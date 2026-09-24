import { el } from '../utils/dom';
import { createCtaButton } from './components';

export type FallbackReason = 'webgl' | 'error';

const MESSAGES: Record<FallbackReason, string> = {
  webgl: "Your device can't show 3D right now — but you can still play the full game!",
  error: 'Something went wrong while building your AI. Try the full game instead!',
};

/**
 * Graceful degradation: without WebGL (or after a fatal error) the ad still
 * shows its message and a working CTA instead of a blank frame.
 */
export function showFallback(root: HTMLElement, reason: FallbackReason, onCta: () => void): void {
  const { button } = createCtaButton('PLAY NOW', 'pulse');
  button.addEventListener('click', onCta);
  const title = el('h1', 'logo', {}, [
    el('span', 'logo__build outlined', {}, ['BUILD']),
    el('span', 'logo__main outlined', {}, ['YOUR ', el('span', 'logo__ai', {}, ['AI'])]),
  ]);
  root.replaceChildren(el('div', 'fallback', { role: 'alert' }, [title, el('p', '', {}, [MESSAGES[reason]]), button]));
}
