import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to mask API keys for safe debug logging
function maskKey(key?: string): string {
  if (!key) return 'none';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

// Helper to instantiate GoogleGenAI with either client-provided key or server env key
function getGeminiClient(clientKey?: string) {
  const apiKey = clientKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Core Tervox AI System Instruction (multilingual, warm, phone-call-like persona)
function buildSystemInstruction(
  memories?: any[],
  preferredLanguage?: string,
  personalityPreset?: string,
  customPersonalityPrompt?: string,
  responseLength?: 'concise' | 'balanced' | 'detailed'
): string {
  const memoryContext =
    memories && memories.length > 0
      ? `\n\n[PERSISTENT USER MEMORIES (Stored on user's device)]:\n${memories
          .map((m: any) => `- ${m.fact} (${m.category || 'general'})`)
          .join('\n')}\nUse these memories naturally when relevant, but do not recite them unprompted.`
      : '';

  const languageDirective =
    preferredLanguage && preferredLanguage !== 'auto'
      ? `\n\n[USER PREFERRED LANGUAGE]: The user has explicitly selected "${preferredLanguage}". Prioritize responding in this language unless the user speaks or asks in another language.`
      : `\n\n[MULTILINGUAL DIRECTIVE]:
Automatically detect the user's language and respond in the same language:
- If the user speaks or writes in Urdu (اردو script), answer in natural, fluent Urdu.
- If the user uses Roman Urdu (e.g., 'Kese ho Tervox?', 'Mujhe ek code chahiye'), answer in warm, natural Roman Urdu.
- If the user speaks or writes in Hindi (हिन्दी), answer in Hindi.
- If the user speaks or writes in English, answer in English.
- If the user switches languages mid-conversation, seamlessly adapt to their language.`;

  let personalityDirective = '';
  switch (personalityPreset) {
    case 'professional':
      personalityDirective =
        '\n\n[PERSONALITY TONE: Professional]: Maintain an executive, precise, structured, and objective tone. Be polite and deliver high-clarity insights.';
      break;
    case 'teacher':
      personalityDirective =
        '\n\n[PERSONALITY TONE: Smart Teacher]: Explain concepts step-by-step with intuitive analogies, check for understanding, and foster curiosity.';
      break;
    case 'coding':
      personalityDirective =
        '\n\n[PERSONALITY TONE: Elite Coding Expert]: Focus heavily on software engineering excellence, modular architecture, algorithmic efficiency, syntax precision, and best practices.';
      break;
    case 'creative':
      personalityDirective =
        '\n\n[PERSONALITY TONE: Creative]: Express imaginative flair, vivid metaphors, storytelling brilliance, and original conceptual brainstorming.';
      break;
    case 'funny':
      personalityDirective =
        '\n\n[PERSONALITY TONE: Witty & Humorous]: Be clever, lighthearted, and cheerful with tasteful humor while remaining genuinely helpful.';
      break;
    case 'custom':
      if (customPersonalityPrompt?.trim()) {
        personalityDirective = `\n\n[CUSTOM USER PERSONALITY INSTRUCTION]:\n${customPersonalityPrompt.trim()}`;
      }
      break;
    case 'friendly':
    default:
      personalityDirective =
        '\n\n[PERSONALITY TONE: Friendly Assistant]: Warm, supportive, empathetic, respectful, and approachable at all times.';
      break;
  }

  let lengthDirective = '';
  if (responseLength === 'concise') {
    lengthDirective =
      '\n\n[RESPONSE LENGTH: Concise]: Keep explanations short, punchy, and direct to the point unless full code or detailed breakdown is requested.';
  } else if (responseLength === 'detailed') {
    lengthDirective =
      '\n\n[RESPONSE LENGTH: Detailed]: Provide comprehensive, deep-dive answers exploring nuances, alternatives, and background context.';
  }

  return `You are Tervox AI, a friendly, intelligent, premium personal AI assistant and expert programming engineer, created and developed by Ibrahim Umair. Speak naturally, warmly, and conversationally, like a helpful mentor talking on a phone call. Listen carefully, understand context, ask sensible follow-up questions, and avoid robotic or repetitive phrases. Speak clearly with natural pacing.

CORE RULES:
1. IDENTITY & CREATOR:
   - Your name is Tervox AI.
   - You were created and developed by Ibrahim Umair.
   - When asked who you are, who created you, or who your developer is, state clearly and warmly:
     "My name is Tervox AI. I am your personal AI assistant, created and developed by Ibrahim Umair. You can talk to me naturally in your preferred language, and I'll do my best to help you with coding, website building, mathematics, education, and daily tasks."

2. EXPERT PROGRAMMING & SOFTWARE ARCHITECTURE:
   - You are a senior software architect and coding mentor across:
     * Web Development: HTML5, CSS3, JavaScript, TypeScript, React.js, Next.js, Node.js, Express, PHP, Python, Tailwind CSS, Bootstrap.
     * Mobile Apps: Android (Kotlin, Java), Flutter (Dart), React Native, Progressive Web Apps (PWA).
     * Languages & Tech: Python, C, C++, C#, Java, SQL, MySQL, PostgreSQL, Firebase (Firestore, Auth), Supabase, REST APIs, GraphQL, WebSockets, Git, GitHub, JSON, XML, automation, and AI/ML foundations.
   - COPYABLE CODE BLOCKS DIRECTIVE (CRITICAL):
     * Whenever the user asks for code, ALWAYS place complete, production-ready, bug-free code inside properly tagged Markdown code blocks (e.g. \`\`\`typescript, \`\`\`html, \`\`\`css, \`\`\`python).
     * Always identify the exact file name clearly above or at the beginning of each code block (e.g., File: \`index.html\`, File: \`style.css\`, File: \`script.js\`, File: \`src/App.tsx\`).
     * Separate HTML, CSS, JavaScript, and backend server code into distinctly labeled sections.
     * NEVER use lazy placeholders like "/* write your code here */" or "...rest of your code". Supply the complete, working code.
     * When asked for a complete website or application, supply the full project folder structure, required dependency installation commands (e.g., npm install ...), and exact step-by-step instructions on where to paste and how to run the project.
     * Include clear troubleshooting tips for common errors.

3. TRUTHFULNESS & RELIABILITY:
   - NEVER claim to have performed external actions that you did not actually perform (e.g. sending real emails, deploying live cloud servers).
   - Do NOT pretend to know facts you cannot verify. Honestly explain uncertainty.
   - If the user explicitly asks you to remember a personal preference or fact, acknowledge that you saved it to your memory.

${languageDirective}
${personalityDirective}
${lengthDirective}
${memoryContext}`;
}

// Exponential backoff retry utility
async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: { maxRetries?: number; initialDelay?: number; retryName?: string } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelay = options.initialDelay ?? 500;
  let attempt = 0;

  while (true) {
    try {
      return await operation(attempt);
    } catch (err: any) {
      attempt++;
      const status = err?.status;
      const msg = String(err?.message || '');
      const isRetryable =
        status === 503 ||
        status === 429 ||
        (status >= 500 && status < 600) ||
        msg.includes('high demand') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('MODEL_TIMEOUT');

      if (!isRetryable || attempt > maxRetries) {
        throw err;
      }

      const backoff = Math.min(2500, initialDelay * Math.pow(2, attempt - 1) + Math.random() * 200);
      console.warn(`[Tervox Backend] ${options.retryName || 'Operation'} attempt ${attempt}/${maxRetries} failed (${status || 'timeout'}). Retrying in ${Math.round(backoff)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

// Check configuration status
app.get('/api/gemini/config', (_req: Request, res: Response) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({
    ok: true,
    hasEnvKey,
    defaultModel: 'gemini-3.8-flash',
    liveModel: 'gemini-3.8-live',
    fallbackModel: 'gemini-3.1-flash-lite',
  });
});

// Verify API Key endpoint with retry & timeout
app.post('/api/gemini/verify', async (req: Request, res: Response) => {
  const customKey = req.body?.apiKey || (req.headers['x-gemini-api-key'] as string);
  console.log(`[Tervox Backend] Received verify request. Custom key: ${Boolean(customKey)}, Masked: ${maskKey(customKey)}`);

  let apiKey: string | undefined;
  try {
    apiKey = customKey?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(400).json({
        ok: false,
        code: 'MISSING_API_KEY',
        message: 'No API key provided. Please input your Gemini API key.',
      });
      return;
    }
  } catch (err: any) {
    res.status(400).json({
      ok: false,
      code: 'MISSING_API_KEY',
      message: 'Failed to read API key.',
    });
    return;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('VERIFY_TIMEOUT')), 5000);
  });

  try {
    const verifyOp = async () => {
      return retryWithBackoff(
        async (attempt) => {
          const modelName = attempt === 0 ? 'gemini-3.8-flash' : 'gemini-3.1-flash-lite';
          const model = await ai.models.get({ model: modelName });
          return { model: model.name || modelName };
        },
        { maxRetries: 1, initialDelay: 400, retryName: 'VerifyModel' }
      );
    };

    const result = await Promise.race([verifyOp(), timeoutPromise]);
    console.log(`[Tervox Backend] API Key verification SUCCEEDED with model: ${result.model}`);

    res.json({
      ok: true,
      model: result.model,
      message: `Connection successfully established with ${result.model}.`,
    });
  } catch (error: any) {
    const rawMessage = error?.message || String(error);
    const status = error?.status || 500;
    console.error(`[Tervox Backend] Verification FAILED (status: ${status}):`, rawMessage);

    if (rawMessage.includes('VERIFY_TIMEOUT')) {
      res.status(504).json({
        ok: false,
        code: 'TIMEOUT',
        message: 'Connection timed out while contacting the Gemini service. Please check your network and try again.',
      });
      return;
    }

    if (
      rawMessage.includes('API_KEY_INVALID') ||
      rawMessage.includes('invalid') ||
      rawMessage.includes('API key not valid') ||
      status === 400 ||
      status === 401 ||
      status === 403
    ) {
      res.status(401).json({
        ok: false,
        code: 'INVALID_API_KEY',
        message: 'The provided Gemini API key is invalid or unauthorized. Please verify your key at Google AI Studio.',
      });
      return;
    }

    if (rawMessage.includes('quota') || rawMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
      res.status(429).json({
        ok: false,
        code: 'QUOTA_EXCEEDED',
        message: 'API quota reached. Please add a new API key to continue using Tervox AI.',
      });
      return;
    }

    if (status === 503 || rawMessage.includes('high demand') || rawMessage.includes('UNAVAILABLE')) {
      res.status(503).json({
        ok: false,
        code: 'SERVICE_BUSY',
        message: 'Tervox is temporarily busy. Please try again in a moment.',
      });
      return;
    }

    res.status(500).json({
      ok: false,
      code: 'CONNECTION_ERROR',
      message: `Failed to connect to Gemini API: ${rawMessage.slice(0, 160)}`,
    });
  }
});

// Chat endpoint with Server-Sent Events (SSE) streaming and exponential backoff retry
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  const customKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
  const {
    messages,
    systemInstruction,
    memories,
    preferredLanguage,
    personalityPreset,
    customPersonalityPrompt,
    responseLength,
    enableSearchGrounding,
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ ok: false, message: 'Messages array is required.' });
    return;
  }

  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient(customKey);
  } catch (err: any) {
    res.status(401).json({
      ok: false,
      code: 'MISSING_API_KEY',
      message: 'No active Gemini API key found. Please activate your key in setup or settings.',
    });
    return;
  }

  const coreSystemInstruction = buildSystemInstruction(
    memories,
    preferredLanguage,
    personalityPreset,
    customPersonalityPrompt,
    responseLength
  );

  const contents = messages.map((m: any) => {
    const parts: any[] = [];

    // Add attachments if present
    if (m.attachments && Array.isArray(m.attachments)) {
      for (const att of m.attachments) {
        if (att.base64) {
          const cleanBase64 = att.base64.replace(/^data:[^;]+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: att.type || 'image/jpeg',
              data: cleanBase64,
            },
          });
        } else if (att.content) {
          parts.push({
            text: `\n[Attached File: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\`\n`,
          });
        }
      }
    }

    if (m.text && m.text.trim()) {
      parts.push({ text: m.text });
    }

    if (parts.length === 0) {
      parts.push({ text: '(empty message)' });
    }

    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    // Retry strategy with verified models (gemini-3.8-flash with fallback to gemini-3.1-flash-lite / gemini-3.5-flash)
    const stream = await retryWithBackoff(
      async (attempt) => {
        let selectedModel = 'gemini-3.8-flash';
        if (attempt === 1) selectedModel = 'gemini-3.1-flash-lite';
        else if (attempt >= 2) selectedModel = 'gemini-3.5-flash';

        console.log(`[Tervox Backend] Chat streaming attempt ${attempt + 1} with model: ${selectedModel}`);

        const config: any = {
          systemInstruction:
            coreSystemInstruction + (systemInstruction ? `\n[NOTE]: ${systemInstruction}` : ''),
          temperature: 0.7,
        };

        if (enableSearchGrounding) {
          config.tools = [{ googleSearch: {} }];
        }

        const tryStream = ai.models.generateContentStream({
          model: selectedModel,
          contents,
          config,
        });

        // 3.5s race timeout for the primary attempt so user does not wait endlessly if 3.8-flash has a 503 demand spike
        if (attempt === 0) {
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('MODEL_TIMEOUT')), 3500)
          );
          return await Promise.race([tryStream, timeout]);
        }

        return await tryStream;
      },
      { maxRetries: 2, initialDelay: 600, retryName: 'ChatStreaming' }
    );

    const emittedSourceUrls = new Set<string>();

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
      }

      // Check for Google Search Grounding metadata
      const candidate = chunk.candidates?.[0] as any;
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
      if (groundingChunks && Array.isArray(groundingChunks)) {
        const newSources: { title: string; url: string }[] = [];
        for (const gc of groundingChunks) {
          if (gc.web?.uri && !emittedSourceUrls.has(gc.web.uri)) {
            emittedSourceUrls.add(gc.web.uri);
            newSources.push({
              title: gc.web.title || gc.web.uri,
              url: gc.web.uri,
            });
          }
        }
        if (newSources.length > 0) {
          res.write(`data: ${JSON.stringify({ type: 'sources', sources: newSources })}\n\n`);
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('[Tervox Backend] Chat streaming final error:', error?.status, error?.message);
    const errorMessage = error?.message || String(error);
    const status = error?.status || 500;

    let errorCode = 'GENAI_ERROR';
    let userFriendlyMessage = 'An error occurred while generating a response.';

    if (errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED') || status === 429) {
      errorCode = 'QUOTA_EXCEEDED';
      userFriendlyMessage = 'API quota reached. Please add a new API key to continue using Tervox AI.';
    } else if (errorMessage.includes('API_KEY_INVALID') || errorMessage.includes('invalid') || errorMessage.includes('403')) {
      errorCode = 'INVALID_API_KEY';
      userFriendlyMessage = 'Your Gemini API key appears invalid or expired. Please update it in Settings.';
    } else if (status === 503 || errorMessage.includes('high demand') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('MODEL_TIMEOUT')) {
      errorCode = 'SERVICE_BUSY';
      userFriendlyMessage = 'Tervox is temporarily busy. Please try again in a moment.';
    } else {
      userFriendlyMessage = `Error from Gemini: ${errorMessage.slice(0, 150)}`;
    }

    res.write(`data: ${JSON.stringify({ type: 'error', code: errorCode, message: userFriendlyMessage })}\n\n`);
    res.end();
  }
});

