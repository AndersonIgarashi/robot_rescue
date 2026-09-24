import { el, replayClass } from '../../utils/dom';

const LEAVE_DURATION_MS = 260;

/** A full-screen layer: top block, stage slot (where the 3D hero is framed), bottom block. */
export abstract class Screen {
  readonly root: HTMLElement;
  readonly top: HTMLElement;
  readonly stage: HTMLElement;
  readonly bottom: HTMLElement;
  private leaveTimer = 0;

  constructor(readonly name: string) {
    this.top = el('div', 'screen__top');
    this.stage = el('div', 'stage-slot');
    this.bottom = el('div', 'screen__bottom');
    this.root = el('section', `screen screen--${name}`, { 'aria-hidden': 'true' }, [this.top, this.stage, this.bottom]);
  }

  get isActive(): boolean {
    return this.root.classList.contains('is-active');
  }

  /** Element the tutorial hand points at when the player idles. */
  abstract get hintTarget(): HTMLElement | null;

  show(): void {
    window.clearTimeout(this.leaveTimer);
    this.root.classList.remove('is-leaving');
    replayClass(this.root, 'is-active');
    this.root.setAttribute('aria-hidden', 'false');
  }

  hide(): void {
    if (!this.isActive) return;
    this.root.classList.remove('is-active');
    this.root.classList.add('is-leaving');
    this.root.setAttribute('aria-hidden', 'true');
    this.leaveTimer = window.setTimeout(() => this.root.classList.remove('is-leaving'), LEAVE_DURATION_MS);
  }
}
