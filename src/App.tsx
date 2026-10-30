import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Session,
  Message,
  Memory,
  UserSettings,
  OrbState,
  Task,
  Attachment,
  GroundingSource,
  GeneratedImage,
} from './types';
import { storage } from './services/storage';
import { gemini } from './services/gemini';
import { speechService } from './services/speech';
import { LiveAudioSession, LiveVoiceState } from './services/liveAudio';
import { Orb } from './components/Orb';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { InputBar } from './components/InputBar';
import { ActivationModal } from './components/ActivationModal';
import { MemoryModal } from './components/MemoryModal';
import { SettingsModal } from './components/SettingsModal';
import { TaskModal } from './components/TaskModal';
import { CodeWorkspaceModal } from './components/CodeWorkspaceModal';
import { ImageGenModal } from './components/ImageGenModal';
import { Sparkles, Brain, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Settings & Activation
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // New Feature Modals
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showCodeWorkspace, setShowCodeWorkspace] = useState(false);
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [workspaceData, setWorkspaceData] = useState<{
    code: string;
    language: string;
    fileName?: string;
  }>({ code: '', language: 'html', fileName: 'index.html' });

  // Tasks State
  const [tasks, setTasks] = useState<Task[]>([]);

  // Sessions & Messages
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);

  // Orb and Voice State
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [orbAmplitude, setOrbAmplitude] = useState<number>(0);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Real-Time Live Voice Call State (Gemini Live API)
  const [isLiveCallActive, setIsLiveCallActive] = useState<boolean>(false);
  const [liveCallState, setLiveCallState] = useState<LiveVoiceState>('disconnected');
  const liveAudioRef = useRef<LiveAudioSession | null>(null);

  // Streaming State
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  // UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    const initializeApp = async () => {
      const userSettings = await storage.getSettings();
      setSettings(userSettings);

      const memList = await storage.getMemories();
      setMemories(memList);

      const taskList = await storage.getTasks();
      setTasks(taskList);

      const sessionList = await storage.getSessions();
      setSessions(sessionList);

      // If user hasn't verified their key, show activation modal
      if (!userSettings.isKeyVerified) {
        setShowActivationModal(true);
      }

      // Restore active session or pick most recent
      if (sessionList.length > 0) {
        const firstSession = sessionList[0];
        setActiveSessionId(firstSession.id);
        const msgs = await storage.getMessagesBySession(firstSession.id);
        setMessages(msgs);
      } else {
        await createNewSession();
      }
    };

    initializeApp();

    // Task reminder interval (checks every 30 seconds)
    const reminderInterval = setInterval(async () => {
      const allTasks = await storage.getTasks();
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;

      for (const t of allTasks) {
        if (!t.completed && t.dueDate === currentDate && t.dueTime === currentTime && !t.reminderScheduled) {
          // Trigger reminder
          showToast(`Reminder: ${t.title}`);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(`Tervox Reminder: ${t.title}`, {
              body: t.description || 'Scheduled task due now.',
              icon: '/favicon.ico',
            });
          }
          // Mark reminder triggered
          await storage.saveTask({ ...t, reminderScheduled: true });
          setTasks(await storage.getTasks());
        }
      }
    }, 30000);

    return () => {
      clearInterval(reminderInterval);
      if (liveAudioRef.current) {
        liveAudioRef.current.stop();
      }
    };
  }, []);

  // Show transient toast notification
  const showToast = (text: string) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 3500);
  };

  // Create a new session
  const createNewSession = async () => {
    handleStopGeneration();
    handleStopSpeaking();
    handleStopListening();
    if (isLiveCallActive) handleEndLiveCall();

    const newId = `session_${Date.now()}`;
    const newSession: Session = {
      id: newId,
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    };

    await storage.saveSession(newSession);
    const updatedSessions = await storage.getSessions();
    setSessions(updatedSessions);
    setActiveSessionId(newId);
    setMessages([]);
  };

  // Switch session
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return;

    handleStopGeneration();
    handleStopSpeaking();
    handleStopListening();
    if (isLiveCallActive) handleEndLiveCall();

    setActiveSessionId(sessionId);
    const msgs = await storage.getMessagesBySession(sessionId);
    setMessages(msgs);
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await storage.deleteSession(sessionId);
    const updatedSessions = await storage.getSessions();
    setSessions(updatedSessions);

    if (sessionId === activeSessionId) {
      if (updatedSessions.length > 0) {
        handleSelectSession(updatedSessions[0].id);
      } else {
        await createNewSession();
      }
    }
  };

  // Clear all conversations
  const handleClearAllHistory = async () => {
    for (const s of sessions) {
      await storage.deleteSession(s.id);
    }
    setSessions([]);
    await createNewSession();
    showToast('Conversation history cleared.');
  };

  // Refresh memories
  const reloadMemories = async () => {
    const list = await storage.getMemories();
    setMemories(list);
  };

  // Handle Settings updates (API key changes, reconnecting active sessions)
  const handleSettingsChanged = (updated: UserSettings) => {
    const keyChanged = updated.apiKey !== settings?.apiKey;
    setSettings(updated);

    if (keyChanged) {
      showToast('API key updated and applied.');
      // If a Live Voice Call is currently running, restart it with the new key seamlessly
      if (isLiveCallActive) {
        handleEndLiveCall();
        setTimeout(() => {
          handleStartLiveCall(updated.apiKey);
        }, 400);
      }
    }
  };

  // Real-Time Voice Conversation Flow (Gemini Live API)
  const handleStartLiveCall = async (overrideApiKey?: string) => {
    handleStopGeneration();
    handleStopSpeaking();
    handleStopListening();

    if (!activeSessionId) await createNewSession();

    setIsLiveCallActive(true);
    setLiveCallState('connecting');
    setOrbState('connecting');

    const keyToUse = overrideApiKey !== undefined ? overrideApiKey : settings?.apiKey;

    const session = new LiveAudioSession(
      {
        onStateChange: (state) => {
          setLiveCallState(state);
          setOrbState(state as any);
        },
        onAmplitude: (amplitude) => {
          setOrbAmplitude(amplitude);
        },
        onTranscription: async (text, isUser, isFinal) => {
          if (!activeSessionId || !text.trim()) return;

          // Append or update live transcript turn in messages
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            const role = isUser ? 'user' : 'assistant';

            if (lastMsg && lastMsg.role === role && !isFinal) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...lastMsg, text };
              return updated;
            }

            if (isFinal) {
              const newMsg: Message = {
                id: `msg_live_${Date.now()}_${isUser ? 'u' : 'a'}`,
                sessionId: activeSessionId,
                role,
                text: text.trim(),
                timestamp: Date.now(),
              };
              storage.saveMessage(newMsg);
              return [...prev, newMsg];
            }

            return prev;
          });

          // Memory extraction on final assistant turn
          if (!isUser && isFinal) {
            gemini.extractMemory(text, text, keyToUse || undefined)
              .then(async (memRes) => {
                if (memRes.hasMemory && memRes.fact) {
                  const newMem: Memory = {
                    id: `mem_${Date.now()}`,
                    fact: memRes.fact,
                    category: (memRes.category as any) || 'personal',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  await storage.saveMemory(newMem);
                  await reloadMemories();
                  showToast(`Remembered: "${memRes.fact}"`);
                }
              })
              .catch(() => {});
          }
        },
        onError: (errMsg) => {
          showToast(errMsg);
          setLiveCallState('error');
          setOrbState('error');

          // If quota reached during live voice call, append error message to active session
          if (errMsg.toLowerCase().includes('quota') || errMsg.includes('429')) {
            if (activeSessionId) {
              const quotaMsg: Message = {
                id: `msg_live_quota_${Date.now()}`,
                sessionId: activeSessionId,
                role: 'assistant',
                text: 'API quota reached. Please add a new API key to continue using Tervox AI.',
                timestamp: Date.now(),
                error: true,
                errorCode: 'QUOTA_EXCEEDED',
              };
              storage.saveMessage(quotaMsg);
              setMessages((prev) => [...prev, quotaMsg]);
            }
          }
        },
        onClose: () => {
          setIsLiveCallActive(false);
          setLiveCallState('disconnected');
          setOrbState('idle');
          setOrbAmplitude(0);
        },
      },
      keyToUse || undefined
    );

    liveAudioRef.current = session;
    const success = await session.start();
    if (success) {
      showToast('Connected to Tervox AI Live Voice Call.');
    } else {
      // Keep error state visible so user can see what failed and click Retry
      setLiveCallState('error');
      setOrbState('error');
    }
  };

  const handleEndLiveCall = () => {
    if (liveAudioRef.current) {
      liveAudioRef.current.stop();
      liveAudioRef.current = null;
    }
    setIsLiveCallActive(false);
    setLiveCallState('disconnected');
    setOrbState('idle');
    setOrbAmplitude(0);
    showToast('Voice call ended.');
  };

  const handleInterruptLiveCall = () => {
    if (liveAudioRef.current) {
      liveAudioRef.current.interruptPlayback();
      setOrbState('listening');
    }
  };

  // Send message flow (Text chat or injecting text into live call)
  const handleSendMessage = async (text: string, attachments?: Attachment[]) => {
    if ((!text.trim() && (!attachments || attachments.length === 0)) || isStreaming || !activeSessionId) return;

    // If a Live Voice Call is currently running, inject the message into the ongoing session
    if (isLiveCallActive && liveAudioRef.current) {
      const userMsg: Message = {
        id: `msg_${Date.now()}_u`,
        sessionId: activeSessionId,
        role: 'user',
        text: text.trim(),
        attachments,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      await storage.saveMessage(userMsg);
      if (text.trim()) {
        liveAudioRef.current.sendTextPrompt(text.trim());
      }
      return;
    }

    handleStopSpeaking();
    if (isListening) handleStopListening();

    const currentSessionId = activeSessionId;

    // Save user message to IndexedDB and update UI
    const userMsg: Message = {
      id: `msg_${Date.now()}_u`,
      sessionId: currentSessionId,
      role: 'user',
      text: text.trim(),
      attachments,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    await storage.saveMessage(userMsg);

    // Update session title if first user message
    if (messages.length === 0) {
      const title = text.trim()
        ? text.trim().slice(0, 36) + (text.length > 36 ? '...' : '')
        : (attachments && attachments[0]?.name) || 'New Conversation';
      const currentSession = sessions.find((s) => s.id === currentSessionId);
      if (currentSession) {
        const updatedSession = { ...currentSession, title, updatedAt: Date.now(), messageCount: 1 };
        await storage.saveSession(updatedSession);
        setSessions(await storage.getSessions());
      }
    }

    setOrbState('thinking');
    setIsStreaming(true);
    setStreamingText('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedText = '';
    let collectedSources: GroundingSource[] = [];

    const apiMessages = newMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      text: m.text,
      attachments: m.attachments,
    }));

    await gemini.streamChat({
      messages: apiMessages,
      apiKey: settings?.apiKey || undefined,
      memories: settings?.memoryEnabled ? memories : [],
      preferredLanguage: settings?.preferredLanguage,
      personalityPreset: settings?.personalityPreset,
      customPersonalityPrompt: settings?.customPersonalityPrompt,
      responseLength: settings?.responseLength,
      enableSearchGrounding: settings?.enableSearchGrounding,
      signal: abortController.signal,
      onChunk: (chunk: string) => {
        setOrbState('speaking');
        accumulatedText += chunk;
        setStreamingText(accumulatedText);
      },
      onSources: (sources) => {
        collectedSources = sources;
      },
      onError: async (error) => {
        setIsStreaming(false);
        setOrbState('idle');

        const errorMsg: Message = {
          id: `msg_${Date.now()}_err`,
          sessionId: currentSessionId,
          role: 'assistant',
          text: error.message || 'Tervox is temporarily busy. Please try again in a moment.',
          timestamp: Date.now(),
          error: true,
          errorCode: error.code,
        };

        const finalMsgs = [...newMessages, errorMsg];
        setMessages(finalMsgs);
        await storage.saveMessage(errorMsg);
      },
      onComplete: async () => {
        setIsStreaming(false);
        setStreamingText('');

        if (accumulatedText.trim()) {
          const assistantMsg: Message = {
            id: `msg_${Date.now()}_a`,
            sessionId: currentSessionId,
            role: 'assistant',
            text: accumulatedText.trim(),
            timestamp: Date.now(),
            sources: collectedSources.length > 0 ? collectedSources : undefined,
          };

          const finalMsgs = [...newMessages, assistantMsg];
          setMessages(finalMsgs);
          await storage.saveMessage(assistantMsg);

          const currentSession = sessions.find((s) => s.id === currentSessionId);
          if (currentSession) {
            const updated = {
              ...currentSession,
              updatedAt: Date.now(),
              lastMessage: accumulatedText.slice(0, 60),
              messageCount: finalMsgs.length,
            };
            await storage.saveSession(updated);
            setSessions(await storage.getSessions());
          }

          if (settings?.voiceEnabled && settings?.autoSpeakResponse) {
            handleSpeakResponse(accumulatedText.trim());
          } else {
            setOrbState('idle');
          }

          if (settings?.memoryEnabled) {
            gemini
              .extractMemory(text, accumulatedText, settings?.apiKey || undefined)
              .then(async (result) => {
                if (result.hasMemory && result.fact) {
                  const newMem: Memory = {
                    id: `mem_${Date.now()}`,
                    fact: result.fact,
                    category: (result.category as any) || 'personal',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  await storage.saveMemory(newMem);
                  await reloadMemories();
                  showToast(`Remembered: "${result.fact}"`);
                }
              })
              .catch(() => {});
          }
        } else {
          setOrbState('idle');
        }
      },
    });
  };

  // Stop streaming generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamingText('');
    setOrbState('idle');
  };

  // Voice output playback (TTS fallback)
  const handleSpeakResponse = (text: string) => {
    if (!settings?.voiceEnabled) return;

    setIsSpeaking(true);
    setOrbState('speaking');

    speechService.speak(
      text,
      {
        rate: settings?.speechRate || 1.0,
        voiceName: settings?.selectedVoiceName,
        preferredLanguage: settings?.preferredLanguage,
      },
      {
        onStart: () => {
          setIsSpeaking(true);
          setOrbState('speaking');
        },
        onEnd: () => {
          setIsSpeaking(false);
          setOrbState('idle');
          setOrbAmplitude(0);
        },
        onError: () => {
          setIsSpeaking(false);
          setOrbState('idle');
          setOrbAmplitude(0);
        },
        onAmplitude: (level) => {
          setOrbAmplitude(level);
        },
      }
    );
  };

  const handleStopSpeaking = () => {
    speechService.stopSpeaking();
    setIsSpeaking(false);
    setOrbAmplitude(0);
    setOrbState('idle');
  };

  // Speech Recognition (Dictate fallback)
  const handleStartListening = () => {
    handleStopSpeaking();
    handleStopGeneration();

    setIsListening(true);
    setOrbState('listening');

    const started = speechService.startListening(
      {
        onStart: () => {
          setIsListening(true);
          setOrbState('listening');
        },
        onResult: (transcript: string, isFinal: boolean) => {
          if (isFinal && transcript.trim()) {
            setIsListening(false);
            speechService.stopListening();
            handleSendMessage(transcript.trim());
          }
        },
        onError: (errMsg: string) => {
          setIsListening(false);
          setOrbState('idle');
          showToast(errMsg);
        },
        onEnd: () => {
          setIsListening(false);
          if (orbState === 'listening') {
            setOrbState('idle');
          }
        },
      },
      settings?.preferredLanguage || 'auto'
    );

    if (!started) {
      setIsListening(false);
      setOrbState('idle');
    }
  };

  const handleStopListening = () => {
    speechService.stopListening();
    setIsListening(false);
    setOrbState('idle');
  };

  const handleToggleVoice = async () => {
    if (!settings) return;
    const newStatus = !settings.voiceEnabled;
    const updated = await storage.saveSettings({ voiceEnabled: newStatus });
    setSettings(updated);
    if (!newStatus) {
      handleStopSpeaking();
    }
    showToast(newStatus ? 'Voice output unmuted' : 'Voice output muted');
  };

  // Interactive Orb Click Handler
  const handleOrbClick = () => {
    if (isLiveCallActive) {
      if (liveCallState === 'speaking') {
        handleInterruptLiveCall();
      } else {
        handleEndLiveCall();
      }
    } else if (isSpeaking) {
      handleStopSpeaking();
    } else if (isListening) {
      handleStopListening();
    } else if (isStreaming) {
      handleStopGeneration();
    } else {
      // Start Real-Time Live Voice Call
      handleStartLiveCall();
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#030712] text-slate-100 cyber-grid relative font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-950/90 border border-cyan-400/40 text-cyan-200 text-xs font-medium shadow-2xl flex items-center gap-2 animate-fade-in glow-cyan">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Sidebar for conversation history */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={createNewSession}
        onDeleteSession={handleDeleteSession}
        onOpenMemory={() => setShowMemoryModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        memoryCount={memories.length}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Navbar */}
        <Navbar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenMemory={() => setShowMemoryModal(true)}
          onOpenTasks={() => setShowTaskModal(true)}
          onOpenCodeWorkspace={() => {
            setWorkspaceData({ code: '', language: 'html', fileName: 'index.html' });
            setShowCodeWorkspace(true);
          }}
          onOpenImageGen={() => setShowImageGenModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          memoryCount={memories.length}
          taskCount={tasks.filter((t) => !t.completed).length}
          voiceEnabled={settings?.voiceEnabled ?? true}
          onToggleVoice={handleToggleVoice}
          preferredLanguage={settings?.preferredLanguage || 'auto'}
          orbState={orbState}
          activeSessionTitle={activeSession?.title}
        />

        {/* Dynamic Orb Center / Header */}
        <div className="shrink-0 pt-3 pb-1 flex flex-col items-center justify-center transition-all duration-300">
          <Orb
            state={orbState}
            amplitude={orbAmplitude}
            reducedMotion={settings?.reducedMotion}
            onClick={handleOrbClick}
            size={messages.length === 0 ? 'lg' : 'sm'}
            isLiveCall={isLiveCallActive}
          />
        </div>

        {/* Chat Stream View */}
        <ChatView
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          onRetry={() => {
            const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
            if (lastUserMsg) {
              handleSendMessage(lastUserMsg.text, lastUserMsg.attachments);
            }
          }}
          onSpeakMessage={handleSpeakResponse}
          onStopSpeaking={handleStopSpeaking}
          isSpeaking={isSpeaking}
          onSuggestionClick={handleSendMessage}
          onOpenApiKeySettings={() => setShowSettingsModal(true)}
          onOpenCodeWorkspace={(code, language, fileName) => {
            setWorkspaceData({
              code: code || '',
              language: language || 'html',
              fileName,
            });
            setShowCodeWorkspace(true);
          }}
        />

        {/* Input Bar with Live Phone Call Controls, Attachments, and Search Toggle */}
        <InputBar
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
          onStopGeneration={handleStopGeneration}
          isListening={isListening}
          onStartListening={handleStartListening}
          onStopListening={handleStopListening}
          voiceEnabled={settings?.voiceEnabled ?? true}
          onToggleVoice={handleToggleVoice}
          isSpeaking={isSpeaking}
          onStopSpeaking={handleStopSpeaking}
          isLiveCallActive={isLiveCallActive}
          onStartLiveCall={handleStartLiveCall}
          onEndLiveCall={handleEndLiveCall}
          liveCallState={liveCallState}
          onInterruptLiveCall={handleInterruptLiveCall}
          enableSearchGrounding={settings?.enableSearchGrounding ?? true}
          onToggleSearchGrounding={async () => {
            const next = !(settings?.enableSearchGrounding ?? true);
            const upd = await storage.saveSettings({ enableSearchGrounding: next });
            setSettings(upd);
            showToast(next ? 'Live Web Search Grounding: ON' : 'Live Web Search Grounding: OFF');
          }}
        />
      </div>

      {/* Activation Screen Modal (First Launch / Setup) */}
      <ActivationModal
        isOpen={showActivationModal}
        onActivated={(maskedKey) => {
          setShowActivationModal(false);
          storage.getSettings().then(setSettings);
          showToast(`Tervox AI Activated (${maskedKey})`);
        }}
        isSettingsMode={settings?.isKeyVerified}
        onClose={() => setShowActivationModal(false)}
      />

      {/* Personal Memory Modal */}
      <MemoryModal
        isOpen={showMemoryModal}
        onClose={() => setShowMemoryModal(false)}
        onMemoriesUpdated={reloadMemories}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSettingsChanged={handleSettingsChanged}
        onChangeKeyRequested={() => setShowActivationModal(true)}
        onClearHistoryRequested={handleClearAllHistory}
        initialTab="api"
      />

      {/* Daily Tasks & Reminders Modal */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        tasks={tasks}
        onTasksChange={setTasks}
      />

      {/* Code Workspace & Website Builder Modal */}
      <CodeWorkspaceModal
        isOpen={showCodeWorkspace}
        onClose={() => setShowCodeWorkspace(false)}
        initialCode={workspaceData.code}
        initialLanguage={workspaceData.language}
        initialFileName={workspaceData.fileName}
      />

      {/* AI Image Studio Modal */}
      <ImageGenModal
        isOpen={showImageGenModal}
        onClose={() => setShowImageGenModal(false)}
        apiKey={settings?.apiKey || ''}
        onImageGenerated={async (img: GeneratedImage) => {
          if (!activeSessionId) return;
          const assistantMsg: Message = {
            id: 'msg_img_' + Date.now(),
            sessionId: activeSessionId,
            role: 'assistant',
            text: `Here is the visual generated for your prompt: "${img.prompt}"`,
            timestamp: Date.now(),
            generatedImage: img,
          };
          setMessages((prev) => [...prev, assistantMsg]);
          await storage.saveMessage(assistantMsg);
          setShowImageGenModal(false);
          showToast('Artwork added to conversation!');
        }}
      />
    </div>
  );
}
