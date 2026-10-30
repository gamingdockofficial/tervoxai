import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Square,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
  Sparkles,
  Loader2,
  Radio,
  Paperclip,
  X,
  FileText,
  Globe,
  Image as ImageIcon,
} from 'lucide-react';
import { LiveVoiceState } from '../services/liveAudio';
import { Attachment } from '../types';

interface InputBarProps {
  onSendMessage: (text: string, attachments?: Attachment[]) => void;
  isStreaming: boolean;
  onStopGeneration: () => void;
  isListening: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
  // Live Phone-Call Mode
  isLiveCallActive: boolean;
  onStartLiveCall: () => void;
  onEndLiveCall: () => void;
  liveCallState: LiveVoiceState;
  onInterruptLiveCall: () => void;
  // Search Grounding Toggle
  enableSearchGrounding: boolean;
  onToggleSearchGrounding: () => void;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSendMessage,
  isStreaming,
  onStopGeneration,
  isListening,
  onStartListening,
  onStopListening,
  voiceEnabled,
  onToggleVoice,
  isSpeaking,
  onStopSpeaking,
  isLiveCallActive,
  onStartLiveCall,
  onEndLiveCall,
  liveCallState,
  onInterruptLiveCall,
  enableSearchGrounding,
  onToggleSearchGrounding,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [inputText]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: Attachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (isImage || isPdf) {
        // Read as Data URL
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const base64 = await base64Promise;
        newAttachments.push({
          id: 'att_' + Date.now() + '_' + i,
          name: file.name,
          type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          size: file.size,
          base64,
        });
      } else {
        // Text / Code / CSV / JSON
        const text = await file.text();
        newAttachments.push({
          id: 'att_' + Date.now() + '_' + i,
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          content: text,
        });
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || isStreaming) return;
    onSendMessage(inputText.trim(), attachments.length > 0 ? attachments : undefined);
    setInputText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const liveStateBadge = {
    connecting: {
      text: 'Connecting Call...',
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: Loader2,
      animate: 'animate-spin',
    },
    listening: {
      text: 'Listening • Speak Naturally',
      color: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
      icon: Radio,
      animate: 'animate-pulse',
    },
    thinking: {
      text: 'Thinking...',
      color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      icon: Sparkles,
      animate: 'animate-spin',
    },
    speaking: {
      text: 'Tervox Speaking',
      color: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
      icon: Volume2,
      animate: 'animate-bounce',
    },
    error: {
      text: 'Connection Error',
      color: 'bg-red-500/20 text-red-300 border-red-500/40',
      icon: Square,
      animate: '',
    },
    disconnected: {
      text: 'Idle',
      color: 'bg-slate-800 text-slate-400 border-slate-700',
      icon: Phone,
      animate: '',
    },
  }[liveCallState] || {
    text: 'Call Active',
    color: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
    icon: Phone,
    animate: '',
  };

