import { el, fromMarkup } from '../utils/dom';
import { HAND_HOTSPOT, UI_ICONS } from './icons';

/** The classic playable-ad tutorial hand, aimed at whatever the player should tap next. */
export class HandHint {
  readonly root: HTMLElement;
  private target: HTMLElement | null = null;

  constructor() {
    this.root = el('div', 'hand', { 'aria-hidden': 'true' }, [el('span', 'hand__ripple')]);
    this.root.append(fromMarkup(UI_ICONS.hand));
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