// AI Image Generation Endpoint using gemini-2.5-flash-image
app.post('/api/gemini/generate-image', async (req: Request, res: Response) => {
  const customKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
  const { prompt, style } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    res.status(400).json({ ok: false, message: 'Image prompt is required.' });
    return;
  }

  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient(customKey);
  } catch (err: any) {
    res.status(401).json({
      ok: false,
      code: 'MISSING_API_KEY',
      message: 'No active Gemini API key found. Please activate your key in Settings.',
    });
    return;
  }

  const promptWithStyle = style && style !== 'None' ? `[Visual Style: ${style}] ${prompt.trim()}` : prompt.trim();

  try {
    const response = await retryWithBackoff(
      async (attempt) => {
        const model = attempt === 0 ? 'gemini-2.5-flash-image' : 'gemini-3.1-flash-image';
        return await ai.models.generateContent({
          model,
          contents: promptWithStyle,
        });
      },
      { maxRetries: 1, initialDelay: 500, retryName: 'GenerateImage' }
    );

    let imageUrl: string | null = null;
    const candidates = response.candidates || [];
    for (const cand of candidates) {
      for (const part of cand.content?.parts || []) {
        if ((part as any).inlineData?.data) {
          const mimeType = (part as any).inlineData.mimeType || 'image/png';
          imageUrl = `data:${mimeType};base64,${(part as any).inlineData.data}`;
          break;
        }
      }
      if (imageUrl) break;
    }

    if (imageUrl) {
      res.json({ ok: true, imageUrl, prompt: promptWithStyle });
    } else {
      const replyText = response.text || '';
      res.status(422).json({
        ok: false,
        code: 'IMAGE_GEN_UNAVAILABLE',
        message: replyText || 'Image generation could not be completed with this model or prompt. Ensure billing is enabled or try another prompt.',
      });
    }
  } catch (err: any) {
    console.error('[Tervox Backend] Image generation error:', err?.status, err?.message);
    const msg = err?.message || String(err);
    if (msg.includes('RESOURCE_EXHAUSTED') || err?.status === 429) {
      res.status(429).json({
        ok: false,
        code: 'QUOTA_EXCEEDED',
        message: 'Image generation quota reached for this key. Please use a Gemini API key with billing enabled or try again later.',
      });
    } else {
      res.status(500).json({
        ok: false,
        code: 'GENAI_ERROR',
        message: `Image generation error: ${msg.slice(0, 160)}`,
      });
    }
  }
});

