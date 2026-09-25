import handUrl from '../assets/images/hand-tutorial.webp';
import { el } from '../utils/dom';

/** Fingertip position inside the hand image (fractions of its box). */
const HAND_HOTSPOT = { x: 16 / 128, y: 5 / 128 } as const;

/** The classic playable-ad tutorial hand, aimed at whatever the player should tap next. */
export class HandHint {
  readonly root: HTMLElement;
  private target: HTMLElement | null = null;

  constructor() {
    const image = el('img', 'hand__img', { src: handUrl, alt: '', draggable: 'false', decoding: 'async' });
    this.root = el('div', 'hand', { 'aria-hidden': 'true' }, [el('span', 'hand__ripple'), image]);
  }

  get visible(): boolean {
    return this.target !== null;
  }

  show(target: HTMLElement): void {
    this.target = target;
    this.reposition();
    this.root.classList.add('is-visible');
  }

  hide(): void {
    this.target = null;
    this.root.classList.remove('is-visible');
  }

  /** Re-aims at the current target (after resize). */
  reposition(): void {
    if (!this.target) return;
    const rect = this.target.getBoundingClientRect();
    const size = this.root.offsetWidth;
    const x = rect.left + rect.width * 0.55 - size * HAND_HOTSPOT.x;
    const y = rect.top + rect.height * 0.55 - size * HAND_HOTSPOT.y;
    this.root.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
}
