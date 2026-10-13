export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (!('serviceWorker' in navigator)) return;

  const isSecureContext = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  if (!isSecureContext) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[LAINES] Service worker nao registrado:', error);
    });
  });
}
