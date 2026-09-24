import { el } from '../../utils/dom';
import type { RevealView } from '../types';
import { Screen } from './Screen';

/** The short "YOUR AI IS READY!" celebration beat between the build and the race. */
export class RevealScreen extends Screen {
  private readonly chip: HTMLElement;
  private readonly nameplate: HTMLElement;
  private readonly tagline: HTMLElement;
  private readonly description: HTMLElement;

  constructor() {
    super('reveal');
    this.top.append(
      el('div', 'ribbon pop', {}, [el('div', 'ribbon__face', {}, [el('span', 'ribbon__text outlined', {}, ['YOUR AI IS READY!'])])]),
    );
    this.chip = el('div', 'namecard__chip');
    this.nameplate = el('h2', 'namecard__name outlined');
    this.tagline = el('p', 'namecard__tagline');
    this.description = el('p', 'namecard__desc');
    this.bottom.append(
      el('div', 'namecard pop', { style: '--d:120' }, [this.chip, this.nameplate, this.tagline, this.description]),
    );
  }

  get hintTarget(): null {
    return null;
  }

  render(view: RevealView): void {
    this.chip.textContent = `${view.bodyLabel} · ${view.designation}`;
    this.nameplate.replaceChildren(...[...view.name].map((letter, i) => el('span', '', { style: `--i:${i}` }, [letter])));
    this.nameplate.setAttribute('aria-label', view.name);
    this.tagline.textContent = view.tagline;
    this.description.textContent = view.description;
  }
}
