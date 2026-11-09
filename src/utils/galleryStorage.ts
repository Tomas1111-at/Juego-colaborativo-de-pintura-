import { ArtFilterConfig, GalleryArtwork, Layer } from '../types/game';

const GALLERY_STORAGE_KEY = 'pincelada_gallery_v1';
const MAX_LOCAL_ARTWORKS = 24;

/**
 * Generates a compact thumbnail Data URL (480x300) from a source canvas or image Data URL
 * so multiple completed artworks fit comfortably in localStorage and WebSocket payloads.
 */
export async function createCompactThumbnail(
  sourceCanvasOrDataUrl: HTMLCanvasElement | string,
  backgroundTint = '#0f172a'
): Promise<string> {
  const thumbWidth = 480;
  const thumbHeight = 300;
  const offscreen = document.createElement('canvas');
  offscreen.width = thumbWidth;
  offscreen.height = thumbHeight;
  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    return typeof sourceCanvasOrDataUrl === 'string' ? sourceCanvasOrDataUrl : '';
  }

  ctx.fillStyle = backgroundTint || '#0f172a';
  ctx.fillRect(0, 0, thumbWidth, thumbHeight);

  if (typeof sourceCanvasOrDataUrl !== 'string') {
    ctx.drawImage(sourceCanvasOrDataUrl, 0, 0, thumbWidth, thumbHeight);
    return offscreen.toDataURL('image/jpeg', 0.82);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
      resolve(offscreen.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      resolve(sourceCanvasOrDataUrl);
    };
    img.src = sourceCanvasOrDataUrl;
  });
}

/**
 * Renders a thumbnail directly from a set of vector layers and filter config.
 */
