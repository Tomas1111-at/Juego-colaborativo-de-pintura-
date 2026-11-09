import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Layer, Stroke, Point, UserPresence, ToolType, ArtFilterConfig } from '../types/game';
import { sound } from '../utils/audio';

interface DrawingCanvasProps {
  layers: Layer[];
  activeFilter?: ArtFilterConfig;
  activeLayerId: string;
  activeUsers: Record<string, UserPresence>;
  currentUserId: string;
  currentUserName: string;
  currentUserColor: string;
  currentUserAvatar: string;
  currentTool: ToolType;
  currentColor: string;
  brushSize: number;
  brushOpacity: number;
  onStrokeStart: (stroke: Omit<Stroke, 'points'>, initialPoint: Point) => void;
  onStrokePoint: (strokeId: string, layerId: string, point: Point) => void;
  onStrokeEnd: (strokeId: string, layerId: string) => void;
  onCursorMove: (x: number, y: number, isDrawing: boolean) => void;
}

interface TextureCache {
  canvas: HTMLCanvasElement;
  key: string;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = React.memo(({
  layers,
  activeFilter,
  activeLayerId,
  activeUsers,
  currentUserId,
  currentUserName,
  currentUserColor,
  currentTool,
  currentColor,
  brushSize,
  brushOpacity,
  onStrokeStart,
  onStrokePoint,
  onStrokeEnd,
  onCursorMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeStrokeRef = useRef<Stroke | null>(null);
  const isPointerDownRef = useRef<boolean>(false);
  const lastSoundTimeRef = useRef<number>(0);
  const lastCursorEmitRef = useRef<number>(0);

  // Pooled offscreen canvases per layer ID to avoid per-frame DOM allocations and GC pauses
  const layerCanvasPoolRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  // Cached procedural texture & vignette canvas
  const textureCacheRef = useRef<TextureCache | null>(null);
  // Cached background grid pattern canvas
  const gridCacheRef = useRef<{ canvas: HTMLCanvasElement; width: number; height: number } | null>(null);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // Resize canvas to match exact container dimensions (1:1 aspect ratio for accurate mobile touch coordinates)
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({
            width: Math.max(Math.round(clientWidth), 280),
            height: Math.max(Math.round(clientHeight), 280),
          });
        }
      }
    };

