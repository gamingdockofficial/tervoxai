import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  AlertCircle,
  HelpCircle,
  Code2,
  Terminal,
  Key,
  FileCode,
  CheckCheck,
  ExternalLink,
  Globe,
  Download,
  Image as ImageIcon,
  Play,
} from 'lucide-react';

interface ChatViewProps {
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  onRetry: () => void;
  onSpeakMessage: (text: string) => void;
  onStopSpeaking: () => void;
  isSpeaking: boolean;
  onSuggestionClick: (prompt: string) => void;
  onOpenApiKeySettings?: () => void;
  onOpenCodeWorkspace?: (code?: string, language?: string, fileName?: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isStreaming,
  streamingText,
  onRetry,
  onSpeakMessage,
  onStopSpeaking,
  isSpeaking,
  onSuggestionClick,
  onOpenApiKeySettings,
  onOpenCodeWorkspace,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSpeechMsgId, setActiveSpeechMsgId] = useState<string | null>(null);

  // Auto-scroll on new messages or streaming text
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText, isStreaming]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleSpeak = (text: string, id: string) => {
    if (isSpeaking && activeSpeechMsgId === id) {
      onStopSpeaking();
      setActiveSpeechMsgId(null);
    } else {
      setActiveSpeechMsgId(id);
      onSpeakMessage(text);
    }
  };

  // Quick initial suggestions for multilingual, coding & technical capability showcase
  const suggestions = [
    { label: 'Who is your developer?', prompt: 'Who is your developer and creator?' },
    { label: 'Build a Website (HTML/CSS/JS)', prompt: 'Create a complete responsive modern portfolio website with HTML, CSS, and JavaScript. Provide all files separately with proper file names.' },
    { label: 'React & Tailwind Component', prompt: 'Build a complete responsive React and Tailwind CSS admin dashboard component with stats cards and charts.' },
    { label: 'Urdu / Roman Urdu Coding', prompt: 'Mujhe Python mein ek complete automated web scraper bana kar do Roman Urdu mein step-by-step samjhate hue.' },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 space-y-6">
      {/* Empty State / Welcome */}
      {messages.length === 0 && !isStreaming && (
        <div className="max-w-2xl mx-auto my-auto text-center py-6 sm:py-10 space-y-6 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 text-xs font-medium tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Futuristic Multilingual AI & Coding Expert</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-bold font-display text-white tracking-tight">
            How can I assist you today?
          </h2>

          <p className="text-slate-300 text-sm max-w-lg mx-auto leading-relaxed">
            I am <strong className="text-cyan-400 font-semibold">Tervox AI</strong>, created and developed by <strong className="text-white font-semibold">Ibrahim Umair</strong>. Talk to me naturally in Urdu, Roman Urdu, English, Hindi, Arabic, or ask me to build complete websites, mobile apps, and write professional code.
          </p>

          {/* Quick Suggestion Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto pt-2">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSuggestionClick(item.prompt)}
                className="p-3.5 text-left rounded-xl bg-slate-900/60 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 transition group cursor-pointer"
              >
                <div className="text-xs font-semibold text-cyan-300 group-hover:text-cyan-200 transition">
                  {item.label}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                  "{item.prompt}"
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message List */}
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={msg.id}
            className={`flex items-start gap-3 sm:gap-4 max-w-3xl mx-auto ${
              isUser ? 'justify-end' : 'justify-start'
            } animate-fade-in`}
          >
            {/* Assistant Avatar */}
            {!isUser && (
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 mt-1 glow-cyan">
                <Bot className="w-4 h-4" />
              </div>
            )}

            {/* Bubble */}
            <div
              className={`relative group max-w-[88%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 text-sm transition-all ${
                isUser
                  ? 'bg-gradient-to-r from-cyan-600/90 to-blue-600/90 text-white rounded-tr-xs shadow-lg shadow-cyan-900/20'
                  : msg.error
                  ? 'bg-red-950/40 border border-red-500/40 text-red-200 rounded-tl-xs'
                  : 'glass-panel text-slate-100 rounded-tl-xs border border-cyan-500/15 shadow-md'
              }`}
            >
              {/* Message Header for Assistant */}
              {!isUser && (
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-cyan-500/10 text-xs">
                  <span className="font-display font-semibold text-cyan-400 tracking-wider">
                    TERVOX AI
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {/* Message Content */}
              {isUser ? (
                <div>
                  {/* User Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => (
                        <div key={att.id} className="relative rounded-xl overflow-hidden border border-white/20 bg-black/30">
                          {att.base64 && att.type.startsWith('image/') ? (
                            <img
                              src={att.base64}
                              alt={att.name}
                              className="max-h-40 max-w-xs object-cover rounded-xl"
                            />
                          ) : (
                            <div className="px-3 py-2 flex items-center gap-2 text-xs">
                              <FileCode className="w-4 h-4 text-cyan-300" />
                              <span className="font-mono text-[11px]">{att.name}</span>
                              <span className="text-[10px] text-cyan-200/70 font-mono">
                                {Math.round(att.size / 1024)}KB
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
              ) : msg.error ? (
                (() => {
                  const isQuota =
                    msg.errorCode === 'QUOTA_EXCEEDED' ||
                    msg.text?.toLowerCase().includes('quota') ||
                    msg.text?.toLowerCase().includes('resource_exhausted') ||
                    msg.text?.includes('429');

                  const isAuthError =
                    msg.errorCode === 'INVALID_API_KEY' ||
                    msg.errorCode === 'MISSING_API_KEY' ||
                    msg.text?.toLowerCase().includes('invalid') ||
                    msg.text?.toLowerCase().includes('expired');

                  if (isQuota) {
                    return (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="text-xs font-bold text-amber-300 tracking-wide uppercase">
                              API Quota Limit Reached
                            </div>
                            <p className="text-xs text-slate-100 font-semibold leading-relaxed">
                              API quota reached. Please add a new API key to continue using Tervox AI.
                            </p>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Your API quota may have been reached. Add or switch to a valid API key in{' '}
                              <strong className="text-cyan-300">Settings → API Key & Connection</strong>.
                            </p>
                            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[10.5px] text-amber-200/90 leading-relaxed">
                              💡 <strong>Important Note:</strong> Gemini quotas are enforced per Google Cloud project. Keys generated in the <em>same</em> project share this quota. Please use an API key from a <strong>different Google Cloud project</strong>.
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
                          {onOpenApiKeySettings && (
                            <button
                              type="button"
                              onClick={onOpenApiKeySettings}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer transition"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Add New API Key</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={onRetry}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 text-xs text-slate-200 font-medium cursor-pointer transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retry Request</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <p className="leading-relaxed text-xs">{msg.text}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-red-500/20">
                        {isAuthError && onOpenApiKeySettings && (
                          <button
                            type="button"
                            onClick={onOpenApiKeySettings}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs text-cyan-200 font-medium cursor-pointer transition"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Update API Key</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onRetry}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 text-xs text-red-200 font-medium cursor-pointer transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry Request</span>
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-3">
                  <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match && !String(children).includes('\n');
                          const codeString = String(children).replace(/\n$/, '');

                          if (isInline) {
                            return (
                              <code
                                className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 font-mono-code text-[12px] border border-cyan-500/20"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          }

                          // Check if the first line is a file name comment (e.g. // File: index.html or # File: main.py)
                          const lines = codeString.split('\n');
                          const lineCount = lines.length;
                          let fileName: string | null = null;
                          const firstLine = lines[0]?.trim() || '';
                          const fileMatch = firstLine.match(
                            /^(?:\/\/|#|\/\*|<!--)\s*(?:File:\s*|Filename:\s*)?([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i
                          );
                          if (fileMatch) {
                            fileName = fileMatch[1];
                          }

                          const languageLabel = match ? match[1].toUpperCase() : 'CODE';

                          return (
                            <div className="relative my-3 rounded-xl overflow-hidden border border-cyan-500/25 bg-[#050b18] shadow-2xl">
                              {/* Code Header Bar */}
                              <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/95 border-b border-cyan-500/15 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 font-mono-code text-cyan-400 font-semibold text-[11px] bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                                    <Terminal className="w-3 h-3 text-cyan-400" />
                                    <span>{languageLabel}</span>
                                  </span>

                                  {fileName && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-mono-code text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                                      <FileCode className="w-3 h-3 text-cyan-300" />
                                      <span>{fileName}</span>
                                    </span>
                                  )}

                                  <span className="text-[10px] text-slate-500 font-mono-code hidden sm:inline">
                                    {lineCount} {lineCount === 1 ? 'line' : 'lines'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {onOpenCodeWorkspace && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenCodeWorkspace(
                                          codeString,
                                          match ? match[1] : 'html',
                                          fileName || undefined
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 hover:text-cyan-100 border border-cyan-400/30 flex items-center gap-1 text-[11px] font-medium transition cursor-pointer"
                                      title="Open and test in Live Code Workspace"
                                    >
                                      <Play className="w-3 h-3 fill-cyan-400 text-cyan-400" />
                                      <span className="hidden sm:inline">Run Workspace</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopy(codeString, `${msg.id}_code_${languageLabel}`)
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 flex items-center gap-1.5 text-[11px] font-medium transition cursor-pointer"
                                    title="Copy code to clipboard"
                                  >
                                    {copiedId === `${msg.id}_code_${languageLabel}` ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 font-semibold">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy Code</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {/* Code Content */}
                              <pre className="p-4 overflow-x-auto text-xs font-mono-code text-slate-200 leading-relaxed bg-[#050b18] selection:bg-cyan-500/30">
                                <code>{children}</code>
                              </pre>
                            </div>
                          );
                        },
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>

                  {/* Generated Image Preview if attached */}
                  {msg.generatedImage && (
                    <div className="rounded-xl overflow-hidden border border-purple-500/30 bg-purple-950/20 p-2.5 space-y-2">
                      <div className="flex items-center justify-between text-xs text-purple-300">
                        <span className="font-semibold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" /> AI Generated Visual
                        </span>
                        <a
                          href={msg.generatedImage.url}
                          download={`tervox_image_${Date.now()}.png`}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/30 flex items-center gap-1 text-[11px]"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                      </div>
                      <img
                        src={msg.generatedImage.url}
                        alt={msg.generatedImage.prompt}
                        className="rounded-lg max-h-72 w-full object-contain bg-black/50"
                      />
                    </div>
                  )}

                  {/* Google Search Grounding Sources */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-cyan-500/15">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 mb-2">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Live Web Sources Grounding</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-[11px] text-cyan-300 transition-colors shadow-sm"
                          >
                            <span className="max-w-[190px] truncate">{src.title}</span>
                            <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons on Assistant Message */}
              {!isUser && !msg.error && (
                <div className="mt-3 pt-2 border-t border-cyan-500/10 flex items-center justify-end gap-2 text-slate-400">
                  <button
                    type="button"
                    onClick={() => handleToggleSpeak(msg.text, msg.id)}
                    title={
                      isSpeaking && activeSpeechMsgId === msg.id
                        ? 'Stop speaking'
                        : 'Read response out loud'
                    }
                    className={`p-1.5 rounded-lg hover:text-cyan-300 hover:bg-slate-800/60 transition ${
                      isSpeaking && activeSpeechMsgId === msg.id
                        ? 'text-cyan-400 bg-cyan-950/60'
                        : ''
                    }`}
                  >
                    {isSpeaking && activeSpeechMsgId === msg.id ? (
                      <VolumeX className="w-4 h-4 text-cyan-400 animate-pulse" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopy(msg.text, msg.id)}
                    title="Copy response"
                    className="p-1.5 rounded-lg hover:text-cyan-300 hover:bg-slate-800/60 transition"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* User Avatar */}
            {isUser && (
              <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}

      {/* Live Streaming Message */}
      {isStreaming && (
        <div className="flex items-start gap-3 sm:gap-4 max-w-3xl mx-auto justify-start animate-fade-in">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 mt-1 glow-cyan">
            <Bot className="w-4 h-4 animate-spin-slow" />
          </div>

          <div className="relative glass-panel text-slate-100 rounded-2xl rounded-tl-xs p-4 sm:p-5 text-sm max-w-[88%] sm:max-w-[80%] border border-cyan-500/20 shadow-md">
            <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-cyan-500/10 text-xs">
              <span className="font-display font-semibold text-cyan-400 tracking-wider flex items-center gap-1.5">
                TERVOX AI
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </span>
              <span className="text-[10px] text-cyan-300 animate-pulse">Streaming</span>
            </div>

            <div className="prose prose-invert max-w-none text-slate-100 leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {streamingText}
              </ReactMarkdown>
              <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
