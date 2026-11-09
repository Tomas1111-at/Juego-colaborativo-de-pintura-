import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  ShieldCheck,
  Zap,
  Share2,
  X,
  FileDown,
  Code2,
  Check,
  Loader2,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { sound } from '../utils/audio';

interface ApkInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkInstallModal: React.FC<ApkInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [isDownloadingStandalone, setIsDownloadingStandalone] = useState(false);
  const [downloadedLauncher, setDownloadedLauncher] = useState(false);
  const [downloadedTwa, setDownloadedTwa] = useState(false);
  const [activeTab, setActiveTab] = useState<'standalone' | 'build_apk'>('standalone');

  if (!isOpen) return null;

  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin.includes('ais-dev-')
        ? window.location.origin.replace('ais-dev-', 'ais-pre-')
        : window.location.origin
      : 'https://ais-pre-4hboe76pcyee55ode5j7dv-505837787880.us-east5.run.app';

  const handleInstallClick = async () => {
    sound.playVictory();
    if (isInstallable) {
      await install();
    } else {
      await handleDownloadStandaloneApp();
    }
  };

  /**
   * Downloads the 100% self-contained single-file compiled application from /api/apk/standalone.
   * Unlike an iframe wrapper, this file embeds the entire compiled React + Tailwind + Canvas engine
   * inside a single file so it opens and works in ANY browser or mobile phone without needing
   * AI Studio authentication cookies or an active server connection.
   */
  const handleDownloadStandaloneApp = async () => {
    if (isDownloadingStandalone) return;
    setIsDownloadingStandalone(true);
    sound.playVictory();

    try {
      const response = await fetch('/api/apk/standalone');
      if (!response.ok) {
        throw new Error('Error downloading standalone bundle');
      }
      const htmlContent = await response.text();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Pincelada-Colab-App-Completa.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadedLauncher(true);
      setTimeout(() => setDownloadedLauncher(false), 4000);
    } catch (err) {
      console.warn('Standalone download fallback:', err);
    } finally {
      setIsDownloadingStandalone(false);
    }
  };

  /**
   * Downloads the complete Android TWA (Trusted Web Activity / Bubblewrap) APK manifest config
   * so developers or users can compile a native signed .apk binary with 1 command.
   */
  const handleDownloadTwaConfig = () => {
    sound.playPop(600);
    const hostDomain = appUrl.replace(/^https?:\/\//, '');
    const twaManifest = {
      packageId: 'com.pinceladacolab.game',
      host: hostDomain,
      name: 'Pincelada Colab',
      launcherName: 'Pincelada',
      display: 'fullscreen',
      themeColor: '#0F172A',
      navigationColor: '#0F172A',
      navigationColorDark: '#0F172A',
      navigationDividerColor: '#0F172A',
      navigationDividerColorDark: '#0F172A',
      backgroundColor: '#FFFFFF',
      enableNotifications: true,
      startUrl: '/',
      iconUrl: `${appUrl}/pwa-512x512.png`,
      maskableIconUrl: `${appUrl}/pwa-maskable-512x512.png`,
      appVersionName: '1.3.0',
      appVersionCode: 13,
      shortcuts: [],
      generatorApp: 'bubblewrap-cli',
      webManifestUrl: `${appUrl}/manifest.webmanifest`,
      fallbackType: 'customtabs',
      orientation: 'default',
      _buildInstructions: [
        '1. Instala Bubblewrap CLI: npm i -g @bubblewrap/cli',
        '2. En la carpeta con este archivo (twa-manifest.json), ejecuta: bubblewrap build',
        '3. Obtendrás el archivo app-release-signed.apk listo para instalar en Android.',
      ],
    };

    const blob = new Blob([JSON.stringify(twaManifest, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'twa-manifest.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadedTwa(true);
    setTimeout(() => setDownloadedTwa(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6 text-slate-100 shadow-2xl overflow-hidden my-auto">
        {/* Glow ambient background */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-indigo-500/30">
              <Smartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                App Móvil Autónoma & APK
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  100% Independiente · 60 FPS
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Abre en cualquier navegador, teléfono Android o sin conexión a internet
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 gap-1.5 mt-4 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            onClick={() => {
              sound.playPop(480);
              setActiveTab('standalone');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'standalone'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar Juego Autónomo (Móvil / PC)</span>
          </button>

          <button
            onClick={() => {
              sound.playPop(540);
              setActiveTab('build_apk');
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
              activeTab === 'build_apk'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Proyecto Android .APK (TWA)</span>
          </button>
        </div>

        {activeTab === 'standalone' && (
          <div className="mt-4 space-y-4 text-sm">
            {/* Primary Self-Contained Game Bundle Card */}
            <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-200 font-bold text-sm">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Juego Completo en 1 Solo Archivo (Sin Bloqueo de Sesión)</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Offline Ready
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Los enlaces de vista previa de Google AI Studio requieren tener tu sesión iniciada en ese mismo navegador. Para abrir el juego en <strong>cualquier otro navegador o enviarlo a tu teléfono Android</strong> sin restricciones, descarga el archivo autónomo completo: incluye todo el motor gráfico, capas, deshacer/rehacer, filtros artísticos y galería integrados dentro del propio archivo.
              </p>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleDownloadStandaloneApp}
                  disabled={isDownloadingStandalone}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition cursor-pointer disabled:opacity-60"
                >
                  {isDownloadingStandalone ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Empaquetando Juego Completo...</span>
                    </>
                  ) : downloadedLauncher ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>¡Descargado! Abre Pincelada-Colab-App-Completa.html</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      <span>Descargar Juego Autónomo (Pincelada-Colab-App-Completa.html)</span>
                    </>
                  )}
                </button>

                {isInstallable && !isInstalled && (
                  <button
                    onClick={handleInstallClick}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white shadow transition cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Instalar Directamente como WebAPK en este Navegador</span>
                  </button>
                )}
              </div>
            </div>

            {/* Instructions to use on Android or another browser */}
            <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2">
              <p className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" /> Cómo usarlo en otro navegador o en tu móvil Android:
              </p>
              <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside">
                <li>
                  Pulsa el botón azul de arriba para descargar <strong>Pincelada-Colab-App-Completa.html</strong> (~300 KB con todo el juego incluido).
                </li>
                <li>
                  Ábrelo con doble clic en <strong>cualquier navegador</strong> (Chrome, Edge, Firefox, Brave, Safari) o envíalo por <strong>WhatsApp / Telegram / Drive</strong> a tu móvil y ábrelo con Chrome.
                </li>
                <li>
                  ¡Listo! Funciona al 100% con lienzo blanco, selector de colores, multicapa, deshacer/rehacer, filtros de arte y galería local sin pedir inicio de sesión.
                </li>
              </ol>
            </div>

            {isIOS && (
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
                <p className="font-semibold text-indigo-300 text-xs flex items-center gap-1.5">
                  <Share2 className="w-4 h-4" /> En iPhone / iPad:
                </p>
                <p className="text-xs text-slate-300">
                  Guarda el archivo en la app <strong>Archivos</strong> o ábrelo en Safari y selecciona <strong>&ldquo;Añadir a pantalla de inicio&rdquo;</strong>.
                </p>
              </div>
            )}

            {/* Features check list */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Sin login ni servidores externos</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Capas, Filtros y Galería incluidos</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'build_apk' && (
          <div className="mt-4 space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-300 text-xs flex items-center gap-1.5">
                  <Code2 className="w-4 h-4" /> Empaquetar como binario .APK (Bubblewrap / Capacitor)
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  com.pinceladacolab.game
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Nota: Para que una URL pública funcione sin login en un contenedor TWA, primero debes publicar la app con el botón <strong>Deploy / Share</strong> de la barra superior de AI Studio (Cloud Run público) o empaquetar el archivo autónomo descargado en la pestaña anterior con Capacitor/Cordova.
              </p>
              <button
                onClick={handleDownloadTwaConfig}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 transition cursor-pointer shadow"
              >
                {downloadedTwa ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡twa-manifest.json Descargado!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Descargar twa-manifest.json (Android TWA)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
