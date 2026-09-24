import type { SelectionKey } from '../../data/steps';
import type { OptionDef } from '../../data/types';
import { el, fromMarkup, replayClass } from '../../utils/dom';
import { ProgressTracker, cardStyleVars, choiceIcon } from '../components';
import { UI_ICONS } from '../icons';
import type { BindButton, ChoiceScreenView, ProgressSlotView } from '../types';
import { Screen } from './Screen';

const SWAP_DELAY_MS = 200;
/** Cards ignore input while popping in, so a stray double-tap can't pick an option by accident. */
const ENTRY_LOCK_MS = 550;
const LONG_LABEL = 7;

/** One reusable screen for every choice step; content is rebuilt from data per step. */
export class ChoiceScreen extends Screen {
  private readonly tracker = new ProgressTracker();
  private readonly title: HTMLElement;
  private readonly cards: HTMLElement;
  private cardElements: HTMLButtonElement[] = [];
  private unbinders: Array<() => void> = [];
  private swapTimer = 0;
  private unlockTimer = 0;

  constructor(
    private readonly bindButton: BindButton,
    private readonly onSelect: (stepId: SelectionKey, optionId: string, index: number) => void,
  ) {
    super('choice');
    this.tracker.root.classList.add('pop');
    this.title = el('h2', 'question outlined pop', { style: '--d:90' });
    this.top.append(this.tracker.root, this.title);
    this.cards = el('div', 'cards', { role: 'group' });
    this.bottom.append(this.cards);
  }

  get hintTarget(): HTMLElement | null {
    return this.cardElements[Math.floor(this.cardElements.length / 2)] ?? null;
  }

  /** Renders a step. When already visible, cards animate out and the new set pops in. */
  render(view: ChoiceScreenView): void {
    window.clearTimeout(this.swapTimer);
    window.clearTimeout(this.unlockTimer);
    this.tracker.update(view.progress);

    if (!this.isActive) {
      this.fill(view);
      return;
    }
    this.cards.classList.remove('is-in');
    this.cards.classList.add('is-out', 'is-locked');
    this.swapTimer = window.setTimeout(() => {
      this.fill(view);
      replayClass(this.title, 'is-swapping');
    }, SWAP_DELAY_MS);
  }

  markSelected(optionId: string, progress: readonly ProgressSlotView[]): void {
    window.clearTimeout(this.unlockTimer);
    this.tracker.update(progress);
    this.cards.classList.add('is-locked');
    for (const card of this.cardElements) {
      const selected = card.dataset.option === optionId;
      card.classList.toggle('is-selected', selected);
      card.classList.toggle('is-dimmed', !selected);
      card.setAttribute('aria-pressed', String(selected));
    }
  }

  private fill(view: ChoiceScreenView): void {
    this.title.textContent = view.title;
    for (const unbind of this.unbinders) unbind();
    this.unbinders = [];
    this.cardElements = view.options.map((option, index) => this.createCard(view.stepId, option, index));
    this.cards.replaceChildren(...this.cardElements);
    this.cards.classList.remove('is-out');
    this.cards.classList.add('is-locked');
    replayClass(this.cards, 'is-in');
    this.unlockTimer = window.setTimeout(() => this.cards.classList.remove('is-locked'), ENTRY_LOCK_MS);
  }

  private createCard(stepId: SelectionKey, option: OptionDef, index: number): HTMLButtonElement {
    const check = el('span', 'card__check');
    check.append(fromMarkup(UI_ICONS.check));
    const card = el(
      'button',
      `card${option.label.length > LONG_LABEL ? ' is-long' : ''}`,
      { type: 'button', 'data-option': option.id, 'aria-pressed': 'false', style: `${cardStyleVars(option.card)};--i:${index}` },
      [el('span', 'card__shine'), choiceIcon(option.icon, 'card__icon'), el('span', 'card__label outlined', {}, [option.label]), check],
    );
    this.unbinders.push(this.bindButton(card, () => this.onSelect(stepId, option.id, index), { tapSound: false }));
    return card;
  }
}
