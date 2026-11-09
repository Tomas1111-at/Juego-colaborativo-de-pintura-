import React, { useState } from 'react';
import { Smartphone, Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { ApkInstallModal } from './ApkInstallModal';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact', className = '' }) => {
  const { isInstallable, isInstalled } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already installed, we still let users open info if they want, but show a subtle state
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Instalar App / APK en dispositivo móvil"
        className={`flex items-center gap-1.5 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer ${
          variant === 'full'
            ? 'px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30'
            : isInstalled
            ? 'px-2.5 py-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
            : 'px-2.5 py-1.5 bg-slate-800/90 border border-slate-700 text-slate-200 hover:bg-indigo-950 hover:text-indigo-200 hover:border-indigo-500/50'
        } ${className}`}
      >
        {isInstallable ? (
          <Download className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
        ) : (
          <Smartphone className="w-3.5 h-3.5 text-slate-300" />
        )}
        <span>{isInstalled ? 'App Instalada' : variant === 'full' ? 'Instalar App (APK)' : 'Instalar APK'}</span>
      </button>

      <ApkInstallModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