    updateSize();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateSize()) : null;
    if (observer && containerRef.current) {
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  // Helper to render a single stroke onto a 2D context
  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.points || stroke.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = stroke.size;
    } else if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = (stroke.opacity || 0.5) * 0.45;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * 1.8;
    } else if (stroke.tool === 'spray') {
      ctx.fillStyle = stroke.color;
      const density = Math.min(25, Math.floor(stroke.size * 0.8));
      const radius = stroke.size;

      for (const pt of stroke.points) {
        for (let i = 0; i < density; i++) {
          const seed = (pt.x * 13.37 + pt.y * 7.91 + i * 31.17) % 100;
          const angle = (seed / 100) * Math.PI * 2;
          const r = (((seed * 17) % 100) / 100) * radius;
          const px = pt.x + Math.cos(angle) * r;
          const py = pt.y + Math.sin(angle) * r;
          ctx.fillRect(px, py, 1.5, 1.5);
        }
      }
      ctx.restore();
      return;
    } else if (stroke.tool === 'stamp') {
      ctx.fillStyle = stroke.color;
      ctx.globalAlpha = stroke.opacity || 1;
      const rOuter = stroke.size * 0.9;
      const rInner = stroke.size * 0.35;
      for (const pt of stroke.points) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const radius = i % 2 === 0 ? rOuter : rInner;
          const angle = (i * Math.PI) / 4 - Math.PI / 2;
          const sx = pt.x + Math.cos(angle) * radius;
          const sy = pt.y + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    } else {
      ctx.globalAlpha = stroke.opacity || 1;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
    }

    const pts = stroke.points;
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }

      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  // Build or retrieve cached procedural texture & vignette canvas
  const getOrBuildTextureOverlay = useCallback(
    (width: number, height: number, filter: ArtFilterConfig): HTMLCanvasElement => {
      const cacheKey = `${width}x${height}:${filter.textureOverlay}:${filter.vignetteIntensity}`;
      if (textureCacheRef.current && textureCacheRef.current.key === cacheKey) {
        return textureCacheRef.current.canvas;
      }

      const texCanvas = textureCacheRef.current?.canvas || document.createElement('canvas');
      texCanvas.width = width;
      texCanvas.height = height;
      const ctx = texCanvas.getContext('2d');

      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.save();

        if (filter.textureOverlay === 'canvas_weave') {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.lineWidth = 1;
          const step = 12;
          ctx.beginPath();
          for (let x = 0; x < width; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
          }
          for (let y = 0; y < height; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          ctx.stroke();
        } else if (filter.textureOverlay === 'watercolor_paper') {
          ctx.fillStyle = 'rgba(255, 250, 240, 0.03)';
          const step = 28;
          for (let x = 14; x < width; x += step) {
            for (let y = 14; y < height; y += step) {
              const radius = 6 + ((x * 7 + y * 13) % 8);
              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        } else if (filter.textureOverlay === 'woodblock') {
          ctx.strokeStyle = 'rgba(254, 243, 199, 0.04)';
          ctx.lineWidth = 1.5;
          for (let y = 8; y < height; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(
              width * 0.33,
              y + ((y % 32) - 16) * 0.4,
              width * 0.66,
              y - ((y % 32) - 16) * 0.4,
              width,
              y
            );
            ctx.stroke();
          }
        } else if (filter.textureOverlay === 'blueprint_grid') {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
          ctx.lineWidth = 1;
          const step = 40;
          ctx.beginPath();
          for (let x = 0; x < width; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
          }
          for (let y = 0; y < height; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          ctx.stroke();
        } else if (filter.textureOverlay === 'halftone') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
          const step = 18;
          for (let x = 9; x < width; x += step) {
            for (let y = 9; y < height; y += step) {
              ctx.beginPath();
              ctx.arc(x, y, 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        if (filter.vignetteIntensity && filter.vignetteIntensity > 0) {
          const grad = ctx.createRadialGradient(
            width / 2,
            height / 2,
            Math.min(width, height) * 0.28,
            width / 2,
            height / 2,
            Math.max(width, height) * 0.72
          );
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.75, filter.vignetteIntensity)})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        }

        ctx.restore();
      }

      textureCacheRef.current = { canvas: texCanvas, key: cacheKey };
      return texCanvas;
    },
    []
  );

  // Build or retrieve cached alignment grid dots
  const getOrBuildGridOverlay = useCallback((width: number, height: number): HTMLCanvasElement => {
    if (
      gridCacheRef.current &&
      gridCacheRef.current.width === width &&
      gridCacheRef.current.height === height
    ) {
      return gridCacheRef.current.canvas;
    }

    const gridCanvas = gridCacheRef.current?.canvas || document.createElement('canvas');
    gridCanvas.width = width;
    gridCanvas.height = height;
    const gCtx = gridCanvas.getContext('2d');
    if (gCtx) {
      gCtx.clearRect(0, 0, width, height);
      gCtx.fillStyle = 'rgba(15, 23, 42, 0.08)';
      const gridSize = 32;
      for (let x = gridSize; x < width; x += gridSize) {
        for (let y = gridSize; y < height; y += gridSize) {
          gCtx.fillRect(x, y, 1.5, 1.5);
        }
      }
    }
    gridCacheRef.current = { canvas: gridCanvas, width, height };
    return gridCanvas;
  }, []);

  // Main 60fps rendering loop using pooled layer buffers
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;

    ctx.clearRect(0, 0, width, height);

    // 1. Always fill canvas background with pure white (#ffffff)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Blit cached alignment dots
    ctx.drawImage(getOrBuildGridOverlay(width, height), 0, 0);

    // 3. Prepare color filter string if an AI filter is active
    const hasColorFilter =
      activeFilter &&
      activeFilter.id !== 'none' &&
      (activeFilter.contrast !== 100 ||
        activeFilter.saturation !== 100 ||
        activeFilter.sepia !== 0 ||
        activeFilter.hueRotate !== 0);

    const filterCssString = hasColorFilter
      ? `contrast(${activeFilter.contrast}%) saturate(${activeFilter.saturation}%) sepia(${activeFilter.sepia}%) hue-rotate(${activeFilter.hueRotate}deg)`
      : 'none';

    const pool = layerCanvasPoolRef.current;
    const currentLayerIds = new Set(layers.map((l) => l.id));
    for (const cachedId of pool.keys()) {
      if (!currentLayerIds.has(cachedId)) {
        pool.delete(cachedId);
      }
    }

    const activeLocalStrokeId = activeStrokeRef.current?.id;

    // 4. Render each visible layer using pooled offscreen canvas
    layers.forEach((layer) => {
      if (!layer.visible || layer.opacity <= 0) return;

      let offscreen = pool.get(layer.id);
      if (!offscreen) {
        offscreen = document.createElement('canvas');
        pool.set(layer.id, offscreen);
      }
      if (offscreen.width !== width || offscreen.height !== height) {
        offscreen.width = width;
        offscreen.height = height;
      }

      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return;
      offCtx.clearRect(0, 0, width, height);

      layer.strokes.forEach((stroke) => {
        // Avoid double-drawing the currently active local stroke
        if (activeLocalStrokeId && stroke.id === activeLocalStrokeId) return;
        drawStroke(offCtx, stroke);
      });

      if (activeStrokeRef.current && activeStrokeRef.current.layerId === layer.id) {
        drawStroke(offCtx, activeStrokeRef.current);
      }

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      if (filterCssString !== 'none') {
        ctx.filter = filterCssString;
      }
      if (layer.blendMode) {
        ctx.globalCompositeOperation = layer.blendMode;
      }
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();
    });

    // 5. Blit cached procedural artistic texture & vignette
    if (activeFilter && activeFilter.id !== 'none') {
      const texCanvas = getOrBuildTextureOverlay(width, height, activeFilter);
      ctx.drawImage(texCanvas, 0, 0);
    }
  }, [layers, activeFilter, dimensions, drawStroke, getOrBuildGridOverlay, getOrBuildTextureOverlay]);

  useEffect(() => {
    const animId = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(animId);
  }, [renderCanvas]);

  // Clear held stroke state on window blur so strokes never stick on mobile app switches
  useEffect(() => {
    const handleWindowBlur = () => {
      if (isPointerDownRef.current && activeStrokeRef.current) {
        const strokeId = activeStrokeRef.current.id;
        const layerId = activeStrokeRef.current.layerId;
        activeStrokeRef.current = null;
        isPointerDownRef.current = false;
        onStrokeEnd(strokeId, layerId);
        renderCanvas();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [onStrokeEnd, renderCanvas]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

    return {
      x: Math.round((e.clientX - rect.left) * scaleX * 10) / 10,
      y: Math.round((e.clientY - rect.top) * scaleY * 10) / 10,
      pressure: e.pressure > 0 ? Math.round(e.pressure * 100) / 100 : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    if (!activeLayer || activeLayer.locked || !activeLayer.visible) {
      return;
    }

    isPointerDownRef.current = true;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Safe pointer capture
    }

    const pt = getCanvasCoords(e);
    const strokeId = `stroke-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const strokeMeta: Omit<Stroke, 'points'> = {
      id: strokeId,
      layerId: activeLayerId,
      userId: currentUserId,
      userName: currentUserName,
      userColor: currentUserColor,
      tool: currentTool,
      color: currentColor,
      size: brushSize,
      opacity: brushOpacity,
      timestamp: Date.now(),
    };

    activeStrokeRef.current = {
      ...strokeMeta,
      points: [pt],
    };

    onStrokeStart(strokeMeta, pt);
    onCursorMove(pt.x, pt.y, true);

    sound.playStrokeSound(currentTool);
    renderCanvas();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = getCanvasCoords(e);
    const now = performance.now();

    if (isPointerDownRef.current && activeStrokeRef.current) {
      const pts = activeStrokeRef.current.points;
      const lastPt = pts[pts.length - 1];

      // Skip redundant sub-pixel jitter (< 1.5px) to keep stroke geometry lean and fast
      if (lastPt && Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) < 1.5) {
        return;
      }

      pts.push(pt);
      onStrokePoint(activeStrokeRef.current.id, activeLayerId, pt);

      if (now - lastCursorEmitRef.current > 32) {
        onCursorMove(pt.x, pt.y, true);
        lastCursorEmitRef.current = now;
      }

      if (now - lastSoundTimeRef.current > 120) {
        sound.playStrokeSound(currentTool);
        lastSoundTimeRef.current = now;
      }

      renderCanvas();
    } else if (now - lastCursorEmitRef.current > 32) {
      onCursorMove(pt.x, pt.y, false);
      lastCursorEmitRef.current = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPointerDownRef.current && activeStrokeRef.current) {
      const strokeId = activeStrokeRef.current.id;
      const layerId = activeStrokeRef.current.layerId;
      activeStrokeRef.current = null;
      isPointerDownRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Safe capture release
      }

      const pt = getCanvasCoords(e);
      onStrokeEnd(strokeId, layerId);
      onCursorMove(pt.x, pt.y, false);
      renderCanvas();
    }
  };

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden bg-white touch-none select-none"
    >
      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="block w-full h-full cursor-crosshair bg-white shadow-2xl touch-none"
        style={{
          touchAction: 'none',
        }}
      />

      {/* Layer Locked Warning */}
      {activeLayer?.locked && (
        <div className="absolute top-24 sm:top-16 left-1/2 -translate-x-1/2 pointer-events-none px-3.5 py-2 rounded-xl bg-slate-900/90 border border-amber-500/60 text-amber-300 text-xs font-semibold shadow-xl whitespace-nowrap z-20">
          🔒 Capa bloqueada. Desbloquéala en Capas para pintar.
        </div>
      )}

      {/* Other Players Live Cursors & Avatars */}
      {Object.values(activeUsers).map((user) => {
        if (user.id === currentUserId) return null;

        const leftPercent = (user.x / dimensions.width) * 100;
        const topPercent = (user.y / dimensions.height) * 100;

        if (leftPercent < 0 || leftPercent > 100 || topPercent < 0 || topPercent > 100) return null;

        return (
          <div
            key={user.id}
            className="absolute pointer-events-none transition-all duration-75 z-30"
            style={{
              left: `${leftPercent}%`,
              top: `${topPercent}%`,
              transform: 'translate(-4px, -4px)',
            }}
          >
            {user.isDrawing && (
              <span
                className="absolute -top-2 -left-2 w-8 h-8 rounded-full animate-ping opacity-60"
                style={{ backgroundColor: user.color }}
              />
            )}

            <svg
              className="w-6 h-6 drop-shadow-md"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
            >
              <path
                d="M18.375 2.625a2.121 2.121 0 1 1 3 3L7.125 19.875 3 21l1.125-4.125L18.375 2.625z"
                fill={user.color}
              />
            </svg>

            <div
              className="absolute left-5 top-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white shadow-lg whitespace-nowrap flex items-center gap-1 border border-white/20"
              style={{ backgroundColor: user.color }}
            >
              <span>{user.avatar}</span>
              <span>{user.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});
