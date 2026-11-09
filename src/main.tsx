import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clear any stale Workbox / PWA caches so the browser always loads the latest build parameters
if ('caches' in window) {
  caches
    .keys()
    .then((keys) => {
      for (const key of keys) {
        if (key !== 'pincelada-colab-v4') {
          caches.delete(key).catch(() => {});
        }
      }
    })
    .catch(() => {});
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          if (reg.active && !reg.active.scriptURL.endsWith('/sw-pincelada.js')) {
            reg.unregister().catch(() => {});
          }
        }
      })
      .catch(() => {});

    navigator.serviceWorker.register('/sw-pincelada.js').catch(() => {
      // Optional in restricted iframe contexts
    });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
