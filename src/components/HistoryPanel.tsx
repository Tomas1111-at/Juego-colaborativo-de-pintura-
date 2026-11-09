import React from 'react';
import {
  History,
  Undo2,
  Redo2,
  X,
  Paintbrush,
  Layers,
  Wand2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { HistorySummary, HistorySummaryItem } from '../types/game';
import { sound } from '../utils/audio';

interface HistoryPanelProps {
  history: HistorySummary;
  isOpen: boolean;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToHistory: (historyId: string) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  history,
  isOpen,
  onClose,
  onUndo,
  onRedo,
  onJumpToHistory,
}) => {
  if (!isOpen) return null;

  const getActionIcon = (actionType: HistorySummaryItem['actionType']) => {
    switch (actionType) {
      case 'stroke':
        return <Paintbrush className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'ai_filter':
        return <Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'ai_paint':
        return <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'layer_clear':
        return <RotateCcw className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  // Display newest items at the top of the list for easy scanning
  const chronologicalItems = [...history.items].reverse();

  return (
    <>
      <div
        onClick={onClose}
        className="sm:hidden fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[1px]"
      />
      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[78vh] rounded-t-3xl border-t border-slate-700/80 sm:inset-y-0 sm:left-0 sm:right-auto sm:w-88 sm:max-h-none sm:rounded-none sm:border-t-0 sm:border-r sm:border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md flex flex-col text-slate-100 select-none animate-fade-in">
        {/* Mobile Handle Pill */}
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 bg-slate-950/60 rounded-t-3xl">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">
              Historial Global
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
              <span>{history.undoCount} activas</span>
              <span aria-hidden="true">·</span>
              <span>{history.redoCount} por rehacer</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          title="Cerrar historial"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Global Undo / Redo Action Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            if (!history.canUndo) return;
            sound.playUndo();
            onUndo();
          }}
          disabled={!history.canUndo}
          className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-semibold text-slate-100 flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
          title="Deshacer última acción global (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Deshacer</span>
          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
            ({history.undoCount})
          </span>
        </button>

        <button
          onClick={() => {
            if (!history.canRedo) return;
            sound.playRedo();
            onRedo();
          }}
          disabled={!history.canRedo}
          className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-xs font-semibold text-slate-100 flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
          title="Rehacer acción global (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Rehacer</span>
          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
            ({history.redoCount})
          </span>
        </button>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {chronologicalItems.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <History className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs font-medium text-slate-400">
              Aún no hay acciones registradas en esta ronda.
            </p>
            <p className="text-[11px] text-slate-500">
              Cada trazo, fusión de capas o filtro artístico de IA aparecerá aquí en tiempo real.
            </p>
          </div>
        ) : (
          chronologicalItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                sound.playPop(480);
                onJumpToHistory(item.id);
              }}
              className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                item.isUndone
                  ? 'bg-slate-900/40 border-slate-800/70 opacity-55 hover:opacity-90'
                  : 'bg-slate-800/70 border-slate-700/70 hover:bg-slate-800 hover:border-indigo-500/50'
              }`}
              title="Haz clic para restaurar el lienzo colaborativo a este punto"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="mt-0.5 p-1.5 rounded-lg bg-slate-950/80 border border-slate-800">
                  {getActionIcon(item.actionType)}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p
                    className={`text-xs font-semibold truncate ${
                      item.isUndone ? 'line-through text-slate-400' : 'text-slate-100'
                    }`}
                  >
                    {item.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span
                      className="font-medium truncate max-w-[110px]"
                      style={{ color: item.userColor }}
                    >
                      {item.userName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[10px] text-slate-500">
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                {item.isUndone ? 'Rehacer' : 'Activo'}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
        <span>Atajos: Ctrl+Z · Ctrl+Y</span>
        <span>Sincronizado en vivo</span>
      </div>
    </div>
    </>
  );
};
