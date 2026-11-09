import React, { useState } from 'react';
import { Wand2, Sparkles, X, Loader2, Check, RotateCcw, Layers } from 'lucide-react';
import { ArtFilterConfig, ArtFilterPresetId, Stroke } from '../types/game';
import { sound } from '../utils/audio';

export interface FilterPresetDefinition {
  id: ArtFilterPresetId;
  name: string;
  subtitle: string;
  defaultConfig: ArtFilterConfig;
  defaultPalette: string[];
}

export const ART_FILTER_PRESETS: FilterPresetDefinition[] = [
  {
    id: 'none',
    name: 'Original (Sin Filtro)',
    subtitle: 'Colores originales y lienzo limpio sin texturas añadidas',
    defaultConfig: {
      id: 'none',
      name: 'Original (Sin Filtro)',
      backgroundTint: '#ffffff',
      contrast: 100,
      saturation: 100,
      sepia: 0,
      hueRotate: 0,
      textureOverlay: 'none',
      vignetteIntensity: 0,
    },
    defaultPalette: [],
  },
  {
    id: 'impressionist_oil',
    name: 'Óleo Impresionista',
    subtitle: 'Empaste vibrante, trama de lienzo tejido y armonía post-impresionista',
    defaultConfig: {
      id: 'impressionist_oil',
      name: 'Óleo Impresionista',
      backgroundTint: '#172554',
      contrast: 118,
      saturation: 135,
      sepia: 12,
      hueRotate: -5,
      textureOverlay: 'canvas_weave',
      vignetteIntensity: 0.28,
    },
    defaultPalette: ['#facc15', '#fb923c', '#38bdf8', '#60a5fa', '#f472b6', '#4ade80'],
  },
  {
    id: 'botanical_watercolor',
    name: 'Acuarela Botánica',
    subtitle: 'Pigmentos translúcidos suaves y grano de papel prensado en frío',
    defaultConfig: {
      id: 'botanical_watercolor',
      name: 'Acuarela Botánica',
      backgroundTint: '#1e293b',
      contrast: 96,
      saturation: 112,
      sepia: 18,
      hueRotate: 6,
      textureOverlay: 'watercolor_paper',
      vignetteIntensity: 0.22,
    },
    defaultPalette: ['#34d399', '#fb7185', '#fcd34d', '#38bdf8', '#a78bfa', '#fda4af'],
  },
  {
    id: 'ukiyo_e',
    name: 'Grabado Ukiyo-e',
    subtitle: 'Xilografía japonesa tradicional con azul de Prusia, bermellón y ocre',
    defaultConfig: {
      id: 'ukiyo_e',
      name: 'Grabado Ukiyo-e',
      backgroundTint: '#1c1917',
      contrast: 124,
      saturation: 92,
      sepia: 32,
      hueRotate: -8,
      textureOverlay: 'woodblock',
      vignetteIntensity: 0.38,
    },
    defaultPalette: ['#ef4444', '#f59e0b', '#0284c7', '#e2e8f0', '#fb923c', '#14b8a6'],
  },
  {
    id: 'cyanotype_blueprint',
    name: 'Cianotipo Técnico',
    subtitle: 'Estética de plano arquitectónico en azul de Prusia y tiza luminosa',
    defaultConfig: {
      id: 'cyanotype_blueprint',
      name: 'Cianotipo Técnico',
      backgroundTint: '#082f49',
      contrast: 122,
      saturation: 110,
      sepia: 5,
      hueRotate: 12,
      textureOverlay: 'blueprint_grid',
      vignetteIntensity: 0.32,
    },
    defaultPalette: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#bae6fd', '#f0f9ff', '#22d3ee'],
  },
  {
    id: 'stained_glass',
    name: 'Vitral Gótico',
    subtitle: 'Fragmentos luminosos de alto contraste con viñeta profunda de plomo',
    defaultConfig: {
      id: 'stained_glass',
      name: 'Vitral Gótico',
      backgroundTint: '#090d16',
      contrast: 132,
      saturation: 142,
      sepia: 0,
      hueRotate: 0,
      textureOverlay: 'canvas_weave',
      vignetteIntensity: 0.48,
    },
    defaultPalette: ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899'],
  },
  {
    id: 'pop_halftone',
    name: 'Arte Pop Serigráfico',
    subtitle: 'Trama de semitonos, saturación intensa y recoloración audaz',
    defaultConfig: {
      id: 'pop_halftone',
      name: 'Arte Pop Serigráfico',
      backgroundTint: '#18181b',
      contrast: 128,
      saturation: 145,
      sepia: 0,
      hueRotate: 10,
      textureOverlay: 'halftone',
      vignetteIntensity: 0.25,
    },
    defaultPalette: ['#ff007f', '#00f5d4', '#fee440', '#ff5400', '#9b5de5', '#00bbf9'],
  },
];

