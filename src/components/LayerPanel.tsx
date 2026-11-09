import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Combine,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sliders,
  Check,
  Edit2,
  X,
} from 'lucide-react';
import { Layer, UserPresence } from '../types/game';
import { sound } from '../utils/audio';

interface LayerPanelProps {
  layers: Layer[];
  activeLayerId: string;
  activeUsers: Record<string, UserPresence>;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectLayer: (layerId: string) => void;
  onCreateLayer: (name?: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onUpdateLayer: (layerId: string, updates: Partial<Layer>) => void;
  onMergeLayers: (sourceLayerId: string, targetLayerId: string) => void;
  onReorderLayers: (layerIds: string[]) => void;
  onClearLayer: (layerId: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  activeLayerId,
  activeUsers,
  currentUserId,
  isOpen,
  onClose,
  onSelectLayer,
  onCreateLayer,
  onDeleteLayer,
  onUpdateLayer,
  onMergeLayers,
  onReorderLayers,
  onClearLayer,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  if (!isOpen) return null;

  // Visual stack: Top of array represents top rendered layer
  // To display layers naturally as in Photoshop/Procreate (top layer at the top of the UI list),
  // we render layers in reverse order: [last, ..., first].
  const reversedLayers = [...layers].reverse();

  const handleCreateNew = () => {
    sound.playPop(620);
    onCreateLayer();
  };

  const handleStartRename = (layer: Layer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingLayerId(layer.id);
    setTempName(layer.name);
  };

  const handleSaveRename = (layerId: string) => {
    if (tempName.trim()) {
      onUpdateLayer(layerId, { name: tempName.trim() });
    }
    setEditingLayerId(null);
  };

  const handleMoveUp = (indexInLayers: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (indexInLayers >= layers.length - 1) return;
    sound.playPop(520);
    const newLayers = [...layers];
    const temp = newLayers[indexInLayers];
    newLayers[indexInLayers] = newLayers[indexInLayers + 1];
    newLayers[indexInLayers + 1] = temp;
    onReorderLayers(newLayers.map((l) => l.id));
  };

  const handleMoveDown = (indexInLayers: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (indexInLayers <= 0) return;
    sound.playPop(420);
    const newLayers = [...layers];
    const temp = newLayers[indexInLayers];
    newLayers[indexInLayers] = newLayers[indexInLayers - 1];
    newLayers[indexInLayers - 1] = temp;
    onReorderLayers(newLayers.map((l) => l.id));
  };

  const handleMergeDown = (layerId: string, indexInLayers: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (indexInLayers <= 0) return; // Cannot merge bottom-most layer down
    const targetLayer = layers[indexInLayers - 1];
    if (targetLayer) {
      sound.playLayerMerge();
      onMergeLayers(layerId, targetLayer.id);
    }
  };

  const handleDelete = (layerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (layers.length <= 1) return;
    sound.playLayerAction();
    onDeleteLayer(layerId);
  };

  const handleClear = (layerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playStrokeSound('eraser');
    onClearLayer(layerId);
  };

  // Find who is drawing on each layer
  const getUsersOnLayer = (layerId: string) => {
    return Object.values(activeUsers).filter(
      (u) => u.activeLayerId === layerId && u.id !== currentUserId
    );
  };

  return (
    <>
      {/* Mobile Backdrop so tapping outside closes the sheet effortlessly */}
      <div
        onClick={onClose}
        className="sm:hidden fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[1px]"
      />
      <div className="fixed inset-x-0 bottom-0 z-40 max-h-[78vh] rounded-t-3xl border-t border-slate-700/80 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-88 sm:max-h-none sm:rounded-none sm:border-t-0 sm:border-l sm:border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur-md flex flex-col text-slate-100 select-none animate-fade-in">
        {/* Mobile Handle Pill */}
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 bg-slate-950/60 rounded-t-3xl">
          <div className="w-10 h-1 rounded-full bg-slate-700" />
        </div>
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Capas Colaborativas
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
                  {layers.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Sincronizadas en tiempo real para todos</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 active:scale-95 transition cursor-pointer"
              title="Crear nueva capa"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {reversedLayers.map((layer) => {
          const indexInOriginal = layers.findIndex((l) => l.id === layer.id);
          const isActive = layer.id === activeLayerId;
          const usersOnLayer = getUsersOnLayer(layer.id);
          const canMergeDown = indexInOriginal > 0;
          const canMoveUp = indexInOriginal < layers.length - 1;
          const canMoveDown = indexInOriginal > 0;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`group relative rounded-xl border p-3 transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-950/70 border-indigo-500/60 shadow-lg shadow-indigo-900/20'
                  : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800/90 hover:border-slate-600'
              } ${!layer.visible ? 'opacity-50' : ''}`}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r" />
              )}

              {/* Layer Title Row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Visibility Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playPop(480);
                      onUpdateLayer(layer.id, { visible: !layer.visible });
                    }}
                    title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
                    className={`p-1 rounded-md transition ${
                      layer.visible
                        ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950'
                        : 'text-slate-500 hover:text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  {/* Layer Name / Renaming */}
                  {editingLayerId === layer.id ? (
                    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(layer.id);
                          if (e.key === 'Escape') setEditingLayerId(null);
                        }}
                        autoFocus
                        className="w-full text-xs bg-slate-950 border border-indigo-500 rounded px-2 py-0.5 text-white focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveRename(layer.id)}
                        className="p-1 text-emerald-400 hover:bg-slate-700 rounded"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {layer.name}
                      </span>
                      <button
                        onClick={(e) => handleStartRename(layer, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition"
                        title="Renombrar capa"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right controls: Lock & Strokes count */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded">
                    {layer.strokes.length} trazos
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playPop(390);
                      onUpdateLayer(layer.id, { locked: !layer.locked });
                    }}
                    title={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}
                    className={`p-1 rounded-md transition ${
                      layer.locked
                        ? 'text-amber-400 bg-amber-950/40'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/50'
                    }`}
                  >
                    {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Other Active Users on this layer pill */}
              {usersOnLayer.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400">Pintando aquí:</span>
                  {usersOnLayer.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border"
                      style={{
                        backgroundColor: `${u.color}20`,
                        borderColor: `${u.color}50`,
                        color: u.color,
                      }}
                    >
                      <span>{u.avatar}</span>
                      <span className="max-w-[70px] truncate">{u.name}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Opacity Slider */}
              <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center gap-2">
                <Sliders className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="text-[10px] text-slate-400 w-11 font-mono">
                  {Math.round(layer.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={layer.opacity}
                  disabled={layer.locked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateLayer(layer.id, { opacity: val });
                  }}
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
                />
              </div>

              {/* Actions Footer Bar: Move, Merge Down, Clear, Delete */}
              <div className="mt-2 flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-0.5">
                  <button
                    disabled={!canMoveUp}
                    onClick={(e) => handleMoveUp(indexInOriginal, e)}
                    className="p-1 rounded hover:bg-slate-700 hover:text-white disabled:opacity-20 transition"
                    title="Mover arriba"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={!canMoveDown}
                    onClick={(e) => handleMoveDown(indexInOriginal, e)}
                    className="p-1 rounded hover:bg-slate-700 hover:text-white disabled:opacity-20 transition"
                    title="Mover abajo"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Merge Down */}
                  {canMergeDown && (
                    <button
                      onClick={(e) => handleMergeDown(layer.id, indexInOriginal, e)}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-indigo-300 hover:bg-indigo-950 hover:text-indigo-200 transition"
                      title="Fusionar hacia abajo con la capa inferior"
                    >
                      <Combine className="w-3.5 h-3.5" />
                      <span>Fusionar</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-0.5">
                  <button
                    disabled={layer.locked || layer.strokes.length === 0}
                    onClick={(e) => handleClear(layer.id, e)}
                    className="p-1 rounded hover:bg-amber-950/60 hover:text-amber-300 disabled:opacity-20 transition"
                    title="Limpiar trazos de esta capa"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    disabled={layers.length <= 1}
                    onClick={(e) => handleDelete(layer.id, e)}
                    className="p-1 rounded hover:bg-red-950/60 hover:text-red-400 disabled:opacity-20 transition"
                    title={layers.length <= 1 ? 'No puedes eliminar la única capa' : 'Eliminar capa'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer tips */}
      <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span>✏️ Activa: <strong>{layers.find((l) => l.id === activeLayerId)?.name || 'Capa'}</strong></span>
        <button
          onClick={handleCreateNew}
          className="text-indigo-400 hover:text-indigo-300 font-semibold"
        >
          + Agregar
        </button>
      </div>
    </div>
    </>
  );
};
