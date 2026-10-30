import { Message, Memory, APIVerificationResult, Attachment, GroundingSource, PersonalityPreset } from '../types';

export interface StreamChatParams {
  messages: Array<{
    role: 'user' | 'assistant';
    text: string;
    attachments?: Attachment[];
  }>;
  apiKey?: string;
  memories?: Memory[];
  preferredLanguage?: string;
  personalityPreset?: PersonalityPreset;
  customPersonalityPrompt?: string;
  responseLength?: 'concise' | 'balanced' | 'detailed';
  enableSearchGrounding?: boolean;
  onChunk: (chunk: string) => void;
  onSources?: (sources: GroundingSource[]) => void;
  onError: (error: { code: string; message: string }) => void;
  onComplete: () => void;
  signal?: AbortSignal;
}

export class GeminiService {
  /**
   * Verify an API key with the backend (with strict 6s timeout and safe logging)
   */
  async verifyApiKey(apiKey?: string): Promise<APIVerificationResult> {
    const keyHint = apiKey ? `starts with "${apiKey.slice(0, 4)}..."` : 'environment default';
    console.log(`[Tervox Client] Initiating key verification (${keyHint}) with 6s timeout...`);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      const res = await fetch('/api/gemini/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ apiKey }),
        signal: AbortSignal.timeout(6000),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        data = {
          ok: false,
          code: `HTTP_${res.status}`,
          message: `Server returned status ${res.status}. Please check your connection.`,
        };
      }

      console.log(`[Tervox Client] Verify response received (status: ${res.status}, ok: ${data.ok})`);
      return data;
    } catch (err: any) {
      console.error('[Tervox Client] Verify fetch error:', err.name, err.message);
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return {
          ok: false,
          code: 'TIMEOUT',
          message: 'Connection timed out while verifying API key (exceeded 6 seconds). Please try again.',
        };
      }

      return {
        ok: false,
        code: 'NETWORK_ERROR',
        message: 'Unable to reach the server. Please check your internet connection and try again.',
      };
    }
  }

  /**
   * Check if the backend has an environment key configured
   */
  async getServerConfig(): Promise<{ ok: boolean; hasEnvKey: boolean; defaultModel: string }> {
    try {
      const res = await fetch('/api/gemini/config', {
        signal: AbortSignal.timeout(4000),
      });
      return await res.json();
    } catch {
      return { ok: true, hasEnvKey: false, defaultModel: 'gemini-3.8-flash' };
    }
  }

  /**
   * Stream chat messages using Server-Sent Events
   */
  async streamChat({
    messages,
    apiKey,
    memories,
    preferredLanguage,
    personalityPreset,
    customPersonalityPrompt,
    responseLength,
    enableSearchGrounding,
    onChunk,
    onSources,
    onError,
    onComplete,
    signal,
  }: StreamChatParams): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages,
          apiKey,
          memories,
          preferredLanguage,
          personalityPreset,
          customPersonalityPrompt,
          responseLength,
          enableSearchGrounding,
        }),
        signal,
      });

      if (!response.ok && !response.body) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          // ignore json parse error
        }
        onError({
          code: errorData.code || `HTTP_${response.status}`,
          message: errorData.message || `Request failed with status ${response.status}`,
        });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body has no readable stream.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'chunk' && data.text) {
                onChunk(data.text);
              } else if (data.type === 'sources' && Array.isArray(data.sources)) {
                onSources?.(data.sources);
              } else if (data.type === 'error') {
                onError({
                  code: data.code || 'GENAI_ERROR',
                  message: data.message || 'Error received from Gemini',
                });
                return;
              } else if (data.type === 'done') {
                onComplete();
                return;
              }
            } catch (e) {
              console.warn('Failed to parse SSE payload', jsonStr, e);
            }
          }
        }
      }

      onComplete();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Stream aborted by user
        onComplete();
        return;
      }

      onError({
        code: 'CLIENT_FETCH_ERROR',
        message: err.message || 'Failed to stream response from Tervox AI.',
      });
    }
  }

  /**
   * Generate an image using Google GenAI Image endpoint
   */
  async generateImage({
    prompt,
    style,
    apiKey,
  }: {
    prompt: string;
    style?: string;
    apiKey?: string;
  }): Promise<{ ok: boolean; imageUrl?: string; message?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      const res = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt, style, apiKey }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || 'Network error occurred while generating image.',
      };
    }
  }

  /**
   * Analyze message exchange to automatically detect facts to remember
   */
  async extractMemory(
    userMessage: string,
    assistantReply: string,
    apiKey?: string
  ): Promise<{ hasMemory: boolean; fact?: string; category?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      const res = await fetch('/api/gemini/extract-memory', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userMessage, assistantReply, apiKey }),
      });

      const data = await res.json();
      if (data.ok && data.data && data.data.hasMemory) {
        return data.data;
      }
      return { hasMemory: false };
    } catch {
      return { hasMemory: false };
    }
  }
}

export const gemini = new GeminiService();
