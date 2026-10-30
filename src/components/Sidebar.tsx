import React from 'react';
import { Session } from '../types';
import {
  Plus,
  MessageSquare,
  Trash2,
  Brain,
  Settings,
  X,
  Cpu,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  memoryCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenMemory,
  onOpenSettings,
  memoryCount,
}) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden animate-fade-in"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 sm:w-80 flex flex-col bg-[#050914] border-r border-cyan-500/15 text-slate-200 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-cyan-500/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center glow-cyan">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm tracking-wider text-white">
                TERVOX AI
              </h1>
              <span className="text-[10px] text-cyan-400 tracking-wide font-mono-code uppercase block">
                Personal AI System
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => {
              onNewSession();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-500/40 text-cyan-200 font-medium text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm group"
          >
            <Plus className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Conversation Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Conversations
          </div>

          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-slate-400">
              No previous conversations yet.
            </div>
          ) : (
            sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    if (window.innerWidth < 1024) onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition cursor-pointer ${
                    isActive
                      ? 'bg-cyan-950/60 text-cyan-200 border border-cyan-500/30'
                      : 'hover:bg-slate-900/60 text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-cyan-400' : 'text-slate-500'
                      }`}
                    />
                    <div className="truncate">
                      <span className="truncate block font-medium">
                        {session.title || 'Untitled Session'}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => onDeleteSession(session.id, e)}
                    title="Delete Conversation"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-red-400 hover:bg-slate-800 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Shortcuts (Memory & Settings) */}
        <div className="p-3 border-t border-cyan-500/10 space-y-1 bg-[#040813]">
          {/* Personal Memory Button */}
          <button
            type="button"
            onClick={() => {
              onOpenMemory();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-cyan-950/40 border border-transparent hover:border-cyan-500/20 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Brain className="w-4 h-4 text-cyan-400" />
              <span>Personal Memory</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono-code">
              {memoryCount}
            </span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              if (window.innerWidth < 1024) onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-cyan-950/40 border border-transparent hover:border-cyan-500/20 transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings & Preferences</span>
          </button>
        </div>
      </aside>
    </>
  );
};
