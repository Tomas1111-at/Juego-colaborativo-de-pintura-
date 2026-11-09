import React, { useState, useRef } from 'react';
import { Mic, MicOff, Sparkles, Send, X, Loader2, Volume2 } from 'lucide-react';
import { sound } from '../utils/audio';

interface VoicePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPrompt: (text: string, action: 'theme' | 'ai_layer' | 'chat') => void;
}

function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

export const VoicePromptModal: React.FC<VoicePromptModalProps> = ({
  isOpen,
  onClose,
  onApplyPrompt,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [modelUsed, setModelUsed] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  if (!isOpen) return null;

  const startRecording = async () => {
    setErrorMsg('');
    sound.playPop(580);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const preferredMime = getSupportedAudioMimeType();
      const mediaRecorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const actualMime = (mediaRecorder.mimeType || preferredMime || 'audio/webm').split(';')[0];
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        await handleTranscribe(audioBlob, actualMime);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error opening microphone:', err);
      setErrorMsg('No se pudo acceder al micrófono. Verifica los permisos o edita tu comando abajo.');
    }
  };

  const stopRecording = () => {
    sound.playPop(340);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleTranscribe = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setErrorMsg('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64Audio = reader.result as string;

          const res = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType,
            }),
          });

          const data = await res.json();
          if (res.ok && data.transcription) {
            setTranscription(data.transcription);
            setModelUsed(data.modelUsed || 'gemini-3.8-flash');
            sound.playVictory();
          } else {
            setErrorMsg(data.error || 'No se detectó voz clara. Puedes intentar de nuevo o editar el texto.');
          }
        } catch (fetchErr) {
          console.error('Transcription request error:', fetchErr);
          setErrorMsg('Error de red al procesar el audio. Puedes escribir o editar tu idea directamente.');
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err) {
      console.error('Transcription error:', err);
      setErrorMsg('Error al leer el archivo de audio.');
      setIsTranscribing(false);
    }
  };

  const handleAction = (action: 'theme' | 'ai_layer' | 'chat') => {
    if (!transcription.trim()) return;
    sound.playLayerAction();
    onApplyPrompt(transcription.trim(), action);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-md">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dictado por Voz</h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Habla para crear temas o capas</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px] text-slate-300">
                  {modelUsed || 'v1beta + Gemini 3.8 Flash'}
                </span>
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

        {/* Center record trigger */}
        <div className="my-5 flex flex-col items-center justify-center">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-transform cursor-pointer shadow-xl ${
              isRecording
                ? 'bg-rose-600 text-white scale-105 ring-8 ring-rose-500/20'
                : 'bg-indigo-600 text-white hover:scale-105'
            } disabled:opacity-50`}
          >
            {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>

          <p className="mt-3 text-xs font-medium text-slate-300 font-mono tabular-nums">
            {isRecording
              ? `Grabando audio (${recordingDuration}s) · Pulsa para finalizar`
              : isTranscribing
              ? 'Transcribiendo voz con respaldo automático Gemini...'
              : 'Toca el micrófono para dictar tu idea'}
          </p>
        </div>

        {/* Transcribing loader */}
        {isTranscribing && (
          <div className="mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center gap-2 text-indigo-300 text-xs font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Transcribiendo audio...</span>
          </div>
        )}

        {errorMsg && (
          <p className="mb-4 text-xs text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-500/30">
            {errorMsg}
          </p>
        )}

        {/* Editable Transcription Review Box */}
        <div className="mb-4 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 focus-within:border-indigo-500/60 space-y-2 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-indigo-300">
              <Volume2 className="w-3.5 h-3.5" /> Revisar y editar texto antes de aplicar
            </span>
            {modelUsed && (
              <span className="font-mono text-[11px] text-slate-500">{modelUsed}</span>
            )}
          </div>
          <textarea
            value={transcription}
            onChange={(e) => setTranscription(e.target.value)}
            placeholder="El texto transcrito aparecerá aquí para que puedas revisarlo o editarlo antes de enviarlo al juego..."
            className="w-full text-sm text-slate-100 bg-transparent border-none resize-none focus:outline-none placeholder:text-slate-600"
            rows={3}
          />
        </div>

        {/* Action buttons with transcribed/edited text */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-400">Aplicar texto al lienzo colaborativo:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => handleAction('theme')}
              disabled={!transcription.trim() || isTranscribing}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 hover:bg-indigo-600/50 text-indigo-100 font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Establecer Tema</span>
            </button>
            <button
              onClick={() => handleAction('ai_layer')}
              disabled={!transcription.trim() || isTranscribing}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-violet-600/30 border border-violet-500/40 hover:bg-violet-600/50 text-violet-100 font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-violet-300 shrink-0" />
              <span>Pintar Capa IA</span>
            </button>
          </div>
          <button
            onClick={() => handleAction('chat')}
            disabled={!transcription.trim() || isTranscribing}
            className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Send className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Enviar al Chat de la Sala</span>
          </button>
        </div>
      </div>
    </div>
  );
};