interface AIArtFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeFilter: ArtFilterConfig;
  activeLayerName: string;
  getCanvasSnapshot: () => string;
  onApplyFilter: (payload: {
    filterConfig: ArtFilterConfig;
    palette?: string[];
    targetScope: 'all' | 'active_layer' | 'atmosphere_only';
    accentStrokes?: Partial<Stroke>[];
  }) => void;
}

export const AIArtFilterModal: React.FC<AIArtFilterModalProps> = ({
  isOpen,
  onClose,
  activeFilter,
  activeLayerName,
  getCanvasSnapshot,
  onApplyFilter,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<ArtFilterPresetId>(
    activeFilter.id === 'none' ? 'impressionist_oil' : activeFilter.id
  );
  const [targetScope, setTargetScope] = useState<'all' | 'active_layer' | 'atmosphere_only'>('all');
  const [includeAiStrokes, setIncludeAiStrokes] = useState<boolean>(true);
  const [customNuance, setCustomNuance] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const selectedPreset =
    ART_FILTER_PRESETS.find((p) => p.id === selectedPresetId) || ART_FILTER_PRESETS[1];

  const handleApplyWithGemini = async () => {
    setErrorMsg('');

    // If user selected 'none', reset immediately
    if (selectedPreset.id === 'none') {
      sound.playPop(440);
      onApplyFilter({
        filterConfig: selectedPreset.defaultConfig,
        palette: [],
        targetScope: 'atmosphere_only',
        accentStrokes: [],
      });
      onClose();
      return;
    }

    setIsGenerating(true);
    sound.playPop(620);

    try {
      const snapshot = getCanvasSnapshot();
      const res = await fetch('/api/gemini/art-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: snapshot,
          presetId: selectedPreset.id,
          presetName: selectedPreset.name,
          customPrompt: customNuance.trim(),
          canvasWidth: 1200,
          canvasHeight: 800,
        }),
      });

      const data = await res.json();

      if (res.ok && data) {
        const mergedConfig: ArtFilterConfig = {
          ...selectedPreset.defaultConfig,
          backgroundTint: data.backgroundTint || selectedPreset.defaultConfig.backgroundTint,
          contrast:
            typeof data.contrast === 'number'
              ? data.contrast
              : selectedPreset.defaultConfig.contrast,
          saturation:
            typeof data.saturation === 'number'
              ? data.saturation
              : selectedPreset.defaultConfig.saturation,
          sepia:
            typeof data.sepia === 'number' ? data.sepia : selectedPreset.defaultConfig.sepia,
          hueRotate:
            typeof data.hueRotate === 'number'
              ? data.hueRotate
              : selectedPreset.defaultConfig.hueRotate,
          vignetteIntensity:
            typeof data.vignetteIntensity === 'number'
              ? data.vignetteIntensity
              : selectedPreset.defaultConfig.vignetteIntensity,
          curatorNote: data.curatorNote || selectedPreset.subtitle,
        };

        const chosenPalette =
          targetScope === 'atmosphere_only'
            ? []
            : Array.isArray(data.palette) && data.palette.length > 0
            ? data.palette
            : selectedPreset.defaultPalette;

        sound.playVictory();
        onApplyFilter({
          filterConfig: mergedConfig,
          palette: chosenPalette,
          targetScope,
          accentStrokes:
            includeAiStrokes && Array.isArray(data.accentStrokes) ? data.accentStrokes : [],
        });
        onClose();
      } else {
        // Fallback to instant preset if API call fails
        sound.playLayerMerge();
        onApplyFilter({
          filterConfig: {
            ...selectedPreset.defaultConfig,
            curatorNote: selectedPreset.subtitle,
          },
          palette: targetScope === 'atmosphere_only' ? [] : selectedPreset.defaultPalette,
          targetScope,
          accentStrokes: [],
        });
        onClose();
      }
    } catch (err) {
      console.error('Error applying AI art filter:', err);
      // Graceful fallback to preset
      sound.playLayerMerge();
      onApplyFilter({
        filterConfig: {
          ...selectedPreset.defaultConfig,
          curatorNote: selectedPreset.subtitle,
        },
        palette: targetScope === 'atmosphere_only' ? [] : selectedPreset.defaultPalette,
        targetScope,
        accentStrokes: [],
      });
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl my-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Filtros Artísticos de IA</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Estilización de capas y textura en vivo</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px] text-slate-300">Gemini 3.8 Flash</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Preset Grid */}
        <div className="mt-4 space-y-3">
          <label className="text-xs font-semibold text-slate-300">
            1. Selecciona un Estilo Pictórico
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
            {ART_FILTER_PRESETS.map((preset) => {
              const isSelected = preset.id === selectedPresetId;
              return (
                <button
                  key={preset.id}
                  onClick={() => {
                    sound.playPop(520);
                    setSelectedPresetId(preset.id);
                  }}
                  className={`text-left p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'bg-indigo-950/70 border-indigo-500/70 shadow-md'
                      : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/70 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{preset.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{preset.subtitle}</p>
                  {preset.defaultPalette.length > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      {preset.defaultPalette.map((hex, i) => (
                        <span
                          key={i}
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scope & Options */}
        {selectedPresetId !== 'none' && (
          <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>2. Alcance de Armonización de Color en las Capas</span>
            </label>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                onClick={() => setTargetScope('all')}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap truncate ${
                  targetScope === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas las Capas
              </button>
              <button
                onClick={() => setTargetScope('active_layer')}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap truncate ${
                  targetScope === 'active_layer'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Solo armonizar trazos en ${activeLayerName}`}
              >
                Solo {activeLayerName}
              </button>
              <button
                onClick={() => setTargetScope('atmosphere_only')}
                className={`py-2 px-2 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap truncate ${
                  targetScope === 'atmosphere_only'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Solo Textura y Luz
              </button>
            </div>

            {/* Toggle generative AI accent strokes */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
              <span className="text-xs text-slate-300">
                Añadir trazos de acento estilizados generados por Gemini IA
              </span>
              <input
                type="checkbox"
                checked={includeAiStrokes}
                onChange={(e) => setIncludeAiStrokes(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
              />
            </label>

            {/* Optional custom prompt */}
            <input
              type="text"
              value={customNuance}
              onChange={(e) => setCustomNuance(e.target.value)}
              placeholder="Matiz opcional (ej: atardecer dorado, atmósfera misteriosa, luces de neón)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}

        {errorMsg && (
          <p className="mt-3 text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30">
            {errorMsg}
          </p>
        )}

        {/* Footer Actions */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          {activeFilter.id !== 'none' ? (
            <button
              onClick={() => {
                sound.playUndo();
                onApplyFilter({
                  filterConfig: ART_FILTER_PRESETS[0].defaultConfig,
                  palette: [],
                  targetScope: 'atmosphere_only',
                  accentStrokes: [],
                });
                onClose();
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Quitar Filtro</span>
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">
              Reversible con Deshacer (Ctrl+Z)
            </span>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleApplyWithGemini}
              disabled={isGenerating}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aplicando Estilo IA...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Aplicar Filtro a la Sala</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
