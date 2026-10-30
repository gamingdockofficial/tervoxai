export type LiveVoiceState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface LiveAudioCallbacks {
  onStateChange: (state: LiveVoiceState) => void;
  onAmplitude: (amplitude: number) => void;
  onTranscription: (text: string, isUser: boolean, isFinal: boolean) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

// Convert Float32Array to 16-bit Little-Endian Linear PCM Base64 string
function floatTo16BitPCMBase64(input: Float32Array): string {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert 16-bit Little-Endian Linear PCM Base64 to Float32Array for Web Audio API playback
function base64To16BitFloat(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const float32 = new Float32Array(bytes.length / 2);
  for (let i = 0; i < float32.length; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768.0;
  }
  return float32;
}

export class LiveAudioSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  private state: LiveVoiceState = 'disconnected';
  private callbacks: LiveAudioCallbacks;
  private apiKey?: string;

  // Playback queue & scheduling
  private nextStartTime: number = 0;
  private totalPlaybackEndTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private accumulatedUserText: string = '';
  private accumulatedModelText: string = '';

  private isUserSpeaking = false;
  private isModelSpeaking = false;
  private isServerTurnComplete = false;
  private silenceTimer: any = null;
  private drainageTimer: any = null;
  private echoCooldownUntil: number = 0;
  private isConnected = false;

  constructor(callbacks: LiveAudioCallbacks, apiKey?: string) {
    this.callbacks = callbacks;
    this.apiKey = apiKey;
  }

  public getState(): LiveVoiceState {
    return this.state;
  }

  public async start(): Promise<boolean> {
    if (this.state === 'connecting' || this.state === 'listening' || this.state === 'speaking') {
      console.warn('[LiveAudio] Session already active or connecting. Resetting existing before start.');
      this.cleanup(false);
    }

    this.setState('connecting');
    console.log('[LiveAudio] Starting real-time voice session...');

    // 1. Request microphone permission
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('BROWSER_UNSUPPORTED_MEDIA');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (micErr: any) {
      console.error('[LiveAudio] Microphone permission error:', micErr);
      this.setState('error');
      let msg = 'Microphone access failed. Please enable microphone permissions in your browser.';
      if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
        msg = 'Microphone permission was denied. Please allow microphone access in your browser address bar to use Voice Chat.';
      } else if (micErr.name === 'NotFoundError') {
        msg = 'No microphone device was detected on your system. Please connect a microphone.';
      } else if (micErr.message === 'BROWSER_UNSUPPORTED_MEDIA') {
        msg = 'Your browser does not support audio recording. Please use Chrome, Edge, or Firefox.';
      }
      this.callbacks.onError(msg);
      this.cleanup(false);
      return false;
    }

    // 2. Set up Input & Output AudioContexts
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });

      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }
      this.nextStartTime = this.outputAudioCtx.currentTime;

      this.analyser = this.outputAudioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      this.analyser.connect(this.outputAudioCtx.destination);
      this.startAmplitudeLoop();
    } catch (audioCtxErr: any) {
      console.error('[LiveAudio] AudioContext init error:', audioCtxErr);
      this.setState('error');
      this.callbacks.onError('Failed to initialize Web Audio system in your browser.');
      this.cleanup(false);
      return false;
    }

    // 3. Connect WebSocket with full handshake promise
    return new Promise<boolean>((resolve) => {
      let handshakeComplete = false;
      const handshakeTimeout = setTimeout(() => {
        if (!handshakeComplete) {
          handshakeComplete = true;
          console.warn('[LiveAudio] Handshake timed out after 8s');
          this.setState('error');
          this.callbacks.onError('Voice connection timed out. Please check your network connection or Gemini API key.');
          this.cleanup(false);
          resolve(false);
        }
      }, 8000);

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/live${
          this.apiKey ? `?apiKey=${encodeURIComponent(this.apiKey)}` : ''
        }`;

        console.log(`[LiveAudio] Connecting WebSocket to ${protocol}//${window.location.host}/api/live`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[LiveAudio] WebSocket connection opened to /api/live');
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'ready') {
              if (!handshakeComplete) {
                handshakeComplete = true;
                clearTimeout(handshakeTimeout);
                this.isConnected = true;
                this.setState('listening');
                console.log('[LiveAudio] Gemini Live session is connected & ready!');
                resolve(true);
              }
            } else if (msg.type === 'error') {
              if (!handshakeComplete) {
                handshakeComplete = true;
                clearTimeout(handshakeTimeout);
                this.setState('error');
                this.callbacks.onError(msg.message || 'Error occurred while initializing voice connection.');
                this.cleanup(false);
                resolve(false);
              } else {
                this.handleServerMessage(msg);
              }
              return;
            }

            this.handleServerMessage(msg);
          } catch (e) {
            console.warn('[LiveAudio] Failed to parse server message', e);
          }
        };

        this.ws.onerror = (e) => {
          console.error('[LiveAudio] WebSocket error event:', e);
          if (!handshakeComplete) {
            handshakeComplete = true;
            clearTimeout(handshakeTimeout);
            this.setState('error');
            this.callbacks.onError('Unable to connect to live voice server. Please check your network or Gemini API key.');
            this.cleanup(false);
            resolve(false);
          } else {
            this.setState('error');
            this.callbacks.onError('Connection error encountered during active voice session.');
          }
        };

        this.ws.onclose = (event) => {
          console.log('[LiveAudio] WebSocket closed. Code:', event.code, 'Reason:', event.reason);
          if (!handshakeComplete) {
            handshakeComplete = true;
            clearTimeout(handshakeTimeout);
            this.setState('error');
            this.callbacks.onError('Voice connection was closed by server. Please check your Gemini API key and quota.');
            this.cleanup(false);
            resolve(false);
          } else {
            // Only notify close if this wasn't an abrupt error
            if (this.state !== 'error') {
              this.cleanup(true);
            } else {
              this.cleanup(false);
            }
          }
        };

        // 4. Connect Mic Input Processing
        if (this.mediaStream && this.inputAudioCtx) {
          const source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
          this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
          source.connect(this.scriptProcessor);
          this.scriptProcessor.connect(this.inputAudioCtx.destination);

          this.scriptProcessor.onaudioprocess = (e) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);

            // Calculate RMS audio energy for VAD (Voice Activity Detection)
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
              sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);

            const now = Date.now();
            const isEchoSuppressionActive = this.isModelSpeaking || now < this.echoCooldownUntil;

            // Mic amplitude visualization when user is speaking
            if (!this.isModelSpeaking) {
              const normalizedAmp = Math.min(1.0, rms * 4.5);
              this.callbacks.onAmplitude(normalizedAmp);
            }

            // Echo protection: Do NOT send audio frames while model is actively speaking
            if (isEchoSuppressionActive) {
              return;
            }

            const speechThreshold = 0.016;
            if (rms > speechThreshold) {
              if (!this.isUserSpeaking) {
                this.isUserSpeaking = true;
                if (this.state !== 'speaking') {
                  this.setState('listening');
                }
              }
              if (this.silenceTimer) {
                clearTimeout(this.silenceTimer);
                this.silenceTimer = null;
              }
            } else if (this.isUserSpeaking && !this.silenceTimer) {
              this.silenceTimer = setTimeout(() => {
                this.isUserSpeaking = false;
                this.silenceTimer = null;
                if (this.state === 'listening') {
                  this.setState('thinking');
                }
              }, 850);
            }

            // Stream PCM 16kHz base64 frame to Gemini Live
            const base64Audio = floatTo16BitPCMBase64(inputData);
            this.ws.send(JSON.stringify({ type: 'audio', data: base64Audio }));
          };
        }
      } catch (wsErr: any) {
        console.error('[LiveAudio] WebSocket creation error:', wsErr);
        if (!handshakeComplete) {
          handshakeComplete = true;
          clearTimeout(handshakeTimeout);
          this.setState('error');
          this.callbacks.onError(wsErr.message || 'Failed to establish WebSocket voice connection.');
          this.cleanup(false);
          resolve(false);
        }
      }
    });
  }

  private handleServerMessage(msg: any) {
    switch (msg.type) {
      case 'ready':
        console.log('[LiveAudio] Gemini Live session is ready and listening!');
        this.setState('listening');
        break;

      case 'audio':
        if (msg.data) {
          this.playAudioChunk(msg.data);
        }
        break;

      case 'outputTranscription':
        if (msg.text) {
          this.accumulatedModelText += msg.text;
          this.callbacks.onTranscription(this.accumulatedModelText, false, false);
        }
        break;

      case 'inputTranscription':
        if (msg.text) {
          this.accumulatedUserText += msg.text;
          this.callbacks.onTranscription(this.accumulatedUserText, true, false);
        }
        break;

      case 'interrupted':
        console.log('[LiveAudio] Model signaled interruption');
        this.interruptPlayback();
        this.setState('listening');
        break;

      case 'turnComplete':
        console.log('[LiveAudio] Server turnComplete signal received');
        this.isServerTurnComplete = true;

        if (this.accumulatedModelText) {
          this.callbacks.onTranscription(this.accumulatedModelText, false, true);
          this.accumulatedModelText = '';
        }
        if (this.accumulatedUserText) {
          this.callbacks.onTranscription(this.accumulatedUserText, true, true);
          this.accumulatedUserText = '';
        }

        this.checkPlaybackCompletion();
        break;

      case 'error':
        console.error('[LiveAudio] Server reported error:', msg.message);
        this.setState('error');
        this.callbacks.onError(msg.message || 'Error occurred in live voice session.');
        break;

      case 'closed':
        this.cleanup(true);
        break;
    }
  }

  // Playback raw 24kHz PCM chunks with gapless buffer queue scheduling
  private playAudioChunk(base64Pcm: string) {
    if (!this.outputAudioCtx || !this.analyser) return;

    try {
      if (this.outputAudioCtx.state === 'suspended') {
        this.outputAudioCtx.resume().catch(() => {});
      }

      const float32Data = base64To16BitFloat(base64Pcm);
      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.analyser);

      const currentTime = this.outputAudioCtx.currentTime;

      // If starting fresh or after silence, add an 80ms lead buffer to prevent underruns
      let startTime = this.nextStartTime;
      if (startTime < currentTime) {
        startTime = currentTime + 0.08;
      }

      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;
      this.totalPlaybackEndTime = this.nextStartTime;

      this.isModelSpeaking = true;
      this.isServerTurnComplete = false;
      this.setState('speaking');
      this.activeSources.push(source);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }
        this.checkPlaybackCompletion();
      };
    } catch (e) {
      console.warn('[LiveAudio] Playback error for chunk', e);
    }
  }

  // Safely checks if all queued audio chunks have genuinely finished playing
  private checkPlaybackCompletion() {
    if (!this.outputAudioCtx) return;

    if (this.drainageTimer) {
      clearTimeout(this.drainageTimer);
      this.drainageTimer = null;
    }

    const currentTime = this.outputAudioCtx.currentTime;
    const remainingTime = this.totalPlaybackEndTime - currentTime;

    if (this.isServerTurnComplete && remainingTime <= 0.05 && this.activeSources.length === 0) {
      // Audio has completely drained and finished
      this.isModelSpeaking = false;
      this.echoCooldownUntil = Date.now() + 400; // 400ms echo cooldown
      this.callbacks.onAmplitude(0);
      if (this.state === 'speaking') {
        this.setState('listening');
      }
    } else if (this.isServerTurnComplete && remainingTime > 0) {
      // Wait for the remaining scheduled audio to finish playing
      this.drainageTimer = setTimeout(() => {
        this.checkPlaybackCompletion();
      }, Math.max(50, Math.round(remainingTime * 1000) + 20));
    }
  }

  // Interrupt model speech immediately (cancel queued buffers)
  public interruptPlayback() {
    console.log('[LiveAudio] Interrupting audio playback');
    this.activeSources.forEach((s) => {
      try {
        s.stop();
        s.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
      this.totalPlaybackEndTime = this.nextStartTime;
    }
    this.isModelSpeaking = false;
    this.isServerTurnComplete = true;
    this.echoCooldownUntil = Date.now() + 250;
    this.callbacks.onAmplitude(0);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'interrupt' }));
    }
  }

  // Send typed text prompt into the ongoing Live session
  public sendTextPrompt(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && text.trim()) {
      this.ws.send(JSON.stringify({ type: 'text', text: text.trim() }));
      this.setState('thinking');
    }
  }

  // Amplitude monitor loop for central Orb synchronization
  private startAmplitudeLoop() {
    const dataArray = new Uint8Array(128);
    const loop = () => {
      if (this.analyser && this.isModelSpeaking) {
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, (avg / 128.0) * 1.5);
        this.callbacks.onAmplitude(normalized);
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  private setState(newState: LiveVoiceState) {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange(newState);
    }
  }

  public stop() {
    console.log('[LiveAudio] Stopping voice call session by user request');
    this.cleanup(true);
  }

  private cleanup(notifyClose = true) {
    this.interruptPlayback();

    if (this.drainageTimer) {
      clearTimeout(this.drainageTimer);
      this.drainageTimer = null;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.callbacks.onAmplitude(0);
    this.isConnected = false;

    if (notifyClose) {
      this.setState('disconnected');
      this.callbacks.onClose();
    }
  }
}
