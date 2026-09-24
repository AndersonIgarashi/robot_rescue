import type { Tween, Tweener } from '../../core/Tweener';
import { Easing } from '../../utils/easing';
import { el, replayClass } from '../../utils/dom';
import { Screen } from './Screen';

export class BuildScreen extends Screen {
  private readonly meter: HTMLElement;
  private readonly value: HTMLElement;
  private readonly status: HTMLElement;
  private shown = 0;
  private counter: Tween | null = null;

  constructor(private readonly tweener: Tweener) {
    super('build');
    const dots = el('span', 'dots', { 'aria-hidden': 'true' }, [el('i', '', {}, ['.']), el('i', '', {}, ['.']), el('i', '', {}, ['.'])]);
    this.top.append(el('h2', 'question outlined pop', {}, ['BUILDING YOUR AI', dots]));

    this.value = el('span', 'meter__value outlined', {}, ['0%']);
    this.meter = el('div', 'meter', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, [
      el('div', 'meter__fill'),
      this.value,
    ]);
    this.status = el('p', 'build-status outlined', { 'aria-live': 'polite' }, [' ']);
    this.bottom.append(el('div', 'build-panel pop', { style: '--d:120' }, [this.meter, this.status]));
  }

  get hintTarget(): null {
    return null;
  }

  reset(): void {
    this.counter?.kill();
    this.shown = 0;
    this.meter.style.setProperty('--p', '0%');
    this.value.textContent = '0%';
    this.status.textContent = ' ';
  }

  setProgress(percent: number, status: string): void {
    this.meter.style.setProperty('--p', `${percent}%`);
    this.meter.setAttribute('aria-valuenow', String(percent));
    if (this.status.textContent !== status) {
      this.status.textContent = status;
      replayClass(this.status, 'is-swapping');
    }

    this.counter?.kill();
    const from = this.shown;
    let last = -1;
    this.counter = this.tweener.tween({
      duration: 0.35,
      ease: Easing.outCubic,
      onUpdate: (k) => {
        const current = Math.round(from + (percent - from) * k);
        this.shown = current;
        if (current !== last) {
          last = current;
          this.value.textContent = `${current}%`;
        }
      },
    });
  }
}
