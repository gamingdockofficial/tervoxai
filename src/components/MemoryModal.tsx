import React, { useState, useEffect } from 'react';
import { Memory } from '../types';
import { storage } from '../services/storage';
import {
  Brain,
  Trash2,
  Edit2,
  Plus,
  Save,
  X,
  Sparkles,
  Info,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemoriesUpdated: () => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({
  isOpen,
  onClose,
  onMemoriesUpdated,
}) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState<Memory['category']>('personal');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFact, setEditFact] = useState('');
  const [editCategory, setEditCategory] = useState<Memory['category']>('personal');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen]);

  const loadMemories = async () => {
    const list = await storage.getMemories();
    setMemories(list);
  };

  if (!isOpen) return null;

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;

    const mem: Memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      fact: newFact.trim(),
      category: newCategory,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.saveMemory(mem);
    setNewFact('');
    setIsAdding(false);
    await loadMemories();
    onMemoriesUpdated();
  };

  const handleStartEdit = (m: Memory) => {
    setEditingId(m.id);
    setEditFact(m.fact);
    setEditCategory(m.category);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editFact.trim()) return;
    const existing = memories.find((m) => m.id === id);
    if (!existing) return;

    const updated: Memory = {
      ...existing,
      fact: editFact.trim(),
      category: editCategory,
      updatedAt: Date.now(),
    };

    await storage.saveMemory(updated);
    setEditingId(null);
    await loadMemories();
    onMemoriesUpdated();
  };

  const handleDelete = async (id: string) => {
    await storage.deleteMemory(id);
    await loadMemories();
    onMemoriesUpdated();
  };

  const handleClearAll = async () => {
    await storage.clearAllMemories();
    setConfirmClear(false);
    await loadMemories();
    onMemoriesUpdated();
  };

  const categoryColors: Record<Memory['category'], string> = {
    personal: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
    preference: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    work: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    language: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    goal: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl glass-panel-elevated border border-cyan-500/30 text-slate-100 shadow-2xl overflow-hidden">
        {/* Accent top stripe */}
        <div className="h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-cyan-500/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center glow-cyan">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-white flex items-center gap-2">
                Personal Memory
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-sans border border-cyan-500/30">
                  {memories.length} facts
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Facts and preferences remembered exclusively on this device.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device Privacy Notice */}
        <div className="px-6 py-2.5 bg-cyan-950/30 border-b border-cyan-500/10 flex items-center gap-2.5 text-xs text-cyan-200/90">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Memory is saved locally in IndexedDB. No login or cross-device cloud sync required.
          </span>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {/* Add Memory Button / Form */}
          {!isAdding ? (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-cyan-500/30 hover:border-cyan-400/60 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add a memory manually</span>
            </button>
          ) : (
            <form
              onSubmit={handleAddMemory}
              className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-3"
            >
              <div className="text-xs font-semibold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>New Memory for Tervox AI</span>
              </div>
              <input
                type="text"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                placeholder="e.g. My preferred programming language is TypeScript"
                className="w-full bg-[#060b19] border border-cyan-500/20 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                autoFocus
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Category:</span>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="bg-[#060b19] border border-cyan-500/20 rounded-md px-2 py-1 text-xs text-cyan-300 focus:outline-none"
                  >
                    <option value="personal">Personal</option>
                    <option value="preference">Preference</option>
                    <option value="work">Work/Study</option>
                    <option value="language">Language</option>
                    <option value="goal">Goal</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setNewFact('');
                    }}
                    className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newFact.trim()}
                    className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs disabled:opacity-50"
                  >
                    Save Memory
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Memory List */}
          {memories.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Brain className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-sm">No memories saved yet.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tell Tervox AI "Remember that I live in Lahore and speak Urdu", or add one above!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/30 transition group flex items-start justify-between gap-3"
                >
                  {editingId === m.id ? (
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={editFact}
                        onChange={(e) => setEditFact(e.target.value)}
                        className="w-full bg-[#060b19] border border-cyan-400 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                      />
                      <div className="flex items-center justify-between">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as any)}
                          className="bg-[#060b19] border border-cyan-500/20 rounded-md px-2 py-0.5 text-xs text-cyan-300"
                        >
                          <option value="personal">Personal</option>
                          <option value="preference">Preference</option>
                          <option value="work">Work/Study</option>
                          <option value="language">Language</option>
                          <option value="goal">Goal</option>
                        </select>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(m.id)}
                            className="p-1 text-cyan-400 hover:text-cyan-300"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider ${categoryColors[m.category]}`}
                          >
                            {m.category}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(m.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-normal">
                          {m.fact}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(m)}
                          title="Edit Memory"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          title="Delete Memory"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-cyan-500/10 flex items-center justify-between bg-slate-950/40">
          {memories.length > 0 && (
            <div>
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-300">Are you sure?</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-500"
                  >
                    Yes, delete all
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-red-400/80 hover:text-red-300 flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All Memories</span>
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
