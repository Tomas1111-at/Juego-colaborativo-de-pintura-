import React, { useState } from 'react';
import {
  Clock,
  Trophy,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Copy,
  Check,
  Sparkles,
  Layers,
  Flame,
  Images,
} from 'lucide-react';
import { GameMode, GamePhase, UserPresence } from '../types/game';
import { sound } from '../utils/audio';
import { PWAInstallButton } from './PWAInstallButton';

interface GameHUDProps {
  roomId: string;
  gameMode: GameMode;
  gamePhase: GamePhase;
  currentTheme: string;
  timeLeft: number;
  activeUsers: Record<string, UserPresence>;
  layersCount: number;
  activeLayerName: string;
  galleryCount: number;
  onToggleLayerPanel: () => void;
  onOpenGallery: () => void;
  onRequestCritique: () => void;
  onStartRound: (mode: GameMode, duration: number) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  roomId,
  gamePhase,
  currentTheme,
  timeLeft,
  activeUsers,
  layersCount,
  galleryCount,
  onToggleLayerPanel,
  onOpenGallery,
  onRequestCritique,
  onStartRound,
}) => {
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedRoom, setCopiedRoom] = useState(false);

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const toggleFullscreen = () => {
    sound.playPop(450);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleCopyRoom = () => {
    sound.playPop(520);
    navigator.clipboard.writeText(roomId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const usersList = Object.values(activeUsers);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-2 sm:p-3 select-none">
      {/* Top Bar Perimeter Cluster (Responsive 2-row on mobile, 1-row on desktop) */}
      <div className="flex flex-col gap-1.5 w-full pointer-events-auto">
        <div className="flex items-center justify-between gap-1.5 w-full">
          {/* Left cluster: Room info & players */}
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Room Pill */}
            <button
              type="button"
              onClick={handleCopyRoom}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-lg backdrop-blur-md text-xs font-semibold text-slate-200 active:scale-95 transition cursor-pointer"
              title="Toca para copiar código de sala"
            >
              <span className="hidden xs:inline text-[10px] text-slate-400">SALA</span>
              <span className="font-mono text-indigo-400 font-bold truncate max-w-[72px] sm:max-w-none">
                {roomId}
              </span>
              {copiedRoom ? (
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
            </button>

            {/* Active Players Avatars */}
            <div className="hidden sm:flex items-center -space-x-2 px-2.5 py-1 rounded-xl bg-slate-900/85 border border-slate-800 shadow-lg backdrop-blur-md">
              <Users className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
              {usersList.slice(0, 4).map((u) => (
                <div
                  key={u.id}
                  title={`${u.name} (capa: ${u.activeLayerId})`}
                  className="w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center text-xs shadow"
                  style={{ backgroundColor: u.color }}
                >
                  {u.avatar}
                </div>
              ))}
              {usersList.length > 4 && (
                <div className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-700 text-[10px] font-bold text-white flex items-center justify-center">
                  +{usersList.length - 4}
                </div>
              )}
            </div>
          </div>

          {/* Center on Desktop (`>= sm`): Thematic Challenge & Game Timer */}
          <div className="hidden sm:flex flex-col items-center max-w-md min-w-0">
            {currentTheme && (
              <div className="px-3.5 py-1 rounded-full bg-slate-900/90 border border-indigo-500/30 shadow-xl backdrop-blur-md text-xs font-bold text-indigo-200 flex items-center gap-2 max-w-sm truncate">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">{currentTheme}</span>
              </div>
            )}

            {gamePhase === 'playing' && (
              <div
                className={`mt-1 flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-mono font-bold shadow-lg ${
                  timeLeft <= 10
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-indigo-950/85 text-indigo-300 border border-indigo-500/40'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span className="tabular-nums tracking-wider">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>

          {/* Right cluster: Layers status, Gallery, Critique, APK install, Audio, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Layer Quick Badge */}
            <button
              type="button"
              onClick={() => {
                sound.playPop(520);
                onToggleLayerPanel();
              }}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-medium text-slate-200 hover:border-indigo-500/50 active:scale-95 transition shadow-lg backdrop-blur-md cursor-pointer"
              title="Ver capas"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-mono text-indigo-300 font-bold">{layersCount}</span>
              <span className="hidden md:inline text-[11px] text-slate-400">capas</span>
            </button>

            {/* Gallery Button */}
            <button
              type="button"
              onClick={() => {
                sound.playPop(560);
                onOpenGallery();
              }}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-medium text-slate-200 hover:border-amber-500/50 active:scale-95 transition shadow-lg backdrop-blur-md cursor-pointer"
              title="Abrir galería de obras completadas en la sala"
            >
              <Images className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline text-[11px] text-slate-200 font-semibold">
                Galería
              </span>
              <span className="font-mono text-[11px] px-1 rounded bg-amber-500/15 text-amber-300 font-bold">
                {galleryCount}
              </span>
            </button>

            {/* Pedir Crítica / Finalizar */}
            <button
              type="button"
              onClick={() => {
                sound.playVictory();
                onRequestCritique();
              }}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white text-xs font-bold shadow-lg shadow-rose-500/30 active:scale-95 transition cursor-pointer"
              title="Pedir veredicto del crítico de arte IA"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Crítica IA</span>
            </button>

            {/* PWA / APK Install Button */}
            <PWAInstallButton />

            {/* Sound Mute */}
            <button
              type="button"
              onClick={toggleSound}
              className="p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-400 hover:text-white active:scale-95 transition shadow-lg backdrop-blur-md cursor-pointer"
              title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden sm:flex p-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-400 hover:text-white transition shadow-lg backdrop-blur-md cursor-pointer"
              title="Pantalla completa"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Row 2 on Mobile (`< sm`): Compact Theme & Timer Pill */}
        <div className="flex sm:hidden items-center justify-center gap-1.5">
          {currentTheme && (
            <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-indigo-500/30 shadow-md backdrop-blur-md text-[11px] font-bold text-indigo-200 flex items-center gap-1.5 max-w-[78vw] truncate">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{currentTheme}</span>
            </div>
          )}

          {gamePhase === 'playing' && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold shadow-md shrink-0 ${
                timeLeft <= 10
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-indigo-950/90 text-indigo-300 border border-indigo-500/40'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span className="tabular-nums">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Mode Fast-Trigger bar if lobby (raised on mobile so it clears the 2-tier thumb dock) */}
      {gamePhase === 'lobby' && (
        <div className="self-center mb-28 sm:mb-16 pointer-events-auto">
          <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-slate-900/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md">
            <span className="text-xs font-bold text-slate-300 ml-2 hidden sm:inline">
              Iniciar Ronda:
            </span>
            <button
              type="button"
              onClick={() => {
                sound.playPop(620);
                onStartRound('speed_battle', 90);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span>Batalla 90s</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playPop(520);
                onStartRound('free_studio', 0);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <span>Estudio Libre</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