  const LiveIcon = liveStateBadge.icon;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 sm:pb-6">
      {/* Live Voice Call Active Floating Banner */}
      {isLiveCallActive && (
        <div
          className={`mb-2.5 p-3 rounded-2xl backdrop-blur-xl border shadow-xl flex items-center justify-between gap-3 animate-fade-in ${
            liveCallState === 'error'
              ? 'bg-[#1a0808]/90 border-red-500/50 shadow-red-950/40'
              : 'bg-[#07132a]/90 border-cyan-500/40 glow-cyan'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`relative flex items-center justify-center w-8 h-8 rounded-xl border ${
                liveCallState === 'error'
                  ? 'bg-red-500/20 border-red-400/50 text-red-400'
                  : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-400'
              }`}
            >
              {liveCallState === 'error' ? (
                <Square className="w-4 h-4 text-red-400" />
              ) : (
                <>
                  <Phone className="w-4 h-4 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                </>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-xs tracking-wider text-white">
                  VOICE CHAT
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${liveStateBadge.color}`}
                >
                  <LiveIcon className={`w-3 h-3 ${liveStateBadge.animate}`} />
                  <span>{liveStateBadge.text}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {liveCallState === 'error'
                  ? 'Voice connection was interrupted or failed. You can retry below.'
                  : 'Bidirectional real-time voice with automatic speech detection.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {liveCallState === 'error' ? (
              <>
                <button
                  type="button"
                  onClick={onStartLiveCall}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-semibold cursor-pointer transition shadow-md flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Retry Voice</span>
                </button>
                <button
                  type="button"
                  onClick={onEndLiveCall}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer transition"
                >
                  Dismiss
                </button>
              </>
            ) : (
              <>
                {liveCallState === 'speaking' && (
                  <button
                    type="button"
                    onClick={onInterruptLiveCall}
                    title="Interrupt Tervox"
                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-medium cursor-pointer transition flex items-center gap-1.5"
                  >
                    <Square className="w-3 h-3 fill-cyan-300" />
                    <span className="hidden sm:inline">Interrupt</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onEndLiveCall}
                  title="End Voice Call"
                  className="px-3 py-1.5 rounded-xl bg-red-600/80 hover:bg-red-500 border border-red-400/50 text-white text-xs font-semibold cursor-pointer transition shadow-md flex items-center gap-1.5"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End Call</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Legacy speech-to-text banner (if using single-turn mic) */}
      {!isLiveCallActive && isListening && (
        <div className="mb-2 px-4 py-2 rounded-xl bg-cyan-950/80 border border-cyan-400/40 text-cyan-200 text-xs flex items-center justify-between gap-3 shadow-lg glow-cyan animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-medium tracking-wide">Listening to speech... Speak now</span>
          </div>
          <button
            type="button"
            onClick={onStopListening}
            className="px-2.5 py-1 rounded-md bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-100 text-xs font-semibold cursor-pointer border border-cyan-400/30"
          >
            Done
          </button>
        </div>
      )}

      {/* Legacy TTS Speaking banner */}
      {!isLiveCallActive && isSpeaking && (
        <div className="mb-2 px-4 py-2 rounded-xl bg-sky-950/80 border border-sky-400/40 text-sky-200 text-xs flex items-center justify-between gap-3 shadow-lg glow-cyan animate-fade-in">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-sky-400 animate-bounce" />
            <span>Tervox AI is speaking...</span>
          </div>
          <button
            type="button"
            onClick={onStopSpeaking}
            className="px-2.5 py-1 rounded-md bg-sky-500/20 hover:bg-sky-500/40 text-sky-100 text-xs font-semibold cursor-pointer border border-sky-400/30 flex items-center gap-1"
          >
            <Square className="w-3 h-3 fill-sky-300" />
            <span>Interrupt</span>
          </button>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.ts,.html,.css,.py,.c,.cpp,.java"
        className="hidden"
      />

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="mb-2 p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center gap-2 overflow-x-auto shadow-lg">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 shrink-0"
            >
              {att.base64 ? (
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className="max-w-[120px] truncate">{att.name}</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {Math.round(att.size / 1024)}KB
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="p-0.5 text-zinc-400 hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Glass Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-end gap-2 p-2 rounded-2xl glass-panel-elevated border border-cyan-500/25 shadow-2xl focus-within:border-cyan-400/60 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all duration-200"
      >
        {/* Live Call Toggle Button (Phone Icon) */}
        <button
          type="button"
          onClick={isLiveCallActive ? onEndLiveCall : onStartLiveCall}
          title={isLiveCallActive ? 'End Live Voice Call' : 'Start Live Phone-Call Voice Conversation'}
          className={`p-3 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer ${
            isLiveCallActive
              ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-lg glow-cyan'
              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400/50 shadow-sm'
          }`}
        >
          {isLiveCallActive ? (
            <PhoneOff className="w-5 h-5 text-red-400" />
          ) : (
            <Phone className="w-5 h-5 text-emerald-400 hover:scale-105 transition-transform" />
          )}
        </button>

        {/* Paperclip File Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image, document, or code file"
          className="p-3 rounded-xl bg-zinc-900/60 hover:bg-cyan-950/50 text-zinc-400 hover:text-cyan-300 border border-zinc-800 hover:border-cyan-500/30 transition flex items-center justify-center shrink-0 cursor-pointer"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Quick Dictate Mic Button */}
        {!isLiveCallActive && (
          <button
            type="button"
            onClick={isListening ? onStopListening : onStartListening}
            title={isListening ? 'Stop dictation' : 'Speech-to-text dictation'}
            className={`p-3 rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer ${
              isListening
                ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                : 'bg-cyan-950/50 hover:bg-cyan-900/50 text-cyan-300 hover:text-cyan-200 border border-cyan-500/20'
            }`}
          >
            {isListening ? (
              <MicOff className="w-5 h-5 text-red-400" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        )}

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isLiveCallActive
              ? 'Type a message to inject into call, or just speak...'
              : 'Ask Tervox in Urdu, Roman Urdu, Hindi, English...'
          }
          className="flex-1 bg-transparent border-0 text-slate-100 placeholder-slate-400 text-sm focus:outline-none resize-none py-2.5 px-2 max-h-36 leading-relaxed"
          disabled={isStreaming}
        />

        {/* Action Controls (Voice output, Search toggle, Send / Stop) */}
        <div className="flex items-center gap-1.5 shrink-0 pb-0.5">
          {/* Web Search Grounding Toggle */}
          <button
            type="button"
            onClick={onToggleSearchGrounding}
            title={enableSearchGrounding ? 'Google Search Grounding: ON' : 'Google Search Grounding: OFF'}
            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-1 ${
              enableSearchGrounding
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
          >
            <Globe className="w-4 h-4" />
          </button>

          {/* Quick Voice Output Mute / Unmute */}
          <button
            type="button"
            onClick={onToggleVoice}
            title={voiceEnabled ? 'Voice output enabled' : 'Voice output muted'}
            className={`p-2.5 rounded-xl transition cursor-pointer ${
              voiceEnabled
                ? 'text-cyan-400 hover:bg-cyan-950/50'
                : 'text-slate-500 hover:text-slate-400 hover:bg-slate-800/40'
            }`}
          >
            {voiceEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* Stop Generating or Send Button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={onStopGeneration}
              title="Stop generating"
              className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 cursor-pointer transition flex items-center justify-center shadow-lg"
            >
              <Square className="w-4 h-4 fill-red-400 text-red-400" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputText.trim() && attachments.length === 0}
              title="Send message"
              className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-md shadow-cyan-500/20 flex items-center justify-center"
            >
              <Send className="w-4 h-4 text-slate-950" />
            </button>
          )}
        </div>
      </form>

      {/* Helpful micro-copy */}
      <div className="mt-2 text-center text-[11px] text-slate-400 flex items-center justify-center gap-3">
        <span>Click <strong className="text-emerald-400">Phone Call</strong> for real-time AI conversation</span>
        <span>•</span>
        <span className={enableSearchGrounding ? 'text-cyan-400' : 'text-slate-500'}>
          Web Search {enableSearchGrounding ? 'Enabled' : 'Off'}
        </span>
      </div>
    </div>
  );
};
