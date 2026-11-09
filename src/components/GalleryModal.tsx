import React, { useState, useMemo } from 'react';
import {
  Images,
  X,
  Download,
  Trash2,
  Sparkles,
  Layers,
  Award,
  PlusCircle,
  Check,
  Calendar,
  ArrowLeft,
  RotateCcw,
  Wand2,
  Users,
  Eye,
} from 'lucide-react';
import { GalleryArtwork } from '../types/game';
import { sound } from '../utils/audio';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentTheme: string;
  artworks: GalleryArtwork[];
  onSaveCurrentArtwork: (customTitle?: string) => Promise<void>;
  onDeleteArtwork: (artworkId: string) => void;
  onRestoreArtworkToCanvas: (artwork: GalleryArtwork) => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  isOpen,
  onClose,
  roomId,
  currentTheme,
  artworks,
  onSaveCurrentArtwork,
  onDeleteArtwork,
  onRestoreArtworkToCanvas,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'room' | 'critiqued'>('all');
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const filteredArtworks = useMemo(() => {
    if (filterTab === 'room') {
      return artworks.filter((a) => a.roomId.toUpperCase() === roomId.toUpperCase());
    }
    if (filterTab === 'critiqued') {
      return artworks.filter((a) => Boolean(a.critique));
    }
    return artworks;
  }, [artworks, filterTab, roomId]);

  const selectedArtwork = useMemo(
    () => artworks.find((a) => a.id === selectedArtworkId) || null,
    [artworks, selectedArtworkId]
  );

  if (!isOpen) return null;

  const handleSaveCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    sound.playVictory();
    try {
      await onSaveCurrentArtwork(customTitle.trim() || undefined);
      setCustomTitle('');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadArtwork = (art: GalleryArtwork, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sound.playPop(540);
    const a = document.createElement('a');
    a.href = art.thumbnailDataUrl;
    const safeTitle = art.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    a.download = `pincelada-${safeTitle || 'obra'}-${art.id.slice(-5)}.jpg`;
    a.click();
  };

  const formatRelativeTime = (ts: number) => {
    const diffSec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'Hace unos segundos';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return new Date(ts).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const roomCount = artworks.filter(
    (a) => a.roomId.toUpperCase() === roomId.toUpperCase()
  ).length;
  const critiquedCount = artworks.filter((a) => Boolean(a.critique)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
        {/* Ambient Header Glow */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            {selectedArtwork ? (
              <button
                onClick={() => {
                  sound.playPop(460);
                  setSelectedArtworkId(null);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                title="Volver a la cuadrícula"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-amber-500 text-white shadow-lg shadow-indigo-500/20">
                <Images className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  {selectedArtwork ? selectedArtwork.title : 'Galería de Obras de la Sala'}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Persistencia Local + Sala
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {selectedArtwork
                  ? `Sala ${selectedArtwork.roomId} · ${formatRelativeTime(selectedArtwork.createdAt)}`
                  : 'Miniaturas y resultados finales guardados de tus sesiones colaborativas'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar galería"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Capture & Filter Bar (when in grid mode) */}
        {!selectedArtwork && (
          <div className="px-5 py-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 flex-shrink-0">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  sound.playPop(480);
                  setFilterTab('all');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({artworks.length})
              </button>
              <button
                onClick={() => {
                  sound.playPop(500);
                  setFilterTab('room');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  filterTab === 'room'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                Sala {roomId} ({roomCount})
              </button>
              <button
                onClick={() => {
                  sound.playPop(520);
                  setFilterTab('critiqued');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  filterTab === 'critiqued'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>Con Crítica IA ({critiquedCount})</span>
              </button>
            </div>

            {/* Save Current Canvas Form */}
            <form onSubmit={handleSaveCurrent} className="flex items-center gap-2">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={`Título (ej. ${currentTheme.slice(0, 26)}...)`}
                maxLength={60}
                className="flex-1 md:w-56 px-3 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={isSaving}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-md cursor-pointer flex-shrink-0 ${
                  justSaved
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white'
                }`}
              >
                {justSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>¡Guardada!</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Guardar Lienzo Actual</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {selectedArtwork ? (
            /* Detailed Inspector View */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Large Artwork Preview */}
              <div className="lg:col-span-7 space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 aspect-[16/10] shadow-2xl">
                  <img
                    src={selectedArtwork.thumbnailDataUrl}
                    alt={selectedArtwork.title}
                    className="w-full h-full object-contain"
                  />
                  {selectedArtwork.filterName && selectedArtwork.filterName !== 'Original (Sin Filtro)' && (
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-amber-500/30 text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
                      <Wand2 className="w-3 h-3" />
                      <span>{selectedArtwork.filterName}</span>
                    </div>
                  )}
                  {selectedArtwork.critique && (
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-amber-500/90 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1">
                      <Award className="w-3.5 h-3.5" />
                      <span>{selectedArtwork.critique.score} PTS</span>
                    </div>
                  )}
                </div>

                {/* Metadata strip */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Capas
                    </span>
                    <span className="text-sm font-extrabold text-indigo-300 font-mono">
                      {selectedArtwork.layersCount}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Trazos Totales
                    </span>
                    <span className="text-sm font-extrabold text-emerald-300 font-mono">
                      {selectedArtwork.strokesCount}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Artistas
                    </span>
                    <span className="text-sm font-extrabold text-amber-300 font-mono">
                      {selectedArtwork.artists.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Session Info, Artists, AI Critique & Actions */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/70 space-y-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Tema de la Sesión
                  </span>
                  <p className="text-sm font-bold text-white">{selectedArtwork.theme}</p>
                </div>

                {/* Collaborators */}
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/70 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    Colaboradores en la Obra
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedArtwork.artists.map((artist, idx) => (
                      <div
                        key={`${artist.id}-${idx}`}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200"
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
                          style={{ backgroundColor: artist.color }}
                        >
                          {artist.avatar}
                        </span>
                        <span>{artist.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Critique Card if present */}
                {selectedArtwork.critique ? (
                  <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                        Veredicto Crítico IA · {selectedArtwork.critique.style}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300">
                        {selectedArtwork.critique.score}/100
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 italic leading-relaxed">
                      "{selectedArtwork.critique.critique}"
                    </p>
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-indigo-300">Armonía:</strong>{' '}
                      {selectedArtwork.critique.harmonyAnalysis}
                    </p>
                    {selectedArtwork.critique.badges &&
                      selectedArtwork.critique.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {selectedArtwork.critique.badges.map((b, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-950/70 text-purple-300 border border-purple-500/30"
                            >
                              <Award className="w-3 h-3 text-amber-400" />
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400">
                    Captura guardada directamente desde el estudio colaborativo.
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                  {selectedArtwork.layersSnapshot &&
                    selectedArtwork.layersSnapshot.length > 0 && (
                      <button
                        onClick={() => {
                          sound.playLayerMerge();
                          onRestoreArtworkToCanvas(selectedArtwork);
                          onClose();
                        }}
                        className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Cargar Obra y Capas en el Lienzo</span>
                      </button>
                    )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={(e) => handleDownloadArtwork(selectedArtwork, e)}
                      className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar Imagen</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playPop(340);
                        onDeleteArtwork(selectedArtwork.id);
                        setSelectedArtworkId(null);
                      }}
                      className="py-2.5 px-3 rounded-xl font-bold text-xs bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredArtworks.length === 0 ? (
            /* Empty State */
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-400">
                <Images className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">
                Aún no hay obras en esta vista
              </h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Finaliza una ronda con Crítica IA o pulsa &ldquo;Guardar Lienzo Actual&rdquo; arriba para conservar una miniatura de la sesión en la galería.
              </p>
            </div>
          ) : (
            /* Responsive Thumbnail Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArtworks.map((art) => (
                <div
                  key={art.id}
                  onClick={() => {
                    sound.playPop(520);
                    setSelectedArtworkId(art.id);
                  }}
                  className="group relative flex flex-col rounded-2xl border border-slate-800 hover:border-indigo-500/60 bg-slate-950/70 overflow-hidden shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer"
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-[16/10] w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
                    {art.thumbnailDataUrl ? (
                      <img
                        src={art.thumbnailDataUrl}
                        alt={art.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                        Sin vista previa
                      </div>
                    )}

                    {/* Room Badge */}
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/70 text-[10px] font-mono font-bold text-indigo-300">
                      {art.roomId}
                    </div>

                    {/* Score Badge if critiqued */}
                    {art.critique && (
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-amber-500/95 text-slate-950 font-black text-[11px] shadow flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        <span>{art.critique.score}</span>
                      </div>
                    )}

                    {/* Filter badge */}
                    {art.filterName && art.filterName !== 'Original (Sin Filtro)' && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[10px] font-medium text-amber-300 border border-amber-500/20">
                        {art.filterName}
                      </div>
                    )}

                    {/* Hover Quick Action Overlay */}
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <span className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspeccionar</span>
                      </span>
                      <button
                        onClick={(e) => handleDownloadArtwork(art, e)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 shadow-lg"
                        title="Descargar miniatura"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition">
                        {art.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {art.theme}
                      </p>
                    </div>

                    {/* Footer: Collaborators + Layer/Stroke Stats */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      {/* Avatar Stack */}
                      <div className="flex items-center -space-x-1.5">
                        {art.artists.slice(0, 4).map((artist, i) => (
                          <div
                            key={`${artist.id}-${i}`}
                            title={artist.name}
                            className="w-5 h-5 rounded-full border border-slate-900 flex items-center justify-center text-[10px]"
                            style={{ backgroundColor: artist.color }}
                          >
                            {artist.avatar}
                          </div>
                        ))}
                        {art.artists.length > 4 && (
                          <div className="w-5 h-5 rounded-full border border-slate-900 bg-slate-800 text-[9px] font-bold text-slate-200 flex items-center justify-center">
                            +{art.artists.length - 4}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 font-mono text-[10px]">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Layers className="w-3 h-3 text-indigo-400" />
                          {art.layersCount}c · {art.strokesCount}t
                        </span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {formatRelativeTime(art.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
