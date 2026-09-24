import './ui/styles/index.css';
import { AdBridge } from './ads/AdBridge';
import { GameApp } from './core/GameApp';
import { loadAdConfig } from './data/adConfig';
import { showFallback, type FallbackReason } from './ui/fallback';
import { detectWebGL2 } from './utils/webgl';

function hideBoot(): void {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('is-done');
  window.setTimeout(() => boot.remove(), 400);
}

function fallback(root: HTMLElement, reason: FallbackReason): void {
  const config = loadAdConfig();
  const bridge = new AdBridge();
  showFallback(root, reason, () => {
    console.info('[analytics] CTA_CLICKED', { placement: 'fallback', reason });
    bridge.openStore(config.storeUrl);
  });
  hideBoot();
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[BuildYourAI] Unhandled rejection', event.reason);
});

function boot(): void {
  const root = document.getElementById('app');
  if (!root) return;
  // `?nowebgl` previews the graceful-degradation screen on any device.
  const forceFallback = new URLSearchParams(window.location.search).has('nowebgl');
  if (forceFallback || !detectWebGL2()) {
    fallback(root, 'webgl');
    return;
  }
  try {
    const app = new GameApp(root);
    if (import.meta.env.DEV) Object.assign(window, { __buildYourAI: app });
    app
      .start()
      .then(hideBoot)
      .catch((error: unknown) => {
        console.error('[BuildYourAI] Failed to start', error);
        fallback(root, 'error');
      });
  } catch (error) {
    console.error('[BuildYourAI] Failed to boot', error);
    fallback(root, 'error');
  }
}

boot();
