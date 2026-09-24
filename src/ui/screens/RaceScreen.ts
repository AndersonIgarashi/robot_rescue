import type { IconId, StatBlock } from '../../data/types';
import { el, fromMarkup, replayClass } from '../../utils/dom';
import { choiceIcon, createCtaButton } from '../components';
import { UI_ICONS } from '../icons';
import type { BindButton, RaceView } from '../types';
import { Screen } from './Screen';

const STATS: ReadonlyArray<{ key: keyof StatBlock; label: string; icon: IconId }> = [
  { key: 'speed', label: 'SPEED', icon: 'rocket' },
  { key: 'armor', label: 'ARMOR', icon: 'shield' },
  { key: 'power', label: 'POWER', icon: 'blaster' },
];

const STAT_FILL_DELAY_MS = 350;
const CLIFFHANGER_TEXT = 'KEEP RACING IN THE APP!';

/**
 * The end card: the racer on the start line, the race rule for its power
 * ("DODGE THE FIRE!"), its build as chips + stats, and the RUN! CTA.
 * After the teaser run it switches to the cliffhanger state.
 */
export class RaceScreen extends Screen {
  private readonly banner: HTMLElement;
  private readonly bannerIcon: HTMLElement;
  private readonly bannerText: HTMLElement;
  private readonly subline: HTMLElement;
  private readonly racerName: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly statBars: Record<keyof StatBlock, HTMLElement>;
  private readonly ctaButton: HTMLButtonElement;
  private readonly ctaLabel: HTMLElement;
  private fillTimer = 0;

  constructor(bindButton: BindButton, onCta: () => void, onReplay: () => void) {
    super('race');

    this.bannerIcon = el('span', 'race-banner__icon');
    this.bannerText = el('span', 'race-banner__text outlined');
    this.banner = el('div', 'race-banner pop', { role: 'status' }, [this.bannerIcon, this.bannerText]);
    this.subline = el('p', 'race-sub outlined pop', { style: '--d:120' });
    this.top.append(this.banner, this.subline);

    this.racerName = el('h2', 'racer-card__name outlined');
    this.chips = el('div', 'racer-card__chips');
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
    const card = el('div', 'racer-card pop', { style: '--d:160' }, [
      el('div', 'racer-card__head', {}, [this.racerName, this.chips]),
      this.stats,
    ]);

    const { button, label } = createCtaButton('RUN!', 'btn--run pop pulse');
    button.style.setProperty('--d', '320');
    button.insertBefore(fromMarkup(UI_ICONS.play), label);
    this.ctaButton = button;
    this.ctaLabel = label;

    const replay = el('button', 'btn btn--ghost pop', { type: 'button', style: '--d:420' });
    replay.append(fromMarkup(UI_ICONS.replay), el('span', 'outlined', { style: '--ow:calc(var(--u)*0.4)' }, ['PLAY AGAIN']));

    this.bottom.append(card, button, replay);
    bindButton(button, onCta, { tapSound: false });
    bindButton(replay, onReplay);
  }

  get hintTarget(): HTMLElement {
    return this.ctaButton;
  }

  render(view: RaceView): void {
    this.root.classList.remove('is-cliffhanger');
    this.bannerIcon.replaceChildren(choiceIcon(view.hazardIcon));
    this.bannerText.textContent = `DODGE THE ${view.hazardLabel}!`;
    this.subline.replaceChildren(choiceIcon(view.pickupIcon, 'race-sub__icon'), `GRAB THE ${view.pickupLabel}`);
    this.racerName.textContent = view.name;
    this.chips.replaceChildren(
      ...view.chips.map((chip) => el('span', 'chip', {}, [choiceIcon(chip.icon, 'chip__icon'), chip.label])),
    );
    this.ctaLabel.textContent = view.ctaLabel;

    for (const { key } of STATS) {
      this.statBars[key].style.setProperty('--v', String(view.stats[key]));
      this.statBars[key].parentElement?.setAttribute('aria-valuenow', String(view.stats[key]));
    }
    window.clearTimeout(this.fillTimer);
    this.stats.classList.remove('is-filled');
    this.fillTimer = window.setTimeout(() => this.stats.classList.add('is-filled'), STAT_FILL_DELAY_MS);
  }

  /** Bullet-time freeze in front of the next hazard: the CTA becomes the only way forward. */
  showCliffhanger(ctaLabel: string): void {
    this.root.classList.add('is-cliffhanger');
    this.bannerText.textContent = CLIFFHANGER_TEXT;
    this.ctaLabel.textContent = ctaLabel;
    replayClass(this.banner, 'is-swapping');
  }
}
