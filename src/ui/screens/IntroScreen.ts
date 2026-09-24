import { el } from '../../utils/dom';
import { createCtaButton, sparkle } from '../components';
import type { BindButton } from '../types';
import { Screen } from './Screen';

export class IntroScreen extends Screen {
  private readonly startButton: HTMLButtonElement;

  constructor(bindButton: BindButton, onStart: () => void) {
    super('intro');

    const logo = el('h1', 'logo pop', { style: '--d:0' }, [
      el('span', 'logo__build outlined', {}, ['BUILD']),
      el('span', 'logo__main outlined', {}, ['YOUR ', el('span', 'logo__ai', {}, ['AI'])]),
      sparkle(0, 'a'),
      sparkle(600, 'b'),
      sparkle(1100, 'c'),
    ]);
    const subtitle = el('p', 'subtitle outlined pop', { style: '--d:140' }, ['Create your perfect AI']);
    this.top.append(logo, subtitle);

    const { button } = createCtaButton('START', 'pop pulse');
    button.style.setProperty('--d', '260');
    this.startButton = button;
    this.bottom.append(button);
    bindButton(button, onStart);
  }

  get hintTarget(): HTMLElement {
    return this.startButton;
  }
}