function renderLayersToThumbnail(layers: Layer[], filter: ArtFilterConfig): string {
  if (typeof document === 'undefined') return '';
  const width = 480;
  const height = 300;
  const scaleX = width / 1200;
  const scaleY = height / 800;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = filter.backgroundTint || '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Subtle background glow
  const grad = ctx.createRadialGradient(width * 0.5, height * 0.45, 20, width * 0.5, height * 0.5, width * 0.65);
  grad.addColorStop(0, 'rgba(99, 102, 241, 0.14)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.save();
    for (const stroke of layer.strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, stroke.opacity * layer.opacity);
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1.5, stroke.size * scaleX);

      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(
          stroke.points[0].x * scaleX,
          stroke.points[0].y * scaleY,
          Math.max(2, (stroke.size * scaleX) / 2),
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  return canvas.toDataURL('image/jpeg', 0.84);
}

/**
 * Creates 2 initial completed session artworks if the user's localStorage has never been initialized,
 * so the Gallery immediately showcases completed room sessions with real vector layers.
 */
function createInitialSeedArtworks(roomId: string): GalleryArtwork[] {
  const now = Date.now();

  const nebularFilter: ArtFilterConfig = {
    id: 'impressionist_oil',
    name: 'Óleo Impresionista',
    backgroundTint: '#131836',
    contrast: 112,
    saturation: 124,
    sepia: 8,
    hueRotate: -5,
    textureOverlay: 'canvas_weave',
    vignetteIntensity: 0.3,
    curatorNote: 'Pinceladas vibrantes de luz nocturna sobre textura de lino.',
    appliedBy: 'Sofía',
  };

  const nebularLayers: Layer[] = [
    {
      id: 'layer-seed-bg',
      name: 'Capa 1: Cielo Cósmico',
      opacity: 1,
      visible: true,
      locked: false,
      strokes: [
        {
          id: 'seed-st-1',
          layerId: 'layer-seed-bg',
          userId: 'artist-sofia',
          userName: 'Sofía',
          userColor: '#f43f5e',
          tool: 'brush',
          color: '#312e81',
          size: 46,
          opacity: 0.75,
          points: [
            { x: 140, y: 220 },
            { x: 380, y: 160 },
            { x: 680, y: 210 },
            { x: 980, y: 150 },
          ],
          timestamp: now - 720000,
        },
        {
          id: 'seed-st-2',
          layerId: 'layer-seed-bg',
          userId: 'artist-mateo',
          userName: 'Mateo',
          userColor: '#38bdf8',
          tool: 'brush',
          color: '#6366f1',
          size: 32,
          opacity: 0.8,
          points: [
            { x: 200, y: 310 },
            { x: 460, y: 250 },
            { x: 760, y: 290 },
            { x: 1020, y: 230 },
          ],
          timestamp: now - 710000,
        },
      ],
    },
    {
      id: 'layer-seed-fg',
      name: 'Capa 2: Ciudad Flotante',
      opacity: 1,
      visible: true,
      locked: false,
      strokes: [
        {
          id: 'seed-st-3',
          layerId: 'layer-seed-fg',
          userId: 'artist-sofia',
          userName: 'Sofía',
          userColor: '#f43f5e',
          tool: 'pen',
          color: '#f59e0b',
          size: 14,
          opacity: 0.95,
          points: [
            { x: 840, y: 170 },
            { x: 865, y: 155 },
            { x: 890, y: 175 },
            { x: 875, y: 205 },
            { x: 845, y: 195 },
            { x: 840, y: 170 },
          ],
          timestamp: now - 700000,
        },
        {
          id: 'seed-st-4',
          layerId: 'layer-seed-fg',
          userId: 'artist-mateo',
          userName: 'Mateo',
          userColor: '#38bdf8',
          tool: 'brush',
          color: '#22d3ee',
          size: 16,
          opacity: 0.9,
          points: [
            { x: 260, y: 540 },
            { x: 410, y: 460 },
            { x: 560, y: 510 },
            { x: 730, y: 420 },
            { x: 920, y: 520 },
          ],
          timestamp: now - 695000,
        },
        {
          id: 'seed-st-5',
          layerId: 'layer-seed-fg',
          userId: 'artist-lucia',
          userName: 'Lucía',
          userColor: '#a855f7',
          tool: 'pen',
          color: '#f43f5e',
          size: 10,
          opacity: 0.9,
          points: [
            { x: 480, y: 480 },
            { x: 480, y: 340 },
            { x: 540, y: 290 },
            { x: 600, y: 340 },
            { x: 600, y: 490 },
          ],
          timestamp: now - 690000,
        },
      ],
    },
  ];

  const ukiyoFilter: ArtFilterConfig = {
    id: 'ukiyo_e',
    name: 'Grabado Ukiyo-e',
    backgroundTint: '#1e1b2e',
    contrast: 118,
    saturation: 110,
    sepia: 18,
    hueRotate: 6,
    textureOverlay: 'woodblock',
    vignetteIntensity: 0.35,
    curatorNote: 'Ondas marinas en azul de Prusia y sol carmesí al estilo xilográfico.',
    appliedBy: 'Mateo',
  };

  const ukiyoLayers: Layer[] = [
    {
      id: 'layer-seed-wave-1',
      name: 'Capa 1: Horizonte Carmesí',
      opacity: 1,
      visible: true,
      locked: false,
      strokes: [
        {
          id: 'seed-uk-1',
          layerId: 'layer-seed-wave-1',
          userId: 'artist-mateo',
          userName: 'Mateo',
          userColor: '#38bdf8',
          tool: 'brush',
          color: '#e11d48',
          size: 56,
          opacity: 0.88,
          points: [
            { x: 580, y: 250 },
            { x: 615, y: 245 },
            { x: 625, y: 275 },
            { x: 590, y: 280 },
          ],
          timestamp: now - 360000,
        },
        {
          id: 'seed-uk-2',
          layerId: 'layer-seed-wave-1',
          userId: 'artist-lucia',
          userName: 'Lucía',
          userColor: '#a855f7',
          tool: 'brush',
          color: '#0284c7',
          size: 30,
          opacity: 0.9,
          points: [
            { x: 100, y: 580 },
            { x: 320, y: 470 },
            { x: 540, y: 550 },
            { x: 780, y: 450 },
            { x: 1080, y: 560 },
          ],
          timestamp: now - 350000,
        },
        {
          id: 'seed-uk-3',
          layerId: 'layer-seed-wave-1',
          userId: 'artist-sofia',
          userName: 'Sofía',
          userColor: '#f43f5e',
          tool: 'pen',
          color: '#f8fafc',
          size: 10,
          opacity: 0.92,
          points: [
            { x: 290, y: 455 },
            { x: 330, y: 435 },
            { x: 365, y: 450 },
            { x: 750, y: 435 },
            { x: 790, y: 420 },
            { x: 820, y: 440 },
          ],
          timestamp: now - 340000,
        },
      ],
    },
  ];

  return [
    {
      id: 'gallery-seed-1',
      roomId,
      title: 'Sinfonía sobre la Ciudadela Astral',
      theme: 'Ciudad flotante bajo una nebulosa dorada',
      thumbnailDataUrl: renderLayersToThumbnail(nebularLayers, nebularFilter),
      createdAt: now - 680000,
      artists: [
        { id: 'artist-sofia', name: 'Sofía', avatar: '🦊', color: '#f43f5e' },
        { id: 'artist-mateo', name: 'Mateo', avatar: '🧑‍🎨', color: '#38bdf8' },
        { id: 'artist-lucia', name: 'Lucía', avatar: '🐉', color: '#a855f7' },
      ],
      layersCount: 2,
      strokesCount: 5,
      filterName: nebularFilter.name,
      critique: {
        title: 'Sinfonía sobre la Ciudadela Astral',
        score: 94,
        critique:
          'Una composición nocturna magnética donde el contraste entre el índigo profundo del cielo y las agujas cian de la metrópoli genera una sensación de levitación inmediata.',
        style: 'Post-Impresionismo Cósmico Colaborativo',
        harmonyAnalysis: 'Excelente separación entre el fondo atmosférico y los trazos arquitectónicos.',
        badges: ['Armonía Cromática', 'Arquitectura Onírica', 'Sinergia de Capas'],
      },
      layersSnapshot: nebularLayers,
      filterSnapshot: nebularFilter,
    },
    {
      id: 'gallery-seed-2',
      roomId,
      title: 'Marea del Sol Naciente',
      theme: 'Criatura marina emergiendo entre olas gigantes',
      thumbnailDataUrl: renderLayersToThumbnail(ukiyoLayers, ukiyoFilter),
      createdAt: now - 320000,
      artists: [
        { id: 'artist-mateo', name: 'Mateo', avatar: '🧑‍🎨', color: '#38bdf8' },
        { id: 'artist-lucia', name: 'Lucía', avatar: '🐉', color: '#a855f7' },
      ],
      layersCount: 1,
      strokesCount: 3,
      filterName: ukiyoFilter.name,
      critique: {
        title: 'Marea del Sol Naciente',
        score: 91,
        critique:
          'Economía de trazo ejemplar. El disco carmesí ancla la mirada mientras las crestas blancas aportan dinamismo rítmico.',
        style: 'Xilografía Neo-Ukiyo-e',
        harmonyAnalysis: 'Fluidez orgánica entre las ondas base y la espuma en primer plano.',
        badges: ['Pulso Caligráfico', 'Contraste Maestro'],
      },
      layersSnapshot: ukiyoLayers,
      filterSnapshot: ukiyoFilter,
    },
  ];
}

export function loadLocalGallery(defaultRoomId = 'SALA-ARTE'): GalleryArtwork[] {
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) {
      const seeded = createInitialSeedArtworks(defaultRoomId);
      saveLocalGallery(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read gallery from localStorage:', err);
  }
  return [];
}

export function saveLocalGallery(artworks: GalleryArtwork[]): void {
  try {
    const trimmed = artworks
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_LOCAL_ARTWORKS);
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    // If quota is exceeded, drop older items and strip heavy layersSnapshot from oldest entries
    try {
      const compact = artworks
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map((item, idx) => (idx > 3 ? { ...item, layersSnapshot: undefined } : item));
      localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(compact));
    } catch {
      console.warn('Could not persist gallery to localStorage:', err);
    }
  }
}

