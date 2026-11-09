import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  GameRoomState,
  Layer,
  Stroke,
  UserPresence,
  ChatMessage,
  ArtFilterConfig,
  HistoryActionType,
  HistorySummary,
  HistorySummaryItem,
  GalleryArtwork,
} from './src/types/game.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '30mb' }));

// Initialize GoogleGenAI clients (Server-Side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const aiBeta = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: 'v1beta',
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Central authoritative room store
const rooms = new Map<string, GameRoomState>();

// Authoritative global Undo/Redo stack per room
interface ServerHistoryRecord {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  userColor: string;
  actionType: HistoryActionType;
  description: string;
  layerId?: string;
  layerName?: string;
  strokeId?: string;
  beforeLayers: Layer[];
  afterLayers: Layer[];
  beforeFilter: ArtFilterConfig;
  afterFilter: ArtFilterConfig;
}

interface RoomHistoryStack {
  undoStack: ServerHistoryRecord[];
  redoStack: ServerHistoryRecord[];
  lastToast: {
    id: string;
    text: string;
    userName: string;
    userColor: string;
  } | null;
}

const roomHistories = new Map<string, RoomHistoryStack>();
const MAX_HISTORY_SIZE = 50;

// Client connection tracking: socket -> { roomId, userId }
interface ClientMeta {
  roomId: string;
  userId: string;
  ws: WebSocket;
}
const socketClients = new Map<WebSocket, ClientMeta>();

function cloneLayers(layers: Layer[]): Layer[] {
  return JSON.parse(JSON.stringify(layers));
}

function cloneFilter(filter: ArtFilterConfig): ArtFilterConfig {
  return JSON.parse(JSON.stringify(filter));
}

function safeParseJson<T>(rawText: string | undefined, fallback: T): T {
  if (!rawText) return fallback;
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

function createDefaultFilter(): ArtFilterConfig {
  return {
    id: 'none',
    name: 'Original (Sin Filtro)',
    backgroundTint: '#ffffff',
    contrast: 100,
    saturation: 100,
    sepia: 0,
    hueRotate: 0,
    textureOverlay: 'none',
    vignetteIntensity: 0,
  };
}

function createDefaultLayers(): Layer[] {
  return [
    {
      id: 'layer-bg',
      name: 'Fondo y Siluetas',
      opacity: 1,
      visible: true,
      locked: false,
      strokes: [],
    },
    {
      id: 'layer-sketch',
      name: 'Boceto y Tinta',
      opacity: 1,
      visible: true,
      locked: false,
      strokes: [],
    },
    {
      id: 'layer-color',
      name: 'Color y Luces',
      opacity: 0.95,
      visible: true,
      locked: false,
      strokes: [],
    },
  ];
}

function getOrCreateHistoryStack(roomId: string): RoomHistoryStack {
  if (!roomHistories.has(roomId)) {
    roomHistories.set(roomId, {
      undoStack: [],
      redoStack: [],
      lastToast: null,
    });
  }
  return roomHistories.get(roomId)!;
}

function buildHistorySummary(roomId: string): HistorySummary {
  const stack = getOrCreateHistoryStack(roomId);
  const undoItems: HistorySummaryItem[] = stack.undoStack.map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    userId: r.userId,
    userName: r.userName,
    userColor: r.userColor,
    actionType: r.actionType,
    description: r.description,
    layerName: r.layerName,
    isUndone: false,
  }));

  // Redo stack top is the next item to redo, so reverse it for chronological display
  const redoItems: HistorySummaryItem[] = [...stack.redoStack].reverse().map((r) => ({
    id: r.id,
    timestamp: r.timestamp,
    userId: r.userId,
    userName: r.userName,
    userColor: r.userColor,
    actionType: r.actionType,
    description: r.description,
    layerName: r.layerName,
    isUndone: true,
  }));

  const combined = [...undoItems, ...redoItems].slice(-35);

  return {
    canUndo: stack.undoStack.length > 0,
    canRedo: stack.redoStack.length > 0,
    undoCount: stack.undoStack.length,
    redoCount: stack.redoStack.length,
    lastActionToast: stack.lastToast,
    items: combined,
  };
}

function recordHistoryAction(
  room: GameRoomState,
  params: {
    userId: string;
    userName: string;
    userColor: string;
    actionType: HistoryActionType;
    description: string;
    layerId?: string;
    layerName?: string;
    strokeId?: string;
    beforeLayers: Layer[];
    afterLayers: Layer[];
    beforeFilter?: ArtFilterConfig;
    afterFilter?: ArtFilterConfig;
  }
): ServerHistoryRecord {
  const stack = getOrCreateHistoryStack(room.roomId);
  const record: ServerHistoryRecord = {
    id: `hist-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: Date.now(),
    userId: params.userId,
    userName: params.userName,
    userColor: params.userColor,
    actionType: params.actionType,
    description: params.description,
    layerId: params.layerId,
    layerName: params.layerName,
    strokeId: params.strokeId,
    beforeLayers: cloneLayers(params.beforeLayers),
    afterLayers: cloneLayers(params.afterLayers),
    beforeFilter: cloneFilter(params.beforeFilter || room.activeFilter),
    afterFilter: cloneFilter(params.afterFilter || room.activeFilter),
  };

  stack.undoStack.push(record);
  if (stack.undoStack.length > MAX_HISTORY_SIZE) {
    stack.undoStack.shift();
  }
  // Any new action clears the redo branch
  stack.redoStack = [];
  stack.lastToast = null;

  room.history = buildHistorySummary(room.roomId);
  return record;
}

function getOrCreateRoom(roomId: string = 'CANVAS-1'): GameRoomState {
  if (!rooms.has(roomId)) {
    getOrCreateHistoryStack(roomId);
    const newRoom: GameRoomState = {
      roomId,
      roomName: `Sala de Arte #${roomId}`,
      gameMode: 'free_studio',
      gamePhase: 'lobby',
      currentTheme: 'Crea tu obra maestra colaborativa en capas',
      timeLeft: 120,
      roundDuration: 120,
      layers: createDefaultLayers(),
      activeFilter: createDefaultFilter(),
      history: buildHistorySummary(roomId),
      gallery: [],
      activeUsers: {},
      chatMessages: [
        {
          id: 'welcome-msg',
          userId: 'system',
          userName: 'Sistema',
          userColor: '#38bdf8',
          text: `¡Bienvenidos a la sala ${roomId}! Dibuja, usa filtros de IA y deshaz/rehaz acciones en tiempo real.`,
          timestamp: Date.now(),
          isSystem: true,
        },
      ],
      canvasWidth: 1200,
      canvasHeight: 800,
    };
    rooms.set(roomId, newRoom);
  }
  return rooms.get(roomId)!;
}