// Memory extraction endpoint with retry
app.post('/api/gemini/extract-memory', async (req: Request, res: Response) => {
  const customKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
  const { userMessage, assistantReply } = req.body;

  try {
    const ai = getGeminiClient(customKey);
    const prompt = `Analyze this user message to see if the user stated any permanent personal facts, preferences, or explicitly asked to remember something (e.g. name, profession, hobbies, language, coding preferences).
User: "${userMessage}"
Assistant: "${assistantReply}"

If there is a clear personal fact/preference to remember, respond in valid JSON format:
{
  "hasMemory": true,
  "fact": "concise statement of the fact",
  "category": "personal" | "preference" | "work" | "language"
}
If there is nothing permanent or noteworthy to remember, return:
{
  "hasMemory": false
}
Return ONLY valid JSON.`;

    const response = await retryWithBackoff(
      async (attempt) => {
        const model = attempt === 0 ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
      },
      { maxRetries: 1, initialDelay: 400, retryName: 'ExtractMemory' }
    );

    const parsed = JSON.parse(response.text || '{"hasMemory":false}');
    res.json({ ok: true, data: parsed });
  } catch (error: any) {
    res.json({ ok: false, hasMemory: false });
  }
});

// WebSocket Server for Genuine Bidirectional Real-Time Voice Conversation (Gemini Live API)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  try {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (clientWs) => {
        wss.emit('connection', clientWs, request);
      });
    }
  } catch (err) {
    console.warn('[Server] Error handling upgrade for WebSocket:', err);
    socket.destroy();
  }
});

wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
  console.log('[Tervox Live WS] Client connected to real-time voice channel');

  // Extract custom API key from query string if provided: /api/live?apiKey=...
  let clientKey: string | undefined;
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    clientKey = url.searchParams.get('apiKey') || undefined;
  } catch {
    // ignore
  }

  let ai: GoogleGenAI;
  try {
    ai = getGeminiClient(clientKey);
  } catch (err: any) {
    console.error('[Tervox Live WS] Failed to initialize Gemini client:', err.message);
    clientWs.send(JSON.stringify({ type: 'error', code: 'MISSING_API_KEY', message: 'No valid Gemini API key found for voice call. Please add or check your key.' }));
    setTimeout(() => {
      try { clientWs.close(); } catch {}
    }, 250);
    return;
  }

  let liveSession: any = null;
  let isSessionClosed = false;

  try {
    const systemPrompt = `You are Tervox AI, a warm, intelligent personal AI assistant and programming engineer created and developed by Ibrahim Umair, speaking directly on an interactive real-time phone call.
Speak warmly, conversationally, and naturally, like a helpful friend on the phone. Keep ordinary answers concise (1-3 sentences) so the conversation flows back and forth smoothly. Listen carefully, understand context, and avoid robotic or repetitive phrases. Speak clearly with natural pacing.

IDENTITY:
Your name is Tervox AI. You were created and developed by Ibrahim Umair. If asked who made you or who your developer is, state proudly:
"My name is Tervox AI. I am your personal AI assistant, created and developed by Ibrahim Umair."

MULTILINGUAL CAPABILITY:
Automatically detect and speak in the user's language:
- If user speaks Urdu (اردو), speak natural fluent Urdu.
- If user speaks Roman Urdu, answer in Roman Urdu / Urdu.
- If user speaks Hindi, answer in Hindi.
- If user speaks English, answer in English.
- If user switches languages, seamlessly mirror their language.`;

    console.log('[Tervox Live WS] Connecting to Gemini Live API with model: gemini-3.8-live...');
    liveSession = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
          },
        },
        systemInstruction: systemPrompt,
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
      callbacks: {
        onmessage: (msg: LiveServerMessage) => {
          if (isSessionClosed || clientWs.readyState !== WebSocket.OPEN) return;

          // 1. Model Audio Output (raw 24kHz PCM chunks)
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                }));
              }
              if (part.text) {
                clientWs.send(JSON.stringify({
                  type: 'outputTranscription',
                  text: part.text,
                }));
              }
            }
          }

          // 2. Transcription updates
          const serverContentAny = msg.serverContent as any;
          if (serverContentAny?.outputTranscription?.text) {
            clientWs.send(JSON.stringify({
              type: 'outputTranscription',
              text: serverContentAny.outputTranscription.text,
            }));
          }

          if (serverContentAny?.inputTranscription?.text) {
            clientWs.send(JSON.stringify({
              type: 'inputTranscription',
              text: serverContentAny.inputTranscription.text,
            }));
          }

          // 3. User Interruption detection
          if (msg.serverContent?.interrupted) {
            console.log('[Tervox Live WS] Model detected user interruption');
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          // 4. Model Turn Complete
          if (msg.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: 'turnComplete' }));
          }
        },
        onerror: (err: any) => {
          console.error('[Tervox Live WS] Gemini Live session error:', err?.message || err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'error',
              code: 'LIVE_ERROR',
              message: err?.message?.includes('503') || err?.message?.includes('high demand')
                ? 'Tervox voice service is temporarily busy. Please try again in a moment.'
                : 'Connection error in voice session.',
            }));
          }
        },
        onclose: () => {
          console.log('[Tervox Live WS] Gemini Live session closed');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'closed' }));
          }
        },
      },
    });

    console.log('[Tervox Live WS] Gemini Live session successfully established!');
    clientWs.send(JSON.stringify({ type: 'ready' }));

    // Handle messages from client
    clientWs.on('message', (rawData) => {
      if (isSessionClosed || !liveSession) return;
      try {
        const payload = JSON.parse(rawData.toString());

        // Audio input chunk from client microphone (16kHz PCM Base64)
        if (payload.type === 'audio' && payload.data) {
          liveSession.sendRealtimeInput({
            audio: { data: payload.data, mimeType: 'audio/pcm;rate=16000' },
          });
        }

        // Text input prompt directly injected into Live session
        if (payload.type === 'text' && payload.text) {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: payload.text }] }],
            turnComplete: true,
          });
        }

        // Explicit interrupt signal from user clicking Orb / Interrupt
        if (payload.type === 'interrupt') {
          // Send empty turn to reset model turn if needed
          console.log('[Tervox Live WS] User triggered explicit interrupt');
        }
      } catch (err: any) {
        console.warn('[Tervox Live WS] Error handling client message:', err.message);
      }
    });

    clientWs.on('close', () => {
      console.log('[Tervox Live WS] Client disconnected from voice channel');
      isSessionClosed = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
        liveSession = null;
      }
    });

    clientWs.on('error', (err) => {
      console.error('[Tervox Live WS] Client socket error:', err);
      isSessionClosed = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore
        }
      }
    });
  } catch (err: any) {
    console.error('[Tervox Live WS] Failed to establish Live session:', err?.message || err);
    clientWs.send(JSON.stringify({
      type: 'error',
      code: 'LIVE_INIT_FAILED',
      message: err?.message?.includes('503')
        ? 'Tervox is temporarily busy. Please try again in a moment.'
        : 'Failed to establish live voice connection.',
    }));
    setTimeout(() => {
      try { clientWs.close(); } catch {}
    }, 250);
  }
});

// Express & Vite integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tervox AI Server with Live Voice listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