export function upsertArtworkInGallery(
  currentList: GalleryArtwork[],
  artwork: GalleryArtwork
): GalleryArtwork[] {
  const existingIdx = currentList.findIndex((a) => a.id === artwork.id);
  let next: GalleryArtwork[];
  if (existingIdx !== -1) {
    next = [...currentList];
    next[existingIdx] = { ...next[existingIdx], ...artwork };
  } else {
    next = [artwork, ...currentList];
  }
  next.sort((a, b) => b.createdAt - a.createdAt);
  const limited = next.slice(0, MAX_LOCAL_ARTWORKS);
  saveLocalGallery(limited);
  return limited;
}

export function mergeGalleryLists(
  localList: GalleryArtwork[],
  remoteList: GalleryArtwork[]
): GalleryArtwork[] {
  const map = new Map<string, GalleryArtwork>();
  for (const item of localList) {
    map.set(item.id, item);
  }
  for (const item of remoteList) {
    const prev = map.get(item.id);
    map.set(item.id, prev ? { ...prev, ...item } : item);
  }
  const merged = Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  const limited = merged.slice(0, MAX_LOCAL_ARTWORKS);
  saveLocalGallery(limited);
  return limited;
}

export function removeArtworkFromLocalGallery(
  currentList: GalleryArtwork[],
  artworkId: string
): GalleryArtwork[] {
  const next = currentList.filter((a) => a.id !== artworkId);
  saveLocalGallery(next);
  return next;
}
