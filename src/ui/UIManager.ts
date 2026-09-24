import type { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';
import type { Tweener } from '../core/Tweener';
import type { ThemeColors } from '../data/types';
import type { InputManager } from '../input/InputManager';
import type { ScreenRect } from '../scene/CameraController';
import { el, fromMarkup, replayClass, toCssHex } from '../utils/dom';
import { HandHint } from './HandHint';
import { UI_ICONS } from './icons';
import { BuildScreen } from './screens/BuildScreen';
import { ChoiceScreen } from './screens/ChoiceScreen';
import { IntroScreen } from './screens/IntroScreen';
import { RevealScreen } from './screens/RevealScreen';
import type { Screen } from './screens/Screen';
import type { BindButton, ChoiceScreenView, ProgressSlotView, RevealView, UIEvents } from './types';

export type SceneName = 'intro' | 'choice' | 'build' | 'reveal';

/**
 * DOM game UI. Renders view models, reports intent through `events`, and
 * publishes the current stage-slot rectangle so the camera can frame the
 * hero around the layout. Knows nothing about Three.js or game rules.
 */
export class UIManager {
  readonly events = new EventBus<UIEvents>();
  readonly root: HTMLElement;
  /** Called whenever the stage slot may have moved (screen switch, resize). */
  onLayoutChange: (() => void) | null = null;

  private readonly background: HTMLElement;
  private readonly intro: IntroScreen;
  private readonly choice: ChoiceScreen;
  private readonly build: BuildScreen;
  private readonly reveal: RevealScreen;
  private readonly hand = new HandHint();
  private readonly toast: HTMLElement;
  private readonly toastText: HTMLElement;
  private readonly flashLayer: HTMLElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  private active: Screen | null = null;
  private stageRect: ScreenRect = { x: 0, y: 0, width: 1, height: 1 };
  private toastTimer = 0;
  private focusX = -1;
  private focusY = -1;

  constructor(
    private readonly app: HTMLElement,
    private readonly input: InputManager,
    private readonly audio: AudioManager,
    tweener: Tweener,
  ) {
    this.background = el('div', 'bg', { 'aria-hidden': 'true' }, [el('div', 'bg__rays'), el('div', 'bg__pattern')]);
    this.root = el('div', 'ui');

    const bind: BindButton = (element, onClick, options) => this.bindButton(element, onClick, options?.tapSound ?? true);
    this.intro = new IntroScreen(bind, () => this.events.emit('start', undefined));
    this.choice = new ChoiceScreen(bind, (stepId, optionId, index) => this.events.emit('select', { stepId, optionId, index }));
    this.build = new BuildScreen(tweener);
    this.reveal = new RevealScreen(
      bind,
      () => this.events.emit('cta', undefined),
      () => this.events.emit('replay', undefined),
    );

    this.soundButton = el('button', 'hud-btn hud-btn--sound', { type: 'button' });
    bind(this.soundButton, () => this.events.emit('toggleSound', undefined));

    this.toastText = el('span');
    this.toast = el('div', 'toast', { role: 'status', 'aria-live': 'polite' }, [this.toastText]);
    this.toast.prepend(fromMarkup(UI_ICONS.check));
    this.flashLayer = el('div', 'flash', { 'aria-hidden': 'true' });

    this.root.append(
      this.intro.root,
      this.choice.root,
      this.build.root,
      this.reveal.root,
      this.soundButton,
      this.hand.root,
      this.toast,
      this.flashLayer,
    );
    app.prepend(this.background);
    app.append(this.root);
  }

  /** Current stage-slot rectangle in CSS pixels. */
  get stage(): ScreenRect {
    return this.stageRect;
  }

  showIntro(): void {
    this.switchTo(this.intro, 'intro');
  }

  showChoice(view: ChoiceScreenView): void {
    this.choice.render(view);
    if (this.active !== this.choice) this.switchTo(this.choice, 'choice');
  }

  markSelected(optionId: string, progress: readonly ProgressSlotView[]): void {
    this.choice.markSelected(optionId, progress);
  }

  showBuild(): void {
    this.build.reset();
    this.switchTo(this.build, 'build');
  }

  setBuildProgress(percent: number, status: string): void {
    this.build.setProgress(percent, status);
  }

  showReveal(view: RevealView): void {
    this.reveal.render(view);
    this.switchTo(this.reveal, 'reveal');
  }

  setTheme(theme: ThemeColors, energy: number): void {
    const style = this.app.style;
    style.setProperty('--bg-top', theme.bgTop);
    style.setProperty('--bg-bottom', theme.bgBottom);
    style.setProperty('--bg-glow', theme.glow);
    style.setProperty('--energy', toCssHex(energy));
    this.themeMeta?.setAttribute('content', theme.bgTop);
  }

  /** Where the hero is on screen — the CSS glow and light rays centre on it. */
  setFocus(x: number, y: number): void {
    if (Math.abs(x - this.focusX) < 1 && Math.abs(y - this.focusY) < 1) return;
    this.focusX = x;
    this.focusY = y;
    this.app.style.setProperty('--focus-x', `${Math.round(x)}px`);
    this.app.style.setProperty('--focus-y', `${Math.round(y)}px`);
  }

  setMuted(muted: boolean): void {
    this.soundButton.replaceChildren(fromMarkup(muted ? UI_ICONS.soundOff : UI_ICONS.soundOn));
    this.soundButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    this.soundButton.setAttribute('aria-pressed', String(muted));
  }

  showHint(): void {
    const target = this.active?.hintTarget;
    if (target) this.hand.show(target);
  }

  hideHint(): void {
    this.hand.hide();
  }

  showToast(text: string, seconds = 2.4): void {
    this.toastText.textContent = text;
    this.toast.classList.add('is-visible');
    window.clearTimeout(this.toastTimer);
    if (seconds > 0) this.toastTimer = window.setTimeout(() => this.toast.classList.remove('is-visible'), seconds * 1000);
  }

  hideToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toast.classList.remove('is-visible');
  }

  flash(): void {
    replayClass(this.flashLayer, 'is-on');
  }

  /** Re-measures layout-dependent geometry. Call on resize / orientation change. */
  refreshLayout(): void {
    this.measureStage();
    this.hand.reposition();
    this.onLayoutChange?.();
  }

  private switchTo(screen: Screen, scene: SceneName): void {
    this.hideHint();
    if (this.active !== screen) this.active?.hide();
    this.active = screen;
    screen.show();
    this.app.dataset.scene = scene;
    this.refreshLayout();
  }

  private measureStage(): void {
    const slot = this.active?.stage;
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    this.stageRect = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  }

  private bindButton(element: HTMLElement, onClick: () => void, tapSound: boolean): () => void {
    return this.input.bind(element, {
      pointerDown: () => {
        if (tapSound) this.audio.play('tap');
        navigator.vibrate?.(8);
      },
      pointerEnter: () => this.audio.play('hover'),
      click: onClick,
    });
  }
}
