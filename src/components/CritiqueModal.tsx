import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Download, RotateCcw, X, Award, Images, CheckCircle2 } from 'lucide-react';
import { ArtCritiqueResult } from '../types/game';
import { sound } from '../utils/audio';

interface CritiqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  critique: ArtCritiqueResult | null;
  isLoading: boolean;
  canvasSnapshotUrl?: string;
  onNewRound: () => void;
  onOpenGallery?: () => void;
}

export const CritiqueModal: React.FC<CritiqueModalProps> = ({
  isOpen,
  onClose,
  critique,
  isLoading,
  canvasSnapshotUrl,
  onNewRound,
  onOpenGallery,
}) => {
  useEffect(() => {
    if (isOpen && critique) {
      sound.playVictory();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [isOpen, critique]);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!canvasSnapshotUrl) return;
    const a = document.createElement('a');
    a.href = canvasSnapshotUrl;
    a.download = `pincelada-colab-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-indigo-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-slate-100 shadow-2xl overflow-hidden my-8">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-lg shadow-rose-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Galería & Crítica IA
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-400">Veredicto del crítico internacional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-4">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <div className="absolute inset-2 rounded-full border-4 border-purple-500/20 border-b-purple-500 animate-spin animate-reverse" />
            </div>
            <p className="text-sm font-semibold text-indigo-300 animate-pulse">
              Gemini 3.8 Flash está contemplando las capas y pinceladas...
            </p>
            <p className="text-xs text-slate-500">Evaluando armonía, audacia y color colectivo</p>
          </div>
        ) : critique ? (
          <div className="mt-5 space-y-4 text-sm">
            {/* Snapshot Preview */}
            {canvasSnapshotUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 aspect-[16/10] shadow-inner">
                <img
                  src={canvasSnapshotUrl}
                  alt="Obra Colaborativa"
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md text-[11px] font-mono text-slate-300">
                  {critique.style}
                </div>
              </div>
            )}

            {/* Score & Title Card */}
            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                  Título de la Obra
                </span>
                <h3 className="text-base font-extrabold text-white truncate">
                  "{critique.title}"
                </h3>
                <p className="text-xs text-slate-300 font-medium">{critique.style}</p>
              </div>

              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 flex-shrink-0">
                <span className="text-2xl font-black tabular-nums">{critique.score}</span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400">
                  Puntos
                </span>
              </div>
            </div>

            {/* Critique quote */}
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 space-y-2">
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "{critique.critique}"
              </p>
              <div className="pt-2 border-t border-slate-700/40 text-[11px] text-slate-400">
                <strong className="text-indigo-300">Armonía de Capas:</strong> {critique.harmonyAnalysis}
              </div>
            </div>

            {/* Badges */}
            {critique.badges && critique.badges.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {critique.badges.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/60 text-purple-300 border border-purple-500/30 shadow-sm"
                  >
                    <Award className="w-3.5 h-3.5 text-amber-400" />
                    {b}
                  </span>
                ))}
              </div>
            )}

            {/* Saved to Gallery Banner */}
            <div className="px-3.5 py-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Obra guardada automáticamente en la Galería de la Sala</span>
              </div>
              {onOpenGallery && (
                <button
                  onClick={() => {
                    sound.playPop(540);
                    onClose();
                    onOpenGallery();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer flex-shrink-0"
                >
                  <Images className="w-3.5 h-3.5" />
                  <span>Ver Galería</span>
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="pt-1 grid grid-cols-2 gap-2">
              <button
                onClick={handleDownload}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Descargar PNG</span>
              </button>

              <button
                onClick={() => {
                  sound.playPop(520);
                  onNewRound();
                  onClose();
                }}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Nueva Ronda</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            No se pudo obtener la crítica de arte.
          </div>
        )}
      </div>
    </div>
  );
};
