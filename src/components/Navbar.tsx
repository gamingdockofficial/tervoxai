import React from 'react';
import {
  Menu,
  Brain,
  Volume2,
  VolumeX,
  Settings,
  Globe,
  ListTodo,
  Code2,
  Sparkles,
} from 'lucide-react';
import { OrbState } from '../types';

interface NavbarProps {
  onToggleSidebar: () => void;
  onOpenMemory: () => void;
  onOpenTasks: () => void;
  onOpenCodeWorkspace: () => void;
  onOpenImageGen: () => void;
  onOpenSettings: () => void;
  memoryCount: number;
  taskCount?: number;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  preferredLanguage: string;
  orbState: OrbState;
  activeSessionTitle?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  onOpenMemory,
  onOpenTasks,
  onOpenCodeWorkspace,
  onOpenImageGen,
  onOpenSettings,
  memoryCount,
  taskCount = 0,
  voiceEnabled,
  onToggleVoice,
  preferredLanguage,
  orbState,
  activeSessionTitle,
}) => {
  const languageLabel = {
    auto: 'Auto',
    en: 'EN',
    ur: 'UR (اردو)',
    'ur-roman': 'Roman Urdu',
    hi: 'HI (हिन्दी)',
    ar: 'AR (العربية)',
    es: 'ES',
    fr: 'FR',
  }[preferredLanguage] || 'Auto';

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between border-b border-cyan-500/15 bg-[#050914]/80 backdrop-blur-md shrink-0 z-20">
      {/* Left: Mobile Sidebar Toggle & Branding */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Toggle Navigation Menu"
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <span className="font-display font-bold text-sm tracking-wider text-white">
            TERVOX AI
          </span>
          <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono uppercase">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                orbState === 'listening'
                  ? 'bg-cyan-400 animate-ping'
                  : orbState === 'thinking'
                  ? 'bg-purple-400 animate-spin'
                  : orbState === 'speaking'
                  ? 'bg-sky-400 animate-bounce'
                  : 'bg-emerald-400'
              }`}
            />
            {orbState}
          </span>
        </div>

        {activeSessionTitle && (
          <span className="hidden md:inline-block text-xs text-slate-400 truncate max-w-xs border-l border-slate-800 pl-3">
            {activeSessionTitle}
          </span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Code Workspace Button */}
        <button
          type="button"
          onClick={onOpenCodeWorkspace}
          title="Open Code & Website Builder Workspace"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/60 hover:bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-300 transition cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-medium hidden sm:inline">Workspace</span>
        </button>

        {/* AI Image Studio Button */}
        <button
          type="button"
          onClick={onOpenImageGen}
          title="AI Image Studio"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/60 hover:bg-purple-950/40 border border-purple-500/20 text-xs text-purple-300 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-[11px] font-medium hidden md:inline">Image AI</span>
        </button>

        {/* Daily Tasks Button */}
        <button
          type="button"
          onClick={onOpenTasks}
          title="Daily Tasks & Reminders"
          className="relative p-2 rounded-xl bg-slate-900/60 hover:bg-cyan-950/40 text-cyan-300 border border-cyan-500/20 transition cursor-pointer flex items-center justify-center"
        >
          <ListTodo className="w-4 h-4 text-cyan-400" />
          {taskCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-950 rounded-full text-[9px] font-bold flex items-center justify-center">
              {taskCount}
            </span>
          )}
        </button>

        {/* Personal Memory Shortcut */}
        <button
          type="button"
          onClick={onOpenMemory}
          title="View Personal Memory"
          className="relative p-2 rounded-xl bg-slate-900/60 hover:bg-cyan-950/40 text-cyan-300 border border-cyan-500/20 transition cursor-pointer flex items-center justify-center"
        >
          <Brain className="w-4 h-4 text-cyan-400" />
          {memoryCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-slate-950 rounded-full text-[9px] font-bold flex items-center justify-center">
              {memoryCount}
            </span>
          )}
        </button>

        {/* Language Indicator Badge */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Response Language (Click to change in Settings)"
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-900/60 hover:bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-300 transition cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px] font-medium hidden sm:inline">{languageLabel}</span>
        </button>

        {/* Voice Toggle */}
        <button
          type="button"
          onClick={onToggleVoice}
          title={voiceEnabled ? 'Mute AI voice output' : 'Enable AI voice output'}
          className={`p-2 rounded-xl border transition cursor-pointer ${
            voiceEnabled
              ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
              : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
          }`}
        >
          {voiceEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>

        {/* Settings Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings"
          className="p-2 rounded-xl bg-slate-900/60 hover:bg-cyan-950/40 text-slate-300 hover:text-white border border-cyan-500/20 transition cursor-pointer"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
