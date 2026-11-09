import React, { useState } from 'react';
import {
  Paintbrush,
  PenTool,
  Wind,
  Highlighter,
  Eraser,
  Sparkles,
  Mic,
  Bot,
  HelpCircle,
  Layers,
  Palette,
  Minus,
  Plus,
  Undo2,
  Redo2,
  History,
  Wand2,
  Check,
  Sliders,
  X,
} from 'lucide-react';
import { ToolType, HistorySummary, ArtFilterConfig } from '../types/game';
import { sound } from '../utils/audio';

const PALETTE = [
  '#0f172a', // Ink Black (great on white canvas)
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#78350f', // Warm Brown
  '#ffffff', // Pure White
];

const QUICK_SWATCHES = [
  '#0f172a',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

const SIZE_PRESETS = [4, 10, 20, 34, 52];

interface ToolbarProps {
  currentTool: ToolType;
  currentColor: string;
  brushSize: number;
  brushOpacity: number;
  activeLayerName: string;
  history: HistorySummary;
  activeFilter: ArtFilterConfig;
  historyToast: string;
  onSelectTool: (tool: ToolType) => void;
  onSelectColor: (color: string) => void;
  onChangeSize: (size: number) => void;
  onChangeOpacity: (opacity: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleHistoryPanel: () => void;
  onOpenFilterModal: () => void;
  onToggleLayerPanel: () => void;
  onOpenVoiceModal: () => void;
  onRequestAIPaint: () => void;
  onRequestAIGuess: () => void;
  isAiPainting: boolean;
  isAiGuessing: boolean;
  aiGuessText: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  currentColor,
  brushSize,
  brushOpacity,
  activeLayerName,
  history,
  activeFilter,
  historyToast,
  onSelectTool,
  onSelectColor,
  onChangeSize,
  onChangeOpacity,
  onUndo,
  onRedo,
  onToggleHistoryPanel,
  onOpenFilterModal,
  onToggleLayerPanel,
  onOpenVoiceModal,
  onRequestAIPaint,
  onRequestAIGuess,
  isAiPainting,
  isAiGuessing,
  aiGuessText,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushSettings, setShowBrushSettings] = useState(false);

  const tools: { id: ToolType; icon: React.ReactNode; label: string; shortLabel: string }[] = [
    { id: 'brush', icon: <Paintbrush className="w-4 h-4" />, label: 'Pincel Suave', shortLabel: 'Pincel' },
    { id: 'pen', icon: <PenTool className="w-4 h-4" />, label: 'Pluma Tinta', shortLabel: 'Pluma' },
    { id: 'spray', icon: <Wind className="w-4 h-4" />, label: 'Aerógrafo', shortLabel: 'Spray' },
    { id: 'highlighter', icon: <Highlighter className="w-4 h-4" />, label: 'Marcador', shortLabel: 'Marca' },
    { id: 'stamp', icon: <Sparkles className="w-4 h-4" />, label: 'Sellos de Color', shortLabel: 'Sello' },
    { id: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Borrador', shortLabel: 'Borrar' },
  ];

  const handleChooseColor = (color: string, closePopover = false) => {
    sound.playPop(600);
    onSelectColor(color);
    if (currentTool === 'eraser') {
      onSelectTool('brush');
    }
    if (closePopover) {
      setShowColorPicker(false);
    }
  };

  return (
    <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 w-[96vw] sm:w-auto max-w-[98vw] pointer-events-none">
      {/* Popover 1: Full Color Palette */}
      {showColorPicker && (
        <div className="pointer-events-auto p-3.5 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md w-72 sm:w-64 z-50 animate-fade-in">
          <div className="flex items-center justify-between mb-2.5 pb-1.5 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-400" />
              Paleta de Colores
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                {currentColor}
              </span>
              <button
                type="button"
                onClick={() => setShowColorPicker(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2.5">
            {PALETTE.map((c) => {
              const isSelected = currentColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleChooseColor(c, true)}
                  className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full transition hover:scale-110 active:scale-95 shadow cursor-pointer flex items-center justify-center border ${
                    isSelected
                      ? 'ring-2 ring-indigo-400 border-white scale-110'
                      : 'border-white/25'
                  }`}
                  style={{ backgroundColor: c }}
                  title={`Color ${c}`}
                >
                  {isSelected && (
                    <Check
                      className={`w-3.5 h-3.5 ${
                        c.toLowerCase() === '#ffffff' || c.toLowerCase() === '#f59e0b'
                          ? 'text-slate-900'
                          : 'text-white'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
            <label htmlFor="custom-color-input" className="font-medium cursor-pointer">
              Color personalizado:
            </label>
            <input
              id="custom-color-input"
              type="color"
              value={currentColor}
              onChange={(e) => handleChooseColor(e.target.value, false)}
              className="w-9 h-7 rounded cursor-pointer bg-transparent border border-slate-700"
            />
          </div>
        </div>
      )}

      {/* Popover 2: Brush Size & Opacity Fine Controls (Works on Mobile & Desktop) */}
      {showBrushSettings && (
        <div className="pointer-events-auto p-3.5 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md w-72 z-50 animate-fade-in space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Ajuste de Trazo y Opacidad
            </span>
            <button
              type="button"
              onClick={() => setShowBrushSettings(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Size Slider + Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Grosor del pincel</span>
              <span className="font-mono font-bold text-indigo-300">{brushSize} px</span>
            </div>
            <input
              type="range"
              min={2}
              max={64}
              value={brushSize}
              onChange={(e) => onChangeSize(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex items-center justify-between pt-1">
              {SIZE_PRESETS.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => {
                    sound.playPop(520);
                    onChangeSize(sz);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border transition cursor-pointer ${
                    brushSize === sz
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Opacidad del trazo</span>
              <span className="font-mono font-bold text-emerald-300">
                {Math.round(brushOpacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={brushOpacity}
              onChange={(e) => onChangeOpacity(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Live AI Guess or Collaborative History Notification */}
      {(aiGuessText || historyToast) && (
        <div className="pointer-events-auto px-3.5 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700 shadow-xl text-xs font-medium text-slate-200 flex items-center gap-2 max-w-[92vw] truncate">
          {aiGuessText ? (
            <>
              <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Gemini adivina: &ldquo;{aiGuessText}&rdquo;</span>
            </>
          ) : (
            <>
              <History className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">{historyToast}</span>
            </>
          )}
        </div>
      )}

      {/* MOBILE UPPER QUICK BAR (< 640px): Direct Color Swatches + Brush Size Pill + AI Studio Actions */}
      <div className="sm:hidden pointer-events-auto flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-xl backdrop-blur-md w-full">
        {/* Direct 1-Tap Color Swatches on Mobile */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
          {QUICK_SWATCHES.map((swatch) => {
            const isSelected =
              currentColor.toLowerCase() === swatch.toLowerCase() && currentTool !== 'eraser';
            return (
              <button
                key={swatch}
                type="button"
                onClick={() => handleChooseColor(swatch, false)}
                aria-label={`Color ${swatch}`}
                className={`w-6 h-6 rounded-full transition shrink-0 cursor-pointer ${
                  isSelected
                    ? 'ring-2 ring-white scale-110 shadow-md'
                    : 'opacity-85 active:scale-95 border border-white/25'
                }`}
                style={{ backgroundColor: swatch }}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mobile Brush Size & Opacity Trigger */}
          <button
            type="button"
            onClick={() => {
              sound.playPop(500);
              setShowBrushSettings((prev) => !prev);
              setShowColorPicker(false);
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-xl border text-[11px] font-mono font-bold transition cursor-pointer ${
              showBrushSettings
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-950/80 text-slate-200 border-slate-700'
            }`}
            title="Ajustar grosor y opacidad"
          >
            <span
              className="w-2.5 h-2.5 rounded-full border border-white/40"
              style={{ backgroundColor: currentColor }}
            />
            <span>{brushSize}px</span>
          </button>

          {/* Mobile AI Quick Cluster */}
          <button
            type="button"
            onClick={() => {
              sound.playPop(560);
              onOpenFilterModal();
            }}
            className={`p-1.5 rounded-xl border transition cursor-pointer ${
              activeFilter.id !== 'none'
                ? 'bg-amber-500/25 border-amber-500/50 text-amber-200'
                : 'bg-slate-950/70 border-slate-800 text-amber-400'
            }`}
            title="Filtros IA"
          >
            <Wand2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onOpenVoiceModal}
            className="p-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 cursor-pointer"
            title="Dictar por voz"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onRequestAIPaint}
            disabled={isAiPainting}
            className="p-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 disabled:opacity-50 cursor-pointer"
            title="Co-Pintor IA"
          >
            <Bot className={`w-3.5 h-3.5 ${isAiPainting ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onRequestAIGuess}
            disabled={isAiGuessing}
            className="p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 disabled:opacity-50 cursor-pointer"
            title="Adivinar dibujo con IA"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiGuessing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* MAIN ERGONOMIC BOTTOM DOCK */}
      <div className="pointer-events-auto flex items-center justify-between sm:justify-center gap-1 p-1.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md w-full sm:w-auto overflow-x-auto no-scrollbar">
        {/* Global Undo / Redo & History Timeline Cluster */}
        <div className="flex items-center gap-0.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!history.canUndo) return;
              sound.playUndo();
              onUndo();
            }}
            disabled={!history.canUndo}
            title={`Deshacer última acción global (Ctrl+Z) · ${history.undoCount} disponibles`}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 disabled:opacity-30 transition cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!history.canRedo) return;
              sound.playRedo();
              onRedo();
            }}
            disabled={!history.canRedo}
            title={`Rehacer acción global (Ctrl+Y) · ${history.redoCount} disponibles`}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 disabled:opacity-30 transition cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playPop(510);
              onToggleHistoryPanel();
            }}
            title="Abrir línea de tiempo del Historial Global"
            className="px-2 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 text-[11px] font-mono tabular-nums"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">{history.undoCount}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="w-[1px] h-6 bg-slate-800 mx-0.5 shrink-0" />

        {/* Tool selector buttons */}
        <div className="flex items-center gap-0.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
          {tools.map((t) => {
            const isActive = currentTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  sound.playPop(500);
                  onSelectTool(t.id);
                }}
                title={t.label}
                className={`p-2 rounded-lg transition cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {t.icon}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-[1px] h-6 bg-slate-800 mx-0.5 shrink-0" />

        {/* Instant Swatches (Desktop) + Full Color Palette Trigger (All screens) */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 shrink-0">
          <div className="hidden md:flex items-center gap-1 px-1">
            {QUICK_SWATCHES.slice(0, 7).map((swatch) => {
              const isSelected =
                currentColor.toLowerCase() === swatch.toLowerCase() &&
                currentTool !== 'eraser';
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => handleChooseColor(swatch, false)}
                  title={`Cambiar a color ${swatch}`}
                  className={`w-5 h-5 rounded-full transition cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-white scale-110 shadow-md'
                      : 'opacity-80 hover:opacity-100 hover:scale-105 border border-white/20'
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              );
            })}
          </div>

          {/* Toggle Full Color Palette Button */}
          <button
            type="button"
            onClick={() => {
              sound.playPop(480);
              setShowColorPicker((prev) => !prev);
              setShowBrushSettings(false);
            }}
            title="Abrir selector de colores completo"
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition cursor-pointer ${
              showColorPicker
                ? 'bg-indigo-600/30 border-indigo-400 text-white'
                : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-200'
            }`}
          >
            <span
              className="w-5 h-5 rounded-full ring-2 ring-white/30 shadow-inner shrink-0"
              style={{ backgroundColor: currentColor }}
            />
            <Palette className="w-3.5 h-3.5 text-indigo-300 hidden sm:inline" />
          </button>
        </div>

        {/* Desktop Brush Size & Opacity Controls */}
        <div className="hidden sm:flex items-center gap-1 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800 text-slate-400 shrink-0">
          <button
            type="button"
            onClick={() => onChangeSize(Math.max(2, brushSize - 4))}
            className="p-1 hover:text-white cursor-pointer"
            title="Disminuir grosor"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playPop(500);
              setShowBrushSettings((prev) => !prev);
              setShowColorPicker(false);
            }}
            className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
            title="Ajustar grosor y opacidad"
          >
            <span
              className="rounded-full border border-white/30"
              style={{
                width: `${Math.min(16, Math.max(4, brushSize / 2))}px`,
                height: `${Math.min(16, Math.max(4, brushSize / 2))}px`,
                backgroundColor: currentColor,
              }}
            />
            <span className="text-[11px] font-mono">{brushSize}px</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSize(Math.min(64, brushSize + 4))}
            className="p-1 hover:text-white cursor-pointer"
            title="Aumentar grosor"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Desktop AI Intelligence & Artistic Filters Buttons */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          <div className="w-[1px] h-6 bg-slate-800 mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={() => {
              sound.playPop(560);
              onOpenFilterModal();
            }}
            className={`px-2.5 py-2 rounded-xl border transition shadow-sm flex items-center gap-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
              activeFilter.id !== 'none'
                ? 'bg-amber-500/25 border-amber-500/50 text-amber-200'
                : 'bg-slate-950/60 border-slate-800 text-amber-300 hover:bg-slate-800'
            }`}
            title="Filtros Artísticos de IA"
          >
            <Wand2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden lg:inline">
              {activeFilter.id !== 'none' ? activeFilter.name : 'Filtros IA'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenVoiceModal}
            className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition shadow-sm cursor-pointer"
            title="Dictar por voz"
          >
            <Mic className="w-4 h-4 text-rose-400" />
          </button>

          <button
            type="button"
            onClick={onRequestAIPaint}
            disabled={isAiPainting}
            className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition shadow-sm disabled:opacity-50 cursor-pointer"
            title="Pintar capa mágica con Gemini IA"
          >
            <Bot className={`w-4 h-4 text-purple-400 ${isAiPainting ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onRequestAIGuess}
            disabled={isAiGuessing}
            className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition shadow-sm disabled:opacity-50 cursor-pointer"
            title="Adivinar dibujo con IA"
          >
            <Sparkles className={`w-4 h-4 text-amber-400 ${isAiGuessing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-[1px] h-6 bg-slate-800 mx-0.5 shrink-0" />

        {/* Layer Panel Trigger Button */}
        <button
          type="button"
          onClick={() => {
            sound.playPop(540);
            onToggleLayerPanel();
          }}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/50 hover:bg-indigo-600/50 text-indigo-200 text-xs font-semibold shadow-md transition cursor-pointer shrink-0 whitespace-nowrap"
          title="Abrir panel de capas"
        >
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="hidden sm:inline max-w-[85px] truncate">{activeLayerName}</span>
        </button>
      </div>
    </div>
  );
};
