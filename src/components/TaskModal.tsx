import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  Bell,
  X,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Task } from '../types';
import { storage } from '../services/storage';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  tasks,
  onTasksChange,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    }
  }, [isOpen]);

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        new Notification('Tervox AI Reminders Enabled', {
          body: 'You will receive reminders for scheduled tasks.',
          icon: '/favicon.ico',
        });
      }
    } catch (e) {
      console.warn('Notification permission error', e);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: Task = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      completed: false,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      reminderScheduled: Boolean(dueDate && dueTime),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.saveTask(newTask);
    const updated = [newTask, ...tasks];
    onTasksChange(updated);

    // Reset form
    setTitle('');
    setDescription('');
    setDueDate('');
    setDueTime('');
    setPriority('medium');
    setIsAdding(false);
  };

  const handleToggle = async (taskId: string) => {
    const updatedTask = await storage.toggleTask(taskId);
    if (updatedTask) {
      const updated = tasks.map((t) => (t.id === taskId ? updatedTask : t));
      onTasksChange(updated);
    }
  };

  const handleDelete = async (taskId: string) => {
    await storage.deleteTask(taskId);
    const updated = tasks.filter((t) => t.id !== taskId);
    onTasksChange(updated);
  };

  if (!isOpen) return null;

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'pending' && t.completed) return false;
    if (activeTab === 'completed' && !t.completed) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.length - completedCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ListTodo className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                Daily Tasks & Reminders
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-mono">
                  {pendingCount} active
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Organize your goals, development targets, and daily schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Filter Bar */}
        <div className="px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'all'
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'pending'
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Active ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'completed'
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {notificationPermission !== 'granted' && (
              <button
                onClick={requestNotificationPermission}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors"
                title="Enable browser notifications for reminders"
              >
                <Bell className="w-3.5 h-3.5" />
                Enable Alerts
              </button>
            )}

            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-black bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {isAdding ? 'Cancel' : 'New Task'}
            </button>
          </div>
        </div>

        {/* Task List / Add Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isAdding && (
            <form
              onSubmit={handleAddTask}
              className="p-4 bg-zinc-900/90 border border-cyan-500/30 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 shadow-lg"
            >
              <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Create New Task
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Task title (e.g. Build authentication in React, Finish report...)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <textarea
                  placeholder="Optional details, notes, or subtasks..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] text-zinc-400 mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 mb-1 block">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 mb-1 block">Reminder Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-black rounded-lg transition-colors"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-zinc-800/80 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto text-zinc-500 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-medium text-zinc-300">
                {activeTab === 'completed'
                  ? 'No completed tasks yet'
                  : activeTab === 'pending'
                  ? 'No pending tasks! All caught up.'
                  : 'Your task list is empty'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                Add your learning goals, coding milestones, or daily reminders to keep track with Tervox AI.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.map((task) => {
                const isHigh = task.priority === 'high';
                const isMedium = task.priority === 'medium';
                return (
                  <div
                    key={task.id}
                    className={`group relative flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                      task.completed
                        ? 'bg-zinc-900/30 border-zinc-800/50 opacity-60'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/90 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggle(task.id)}
                        className={`mt-0.5 text-zinc-400 hover:text-cyan-400 transition-colors shrink-0 ${
                          task.completed ? 'text-cyan-400' : ''
                        }`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium break-words ${
                              task.completed
                                ? 'line-through text-zinc-500'
                                : 'text-zinc-200'
                            }`}
                          >
                            {task.title}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-mono uppercase tracking-wider ${
                              isHigh
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : isMedium
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-zinc-400 mt-1 break-words">
                            {task.description}
                          </p>
                        )}

                        {(task.dueDate || task.dueTime) && (
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400">
                            {task.dueDate && (
                              <span className="flex items-center gap-1 text-cyan-400/80">
                                <Calendar className="w-3 h-3" />
                                {task.dueDate}
                              </span>
                            )}
                            {task.dueTime && (
                              <span className="flex items-center gap-1 text-cyan-400/80">
                                <Clock className="w-3 h-3" />
                                {task.dueTime}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800/80 bg-zinc-900/40 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Synced locally via IndexedDB</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
