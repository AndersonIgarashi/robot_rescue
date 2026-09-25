import type { CardStyle, IconId } from '../data/types';
import { el, fromMarkup } from '../utils/dom';
import { CHOICE_ICONS } from './icons';
import type { ProgressSlotView } from './types';

export const icon = (markup: string, className = ''): HTMLElement => {
  const wrapper = el('span', className);
  wrapper.append(fromMarkup(markup));
  return wrapper;
};

export const choiceIcon = (id: IconId, className = ''): HTMLElement => icon(CHOICE_ICONS[id], className);

/** Big glossy green call-to-action with shine sweep. */
export function createCtaButton(label: string, extraClass = ''): { button: HTMLButtonElement; label: HTMLElement } {
  const text = el('span', 'btn__label outlined', {}, [label]);
  const button = el('button', `btn btn--cta ${extraClass}`.trim(), { type: 'button' }, [el('span', 'btn__shine'), text]);
  return { button, label: text };
}

export const cardStyleVars = (card: CardStyle): string =>
  `--card-top:${card.top};--card-bottom:${card.bottom};--card-edge:${card.edge}`;

/** Three-slot progress pill: shows which choices are made, with their colours and icons. */
export class ProgressTracker {
  readonly root = el('div', 'tracker', { role: 'progressbar', 'aria-label': 'Build progress' });
  private slots: HTMLElement[] = [];
  private bars: HTMLElement[] = [];
  private doneState: boolean[] = [];

  update(progress: readonly ProgressSlotView[]): void {
    if (progress.length !== this.slots.length) this.rebuild(progress.length);
    const doneCount = progress.filter((slot) => slot.done).length;
    this.root.setAttribute('aria-valuenow', String(doneCount));
    this.root.setAttribute('aria-valuemax', String(progress.length));

    progress.forEach((view, i) => {
      const slot = this.slots[i];
      const wasDone = this.doneState[i];
      slot.classList.toggle('is-done', view.done);
      slot.classList.toggle('is-current', view.current);
      slot.classList.toggle('is-new', view.done && !wasDone);
      if (view.done && view.card) {
        slot.style.setProperty('--slot-top', view.card.top);
        slot.style.setProperty('--slot-bottom', view.card.bottom);
        slot.style.setProperty('--ic-ink', view.card.edge);
      } else {
        slot.style.removeProperty('--slot-top');
        slot.style.removeProperty('--slot-bottom');
        slot.style.removeProperty('--ic-ink');
      }
      slot.replaceChildren(fromMarkup(CHOICE_ICONS[view.icon]));
      this.doneState[i] = view.done;
      if (i > 0) this.bars[i - 1].classList.toggle('is-done', view.done || view.current);
    });
  }

  private rebuild(count: number): void {
    this.root.replaceChildren();
    this.slots = [];
    this.bars = [];
    this.doneState = [];
    for (let i = 0; i < count; i++) {
      if (i > 0) {
        const bar = el('span', 'tracker__bar', {}, [el('i')]);
        this.bars.push(bar);
        this.root.append(bar);
      }
      const slot = el('span', 'tracker__slot');
      this.slots.push(slot);
      this.doneState.push(false);
      this.root.append(slot);
    }
  }
}
