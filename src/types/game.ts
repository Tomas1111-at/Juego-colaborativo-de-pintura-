export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export type ToolType =
  | 'brush'
  | 'pen'
  | 'spray'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'stamp';

export interface Stroke {
  id: string;
  layerId: string;
  userId: string;
  userName: string;
  userColor: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
  timestamp: number;
}

export interface Layer {
  id: string;
  name: string;
  opacity: number; // 0 to 1
  visible: boolean;
  locked: boolean;
  blendMode?: GlobalCompositeOperation;
  strokes: Stroke[];
}

export interface UserPresence {
  id: string;
  name: string;
  avatar: string;
  color: string;
  x: number;
  y: number;
  isDrawing: boolean;
  activeLayerId: string;
  lastSeen: number;
}

export type GameMode = 'free_studio' | 'speed_battle' | 'exquisite_corpse' | 'guess_art';
export type GamePhase = 'lobby' | 'playing' | 'critique' | 'victory';

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface ArtCritiqueResult {
  title: string;
  score: number; // 0 - 100
  critique: string;
  style: string;
  harmonyAnalysis: string;
  badges: string[];
}

export type ArtFilterPresetId =
  | 'none'
  | 'impressionist_oil'
  | 'botanical_watercolor'
  | 'ukiyo_e'
  | 'cyanotype_blueprint'
  | 'stained_glass'
  | 'pop_halftone';

export interface ArtFilterConfig {
  id: ArtFilterPresetId;
  name: string;
  backgroundTint: string;
  contrast: number; // e.g. 100 default
  saturation: number; // e.g. 100 default
  sepia: number; // 0 - 100
  hueRotate: number; // deg
  textureOverlay: 'none' | 'canvas_weave' | 'watercolor_paper' | 'woodblock' | 'blueprint_grid' | 'halftone';
  vignetteIntensity: number; // 0 to 1
  curatorNote?: string;
  appliedBy?: string;
}

export type HistoryActionType =
  | 'stroke'
  | 'layer_create'
  | 'layer_delete'
  | 'layer_merge'
  | 'layer_clear'
  | 'layer_reorder'
  | 'layer_update'
  | 'ai_filter'
  | 'ai_paint'
  | 'gallery_restore';

export interface HistorySummaryItem {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  userColor: string;
  actionType: HistoryActionType;
  description: string;
  layerName?: string;
  isUndone: boolean;
}

export interface HistorySummary {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  lastActionToast?: {
    id: string;
    text: string;
    userName: string;
    userColor: string;
  } | null;
  items: HistorySummaryItem[];
}

export interface GalleryArtistBadge {
  id: string;
  name: string;
  avatar: string;
  color: string;
}

export interface GalleryArtwork {
  id: string;
  roomId: string;
  title: string;
  theme: string;
  thumbnailDataUrl: string;
  createdAt: number;
  artists: GalleryArtistBadge[];
  layersCount: number;
  strokesCount: number;
  filterName?: string;
  critique?: ArtCritiqueResult | null;
  layersSnapshot?: Layer[];
  filterSnapshot?: ArtFilterConfig;
}

export interface GameRoomState {
  roomId: string;
  roomName: string;
  gameMode: GameMode;
  gamePhase: GamePhase;
  currentTheme: string;
  timeLeft: number;
  roundDuration: number;
  layers: Layer[];
  activeFilter: ArtFilterConfig;
  history: HistorySummary;
  gallery: GalleryArtwork[];
  activeUsers: Record<string, UserPresence>;
  chatMessages: ChatMessage[];
  critiqueResult?: ArtCritiqueResult | null;
  canvasWidth: number;
  canvasHeight: number;
}
