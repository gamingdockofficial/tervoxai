export type OrbState =
  | 'idle'
  | 'connecting'
  | 'reconnecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'stopped'
  | 'error';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  base64?: string; // Data URL or Base64 string for images/PDFs
  content?: string; // Extracted text content for code/txt/csv/json files
}

export interface GroundingSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface GeneratedImage {
  id: string;
  url: string; // Base64 data URL
  prompt: string;
  style?: string;
  createdAt: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  language?: string;
  error?: boolean;
  errorCode?: string;
  attachments?: Attachment[];
  sources?: GroundingSource[];
  generatedImage?: GeneratedImage;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
  messageCount: number;
}

export interface Memory {
  id: string;
  fact: string;
  category: 'preference' | 'personal' | 'goal' | 'language' | 'work';
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:MM
  reminderScheduled?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type PersonalityPreset =
  | 'friendly'
  | 'professional'
  | 'teacher'
  | 'coding'
  | 'creative'
  | 'funny'
  | 'custom';

export interface UserSettings {
  apiKey: string; // obfuscated / stored securely in localStorage
  isKeyVerified: boolean;
  preferredLanguage: string; // 'auto', 'en', 'ur', 'ur-roman', 'hi', 'ar', etc.
  voiceEnabled: boolean;
  speechRate: number; // 0.8 to 1.3
  selectedVoiceName?: string;
  reducedMotion: boolean;
  autoSpeakResponse: boolean;
  hasSeenWelcome: boolean;
  // Smart Memory Controls
  memoryEnabled: boolean;
  // AI Personality Customization
  personalityPreset: PersonalityPreset;
  customPersonalityPrompt?: string;
  responseLength: 'concise' | 'balanced' | 'detailed';
  // Live Web Search
  enableSearchGrounding: boolean;
}

export interface APIVerificationResult {
  ok: boolean;
  model?: string;
  message?: string;
  code?: string;
  verifiedText?: string;
}
