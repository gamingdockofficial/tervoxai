export interface SpeechRecognitionCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onStart?: () => void;
  onEnd: () => void;
}

export interface SpeechSynthesisCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onAmplitude?: (level: number) => void;
}

class SpeechService {
  private recognition: any = null;
  private isListeningActive = false;
  private amplitudeInterval: any = null;
  private resumeKeepAliveTimer: any = null;
  private activeUtterances: SpeechSynthesisUtterance[] = [];
  private isSpeakingActive = false;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
      } catch (e) {
        console.warn('SpeechRecognition initialization failed:', e);
      }
    }
  }

  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public isSpeechSynthesisSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  public startListening(
    callbacks: SpeechRecognitionCallbacks,
    language: string = 'auto'
  ): boolean {
    if (!this.recognition) {
      this.initRecognition();
      if (!this.recognition) {
        callbacks.onError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
        return false;
      }
    }

    try {
      let langTag = 'en-US';
      if (language === 'ur' || language === 'ur-roman') {
        langTag = 'ur-PK';
      } else if (language === 'hi') {
        langTag = 'hi-IN';
      } else if (language === 'ar') {
        langTag = 'ar-SA';
      } else if (language === 'es') {
        langTag = 'es-ES';
      } else if (language === 'fr') {
        langTag = 'fr-FR';
      } else if (typeof navigator !== 'undefined' && navigator.language) {
        langTag = navigator.language;
      }

      this.recognition.lang = langTag;

      this.recognition.onstart = () => {
        this.isListeningActive = true;
        callbacks.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        if (text) {
          callbacks.onResult(text, Boolean(finalTranscript));
        }
      };

      this.recognition.onerror = (event: any) => {
        let msg = 'Speech recognition error occurred.';
        if (event.error === 'not-allowed') {
          msg = 'Microphone permission was denied. Please allow microphone access in your browser.';
        } else if (event.error === 'no-speech') {
          msg = 'No speech was detected. Please try speaking closer to your microphone.';
        } else if (event.error === 'network') {
          msg = 'Network error during speech recognition.';
        }
        this.isListeningActive = false;
        callbacks.onError(msg);
      };

      this.recognition.onend = () => {
        this.isListeningActive = false;
        callbacks.onEnd();
      };

      this.recognition.start();
      return true;
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      callbacks.onError(err.message || 'Could not start microphone listener.');
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListeningActive) {
      try {
        this.recognition.stop();
      } catch (e) {
        // ignore
      }
    }
    this.isListeningActive = false;
  }

  public isListening(): boolean {
    return this.isListeningActive;
  }

  /**
   * Clean text before speech synthesis so it doesn't read markdown formatting or code blocks verbatim
   */
  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, ' [Code block omitted] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~>]/g, '')
      .replace(/https?:\/\/\S+/g, 'link')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split long text into natural sentence chunks to prevent browser speech synthesis timeouts
   */
  private splitIntoSentenceChunks(text: string): string[] {
    // Splits by English and Urdu sentence terminators (. ! ? \n ۔ ؟)
    const rawChunks = text.split(/(?<=[.!?۔؟\n])\s+/);
    const result: string[] = [];

    for (const chunk of rawChunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      // If a sentence chunk is exceptionally long (>200 chars), split by commas or pauses
      if (trimmed.length > 200) {
        const subChunks = trimmed.split(/(?<=[,;،])\s+/);
        for (const sub of subChunks) {
          if (sub.trim()) result.push(sub.trim());
        }
      } else {
        result.push(trimmed);
      }
    }

    return result.length > 0 ? result : [text];
  }

  /**
   * Speak response using Web Speech Synthesis with sentence chunking & Chromium keep-alive
   */
  public speak(
    text: string,
    options: {
      rate?: number;
      voiceName?: string;
      preferredLanguage?: string;
    } = {},
    callbacks?: SpeechSynthesisCallbacks
  ) {
    if (!this.isSpeechSynthesisSupported()) {
      callbacks?.onError?.('Speech synthesis not supported in this browser.');
      return;
    }

    this.stopSpeaking();

    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) {
      callbacks?.onEnd?.();
      return;
    }

    const chunks = this.splitIntoSentenceChunks(cleanText);
    const voices = window.speechSynthesis.getVoices();

    // Pick best available voice
    let selectedVoice: SpeechSynthesisVoice | undefined;
    if (options.voiceName) {
      selectedVoice = voices.find((v) => v.name === options.voiceName);
    }
    if (!selectedVoice && options.preferredLanguage) {
      const prefix = options.preferredLanguage.split('-')[0].toLowerCase();
      selectedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    }

    this.isSpeakingActive = true;
    this.activeUtterances = [];

    // Start amplitude emulation to drive the central Orb
    const startAmplitudeEmulation = () => {
      if (this.amplitudeInterval) clearInterval(this.amplitudeInterval);
      let phase = 0;
      this.amplitudeInterval = setInterval(() => {
        phase += 0.25;
        const naturalNoise = Math.sin(phase * 1.7) * 0.3 + Math.cos(phase * 2.9) * 0.2;
        const baseAmp = 0.5 + Math.sin(phase) * 0.35 + naturalNoise;
        const clamped = Math.max(0.15, Math.min(1.0, baseAmp));
        callbacks?.onAmplitude?.(clamped);
      }, 50);
    };

    // Chromium keep-alive interval: Chrome pauses SpeechSynthesis on long speeches without this
    if (this.resumeKeepAliveTimer) clearInterval(this.resumeKeepAliveTimer);
    this.resumeKeepAliveTimer = setInterval(() => {
      if (this.isSpeakingActive && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 7000);

    let currentChunkIndex = 0;
    callbacks?.onStart?.();
    startAmplitudeEmulation();

    const playNextChunk = () => {
      if (!this.isSpeakingActive) return;

      if (currentChunkIndex >= chunks.length) {
        // Complete speech has genuinely finished
        this.cleanupSpeech();
        callbacks?.onAmplitude?.(0);
        callbacks?.onEnd?.();
        return;
      }

      const chunkText = chunks[currentChunkIndex];
      const utterance = new SpeechSynthesisUtterance(chunkText);
      utterance.rate = options.rate || 1.0;
      if (selectedVoice) utterance.voice = selectedVoice;

      // Keep strong reference in array to prevent GC in Chrome
      this.activeUtterances.push(utterance);

      utterance.onend = () => {
        currentChunkIndex++;
        playNextChunk();
      };

      utterance.onerror = (e) => {
        console.warn('Speech synthesis chunk error:', e);
        currentChunkIndex++;
        if (currentChunkIndex < chunks.length) {
          playNextChunk();
        } else {
          this.cleanupSpeech();
          callbacks?.onAmplitude?.(0);
          callbacks?.onEnd?.();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    playNextChunk();
  }

  public stopSpeaking() {
    this.cleanupSpeech();
    if (this.isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  }

  private cleanupSpeech() {
    this.isSpeakingActive = false;
    this.activeUtterances = [];

    if (this.amplitudeInterval) {
      clearInterval(this.amplitudeInterval);
      this.amplitudeInterval = null;
    }

    if (this.resumeKeepAliveTimer) {
      clearInterval(this.resumeKeepAliveTimer);
      this.resumeKeepAliveTimer = null;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.isSpeechSynthesisSupported()) return [];
    return window.speechSynthesis.getVoices();
  }
}

export const speechService = new SpeechService();
