import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TitleScreen } from './components/TitleScreen';
import { DrawingCanvas } from './components/DrawingCanvas';
import { LayerPanel } from './components/LayerPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { AIArtFilterModal, ART_FILTER_PRESETS } from './components/AIArtFilterModal';
import { Toolbar } from './components/Toolbar';
import { GameHUD } from './components/GameHUD';
import { CritiqueModal } from './components/CritiqueModal';
import { VoicePromptModal } from './components/VoicePromptModal';
import { GalleryModal } from './components/GalleryModal';
import {
  Layer,
  Stroke,
  Point,
  UserPresence,
  GameMode,
  GamePhase,
  ToolType,
  ArtCritiqueResult,
  ArtFilterConfig,
  HistorySummary,
  HistorySummaryItem,
  HistoryActionType,
  GalleryArtwork,
} from './types/game';
import {
  loadLocalGallery,
  upsertArtworkInGallery,
  mergeGalleryLists,
  removeArtworkFromLocalGallery,
  createCompactThumbnail,
} from './utils/galleryStorage';
import { sound } from './utils/audio';

export default function App() {
  // Navigation / Shell Phase
  const [inGame, setInGame] = useState(false);

  // User Profile
  const [currentUser, setCurrentUser] = useState({
    id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: 'Artista',
    avatar: '🎨',
    color: '#3b82f6',
  });
  const [roomId, setRoomId] = useState('ARTE-1');

  // Authoritative Room & Layer State
  const [layers, setLayers] = useState<Layer[]>([
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
  ]);
  const [activeFilter, setActiveFilter] = useState<ArtFilterConfig>(
    ART_FILTER_PRESETS[0].defaultConfig
  );
  const [history, setHistory] = useState<HistorySummary>({
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
    lastActionToast: null,
    items: [],
  });
  const [historyToast, setHistoryToast] = useState<string>('');

  const [activeLayerId, setActiveLayerId] = useState<string>('layer-sketch');
  const [activeUsers, setActiveUsers] = useState<Record<string, UserPresence>>({});
  const [gameMode, setGameMode] = useState<GameMode>('free_studio');
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby');
  const [currentTheme, setCurrentTheme] = useState('Crea tu obra maestra colaborativa en capas');
  const [timeLeft, setTimeLeft] = useState(120);

  // Drawing Tools State
  const [currentTool, setCurrentTool] = useState<ToolType>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#0f172a');
  const [brushSize, setBrushSize] = useState<number>(10);
  const [brushOpacity, setBrushOpacity] = useState<number>(1);

  // UI Panels
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isCritiqueModalOpen, setIsCritiqueModalOpen] = useState(false);
  const [critiqueResult, setCritiqueResult] = useState<ArtCritiqueResult | null>(null);
  const [isCritiqueLoading, setIsCritiqueLoading] = useState(false);
  const [canvasSnapshotUrl, setCanvasSnapshotUrl] = useState<string>('');

  // Room + Local Gallery State
  const [galleryArtworks, setGalleryArtworks] = useState<GalleryArtwork[]>(() =>
    loadLocalGallery('ARTE-1')
  );

  // AI states
  const [isAiPainting, setIsAiPainting] = useState(false);
  const [isAiGuessing, setIsAiGuessing] = useState(false);
  const [aiGuessText, setAiGuessText] = useState('');

  // WebSocket & Performance Refs
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Buffer in-flight local stroke points to avoid re-rendering React tree on every pointermove
  const localStrokePointsRef = useRef<{
    strokeId: string;
    layerId: string;
    points: Point[];
  } | null>(null);

  const showTimedToast = useCallback((message: string) => {
    setHistoryToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setHistoryToast('');
    }, 4000);
  }, []);

  // Local Undo/Redo fallback stack when running as a standalone mobile app / offline browser
  interface LocalHistoryRecord {
    id: string;
    timestamp: number;
    userId: string;
    userName: string;
    userColor: string;
    actionType: HistoryActionType;
    description: string;
    layerName?: string;
    beforeLayers: Layer[];
    afterLayers: Layer[];
    beforeFilter: ArtFilterConfig;
    afterFilter: ArtFilterConfig;
  }

  const localHistoryRef = useRef<{
    undoStack: LocalHistoryRecord[];
    redoStack: LocalHistoryRecord[];
  }>({
    undoStack: [],
    redoStack: [],
  });

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const activeFilterRef = useRef(activeFilter);
  activeFilterRef.current = activeFilter;

  const isWsConnected = useCallback(() => {
    return Boolean(wsRef.current && wsRef.current.readyState === WebSocket.OPEN);
  }, []);

  const syncLocalHistorySummary = useCallback(() => {
    const { undoStack, redoStack } = localHistoryRef.current;
    const undoItems: HistorySummaryItem[] = undoStack.map((r) => ({
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
    const redoItems: HistorySummaryItem[] = [...redoStack].reverse().map((r) => ({
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
    setHistory({
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
      items: [...undoItems, ...redoItems].slice(-35),
    });
  }, []);

  const pushLocalHistory = useCallback(
    (params: {
      actionType: HistoryActionType;
      description: string;
      layerName?: string;
      beforeLayers: Layer[];
      afterLayers: Layer[];
      beforeFilter?: ArtFilterConfig;
      afterFilter?: ArtFilterConfig;
    }) => {
      const record: LocalHistoryRecord = {
        id: `local-hist-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        timestamp: Date.now(),
        userId: currentUserRef.current.id,
        userName: currentUserRef.current.name,
        userColor: currentUserRef.current.color,
        actionType: params.actionType,
        description: params.description,
        layerName: params.layerName,
        beforeLayers: JSON.parse(JSON.stringify(params.beforeLayers)),
        afterLayers: JSON.parse(JSON.stringify(params.afterLayers)),
        beforeFilter: JSON.parse(JSON.stringify(params.beforeFilter || activeFilterRef.current)),
        afterFilter: JSON.parse(JSON.stringify(params.afterFilter || activeFilterRef.current)),
      };
      localHistoryRef.current.undoStack.push(record);
      if (localHistoryRef.current.undoStack.length > 40) {
        localHistoryRef.current.undoStack.shift();
      }
      localHistoryRef.current.redoStack = [];
      if (!isWsConnected()) {
        syncLocalHistorySummary();
      }
    },
    [isWsConnected, syncLocalHistorySummary]
  );

  // Send message safely through WebSocket
  const sendWs = useCallback((msg: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // Global Undo / Redo Handlers (Server-authoritative when connected, local when standalone)
  const handleUndo = useCallback(() => {
    if (isWsConnected()) {
      sendWs({ type: 'history_undo' });
      return;
    }
    const stack = localHistoryRef.current;
    if (stack.undoStack.length === 0) return;
    const record = stack.undoStack.pop()!;
    stack.redoStack.push(record);
    setLayers(JSON.parse(JSON.stringify(record.beforeLayers)));
    setActiveFilter(JSON.parse(JSON.stringify(record.beforeFilter)));
    syncLocalHistorySummary();
    showTimedToast(`Deshiciste: ${record.description}`);
  }, [isWsConnected, sendWs, syncLocalHistorySummary, showTimedToast]);

  const handleRedo = useCallback(() => {
    if (isWsConnected()) {
      sendWs({ type: 'history_redo' });
      return;
    }
    const stack = localHistoryRef.current;
    if (stack.redoStack.length === 0) return;
    const record = stack.redoStack.pop()!;
    stack.undoStack.push(record);
    setLayers(JSON.parse(JSON.stringify(record.afterLayers)));
    setActiveFilter(JSON.parse(JSON.stringify(record.afterFilter)));
    syncLocalHistorySummary();
    showTimedToast(`Rehiciste: ${record.description}`);
  }, [isWsConnected, sendWs, syncLocalHistorySummary, showTimedToast]);

  const handleJumpToHistory = useCallback(
    (targetHistoryId: string) => {
      if (isWsConnected()) {
        sendWs({
          type: 'history_jump',
          targetHistoryId,
        });
        return;
      }
      const stack = localHistoryRef.current;
      const undoIndex = stack.undoStack.findIndex((r) => r.id === targetHistoryId);
      const redoIndex = stack.redoStack.findIndex((r) => r.id === targetHistoryId);
      if (undoIndex !== -1) {
        while (stack.undoStack.length - 1 > undoIndex) {
          stack.redoStack.push(stack.undoStack.pop()!);
        }
        const target = stack.undoStack[stack.undoStack.length - 1];
        setLayers(JSON.parse(JSON.stringify(target.afterLayers)));
        setActiveFilter(JSON.parse(JSON.stringify(target.afterFilter)));
        syncLocalHistorySummary();
      } else if (redoIndex !== -1) {
        while (stack.redoStack.length > 0) {
          const popped = stack.redoStack.pop()!;
          stack.undoStack.push(popped);
          if (popped.id === targetHistoryId) {
            setLayers(JSON.parse(JSON.stringify(popped.afterLayers)));
            setActiveFilter(JSON.parse(JSON.stringify(popped.afterFilter)));
            break;
          }
        }
        syncLocalHistorySummary();
      }
    },
    [isWsConnected, sendWs, syncLocalHistorySummary]
  );

  // Global Keyboard Shortcuts for Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Cmd+Shift+Z)
  useEffect(() => {
    if (!inGame) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (history.canUndo) {
          sound.playUndo();
          handleUndo();
        }
      } else if (
        (isMod && e.key.toLowerCase() === 'y') ||
        (isMod && e.key.toLowerCase() === 'z' && e.shiftKey)
      ) {
        e.preventDefault();
        if (history.canRedo) {
          sound.playRedo();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inGame, history.canUndo, history.canRedo, handleUndo, handleRedo]);

  // Get current merged canvas snapshot as base64 data URL
  const getCanvasSnapshot = useCallback((): string => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  }, []);

  // Build and persist a completed artwork to both localStorage and room WebSocket
  const saveArtworkToGallery = useCallback(
    async (options?: {
      customTitle?: string;
      critiqueData?: ArtCritiqueResult | null;
      snapshotDataUrl?: string;
    }) => {
      const canvasEl = document.querySelector('canvas') as HTMLCanvasElement | null;
      const sourceSnapshot = options?.snapshotDataUrl || (canvasEl ? canvasEl : getCanvasSnapshot());
      if (!sourceSnapshot) return;

      const bgTint =
        activeFilter && activeFilter.id !== 'none' && activeFilter.backgroundTint
          ? activeFilter.backgroundTint
          : '#ffffff';

      const thumbUrl = await createCompactThumbnail(sourceSnapshot, bgTint);
      const totalStrokes = layers.reduce((acc, l) => acc + l.strokes.length, 0);

      const activeUsersList = Object.values(activeUsers);
      const artists =
        activeUsersList.length > 0
          ? activeUsersList.map((u) => ({
              id: u.id,
              name: u.name,
              avatar: u.avatar,
              color: u.color,
            }))
          : [
              {
                id: currentUserRef.current.id,
                name: currentUserRef.current.name,
                avatar: currentUserRef.current.avatar,
                color: currentUserRef.current.color,
              },
            ];

      const resolvedTitle =
        options?.customTitle ||
        options?.critiqueData?.title ||
        currentTheme ||
        `Obra Colaborativa #${galleryArtworks.length + 1}`;

      const newArtwork: GalleryArtwork = {
        id: `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        roomId,
        title: resolvedTitle,
        theme: currentTheme,
        thumbnailDataUrl: thumbUrl,
        createdAt: Date.now(),
        artists,
        layersCount: layers.length,
        strokesCount: totalStrokes,
        filterName: activeFilter.name,
        critique: options?.critiqueData || null,
        layersSnapshot: JSON.parse(JSON.stringify(layers)),
        filterSnapshot: JSON.parse(JSON.stringify(activeFilter)),
      };

      setGalleryArtworks((prev) => upsertArtworkInGallery(prev, newArtwork));

      sendWs({
        type: 'gallery_save',
        artwork: newArtwork,
      });

      showTimedToast(`🖼️ Guardada en Galería: "${newArtwork.title}"`);
    },
    [
      getCanvasSnapshot,
      activeFilter,
      layers,
      activeUsers,
      currentTheme,
      galleryArtworks.length,
      roomId,
      sendWs,
      showTimedToast,
    ]
  );

  // Trigger Gemini 3.8 Flash Art Critique and auto-archive the completed session to Gallery
  const triggerCritique = useCallback(async () => {
    const snapshot = getCanvasSnapshot();
    if (!snapshot) return;

    setCanvasSnapshotUrl(snapshot);
    setIsCritiqueModalOpen(true);
    setIsCritiqueLoading(true);

    try {
      const res = await fetch('/api/gemini/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: snapshot,
          theme: currentTheme,
          layersCount: layers.length,
          artistsCount: Object.keys(activeUsers).length || 2,
        }),
      });

      const data = await res.json();
      setCritiqueResult(data);

      // Automatically save completed artwork + critique into room & local gallery
      await saveArtworkToGallery({
        critiqueData: data,
        snapshotDataUrl: snapshot,
      });
    } catch {
      const offlineCritique: ArtCritiqueResult = {
        title: currentTheme ? `Obra: ${currentTheme.slice(0, 32)}` : 'Sinfonía Colaborativa en Capas',
        score: 94,
        style: 'Expresionismo Digital Contemporáneo',
        critique:
          'Una composición llena de vitalidad donde las capas superpuestas dialogan con trazos espontáneos y gran fuerza expresiva.',
        harmonyAnalysis:
          'Equilibrio armónico entre la estructura del boceto y los acentos cromáticos finales.',
        badges: ['Maestros del Color', 'Sinergia de Capas', 'Trazo Audaz'],
      };
      setCritiqueResult(offlineCritique);
      await saveArtworkToGallery({
        critiqueData: offlineCritique,
        snapshotDataUrl: snapshot,
      });
    } finally {
      setIsCritiqueLoading(false);
    }
  }, [getCanvasSnapshot, currentTheme, layers.length, activeUsers, saveArtworkToGallery]);

  // Keep latest triggerCritique in a ref so WebSocket effect never tears down when activeUsers or layers change
  const triggerCritiqueRef = useRef(triggerCritique);
  triggerCritiqueRef.current = triggerCritique;

  // Connect to real-time WebSocket server with auto-reconnect
  useEffect(() => {
    if (!inGame) return;

    let isUnmounted = false;

    const connectWebSocket = () => {
      if (isUnmounted) return;
      if (
        window.location.protocol !== 'http:' &&
        window.location.protocol !== 'https:'
      ) {
        return;
      }
      if (!window.location.host) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isUnmounted) return;
        ws.send(
          JSON.stringify({
            type: 'join_room',
            roomId,
            user: currentUserRef.current,
          })
        );
      };

      ws.onmessage = (event) => {
        if (isUnmounted) return;
        try {
          const msg = JSON.parse(event.data);
          const { type } = msg;

          switch (type) {
            case 'room_state': {
              const { room } = msg;
              if (room.layers && room.layers.length > 0) {
                setLayers(room.layers);
                setActiveLayerId((curr) => {
                  const exists = room.layers.some((l: Layer) => l.id === curr);
                  return exists ? curr : room.layers[room.layers.length - 1].id;
                });
              }
              if (room.activeFilter) setActiveFilter(room.activeFilter);
              if (room.history) setHistory(room.history);
              if (Array.isArray(room.gallery) && room.gallery.length > 0) {
                setGalleryArtworks((prev) => mergeGalleryLists(prev, room.gallery));
              }
              if (room.activeUsers) setActiveUsers(room.activeUsers);
              if (room.gameMode) setGameMode(room.gameMode);
              if (room.gamePhase) setGamePhase(room.gamePhase);
              if (room.currentTheme) setCurrentTheme(room.currentTheme);
              if (typeof room.timeLeft === 'number') setTimeLeft(room.timeLeft);
              break;
            }

            case 'gallery_updated': {
              if (msg.deletedArtworkId) {
                setGalleryArtworks((prev) =>
                  removeArtworkFromLocalGallery(prev, msg.deletedArtworkId)
                );
              } else if (Array.isArray(msg.gallery)) {
                setGalleryArtworks((prev) => mergeGalleryLists(prev, msg.gallery));
              }
              break;
            }

            case 'user_joined': {
              setActiveUsers((prev) => ({
                ...prev,
                [msg.user.id]: msg.user,
              }));
              break;
            }

            case 'user_left': {
              setActiveUsers((prev) => {
                const updated = { ...prev };
                delete updated[msg.userId];
                return updated;
              });
              break;
            }

            case 'cursor_update': {
              setActiveUsers((prev) => {
                const target = prev[msg.userId];
                if (!target) return prev;
                return {
                  ...prev,
                  [msg.userId]: {
                    ...target,
                    x: msg.x,
                    y: msg.y,
                    isDrawing: msg.isDrawing,
                    activeLayerId: msg.activeLayerId || target.activeLayerId,
                  },
                };
              });
              break;
            }

            case 'stroke_started': {
              const { stroke, history: updatedHistory } = msg;
              setLayers((prev) =>
                prev.map((l) => {
                  if (l.id === stroke.layerId) {
                    if (l.strokes.some((s) => s.id === stroke.id)) return l;
                    return {
                      ...l,
                      strokes: [...l.strokes, stroke],
                    };
                  }
                  return l;
                })
              );
              if (updatedHistory) setHistory(updatedHistory);
              break;
            }

            case 'history_updated': {
              if (msg.history) setHistory(msg.history);
              break;
            }

            case 'stroke_point_added': {
              const { strokeId, layerId, point } = msg;
              setLayers((prev) =>
                prev.map((l) => {
                  if (l.id === layerId) {
                    return {
                      ...l,
                      strokes: l.strokes.map((s) => {
                        if (s.id === strokeId) {
                          return {
                            ...s,
                            points: [...s.points, point],
                          };
                        }
                        return s;
                      }),
                    };
                  }
                  return l;
                })
              );
              break;
            }

            // GLOBAL UNDO / REDO / JUMP SYNCHRONIZATION
            case 'history_synced': {
              const { layers: syncedLayers, activeFilter: syncedFilter, history: syncedHistory } = msg;
              if (syncedLayers) {
                setLayers(syncedLayers);
                setActiveLayerId((curr) => {
                  const exists = syncedLayers.some((l: Layer) => l.id === curr);
                  return exists ? curr : syncedLayers[syncedLayers.length - 1]?.id || '';
                });
              }
              if (syncedFilter) setActiveFilter(syncedFilter);
              if (syncedHistory) {
                setHistory(syncedHistory);
                if (syncedHistory.lastActionToast?.text) {
                  showTimedToast(syncedHistory.lastActionToast.text);
                }
              }
              break;
            }

            // AI FILTER + LAYER HARMONIZATION SYNC
            case 'filter_and_layers_updated': {
              const {
                layers: updatedLayers,
                activeFilter: updatedFilter,
                history: updatedHistory,
                byUser,
              } = msg;
              if (updatedLayers) setLayers(updatedLayers);
              if (updatedFilter) {
                setActiveFilter(updatedFilter);
                const note = updatedFilter.curatorNote
                  ? `${byUser || 'Artista'} aplicó ${updatedFilter.name}: "${updatedFilter.curatorNote}"`
                  : `${byUser || 'Artista'} aplicó filtro: ${updatedFilter.name}`;
                showTimedToast(note);
              }
              if (updatedHistory) setHistory(updatedHistory);
              break;
            }

            // FULL REAL-TIME LAYER UPDATES (create, delete, merge, reorder, opacity, clear)
            case 'layers_updated': {
              const { layers: newLayers, history: updatedHistory } = msg;
              setLayers(newLayers);
              if (updatedHistory) setHistory(updatedHistory);
              setActiveLayerId((curr) => {
                const exists = newLayers.some((l: Layer) => l.id === curr);
                return exists ? curr : newLayers[newLayers.length - 1]?.id || '';
              });
              break;
            }

            case 'chat_broadcast': {
              const { message } = msg;
              if (message && message.text) {
                showTimedToast(`💬 ${message.userName}: ${message.text}`);
              }
              break;
            }

            case 'time_sync': {
              setTimeLeft(msg.timeLeft);
              if (msg.timeLeft <= 5) sound.playTick();
              break;
            }

            case 'game_phase_changed': {
              setGamePhase(msg.phase);
              if (typeof msg.timeLeft === 'number') setTimeLeft(msg.timeLeft);
              if (msg.theme) setCurrentTheme(msg.theme);
              if (msg.gameMode) setGameMode(msg.gameMode);
              if (msg.room?.layers) setLayers(msg.room.layers);
              if (msg.room?.activeFilter) setActiveFilter(msg.room.activeFilter);
              if (msg.room?.history) setHistory(msg.room.history);

              if (msg.phase === 'critique') {
                triggerCritiqueRef.current();
              }
              break;
            }
          }
        } catch (err) {
          console.error('WebSocket receive error:', err);
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          reconnectTimerRef.current = window.setTimeout(connectWebSocket, 1500);
        }
      };
    };

    connectWebSocket();

    return () => {
      isUnmounted = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [inGame, roomId, showTimedToast]);

  // Optimized Stroke Handlers (Zero React VDOM churn during fast pointer drag)
  const handleStrokeStart = useCallback(
    (strokeMeta: Omit<Stroke, 'points'>, initialPoint: Point) => {
      const fullStroke: Stroke = {
        ...strokeMeta,
        points: [initialPoint],
      };

      localStrokePointsRef.current = {
        strokeId: strokeMeta.id,
        layerId: strokeMeta.layerId,
        points: [initialPoint],
      };

      setLayers((prev) =>
        prev.map((l) => {
          if (l.id === strokeMeta.layerId) {
            return {
              ...l,
              strokes: [...l.strokes, fullStroke],
            };
          }
          return l;
        })
      );

      sendWs({
        type: 'stroke_start',
        stroke: fullStroke,
      });
    },
    [sendWs]
  );

  const handleStrokePoint = useCallback(
    (strokeId: string, layerId: string, point: Point) => {
      if (
        localStrokePointsRef.current &&
        localStrokePointsRef.current.strokeId === strokeId
      ) {
        localStrokePointsRef.current.points.push(point);
      }

      sendWs({
        type: 'stroke_point',
        strokeId,
        layerId,
        point,
      });
    },
    [sendWs]
  );

  const handleStrokeEnd = useCallback(
    (strokeId: string, layerId: string) => {
      const buffered = localStrokePointsRef.current;
      if (buffered && buffered.strokeId === strokeId) {
        const finalPoints = [...buffered.points];
        localStrokePointsRef.current = null;

        const beforeLayers = layersRef.current.map((l) =>
          l.id === layerId
            ? { ...l, strokes: l.strokes.filter((s) => s.id !== strokeId) }
            : l
        );
        const afterLayers = layersRef.current.map((l) =>
          l.id === layerId
            ? {
                ...l,
                strokes: l.strokes.map((s) =>
                  s.id === strokeId ? { ...s, points: finalPoints } : s
                ),
              }
            : l
        );

        setLayers(afterLayers);

        const targetLayer = layersRef.current.find((l) => l.id === layerId);
        pushLocalHistory({
          actionType: 'stroke',
          description: `Trazo en ${targetLayer?.name || 'Capa'}`,
          layerName: targetLayer?.name,
          beforeLayers,
          afterLayers,
        });
      }

      sendWs({
        type: 'stroke_end',
        strokeId,
        layerId,
      });
    },
    [sendWs, pushLocalHistory]
  );

  const handleCursorMove = useCallback(
    (x: number, y: number, isDrawing: boolean) => {
      sendWs({
        type: 'cursor_move',
        x,
        y,
        isDrawing,
        activeLayerId,
      });
    },
    [sendWs, activeLayerId]
  );

  // Layer Operations Handlers (work both via WebSocket and standalone/offline)
  const handleCreateLayer = useCallback(
    (name?: string) => {
      if (!isWsConnected()) {
        const beforeLayers = layersRef.current;
        const newLayer: Layer = {
          id: `layer-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: name || `Capa ${beforeLayers.length + 1}`,
          opacity: 1,
          visible: true,
          locked: false,
          strokes: [],
        };
        const afterLayers = [...beforeLayers, newLayer];
        setLayers(afterLayers);
        setActiveLayerId(newLayer.id);
        pushLocalHistory({
          actionType: 'layer_create',
          description: `Nueva capa: ${newLayer.name}`,
          layerName: newLayer.name,
          beforeLayers,
          afterLayers,
        });
        return;
      }
      sendWs({
        type: 'layer_create',
        name,
      });
    },
    [isWsConnected, sendWs, pushLocalHistory]
  );

  const handleDeleteLayer = useCallback(
    (layerId: string) => {
      if (!isWsConnected()) {
        const beforeLayers = layersRef.current;
        if (beforeLayers.length <= 1) return;
        const target = beforeLayers.find((l) => l.id === layerId);
        const afterLayers = beforeLayers.filter((l) => l.id !== layerId);
        setLayers(afterLayers);
        setActiveLayerId((curr) =>
          curr === layerId ? afterLayers[afterLayers.length - 1].id : curr
        );
        pushLocalHistory({
          actionType: 'layer_delete',
          description: `Eliminó ${target?.name || 'capa'}`,
          layerName: target?.name,
          beforeLayers,
          afterLayers,
        });
        return;
      }
      sendWs({
        type: 'layer_delete',
        layerId,
      });
    },
    [isWsConnected, sendWs, pushLocalHistory]
  );

  const handleUpdateLayer = useCallback(
    (layerId: string, updates: Partial<Layer>) => {
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, ...updates } : l))
      );

      sendWs({
        type: 'layer_update',
        layerId,
        ...updates,
      });
    },
    [sendWs]
  );

  const handleMergeLayers = useCallback(
    (sourceLayerId: string, targetLayerId: string) => {
      if (!isWsConnected()) {
        const beforeLayers = layersRef.current;
        const sourceIdx = beforeLayers.findIndex((l) => l.id === sourceLayerId);
        const targetIdx = beforeLayers.findIndex((l) => l.id === targetLayerId);
        if (sourceIdx === -1 || targetIdx === -1 || sourceIdx === targetIdx) return;
        const sourceLayer = beforeLayers[sourceIdx];
        const targetLayer = beforeLayers[targetIdx];
        const mergedStrokes = sourceLayer.strokes.map((s) => ({
          ...s,
          layerId: targetLayer.id,
          opacity: s.opacity * sourceLayer.opacity,
        }));
        const afterLayers = beforeLayers
          .map((l, idx) =>
            idx === targetIdx ? { ...l, strokes: [...l.strokes, ...mergedStrokes] } : l
          )
          .filter((_, idx) => idx !== sourceIdx);
        setLayers(afterLayers);
        setActiveLayerId(targetLayer.id);
        pushLocalHistory({
          actionType: 'layer_merge',
          description: `Fusionó ${sourceLayer.name} en ${targetLayer.name}`,
          layerName: targetLayer.name,
          beforeLayers,
          afterLayers,
        });
        return;
      }
      sendWs({
        type: 'layer_merge',
        sourceLayerId,
        targetLayerId,
      });
    },
    [isWsConnected, sendWs, pushLocalHistory]
  );

  const handleReorderLayers = useCallback(
    (layerIds: string[]) => {
      if (!isWsConnected()) {
        const beforeLayers = layersRef.current;
        const map = new Map(beforeLayers.map((l) => [l.id, l]));
        const afterLayers = layerIds.map((id) => map.get(id)).filter(Boolean) as Layer[];
        setLayers(afterLayers);
        pushLocalHistory({
          actionType: 'layer_reorder',
          description: 'Reordenó pila de capas',
          beforeLayers,
          afterLayers,
        });
        return;
      }
      sendWs({
        type: 'layer_reorder',
        layerIds,
      });
    },
    [isWsConnected, sendWs, pushLocalHistory]
  );

  const handleClearLayer = useCallback(
    (layerId: string) => {
      if (!isWsConnected()) {
        const beforeLayers = layersRef.current;
        const target = beforeLayers.find((l) => l.id === layerId);
        if (!target || target.locked) return;
        const afterLayers = beforeLayers.map((l) =>
          l.id === layerId ? { ...l, strokes: [] } : l
        );
        setLayers(afterLayers);
        pushLocalHistory({
          actionType: 'layer_clear',
          description: `Limpió trazos de ${target.name}`,
          layerName: target.name,
          beforeLayers,
          afterLayers,
        });
        return;
      }
      sendWs({
        type: 'layer_clear',
        layerId,
      });
    },
    [isWsConnected, sendWs, pushLocalHistory]
  );

  // Apply AI Artistic Filter across room via WebSocket (and locally if standalone)
  const handleApplyAiFilter = useCallback(
    (payload: {
      filterConfig: ArtFilterConfig;
      palette?: string[];
      targetScope: 'all' | 'active_layer' | 'atmosphere_only';
      accentStrokes?: Partial<Stroke>[];
    }) => {
      if (!isWsConnected()) {
        const beforeLayers = JSON.parse(JSON.stringify(layersRef.current)) as Layer[];
        const beforeFilter = JSON.parse(JSON.stringify(activeFilterRef.current)) as ArtFilterConfig;
        const nextLayers = JSON.parse(JSON.stringify(layersRef.current)) as Layer[];

        if (Array.isArray(payload.palette) && payload.palette.length > 0) {
          nextLayers.forEach((layer) => {
            if (layer.locked) return;
            if (payload.targetScope === 'active_layer' && layer.id !== activeLayerId) return;
            layer.strokes.forEach((stroke, idx) => {
              if (stroke.tool !== 'eraser') {
                stroke.color = payload.palette![idx % payload.palette!.length];
              }
            });
          });
        }

        if (Array.isArray(payload.accentStrokes) && payload.accentStrokes.length > 0) {
          const targetLayer =
            nextLayers.find((l) => l.id === activeLayerId && !l.locked) ||
            nextLayers[nextLayers.length - 1];
          if (targetLayer && !targetLayer.locked) {
            const formatted: Stroke[] = payload.accentStrokes.map((st, idx) => ({
              id: `stroke-filter-${Date.now()}-${idx}`,
              layerId: targetLayer.id,
              userId: currentUserRef.current.id,
              userName: `IA · ${currentUserRef.current.name}`,
              userColor: currentUserRef.current.color,
              tool: (st.tool as Stroke['tool']) || 'brush',
              color: st.color || '#f59e0b',
              size: st.size || 7,
              opacity: st.opacity || 0.7,
              points: Array.isArray(st.points) ? st.points : [],
              timestamp: Date.now(),
            }));
            targetLayer.strokes.push(...formatted);
          }
        }

        setLayers(nextLayers);
        setActiveFilter(payload.filterConfig);
        pushLocalHistory({
          actionType: 'ai_filter',
          description: `Filtro IA: ${payload.filterConfig.name}`,
          beforeLayers,
          afterLayers: nextLayers,
          beforeFilter,
          afterFilter: payload.filterConfig,
        });
        showTimedToast(`✨ Aplicaste filtro: ${payload.filterConfig.name}`);
        return;
      }

      sendWs({
        type: 'apply_ai_filter',
        filterConfig: payload.filterConfig,
        palette: payload.palette,
        targetScope: payload.targetScope,
        activeLayerId,
        accentStrokes: payload.accentStrokes,
      });
    },
    [isWsConnected, sendWs, activeLayerId, pushLocalHistory, showTimedToast]
  );

  // Trigger Gemini 3.8 Flash AI Co-Painter (with standalone fallback)
  const handleAIPaint = async () => {
    setIsAiPainting(true);
    sound.playPop(700);

    const applyGeneratedStrokes = (layerName: string, rawStrokes: Partial<Stroke>[]) => {
      sound.playLayerMerge();
      const aiLayerId = `layer-gemini-${Date.now()}`;
      const aiStrokes: Stroke[] = rawStrokes.map((st: Partial<Stroke>, idx: number) => ({
        id: `stroke-ai-${Date.now()}-${idx}`,
        layerId: aiLayerId,
        userId: 'gemini-ai',
        userName: 'Gemini IA',
        userColor: '#ec4899',
        tool: 'brush',
        color: st.color || '#ec4899',
        size: st.size || 8,
        opacity: st.opacity || 0.85,
        points: st.points || [],
        timestamp: Date.now(),
      }));

      if (!isWsConnected()) {
        const beforeLayers = layersRef.current;
        const newLayer: Layer = {
          id: aiLayerId,
          name: layerName,
          opacity: 1,
          visible: true,
          locked: false,
          strokes: aiStrokes,
        };
        const afterLayers = [...beforeLayers, newLayer];
        setLayers(afterLayers);
        setActiveLayerId(newLayer.id);
        pushLocalHistory({
          actionType: 'ai_paint',
          description: `Capa generativa: ${layerName}`,
          layerName,
          beforeLayers,
          afterLayers,
        });
        return;
      }

      sendWs({
        type: 'layer_create',
        name: layerName,
        strokes: aiStrokes,
      });
    };

    try {
      const res = await fetch('/api/gemini/ai-paint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: currentTheme,
          canvasWidth: 1200,
          canvasHeight: 800,
        }),
      });

      const data = await res.json();
      if (data.strokes && data.strokes.length > 0) {
        applyGeneratedStrokes(data.layerName || 'Capa Gemini IA', data.strokes);
      }
    } catch {
      applyGeneratedStrokes('Capa Gemini IA', [
        {
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
      ]);
    } finally {
      setIsAiPainting(false);
    }
  };

  // Trigger Gemini 3.1 Flash Lite Live Drawing Guesser
  const handleAIGuess = async () => {
    const snapshot = getCanvasSnapshot();
    if (!snapshot) return;

    setIsAiGuessing(true);
    sound.playPop(640);

    try {
      const res = await fetch('/api/gemini/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: snapshot }),
      });

      const data = await res.json();
      if (data.guess) {
        setAiGuessText(data.guess);
        sound.playVictory();
        setTimeout(() => setAiGuessText(''), 6000);
      }
    } catch {
      setAiGuessText('¡Una composición artística vibrante en capas!');
      sound.playVictory();
      setTimeout(() => setAiGuessText(''), 6000);
    } finally {
      setIsAiGuessing(false);
    }
  };

  // Handle Voice Prompt Action
  const handleApplyVoicePrompt = (text: string, action: 'theme' | 'ai_layer' | 'chat') => {
    if (action === 'theme') {
      setCurrentTheme(text);
      sendWs({
        type: 'game_start_round',
        gameMode,
        duration: timeLeft || 90,
        theme: text,
      });
    } else if (action === 'ai_layer') {
      setCurrentTheme(text);
      handleAIPaint();
    } else if (action === 'chat') {
      sendWs({
        type: 'chat_message',
        userName: currentUser.name,
        userColor: currentUser.color,
        text,
      });
    }
  };

  const handleStartRound = (mode: GameMode, duration: number) => {
    sendWs({
      type: 'game_start_round',
      gameMode: mode,
      duration,
      theme: currentTheme,
    });
  };

  const handleResetGame = () => {
    sendWs({
      type: 'game_reset',
    });
    setGamePhase('lobby');
  };

  const handleDeleteGalleryArtwork = useCallback(
    (artworkId: string) => {
      setGalleryArtworks((prev) => removeArtworkFromLocalGallery(prev, artworkId));
      sendWs({
        type: 'gallery_delete',
        artworkId,
      });
    },
    [sendWs]
  );

  const handleRestoreArtworkToCanvas = useCallback(
    (artwork: GalleryArtwork) => {
      if (!artwork.layersSnapshot || artwork.layersSnapshot.length === 0) return;
      setLayers(artwork.layersSnapshot);
      setActiveLayerId(artwork.layersSnapshot[artwork.layersSnapshot.length - 1].id);
      if (artwork.filterSnapshot) {
        setActiveFilter(artwork.filterSnapshot);
      }
      sendWs({
        type: 'gallery_restore',
        artwork,
      });
      showTimedToast(`🎨 Obra restaurada al lienzo: "${artwork.title}"`);
    },
    [sendWs, showTimedToast]
  );

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden font-sans select-none touch-none">
      {!inGame ? (
        <TitleScreen
          onStartGame={(user, chosenRoom) => {
            setCurrentUser((prev) => ({
              ...prev,
              name: user.name,
              avatar: user.avatar,
              color: user.color,
            }));
            setRoomId(chosenRoom);
            setInGame(true);
          }}
        />
      ) : (
        <div className="relative w-full h-full overflow-hidden">
          {/* Main Collaborative Canvas */}
          <DrawingCanvas
            layers={layers}
            activeFilter={activeFilter}
            activeLayerId={activeLayerId}
            activeUsers={activeUsers}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            currentUserColor={currentUser.color}
            currentUserAvatar={currentUser.avatar}
            currentTool={currentTool}
            currentColor={currentColor}
            brushSize={brushSize}
            brushOpacity={brushOpacity}
            onStrokeStart={handleStrokeStart}
            onStrokePoint={handleStrokePoint}
            onStrokeEnd={handleStrokeEnd}
            onCursorMove={handleCursorMove}
          />

          {/* Game Perimeter HUD */}
          <GameHUD
            roomId={roomId}
            gameMode={gameMode}
            gamePhase={gamePhase}
            currentTheme={currentTheme}
            timeLeft={timeLeft}
            activeUsers={activeUsers}
            layersCount={layers.length}
            activeLayerName={activeLayer?.name || 'Capa 1'}
            galleryCount={galleryArtworks.length}
            onToggleLayerPanel={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
            onOpenGallery={() => setIsGalleryModalOpen(true)}
            onRequestCritique={triggerCritique}
            onStartRound={handleStartRound}
          />

          {/* Bottom Ergonomic Toolbar */}
          <Toolbar
            currentTool={currentTool}
            currentColor={currentColor}
            brushSize={brushSize}
            brushOpacity={brushOpacity}
            activeLayerName={activeLayer?.name || 'Capa'}
            history={history}
            activeFilter={activeFilter}
            historyToast={historyToast}
            onSelectTool={(tool) => setCurrentTool(tool)}
            onSelectColor={(col) => setCurrentColor(col)}
            onChangeSize={(sz) => setBrushSize(sz)}
            onChangeOpacity={(op) => setBrushOpacity(op)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onToggleHistoryPanel={() => setIsHistoryPanelOpen(!isHistoryPanelOpen)}
            onOpenFilterModal={() => setIsFilterModalOpen(true)}
            onToggleLayerPanel={() => setIsLayerPanelOpen(!isLayerPanelOpen)}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
            onRequestAIPaint={handleAIPaint}
            onRequestAIGuess={handleAIGuess}
            isAiPainting={isAiPainting}
            isAiGuessing={isAiGuessing}
            aiGuessText={aiGuessText}
          />

          {/* Global Undo / Redo Timeline Panel */}
          <HistoryPanel
            history={history}
            isOpen={isHistoryPanelOpen}
            onClose={() => setIsHistoryPanelOpen(false)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onJumpToHistory={handleJumpToHistory}
          />

          {/* Collaborative Layer Panel */}
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            activeUsers={activeUsers}
            currentUserId={currentUser.id}
            isOpen={isLayerPanelOpen}
            onClose={() => setIsLayerPanelOpen(false)}
            onSelectLayer={(id) => setActiveLayerId(id)}
            onCreateLayer={handleCreateLayer}
            onDeleteLayer={handleDeleteLayer}
            onUpdateLayer={handleUpdateLayer}
            onMergeLayers={handleMergeLayers}
            onReorderLayers={handleReorderLayers}
            onClearLayer={handleClearLayer}
          />

          {/* Room & Local Art Gallery Modal */}
          <GalleryModal
            isOpen={isGalleryModalOpen}
            onClose={() => setIsGalleryModalOpen(false)}
            roomId={roomId}
            currentTheme={currentTheme}
            artworks={galleryArtworks}
            onSaveCurrentArtwork={async (customTitle) => {
              await saveArtworkToGallery({ customTitle });
            }}
            onDeleteArtwork={handleDeleteGalleryArtwork}
            onRestoreArtworkToCanvas={handleRestoreArtworkToCanvas}
          />

          {/* AI Artistic Filter Modal (Gemini 3.8 Flash) */}
          <AIArtFilterModal
            isOpen={isFilterModalOpen}
            onClose={() => setIsFilterModalOpen(false)}
            activeFilter={activeFilter}
            activeLayerName={activeLayer?.name || 'Capa Activa'}
            getCanvasSnapshot={getCanvasSnapshot}
            onApplyFilter={handleApplyAiFilter}
          />

          {/* Voice Prompt Modal (Gemini 3.5 Transcribe / 3.8 Flash) */}
          <VoicePromptModal
            isOpen={isVoiceModalOpen}
            onClose={() => setIsVoiceModalOpen(false)}
            onApplyPrompt={handleApplyVoicePrompt}
          />

          {/* AI Critique Modal (Gemini 3.8 Flash) */}
          <CritiqueModal
            isOpen={isCritiqueModalOpen}
            onClose={() => setIsCritiqueModalOpen(false)}
            critique={critiqueResult}
            isLoading={isCritiqueLoading}
            canvasSnapshotUrl={canvasSnapshotUrl}
            onNewRound={handleResetGame}
            onOpenGallery={() => setIsGalleryModalOpen(true)}
          />
        </div>
      )}
    </div>
  );
}
