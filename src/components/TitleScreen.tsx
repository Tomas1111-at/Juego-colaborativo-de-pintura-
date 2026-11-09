import React, { useState, useEffect } from 'react';
import { Play, Sparkles, Smartphone, Users, Palette, Zap } from 'lucide-react';
import { sound } from '../utils/audio';
import { PWAInstallButton } from './PWAInstallButton';
import { ApkInstallModal } from './ApkInstallModal';

const AVATARS = ['🎨', '🖌️', '🦁', '🦊', '🚀', '⭐', '🐉', '👾', '🌈', '⚡'];
const COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#6366f1',
];

interface TitleScreenProps {
  onStartGame: (user: { name: string; avatar: string; color: string }, roomId: string) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStartGame }) => {
  const [name, setName] = useState('Artista 1');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [roomId, setRoomId] = useState('ARTE-1');
  const [showApkModal, setShowApkModal] = useState(false);

  // Keyboard shortcut: Space or Enter to start
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        handleStart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [name, selectedAvatar, selectedColor, roomId]);

  const handleStart = () => {
    sound.playVictory();
    onStartGame(
      {
        name: name.trim() || 'Artista',
        avatar: selectedAvatar,
        color: selectedColor,
      },
      roomId.trim().toUpperCase() || 'ARTE-1'
    );
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-start sm:justify-center py-6 px-4 sm:p-6 bg-slate-950 text-slate-100 overflow-y-auto overflow-x-hidden select-none">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Floating Canvas Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute top-12 left-16 w-32 h-32 rounded-3xl border border-indigo-500/30 rotate-12 animate-pulse" />
        <div className="absolute bottom-16 right-20 w-40 h-40 rounded-full border border-pink-500/30 -rotate-12" />
        <div className="absolute top-1/3 right-1/4 w-20 h-20 rounded-xl border border-amber-500/20 rotate-45" />
      </div>

      {/* Main Content Container with ~35% negative space */}
      <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center space-y-4 sm:space-y-6 my-auto">
        {/* Bespoke inline SVG Title Lockup */}
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Pintura Colaborativa en Tiempo Real</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-center justify-center gap-3">
            <svg
              className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-[0_0_25px_rgba(99,102,241,0.5)]"
              viewBox="0 0 100 100"
              fill="none"
            >
              <defs>
                <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="44" stroke="url(#titleGrad)" strokeWidth="8" />
              <path
                d="M32 68 L68 32 M48 24 L76 52 M24 52 L52 76"
                stroke="url(#titleGrad)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle cx="50" cy="50" r="10" fill="#f43f5e" />
            </svg>
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">
              PINCELADA
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
            Crea arte en capas con múltiples amigos simultáneos, chat de voz y veredicto de IA.
          </p>
        </div>

        {/* Player Setup Card */}
        <div className="w-full p-5 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md space-y-4 text-left">
          {/* Nickname & Avatar */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Tu Nombre de Artista</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                maxLength={18}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre o alias..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500 font-medium"
              />
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border border-white/20 shadow-inner flex-shrink-0"
                style={{ backgroundColor: selectedColor }}
              >
                {selectedAvatar}
              </div>
            </div>
          </div>

          {/* Avatars Carousel */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Elige tu Ícono</label>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  onClick={() => {
                    sound.playPop(500);
                    setSelectedAvatar(av);
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition flex-shrink-0 cursor-pointer ${
                    selectedAvatar === av
                      ? 'bg-indigo-600 scale-110 shadow-md ring-2 ring-indigo-400'
                      : 'bg-slate-800 hover:bg-slate-700'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Cursor Color Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400">Color de tu Puntero</label>
            <div className="flex items-center gap-2">
              {COLORS.map((col) => (
                <button
                  key={col}
                  onClick={() => {
                    sound.playPop(550);
                    setSelectedColor(col);
                  }}
                  className={`w-7 h-7 rounded-full transition cursor-pointer ${
                    selectedColor === col ? 'ring-2 ring-white scale-110 shadow' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          {/* Room ID selection */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Código de Sala</span>
              <span className="text-[10px] text-indigo-400">Mismo código = Misma sala</span>
            </label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="ARTE-1"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm tracking-wider uppercase focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Primary Start CTA */}
        <div className="w-full space-y-2">
          <button
            onClick={handleStart}
            className="w-full py-4 px-6 rounded-2xl font-black text-base tracking-wide bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600 hover:from-blue-500 hover:to-pink-500 text-white shadow-xl shadow-indigo-600/40 active:scale-[0.98] transition flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>ENTRAR AL LIENZO</span>
          </button>

          {/* Install APK / WebAPK mobile button */}
          <button
            onClick={() => setShowApkModal(true)}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-300 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Smartphone className="w-4 h-4 text-indigo-400" />
            <span>Instalar APK / App Android a 60 FPS</span>
          </button>
        </div>

        {/* Flat control-hint line as required by Game Craft constitution */}
        <div className="text-[11px] font-mono text-slate-500 tracking-wider">
          Tocar / Arrastrar Pintar · 1-4 Capas Sincronizadas · Enter Iniciar · M Silenciar
        </div>
      </div>

      <ApkInstallModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
    </div>
  );
};