// Broadcast to all clients in a specific room
function broadcastToRoom(roomId: string, message: object, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const [ws, meta] of socketClients.entries()) {
    if (meta.roomId === roomId && ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Tick timer for rooms in active game phases
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.gamePhase === 'playing') {
      room.timeLeft -= 1;
      if (room.timeLeft <= 0) {
        room.timeLeft = 0;
        room.gamePhase = 'critique';
        broadcastToRoom(roomId, {
          type: 'game_phase_changed',
          phase: 'critique',
          timeLeft: 0,
          room,
        });
      } else if (room.timeLeft % 5 === 0 || room.timeLeft <= 10) {
        broadcastToRoom(roomId, {
          type: 'time_sync',
          timeLeft: room.timeLeft,
        });
      }
    }
  }
}, 1000);

// Track temporary cooldowns when a specific Gemini model hits Free Tier 429 rate limits
const modelCooldowns = new Map<string, number>();

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('Quota exceeded') ||
    msg.includes('rate-limit')
  );
}

async function generateWithModelFallback(params: {
  models?: string[];
  contents: unknown;
  responseMimeType?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const candidateModels = params.models || ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  const now = Date.now();

  // Order models so non-cooled-down models are tried first
  const orderedModels = [
    ...candidateModels.filter((m) => (modelCooldowns.get(m) || 0) <= now),
    ...candidateModels.filter((m) => (modelCooldowns.get(m) || 0) > now),
  ];

  let lastError: unknown = null;

  for (const modelName of orderedModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: params.contents as Parameters<typeof ai.models.generateContent>[0]['contents'],
        config: params.responseMimeType
          ? { responseMimeType: params.responseMimeType }
          : undefined,
      });
      return {
        text: response.text || '',
        modelUsed: modelName,
      };
    } catch (err: unknown) {
      lastError = err;
      if (isQuotaOrRateLimitError(err)) {
        // Put this model on a 15-minute cooldown so subsequent requests immediately use the fallback model
        modelCooldowns.set(modelName, Date.now() + 15 * 60 * 1000);
        console.warn(`Model ${modelName} reached Free Tier quota (429), switching to fallback model.`);
      } else {
        console.warn(
          `Model ${modelName} call failed, trying next fallback:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  throw lastError || new Error('All candidate Gemini models unavailable');
}

// API Routes for Gemini Intelligence
// 1. Art Critique via gemini-3.8-flash with automatic quota fallback to gemini-3.1-flash-lite
app.post('/api/gemini/critique', async (req, res) => {
  const { imageBase64, theme, layersCount, artistsCount } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Falta la imagen en base64' });
  }

  const defaultCritique = {
    title: theme ? `Visión Colectiva: ${String(theme).slice(0, 36)}` : 'Sinfonía Colaborativa en Capas',
    score: 93,
    style: 'Expresionismo Digital Contemporáneo',
    critique: `Una composición magnética donde los ${artistsCount || 2} artistas fusionaron ${
      layersCount || 3
    } capas con trazos llenos de energía, ritmo visual y contraste sobre el lienzo.`,
    harmonyAnalysis:
      'Equilibrio fluido entre los trazos estructurales de boceto y los acentos cromáticos finales.',
    badges: ['Maestros del Color', 'Sinergia en Vivo', 'Trazo Audaz'],
  };

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const promptText = `
Eres un legendario y vanguardista crítico de arte contemporáneo (estilo galería de arte de París o Nueva York, ingenioso, expresivo, divertido y poético).
Analiza esta obra de arte colaborativa pintada por ${artistsCount || 2} artistas simultáneos usando un sistema de ${layersCount || 3} capas superpuestas.
El tema o consigna de la ronda fue: "${theme || 'Arte Libre'}".

Devuelve OBLIGATORIAMENTE un JSON puro con la siguiente estructura:
{
  "title": "Un título artístico ingenioso para la obra",
  "score": un número entero entre 75 y 100 evaluando la audacia y armonía colaborativa,
  "style": "Un movimiento artístico inventado o real (ej: Neo-Expresionismo Psicodélico, Ciber-Dadaísmo, Fauvismo Digital)",
  "critique": "Un párrafo de 2 a 3 oraciones analizando las pinceladas, el uso del color, la interacción entre capas y la energía colectiva.",
  "harmonyAnalysis": "Una breve descripción de cómo conviven los trazos de los diferentes jugadores en sus respectivas capas.",
  "badges": ["3 insignias divertidas en español, ej: 'Maestros del Color', 'Pincel Veloz', 'Caos Armónico'"]
}
`;

    const { text } = await generateWithModelFallback({
      models: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      responseMimeType: 'application/json',
    });

    const parsed = safeParseJson(text, defaultCritique);
    return res.json(parsed);
  } catch (err: unknown) {
    console.warn(
      'Using local curator fallback for art critique due to API limit:',
      err instanceof Error ? err.message : String(err)
    );
    return res.json(defaultCritique);
  }
});

// 2. Audio Transcription via gemini-3.5-transcribe (v1beta) with automatic fallback to gemini-3.1-flash-lite & gemini-3.8-flash
app.post('/api/gemini/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType } = req.body;
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Falta el audio en formato base64' });
    }

    const cleanAudio = audioBase64.includes(',')
      ? audioBase64.split(',')[1].trim()
      : audioBase64.replace(/^data:[^;]+(?:;[^;]+)*;base64,/, '').trim();

    const normalizedMimeType = ((mimeType || 'audio/webm').split(';')[0] || 'audio/webm').trim();

    const audioPart = {
      inlineData: {
        mimeType: normalizedMimeType,
        data: cleanAudio,
      },
    };

    const promptPart = {
      text: 'Transcribe fielmente lo que dice la persona en este audio. Devuelve únicamente el texto transcrito, sin comillas ni comentarios adicionales.',
    };

    let transcription = '';
    let modelUsed = 'gemini-3.5-transcribe';

    try {
      const primaryResponse = await aiBeta.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [audioPart, promptPart],
        },
      });
      transcription = (primaryResponse.text || '').trim();
    } catch {
      const fallbackResult = await generateWithModelFallback({
        models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
        contents: {
          parts: [audioPart, promptPart],
        },
      });
      transcription = fallbackResult.text.trim();
      modelUsed = fallbackResult.modelUsed;
    }

    return res.json({ transcription, modelUsed });
  } catch (err: unknown) {
    console.warn('Audio transcription fallback:', err instanceof Error ? err.message : String(err));
    return res.status(200).json({
      transcription: 'Un paisaje fantástico lleno de color y movimiento',
      modelUsed: 'fallback',
    });
  }
});

// 3. Prompt & Thematic Challenge Generator
app.post('/api/gemini/generate-theme', async (req, res) => {
  const { category } = req.body || {};
  const fallbackThemes = {
    themes: [
      {
        title: 'Ciudadela entre las Nubes',
        description: 'Pinten una ciudad flotante iluminada por dirigibles y puentes de cristal.',
        suggestedLayers: ['Cielo y nubes', 'Torres flotantes', 'Dirigibles y luces'],
      },
      {
        title: 'Criatura del Abismo Luminoso',
        description: 'Diseñen juntos un ser marino bioluminiscente rodeado de corales.',
        suggestedLayers: ['Océano profundo', 'Criatura central', 'Destellos neón'],
      },
      {
        title: 'Carnaval de Robots Músicos',
        description: 'Una banda de autómatas tocando instrumentos imposibles a todo color.',
        suggestedLayers: ['Escenario festivo', 'Robots músicos', 'Notas y chispas'],
      },
    ],
  };

  try {
    const { text } = await generateWithModelFallback({
      models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
      contents: `Genera 3 propuestas divertidas, visuales y desafiantes para un juego de pintura colaborativo multijugador. Categoría: ${category || 'general'}.
Devuelve un JSON con:
{
  "themes": [
    { "title": "Nombre corto del tema", "description": "1 frase inspiradora de lo que deben pintar juntos", "suggestedLayers": ["Fondo espacial", "Monstruo central", "Detalles neón"] }
  ]
}`,
      responseMimeType: 'application/json',
    });

    const parsed = safeParseJson(text, fallbackThemes);
    return res.json(parsed);
  } catch {
    return res.json(fallbackThemes);
  }
});

// 4. Quick Live AI Guesser via gemini-3.1-flash-lite
app.post('/api/gemini/guess', async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: 'Falta imagen' });

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const { text } = await generateWithModelFallback({
      models: ['gemini-3.1-flash-lite', 'gemini-3.8-flash'],
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: 'Observa este dibujo colaborativo. En 1 sola frase corta o lista de 3 palabras en español, adivina qué están dibujando o qué parece ser.',
          },
        ],
      },
    });

    return res.json({ guess: text.trim() || '¡Una obra abstracta llena de energía!' });
  } catch {
    return res.json({ guess: '¡Parece una creación surrealista llena de color!' });
  }
});

// 5. AI Co-Painter: Gemini generates creative vector strokes on a layer
app.post('/api/gemini/ai-paint', async (req, res) => {
  const { prompt, canvasWidth = 1000, canvasHeight = 700 } = req.body || {};
  const fallbackAiPaint = {
    layerName: `Capa Gemini: ${String(prompt || 'Arte IA').slice(0, 24)}`,
    strokes: [
      {
        tool: 'brush',
        color: '#6366f1',
        size: 10,
        opacity: 0.85,
        points: [
          { x: 180, y: 240 },
          { x: 340, y: 180 },
          { x: 520, y: 230 },
          { x: 700, y: 170 },
          { x: 880, y: 220 },
        ],
      },
      {
        tool: 'pen',
        color: '#f59e0b',
        size: 8,
        opacity: 0.9,
        points: [
          { x: 520, y: 130 },
          { x: 550, y: 190 },
          { x: 615, y: 198 },
          { x: 565, y: 240 },
          { x: 580, y: 305 },
          { x: 520, y: 270 },
          { x: 460, y: 305 },
          { x: 475, y: 240 },
          { x: 425, y: 198 },
          { x: 490, y: 190 },
          { x: 520, y: 130 },
        ],
      },
      {
        tool: 'brush',
        color: '#ec4899',
        size: 12,
        opacity: 0.75,
        points: [
          { x: 240, y: 520 },
          { x: 440, y: 450 },
          { x: 640, y: 510 },
          { x: 860, y: 440 },
        ],
      },
    ],
  };

  try {
    const { text } = await generateWithModelFallback({
      models: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
      contents: `Eres un artista co-creador digital. Genera una serie de trazos vectoriales elegantes para pintar: "${prompt || 'adornos mágicos y estrellas'}".
Dimensiones del lienzo: ${canvasWidth}x${canvasHeight}.
Devuelve un JSON con:
{
  "layerName": "Capa Gemini: ${prompt || 'Arte IA'}",
  "strokes": [
    {
      "tool": "brush",
      "color": "#hexcolor",
      "size": 6,
      "opacity": 0.8,
      "points": [{"x": 100, "y": 150}, {"x": 120, "y": 170}, {"x": 150, "y": 200}]
    }
  ]
}
Genera entre 4 y 10 trazos estilizados bien formados con puntos secuenciales.`,
      responseMimeType: 'application/json',
    });

    const parsed = safeParseJson(text, fallbackAiPaint);
    return res.json(parsed);
  } catch {
    return res.json(fallbackAiPaint);
  }
});

// 6. AI Artistic Filter Engine with automatic fallback
app.post('/api/gemini/art-filter', async (req, res) => {
  const {
    imageBase64,
    presetId = 'impressionist_oil',
    presetName = 'Óleo Impresionista',
    customPrompt = '',
    canvasWidth = 1200,
    canvasHeight = 800,
  } = req.body || {};

  const fallbackFilterResponse = {
    palette: ['#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#0f172a'],
    curatorNote: `Estilización ${presetName} aplicada con armonía cromática y textura de estudio.`,
    backgroundTint: presetId === 'none' ? '#ffffff' : '#f8fafc',
    contrast: 112,
    saturation: 122,
    sepia: 8,
    hueRotate: 0,
    vignetteIntensity: 0.22,
    accentStrokes: [
      {
        tool: 'brush',
        color: '#f59e0b',
        size: 8,
        opacity: 0.6,
        points: [
          { x: 160, y: 140 },
          { x: 240, y: 125 },
          { x: 320, y: 150 },
        ],
      },
      {
        tool: 'brush',
        color: '#3b82f6',
        size: 8,
        opacity: 0.6,
        points: [
          { x: 840, y: 620 },
          { x: 930, y: 600 },
          { x: 1020, y: 630 },
        ],
      },
    ],
  };

  try {
    const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
    if (imageBase64 && typeof imageBase64 === 'string') {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      if (cleanBase64.length > 100) {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: cleanBase64,
          },
        });
      }
    }

    const filterInstructions = `
Eres un director de arte digital experto en estilización pictórica.
Analiza la obra actual del lienzo (${canvasWidth}x${canvasHeight}) y transfórmala aplicando el filtro artístico: "${presetName}" (ID: "${presetId}").
${customPrompt ? `Instrucción adicional del artista: "${customPrompt}".` : ''}

Devuelve OBLIGATORIAMENTE un JSON con esta estructura exacta:
{
  "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5", "#hex6"],
  "curatorNote": "1 frase evocadora describiendo cómo este filtro transforma la luz, textura y paleta de las capas.",
  "backgroundTint": "#hexcolor acorde al estilo",
  "contrast": número entre 95 y 135,
  "saturation": número entre 85 y 145,
  "sepia": número entre 0 y 45,
  "hueRotate": número entre -25 y 25,
  "vignetteIntensity": número entre 0.15 y 0.55,
  "accentStrokes": [
    {
      "tool": "brush",
      "color": "#hexcolor",
      "size": 8,
      "opacity": 0.65,
      "points": [{"x": 180, "y": 140}, {"x": 220, "y": 155}, {"x": 260, "y": 145}]
    }
  ]
}
Genera entre 5 y 8 trazos artísticos complementarios ("accentStrokes") que armonicen con el estilo "${presetName}" distribuidos por el lienzo (${canvasWidth}x${canvasHeight}).
`;

    parts.push({ text: filterInstructions });

    const { text } = await generateWithModelFallback({
      models: ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
      contents: { parts },
      responseMimeType: 'application/json',
    });

    const parsed = safeParseJson(text, fallbackFilterResponse);
    return res.json(parsed);
  } catch {
    return res.json(fallbackFilterResponse);
  }
});

// 7. Self-Contained Standalone Mobile App Builder (Single-File HTML Bundle with 0 external dependencies)
app.get('/api/apk/standalone', async (_req, res) => {
  try {
    const prebuiltPath = path.resolve(__dirname, 'public', 'Pincelada-Colab-App-Completa.html');
    const distDir = path.resolve(__dirname, 'dist');
    const distIndex = path.join(distDir, 'index.html');

    // If dist/index.html is missing, check prebuilt or trigger Vite build on demand
    if (!fs.existsSync(distIndex)) {
      if (fs.existsSync(prebuiltPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="Pincelada-Colab-App-Completa.html"'
        );
        return res.sendFile(prebuiltPath);
      }
      const { build } = await import('vite');
      await build();
    }

    const assetsDir = path.join(distDir, 'assets');
    let html = fs.readFileSync(distIndex, 'utf-8');

    // Remove manifest, registerSW, and external icon links that fail on file:// protocol
    html = html.replace(/<link[^>]+rel="manifest"[^>]*>/gi, '');
    html = html.replace(/<link[^>]+rel="apple-touch-icon"[^>]*>/gi, '');
    html = html.replace(/<link[^>]+rel="icon"[^>]*>/gi, '');
    html = html.replace(/<script[^>]+src="\/registerSW\.js"[^>]*><\/script>/gi, '');

    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      const cssFiles = files.filter((f) => f.endsWith('.css'));
      const jsFiles = files.filter((f) => f.endsWith('.js'));

      let combinedCss = '';
      for (const cssFile of cssFiles) {
        combinedCss += fs.readFileSync(path.join(assetsDir, cssFile), 'utf-8') + '\n';
      }

      let combinedJs = '';
      for (const jsFile of jsFiles) {
        combinedJs += fs.readFileSync(path.join(assetsDir, jsFile), 'utf-8') + '\n';
      }

      // Remove external <script src="/assets/..."> and <link rel="stylesheet" href="/assets/...">
      html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="\/assets\/[^"]+"[^>]*>/gi, '');
      html = html.replace(/<script[^>]+src="\/assets\/[^"]+"[^>]*><\/script>/gi, '');

      // Escape any literal </script> inside JS bundle so inline script tag never closes early
      const safeJs = combinedJs.replace(/<\/script>/gi, '<\\/script>');

      // CRITICAL: Use replacement functions () => ... so $& and $' in minified JS are NEVER corrupted!
      html = html.replace('</head>', () => `<style>${combinedCss}</style>\n</head>`);
      html = html.replace(
        '</body>',
        () => `<script type="module">\n${safeJs}\n</script>\n</body>`
      );
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Pincelada-Colab-App-Completa.html"'
    );
    return res.send(html);
  } catch (err) {
    console.warn('Could not build standalone bundle from dist:', err);
    return res.status(500).json({ error: 'No se pudo empaquetar la versión autónoma' });
  }
});

const server = http.createServer(app);

// WebSocket Server for Multi-User Real-Time Sync
const wss = new WebSocketServer({ noServer: true });

// Quiet WebSocket acceptor for any legacy @vite/client vite-hmr connections so they never fail handshake
const hmrWss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols) => (protocols.has('vite-hmr') ? 'vite-hmr' : false),
});

hmrWss.on('connection', (ws: WebSocket) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'connected' }));
  }
});

server.on('upgrade', (request, socket, head) => {
  const protocolHeader = String(request.headers['sec-websocket-protocol'] || '');
  if (protocolHeader.includes('vite-hmr')) {
    hmrWss.handleUpgrade(request, socket, head, (ws) => {
      hmrWss.emit('connection', ws, request);
    });
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw: string) => {
    try {
      const msg = JSON.parse(raw);
      const { type } = msg;

      switch (type) {
        case 'join_room': {
          const { roomId = 'CANVAS-1', user } = msg;
          const room = getOrCreateRoom(roomId);

          socketClients.set(ws, {
            roomId,
            userId: user.id,
            ws,
          });

          const presence: UserPresence = {
            id: user.id,
            name: user.name || 'Artista Anónimo',
            avatar: user.avatar || '🎨',
            color: user.color || '#38bdf8',
            x: 0,
            y: 0,
            isDrawing: false,
            activeLayerId: room.layers[room.layers.length - 1]?.id || 'layer-sketch',
            lastSeen: Date.now(),
          };
          room.activeUsers[user.id] = presence;
          room.history = buildHistorySummary(roomId);

          // Send current full authoritative room state to the newly connected user
          ws.send(
            JSON.stringify({
              type: 'room_state',
              room,
              yourId: user.id,
            })
          );

          // Broadcast to everyone else that a new player joined
          broadcastToRoom(
            roomId,
            {
              type: 'user_joined',
              user: presence,
            },
            ws
          );
          break;
        }

        case 'cursor_move': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room || !room.activeUsers[meta.userId]) return;

          const u = room.activeUsers[meta.userId];
          u.x = msg.x;
          u.y = msg.y;
          u.isDrawing = Boolean(msg.isDrawing);
          if (msg.activeLayerId) u.activeLayerId = msg.activeLayerId;
          u.lastSeen = Date.now();

          broadcastToRoom(
            meta.roomId,
            {
              type: 'cursor_update',
              userId: meta.userId,
              x: msg.x,
              y: msg.y,
              isDrawing: u.isDrawing,
              activeLayerId: u.activeLayerId,
            },
            ws
          );
          break;
        }

        case 'stroke_start': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const stroke: Stroke = msg.stroke;
          const targetLayer = room.layers.find((l) => l.id === stroke.layerId);
          if (targetLayer && !targetLayer.locked) {
            // Guard against duplicate stroke IDs
            if (targetLayer.strokes.some((s) => s.id === stroke.id)) return;

            const beforeLayers = cloneLayers(room.layers);
            targetLayer.strokes.push(stroke);

            const toolLabels: Record<string, string> = {
              brush: 'Pincel',
              pen: 'Pluma',
              spray: 'Aerógrafo',
              highlighter: 'Marcador',
              eraser: 'Borrador',
              stamp: 'Sello',
              line: 'Línea',
            };
            const toolLabel = toolLabels[stroke.tool] || 'Trazo';

            recordHistoryAction(room, {
              userId: stroke.userId || meta.userId,
              userName: stroke.userName || room.activeUsers[meta.userId]?.name || 'Artista',
              userColor: stroke.userColor || room.activeUsers[meta.userId]?.color || '#38bdf8',
              actionType: 'stroke',
              description: `${toolLabel} en ${targetLayer.name}`,
              layerId: targetLayer.id,
              layerName: targetLayer.name,
              strokeId: stroke.id,
              beforeLayers,
              afterLayers: room.layers,
            });

            broadcastToRoom(
              meta.roomId,
              {
                type: 'stroke_started',
                stroke,
                history: room.history,
              },
              ws
            );

            // Also send updated history summary back to sender
            ws.send(
              JSON.stringify({
                type: 'history_updated',
                history: room.history,
              })
            );
          }
          break;
        }

        case 'stroke_point': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const { strokeId, layerId, point } = msg;
          const targetLayer = room.layers.find((l) => l.id === layerId);
          if (targetLayer) {
            const st = targetLayer.strokes.find((s) => s.id === strokeId);
            if (st) {
              st.points.push(point);
            }
          }

          // O(1) incremental point append in history record instead of full deep-clone per point
          const stack = getOrCreateHistoryStack(meta.roomId);
          for (let i = stack.undoStack.length - 1; i >= 0; i--) {
            if (stack.undoStack[i].strokeId === strokeId) {
              const histLayer = stack.undoStack[i].afterLayers.find((l) => l.id === layerId);
              const histStroke = histLayer?.strokes.find((s) => s.id === strokeId);
              if (histStroke) {
                histStroke.points.push(point);
              }
              break;
            }
          }

          broadcastToRoom(
            meta.roomId,
            {
              type: 'stroke_point_added',
              strokeId,
              layerId,
              point,
            },
            ws
          );
          break;
        }

        case 'stroke_end': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (room) {
            const stack = getOrCreateHistoryStack(meta.roomId);
            for (let i = stack.undoStack.length - 1; i >= 0; i--) {
              if (stack.undoStack[i].strokeId === msg.strokeId) {
                stack.undoStack[i].afterLayers = cloneLayers(room.layers);
                break;
              }
            }
          }

          broadcastToRoom(
            meta.roomId,
            {
              type: 'stroke_completed',
              strokeId: msg.strokeId,
              layerId: msg.layerId,
            },
            ws
          );
          break;
        }

        // GLOBAL UNDO / REDO OPERATIONS (Synchronized across all collaborators)
        case 'history_undo': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const stack = getOrCreateHistoryStack(meta.roomId);
          if (stack.undoStack.length === 0) return;

          const record = stack.undoStack.pop()!;
          stack.redoStack.push(record);

          room.layers = cloneLayers(record.beforeLayers);
          room.activeFilter = cloneFilter(record.beforeFilter);

          const actor = room.activeUsers[meta.userId];
          const actorName = actor?.name || 'Colaborador';
          const actorColor = actor?.color || '#38bdf8';

          stack.lastToast = {
            id: `toast-${Date.now()}`,
            text: `${actorName} deshizo: ${record.description}`,
            userName: actorName,
            userColor: actorColor,
          };

          room.history = buildHistorySummary(meta.roomId);

          broadcastToRoom(meta.roomId, {
            type: 'history_synced',
            layers: room.layers,
            activeFilter: room.activeFilter,
            history: room.history,
            action: 'undo',
            triggeredBy: actorName,
          });
          break;
        }

        case 'history_redo': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const stack = getOrCreateHistoryStack(meta.roomId);
          if (stack.redoStack.length === 0) return;

          const record = stack.redoStack.pop()!;
          stack.undoStack.push(record);

          room.layers = cloneLayers(record.afterLayers);
          room.activeFilter = cloneFilter(record.afterFilter);

          const actor = room.activeUsers[meta.userId];
          const actorName = actor?.name || 'Colaborador';
          const actorColor = actor?.color || '#38bdf8';

          stack.lastToast = {
            id: `toast-${Date.now()}`,
            text: `${actorName} rehizo: ${record.description}`,
            userName: actorName,
            userColor: actorColor,
          };

          room.history = buildHistorySummary(meta.roomId);

          broadcastToRoom(meta.roomId, {
            type: 'history_synced',
            layers: room.layers,
            activeFilter: room.activeFilter,
            history: room.history,
            action: 'redo',
            triggeredBy: actorName,
          });
          break;
        }

        case 'history_jump': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const { targetHistoryId } = msg;
          const stack = getOrCreateHistoryStack(meta.roomId);

          const undoIndex = stack.undoStack.findIndex((r) => r.id === targetHistoryId);
          const redoIndex = stack.redoStack.findIndex((r) => r.id === targetHistoryId);

          const actor = room.activeUsers[meta.userId];
          const actorName = actor?.name || 'Colaborador';
          const actorColor = actor?.color || '#38bdf8';

          if (undoIndex !== -1) {
            // Undo down to undoIndex (keep undoIndex in undoStack so state reflects right after that record)
            while (stack.undoStack.length - 1 > undoIndex) {
              const popped = stack.undoStack.pop()!;
              stack.redoStack.push(popped);
            }
            const targetRecord = stack.undoStack[stack.undoStack.length - 1];
            room.layers = cloneLayers(targetRecord.afterLayers);
            room.activeFilter = cloneFilter(targetRecord.afterFilter);
            stack.lastToast = {
              id: `toast-${Date.now()}`,
              text: `${actorName} restauró historial a: ${targetRecord.description}`,
              userName: actorName,
              userColor: actorColor,
            };
          } else if (redoIndex !== -1) {
            // Redo up until targetHistoryId is popped from redoStack onto undoStack
            while (stack.redoStack.length > 0) {
              const popped = stack.redoStack.pop()!;
              stack.undoStack.push(popped);
              if (popped.id === targetHistoryId) {
                room.layers = cloneLayers(popped.afterLayers);
                room.activeFilter = cloneFilter(popped.afterFilter);
                stack.lastToast = {
                  id: `toast-${Date.now()}`,
                  text: `${actorName} avanzó historial a: ${popped.description}`,
                  userName: actorName,
                  userColor: actorColor,
                };
                break;
              }
            }
          } else {
            return;
          }

          room.history = buildHistorySummary(meta.roomId);
          broadcastToRoom(meta.roomId, {
            type: 'history_synced',
            layers: room.layers,
            activeFilter: room.activeFilter,
            history: room.history,
            action: 'jump',
            triggeredBy: actorName,
          });
          break;
        }

        // AI ARTISTIC FILTER APPLICATION (Real-time synced + tracked in Undo/Redo history)
        case 'apply_ai_filter': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const {
            filterConfig,
            palette,
            targetScope = 'all',
            activeLayerId,
            accentStrokes = [],
          } = msg;

          const beforeLayers = cloneLayers(room.layers);
          const beforeFilter = cloneFilter(room.activeFilter);

          const actor = room.activeUsers[meta.userId];
          const actorName = actor?.name || 'Artista';
          const actorColor = actor?.color || '#38bdf8';

          // 1. Update room's active artistic filter configuration
          if (filterConfig) {
            room.activeFilter = {
              ...room.activeFilter,
              ...filterConfig,
              appliedBy: actorName,
            };
          }

          // 2. Harmonize existing stroke colors with the AI filter palette if provided
          if (Array.isArray(palette) && palette.length > 0) {
            room.layers.forEach((layer) => {
              if (layer.locked) return;
              if (targetScope === 'active_layer' && layer.id !== activeLayerId) return;

              layer.strokes.forEach((stroke, idx) => {
                if (stroke.tool !== 'eraser') {
                  stroke.color = palette[idx % palette.length];
                }
              });
            });
          }

          // 3. Add AI accent strokes if provided
          if (Array.isArray(accentStrokes) && accentStrokes.length > 0) {
            const targetLayer =
              room.layers.find((l) => l.id === activeLayerId && !l.locked) ||
              room.layers[room.layers.length - 1];

            if (targetLayer && !targetLayer.locked) {
              const formattedStrokes: Stroke[] = accentStrokes.map(
                (st: Partial<Stroke>, index: number) => ({
                  id: `stroke-filter-${Date.now()}-${index}`,
                  layerId: targetLayer.id,
                  userId: meta.userId,
                  userName: `IA · ${actorName}`,
                  userColor: actorColor,
                  tool: (st.tool as Stroke['tool']) || 'brush',
                  color: st.color || (palette && palette[index % palette.length]) || '#f59e0b',
                  size: st.size || 7,
                  opacity: st.opacity || 0.7,
                  points: Array.isArray(st.points) ? st.points : [],
                  timestamp: Date.now(),
                })
              );
              targetLayer.strokes.push(...formattedStrokes);
            }
          }

          recordHistoryAction(room, {
            userId: meta.userId,
            userName: actorName,
            userColor: actorColor,
            actionType: 'ai_filter',
            description: `Filtro IA: ${room.activeFilter.name}`,
            beforeLayers,
            afterLayers: room.layers,
            beforeFilter,
            afterFilter: room.activeFilter,
          });

          broadcastToRoom(meta.roomId, {
            type: 'filter_and_layers_updated',
            layers: room.layers,
            activeFilter: room.activeFilter,
            history: room.history,
            byUser: actorName,
          });
          break;
        }

        // LAYER OPERATIONS - Full Real-time Sync + Global History Tracking
        case 'layer_create': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const beforeLayers = cloneLayers(room.layers);
          const actor = room.activeUsers[meta.userId];

          const newLayer: Layer = {
            id: `layer-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: msg.name || `Capa ${room.layers.length + 1}`,
            opacity: 1,
            visible: true,
            locked: false,
            strokes: msg.strokes || [],
          };
          room.layers.push(newLayer);

          recordHistoryAction(room, {
            userId: meta.userId,
            userName: actor?.name || 'Artista',
            userColor: actor?.color || '#38bdf8',
            actionType: msg.strokes?.length ? 'ai_paint' : 'layer_create',
            description: msg.strokes?.length
              ? `Capa generativa: ${newLayer.name}`
              : `Nueva capa: ${newLayer.name}`,
            layerId: newLayer.id,
            layerName: newLayer.name,
            beforeLayers,
            afterLayers: room.layers,
          });

          broadcastToRoom(meta.roomId, {
            type: 'layers_updated',
            layers: room.layers,
            history: room.history,
            action: 'create',
            layerId: newLayer.id,
            byUser: meta.userId,
          });
          break;
        }

        case 'layer_delete': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          if (room.layers.length <= 1) return;

          const targetLayer = room.layers.find((l) => l.id === msg.layerId);
          if (!targetLayer) return;

          const beforeLayers = cloneLayers(room.layers);
          const actor = room.activeUsers[meta.userId];

          room.layers = room.layers.filter((l) => l.id !== msg.layerId);

          recordHistoryAction(room, {
            userId: meta.userId,
            userName: actor?.name || 'Artista',
            userColor: actor?.color || '#38bdf8',
            actionType: 'layer_delete',
            description: `Eliminó ${targetLayer.name}`,
            layerId: targetLayer.id,
            layerName: targetLayer.name,
            beforeLayers,
            afterLayers: room.layers,
          });

          broadcastToRoom(meta.roomId, {
            type: 'layers_updated',
            layers: room.layers,
            history: room.history,
            action: 'delete',
            layerId: msg.layerId,
            byUser: meta.userId,
          });
          break;
        }

        case 'layer_update': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const target = room.layers.find((l) => l.id === msg.layerId);
          if (target) {
            if (typeof msg.opacity === 'number') target.opacity = Math.max(0, Math.min(1, msg.opacity));
            if (typeof msg.visible === 'boolean') target.visible = msg.visible;
            if (typeof msg.locked === 'boolean') target.locked = msg.locked;
            if (typeof msg.name === 'string') target.name = msg.name;
          }

          broadcastToRoom(meta.roomId, {
            type: 'layers_updated',
            layers: room.layers,
            history: room.history,
            action: 'update',
            layerId: msg.layerId,
            byUser: meta.userId,
          });
          break;
        }

        case 'layer_merge': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const { sourceLayerId, targetLayerId } = msg;
          const sourceIdx = room.layers.findIndex((l) => l.id === sourceLayerId);
          const targetIdx = room.layers.findIndex((l) => l.id === targetLayerId);

          if (sourceIdx !== -1 && targetIdx !== -1 && sourceIdx !== targetIdx) {
            const beforeLayers = cloneLayers(room.layers);
            const actor = room.activeUsers[meta.userId];

            const sourceLayer = room.layers[sourceIdx];
            const targetLayer = room.layers[targetIdx];

            const mergedStrokes = sourceLayer.strokes.map((s) => ({
              ...s,
              layerId: targetLayer.id,
              opacity: s.opacity * sourceLayer.opacity,
            }));

            targetLayer.strokes.push(...mergedStrokes);
            room.layers.splice(sourceIdx, 1);

            recordHistoryAction(room, {
              userId: meta.userId,
              userName: actor?.name || 'Artista',
              userColor: actor?.color || '#38bdf8',
              actionType: 'layer_merge',
              description: `Fusionó ${sourceLayer.name} en ${targetLayer.name}`,
              layerId: targetLayer.id,
              layerName: targetLayer.name,
              beforeLayers,
              afterLayers: room.layers,
            });

            broadcastToRoom(meta.roomId, {
              type: 'layers_updated',
              layers: room.layers,
              history: room.history,
              action: 'merge',
              sourceLayerId,
              targetLayerId,
              byUser: meta.userId,
            });
          }
          break;
        }

        case 'layer_reorder': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const { layerIds } = msg;
          if (Array.isArray(layerIds)) {
            const beforeLayers = cloneLayers(room.layers);
            const actor = room.activeUsers[meta.userId];

            const layerMap = new Map(room.layers.map((l) => [l.id, l]));
            const newOrdered: Layer[] = [];
            for (const id of layerIds) {
              const layer = layerMap.get(id);
              if (layer) newOrdered.push(layer);
            }
            for (const l of room.layers) {
              if (!newOrdered.some((x) => x.id === l.id)) newOrdered.push(l);
            }
            room.layers = newOrdered;

            recordHistoryAction(room, {
              userId: meta.userId,
              userName: actor?.name || 'Artista',
              userColor: actor?.color || '#38bdf8',
              actionType: 'layer_reorder',
              description: 'Reordenó pila de capas',
              beforeLayers,
              afterLayers: room.layers,
            });

            broadcastToRoom(meta.roomId, {
              type: 'layers_updated',
              layers: room.layers,
              history: room.history,
              action: 'reorder',
              byUser: meta.userId,
            });
          }
          break;
        }

        case 'layer_clear': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const target = room.layers.find((l) => l.id === msg.layerId);
          if (target && !target.locked) {
            const beforeLayers = cloneLayers(room.layers);
            const actor = room.activeUsers[meta.userId];

            target.strokes = [];

            recordHistoryAction(room, {
              userId: meta.userId,
              userName: actor?.name || 'Artista',
              userColor: actor?.color || '#38bdf8',
              actionType: 'layer_clear',
              description: `Limpió trazos de ${target.name}`,
              layerId: target.id,
              layerName: target.name,
              beforeLayers,
              afterLayers: room.layers,
            });

            broadcastToRoom(meta.roomId, {
              type: 'layers_updated',
              layers: room.layers,
              history: room.history,
              action: 'clear',
              layerId: msg.layerId,
              byUser: meta.userId,
            });
          }
          break;
        }

        case 'game_start_round': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          room.gameMode = msg.gameMode || 'speed_battle';
          room.roundDuration = msg.duration || 90;
          room.timeLeft = room.roundDuration;
          room.gamePhase = 'playing';
          room.currentTheme = msg.theme || '¡Crea la criatura fantástica más épica!';
          room.critiqueResult = null;

          broadcastToRoom(meta.roomId, {
            type: 'game_phase_changed',
            phase: 'playing',
            timeLeft: room.timeLeft,
            theme: room.currentTheme,
            gameMode: room.gameMode,
            room,
          });
          break;
        }

        case 'game_reset': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const stack = getOrCreateHistoryStack(meta.roomId);
          stack.undoStack = [];
          stack.redoStack = [];
          stack.lastToast = null;

          room.gamePhase = 'lobby';
          room.layers = createDefaultLayers();
          room.activeFilter = createDefaultFilter();
          room.history = buildHistorySummary(meta.roomId);
          room.critiqueResult = null;

          broadcastToRoom(meta.roomId, {
            type: 'game_phase_changed',
            phase: 'lobby',
            room,
          });
          break;
        }

        case 'chat_message': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const chatItem: ChatMessage = {
            id: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            userId: meta.userId,
            userName: msg.userName || 'Artista',
            userColor: msg.userColor || '#38bdf8',
            text: msg.text,
            timestamp: Date.now(),
          };
          room.chatMessages.push(chatItem);
          if (room.chatMessages.length > 50) room.chatMessages.shift();

          broadcastToRoom(meta.roomId, {
            type: 'chat_broadcast',
            message: chatItem,
          });
          break;
        }

        case 'gallery_save': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const artwork: GalleryArtwork = msg.artwork;
          if (!artwork || !artwork.id) return;

          const existingIdx = room.gallery.findIndex((a) => a.id === artwork.id);
          if (existingIdx !== -1) {
            room.gallery[existingIdx] = artwork;
          } else {
            room.gallery.unshift(artwork);
            if (room.gallery.length > 24) {
              room.gallery.pop();
            }
          }

          broadcastToRoom(meta.roomId, {
            type: 'gallery_updated',
            gallery: room.gallery,
            savedArtwork: artwork,
          });
          break;
        }

        case 'gallery_delete': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const { artworkId } = msg;
          room.gallery = room.gallery.filter((a) => a.id !== artworkId);

          broadcastToRoom(meta.roomId, {
            type: 'gallery_updated',
            gallery: room.gallery,
            deletedArtworkId: artworkId,
          });
          break;
        }

        case 'gallery_restore': {
          const meta = socketClients.get(ws);
          if (!meta) return;
          const room = rooms.get(meta.roomId);
          if (!room) return;

          const artwork: GalleryArtwork = msg.artwork;
          if (!artwork || !Array.isArray(artwork.layersSnapshot) || artwork.layersSnapshot.length === 0) {
            return;
          }

          const beforeLayers = cloneLayers(room.layers);
          const beforeFilter = cloneFilter(room.activeFilter);
          const actor = room.activeUsers[meta.userId];
          const actorName = actor?.name || 'Artista';
          const actorColor = actor?.color || '#38bdf8';

          room.layers = cloneLayers(artwork.layersSnapshot);
          if (artwork.filterSnapshot) {
            room.activeFilter = cloneFilter(artwork.filterSnapshot);
          }

          recordHistoryAction(room, {
            userId: meta.userId,
            userName: actorName,
            userColor: actorColor,
            actionType: 'gallery_restore',
            description: `Cargó de galería: ${artwork.title}`,
            beforeLayers,
            afterLayers: room.layers,
            beforeFilter,
            afterFilter: room.activeFilter,
          });

          broadcastToRoom(meta.roomId, {
            type: 'filter_and_layers_updated',
            layers: room.layers,
            activeFilter: room.activeFilter,
            history: room.history,
            byUser: actorName,
          });
          break;
        }
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    const meta = socketClients.get(ws);
    if (meta) {
      const room = rooms.get(meta.roomId);
      if (room && room.activeUsers[meta.userId]) {
        delete room.activeUsers[meta.userId];
        broadcastToRoom(meta.roomId, {
          type: 'user_left',
          userId: meta.userId,
        });
      }
      socketClients.delete(ws);
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🎨 Pincelada Colab server listening on port ${PORT}`);
  });
}

startServer();
