import { Session, Message, Memory, UserSettings, Task } from '../types';

const DB_NAME = 'TervoxAIDB';
const DB_VERSION = 2;

const DEFAULT_SETTINGS: UserSettings = {
  apiKey: '',
  isKeyVerified: false,
  preferredLanguage: 'auto',
  voiceEnabled: true,
  speechRate: 1.0,
  selectedVoiceName: '',
  reducedMotion: false,
  autoSpeakResponse: false,
  hasSeenWelcome: false,
  memoryEnabled: true,
  personalityPreset: 'friendly',
  responseLength: 'balanced',
  enableSearchGrounding: true,
};

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isIndexedDBAvailable: boolean = typeof window !== 'undefined' && 'indexedDB' in window;

  constructor() {
    if (this.isIndexedDBAvailable) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('sessions')) {
            const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
            sessionStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }

          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
            messageStore.createIndex('sessionId', 'sessionId', { unique: false });
            messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          if (!db.objectStoreNames.contains('memories')) {
            const memoryStore = db.createObjectStore('memories', { keyPath: 'id' });
            memoryStore.createIndex('category', 'category', { unique: false });
            memoryStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }

          if (!db.objectStoreNames.contains('tasks')) {
            const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
            taskStore.createIndex('createdAt', 'createdAt', { unique: false });
            taskStore.createIndex('completed', 'completed', { unique: false });
          }

          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => {
          console.warn('IndexedDB failed to open, falling back to localStorage', e);
          this.isIndexedDBAvailable = false;
          reject(e);
        };
      } catch (err) {
        console.warn('IndexedDB initialization exception, fallback to localStorage', err);
        this.isIndexedDBAvailable = false;
        reject(err);
      }
    });

    return this.dbPromise;
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isIndexedDBAvailable) return null;
    try {
      return await this.initDB();
    } catch {
      return null;
    }
  }

  // --- SESSIONS ---
  async getSessions(): Promise<Session[]> {
    const db = await this.getDB();
    if (!db) {
      const raw = localStorage.getItem('tervox_sessions');
      return raw ? JSON.parse(raw) : [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('sessions', 'readonly');
      const store = transaction.objectStore('sessions');
      const index = store.index('updatedAt');
      const request = index.getAll();

      request.onsuccess = () => {
        const results: Session[] = request.result || [];
        // Sort descending (most recent first)
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  }

  async saveSession(session: Session): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const sessions = await this.getSessions();
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) sessions[idx] = session;
      else sessions.unshift(session);
      localStorage.setItem('tervox_sessions', JSON.stringify(sessions));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const sessions = (await this.getSessions()).filter((s) => s.id !== sessionId);
      localStorage.setItem('tervox_sessions', JSON.stringify(sessions));
      await this.deleteMessagesBySession(sessionId);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sessions', 'messages'], 'readwrite');
      const sessionStore = transaction.objectStore('sessions');
      sessionStore.delete(sessionId);

      // Delete associated messages
      const messageStore = transaction.objectStore('messages');
      const index = messageStore.index('sessionId');
      const request = index.openCursor(IDBKeyRange.only(sessionId));

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // --- MESSAGES ---
  async getMessagesBySession(sessionId: string): Promise<Message[]> {
    const db = await this.getDB();
    if (!db) {
      const raw = localStorage.getItem(`tervox_msgs_${sessionId}`);
      return raw ? JSON.parse(raw) : [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('messages', 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('sessionId');
      const request = index.getAll(sessionId);

      request.onsuccess = () => {
        const messages: Message[] = request.result || [];
        messages.sort((a, b) => a.timestamp - b.timestamp);
        resolve(messages);
      };
      request.onerror = () => resolve([]);
    });
  }

  async saveMessage(message: Message): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const msgs = await this.getMessagesBySession(message.sessionId);
      msgs.push(message);
      localStorage.setItem(`tervox_msgs_${message.sessionId}`, JSON.stringify(msgs));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const request = store.put(message);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMessagesBySession(sessionId: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      localStorage.removeItem(`tervox_msgs_${sessionId}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('messages', 'readwrite');
      const store = transaction.objectStore('messages');
      const index = store.index('sessionId');
      const request = index.openCursor(IDBKeyRange.only(sessionId));

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- MEMORIES ---
  async getMemories(): Promise<Memory[]> {
    const db = await this.getDB();
    if (!db) {
      const raw = localStorage.getItem('tervox_memories');
      return raw ? JSON.parse(raw) : [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('memories', 'readonly');
      const store = transaction.objectStore('memories');
      const request = store.getAll();

      request.onsuccess = () => {
        const results: Memory[] = request.result || [];
        results.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  }

  async saveMemory(memory: Memory): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const memories = await this.getMemories();
      const idx = memories.findIndex((m) => m.id === memory.id);
      if (idx >= 0) memories[idx] = memory;
      else memories.unshift(memory);
      localStorage.setItem('tervox_memories', JSON.stringify(memories));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('memories', 'readwrite');
      const store = transaction.objectStore('memories');
      const request = store.put(memory);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMemory(memoryId: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const memories = (await this.getMemories()).filter((m) => m.id !== memoryId);
      localStorage.setItem('tervox_memories', JSON.stringify(memories));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('memories', 'readwrite');
      const store = transaction.objectStore('memories');
      const request = store.delete(memoryId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllMemories(): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      localStorage.removeItem('tervox_memories');
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('memories', 'readwrite');
      const store = transaction.objectStore('memories');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- SETTINGS ---
  async getSettings(): Promise<UserSettings> {
    try {
      const raw = localStorage.getItem('tervox_settings');
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Failed to parse settings from localStorage', e);
    }
    return DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem('tervox_settings', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
    return updated;
  }

  // --- TASKS ---
  async getTasks(): Promise<Task[]> {
    const db = await this.getDB();
    if (!db) {
      const raw = localStorage.getItem('tervox_tasks');
      return raw ? JSON.parse(raw) : [];
    }

    return new Promise((resolve) => {
      const transaction = db.transaction('tasks', 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.getAll();

      request.onsuccess = () => {
        const results: Task[] = request.result || [];
        results.sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  }

  async saveTask(task: Task): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const tasks = await this.getTasks();
      const idx = tasks.findIndex((t) => t.id === task.id);
      if (idx >= 0) tasks[idx] = task;
      else tasks.unshift(task);
      localStorage.setItem('tervox_tasks', JSON.stringify(tasks));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tasks', 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.put(task);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTask(taskId: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      const tasks = (await this.getTasks()).filter((t) => t.id !== taskId);
      localStorage.setItem('tervox_tasks', JSON.stringify(tasks));
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction('tasks', 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.delete(taskId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async toggleTask(taskId: string): Promise<Task | null> {
    const tasks = await this.getTasks();
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return null;
    const updated: Task = { ...target, completed: !target.completed, updatedAt: Date.now() };
    await this.saveTask(updated);
    return updated;
  }

  async clearAllData(): Promise<void> {
    const db = await this.getDB();
    if (db) {
      const transaction = db.transaction(['sessions', 'messages', 'memories', 'tasks'], 'readwrite');
      transaction.objectStore('sessions').clear();
      transaction.objectStore('messages').clear();
      transaction.objectStore('memories').clear();
      if (transaction.objectStoreNames.contains('tasks')) {
        transaction.objectStore('tasks').clear();
      }
    }
    localStorage.clear();
  }
}

export const storage = new StorageService();
