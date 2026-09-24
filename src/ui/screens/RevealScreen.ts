import type { IconId, StatBlock } from '../../data/types';
import { el, fromMarkup } from '../../utils/dom';
import { choiceIcon, createCtaButton } from '../components';
import { UI_ICONS } from '../icons';
import type { BindButton, RevealView } from '../types';
import { Screen } from './Screen';

const STATS: ReadonlyArray<{ key: keyof StatBlock; label: string; icon: IconId }> = [
  { key: 'brain', label: 'BRAIN', icon: 'brain' },
  { key: 'speed', label: 'SPEED', icon: 'rocket' },
  { key: 'style', label: 'STYLE', icon: 'palette' },
];

const STAT_FILL_DELAY_MS = 450;

export class RevealScreen extends Screen {
  private readonly chip: HTMLElement;
  private readonly nameplate: HTMLElement;
  private readonly tagline: HTMLElement;
  private readonly description: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly statBars: Record<keyof StatBlock, HTMLElement>;
  private readonly ctaButton: HTMLButtonElement;
  private readonly ctaLabel: HTMLElement;
  private fillTimer = 0;

  constructor(bindButton: BindButton, onCta: () => void, onReplay: () => void) {
    super('reveal');

    this.top.append(
      el('div', 'ribbon pop', {}, [el('div', 'ribbon__face', {}, [el('span', 'ribbon__text outlined', {}, ['YOUR AI IS READY!'])])]),
    );

    this.chip = el('div', 'namecard__chip');
    this.nameplate = el('h2', 'namecard__name outlined');
    this.tagline = el('p', 'namecard__tagline');
    this.description = el('p', 'namecard__desc');

    const bars = {} as Record<keyof StatBlock, HTMLElement>;
    this.stats = el(
      'div',
      'stats',
      {},
      STATS.map((stat, i) => {
        const fill = el('i', '', { style: `--i:${i}` });
        bars[stat.key] = fill;
        return el('div', 'stat', {}, [
          el('div', 'stat__head', {}, [choiceIcon(stat.icon, 'stat__icon'), stat.label]),
          el('div', 'stat__bar', { role: 'meter', 'aria-label': stat.label }, [fill]),
        ]);
      }),
    );
    this.statBars = bars;

    const card = el('div', 'namecard pop', { style: '--d:120' }, [this.chip, this.nameplate, this.tagline, this.description, this.stats]);

    const { button, label } = createCtaButton('PLAY NOW', 'pop pulse');
    button.style.setProperty('--d', '380');
    this.ctaButton = button;
    this.ctaLabel = label;

    const replay = el('button', 'btn btn--ghost pop', { type: 'button', style: '--d:480' });
    replay.append(fromMarkup(UI_ICONS.replay), el('span', 'outlined', { style: '--ow:calc(var(--u)*0.4)' }, ['PLAY AGAIN']));

    this.bottom.append(card, button, replay);
    bindButton(button, onCta, { tapSound: false });
    bindButton(replay, onReplay);
  }

  get hintTarget(): HTMLElement {
    return this.ctaButton;
  }

  render(view: RevealView): void {
    this.chip.textContent = `${view.bodyLabel} · ${view.designation}`;
    this.nameplate.replaceChildren(
      ...[...view.name].map((letter, i) => el('span', '', { style: `--i:${i}` }, [letter])),
    );
    this.nameplate.setAttribute('aria-label', view.name);
    this.tagline.textContent = view.tagline;
    this.description.textContent = view.description;
    this.ctaLabel.textContent = view.ctaLabel;

    for (const { key } of STATS) {
      this.statBars[key].style.setProperty('--v', String(view.stats[key]));
      this.statBars[key].parentElement?.setAttribute('aria-valuenow', String(view.stats[key]));
    }
    window.clearTimeout(this.fillTimer);
    this.stats.classList.remove('is-filled');
    this.fillTimer = window.setTimeout(() => this.stats.classList.add('is-filled'), STAT_FILL_DELAY_MS);
  }
}
