import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  const getApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

  // API Config check
  app.get('/api/gemini/config', (req, res) => {
    const apiKey = getApiKey();
    res.json({ isConfigured: Boolean(apiKey) });
  });

  const formatGeminiError = (error: any, fallbackMessage: string) => {
    const rawStatus =
      typeof error?.status === 'number' && error.status >= 400 && error.status < 600
        ? error.status
        : 500;
    // Map statuses intercepted by nginx error_page (403, 502, 503, 504) to safe JSON-preserving HTTP codes
    const status =
      rawStatus === 403
        ? 401
        : rawStatus === 502 || rawStatus === 503 || rawStatus === 504
          ? 500
          : rawStatus;

    let message = error?.message || fallbackMessage;
    if (typeof message === 'string' && message.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(message);
        if (parsed?.error?.message) {
          message = parsed.error.message;
        }
      } catch {
        // Keep original message
      }
    }
    return { status, upstreamStatus: rawStatus, message };
  };

  const isTransientModelError = (error: any) => {
    const status = error?.status;
    const msg = String(error?.message || '').toLowerCase();
    return (
      status === 503 ||
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 504 ||
      msg.includes('high demand') ||
      msg.includes('unavailable') ||
      msg.includes('resource_exhausted') ||
      msg.includes('overloaded')
    );
  };

  const getModelFallbackChain = (primaryModel: string) => {
    const defaults = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    return [primaryModel, ...defaults.filter((m) => m !== primaryModel)];
  };

  const generateWithFallback = async (
    ai: GoogleGenAI,
    primaryModel: string,
    contents: any,
    config: any
  ) => {
    const models = getModelFallbackChain(primaryModel);
    let lastError: any;
    for (const model of models) {
      try {
        return await ai.models.generateContent({ model, contents, config });
      } catch (err: any) {
        lastError = err;
        if (!isTransientModelError(err)) {
          throw err;
        }
        console.warn(`Model ${model} unavailable (${err?.status || err?.message}), trying next fallback...`);
      }
    }
    throw lastError;
  };

  // Bug Analysis route
  app.post('/api/analyze-bug', async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(401).json({
        error: { message: 'Missing Gemini API key on server. Please set GEMINI_API_KEY in server environment.' }
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const { contents, systemInstruction, model = 'gemini-3.8-flash' } = req.body || {};

      if (!contents) {
        return res.status(400).json({
          error: { message: 'Missing required contents payload.' }
        });
      }

      const response = await generateWithFallback(ai, model, contents, {
        systemInstruction,
        responseMimeType: 'application/json',
      });

      return res.json({ text: response.text });
    } catch (error: any) {
      console.error('Error calling Gemini API on server:', error);
      const { status, upstreamStatus, message } = formatGeminiError(
        error,
        'Gemini API request failed on server.'
      );
      return res.status(status).json({
        error: { message, code: upstreamStatus }
      });
    }
  });

  // General Gemini Generate Content route
  app.post('/api/gemini/generateContent', async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(401).json({ error: { message: 'Missing Gemini API key on server.' } });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const { model = 'gemini-3.8-flash', contents, config } = req.body || {};

      const response = await generateWithFallback(ai, model, contents, config);

      return res.json({ text: response.text, candidates: response.candidates });
    } catch (error: any) {
      console.error('Error in /api/gemini/generateContent:', error);
      const { status, upstreamStatus, message } = formatGeminiError(
        error,
        'Server error calling Gemini API.'
      );
      return res.status(status).json({
        error: { message, code: upstreamStatus }
      });
    }
  });

  // Gemini Streaming route
  app.post('/api/gemini/generateContentStream', async (req, res) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(401).json({ error: { message: 'Missing Gemini API key on server.' } });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const { model = 'gemini-3.8-flash', contents, config } = req.body || {};
      const models = getModelFallbackChain(model);
      let responseStream: any = null;
      let lastError: any = null;

      for (const candidateModel of models) {
        try {
          responseStream = await ai.models.generateContentStream({
            model: candidateModel,
            contents,
            config,
          });
          break;
        } catch (err: any) {
          lastError = err;
          if (!isTransientModelError(err)) {
            throw err;
          }
          console.warn(`Stream model ${candidateModel} unavailable, trying next fallback...`);
        }
      }

      if (!responseStream) {
        throw lastError || new Error('Streaming error calling Gemini API.');
      }

      for await (const chunk of responseStream) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }

      res.write('event: end\ndata: {}\n\n');
      res.end();
    } catch (error: any) {
      console.error('Error in streaming:', error);
      const { message } = formatGeminiError(error, 'Streaming error calling Gemini API.');
      res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  });

  // Ensure unmatched /api/* routes return JSON instead of SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'API route not found.' } });
  });

  // Ensure Express body-parser and middleware errors return JSON instead of HTML
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    const status =
      typeof err?.status === 'number' && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    if (req.path.startsWith('/api')) {
      return res.status(status).json({
        error: { message: err?.message || 'Unexpected server error.' }
      });
    }
    return next(err);
  });

  // WebSocket Live API proxy bridge
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
    if (pathname === '/api/gemini/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      ws.send(JSON.stringify({ error: 'Missing Gemini API key on server' }));
      ws.close();
      return;
    }

    const targetUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const geminiWs = new WebSocket(targetUrl);

    geminiWs.on('message', (data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data.toString());
      }
    });

    geminiWs.on('error', (err) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: err.message }));
      }
    });

    geminiWs.on('close', () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });

    ws.on('message', (message) => {
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(message.toString());
      }
    });

    ws.on('close', () => {
      if (geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.close();
      }
    });
  });

  // Serve static assets and client script directories
  app.use('/assets', express.static(path.join(__dirname, 'assets')));
  app.use('/js', express.static(path.join(__dirname, 'js')));

  // Attach Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
