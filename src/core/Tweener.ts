import { Easing, type Ease } from '../utils/easing';

type NumericKeys<T> = { [K in keyof T]: T[K] extends number ? K : never }[keyof T];

export interface TweenOptions {
  duration: number;
  delay?: number;
  ease?: Ease;
  onStart?: () => void;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

export class Tween {
  private elapsed = 0;
  private started = false;
  private done = false;
  private readonly from: number[] = [];
  private resolveFinished: (() => void) | null = null;
  readonly finished: Promise<void>;

  constructor(
    readonly target: object | null,
    private readonly keys: string[],
    private readonly to: number[],
    private readonly options: TweenOptions,
  ) {
    this.finished = new Promise((resolve) => (this.resolveFinished = resolve));
  }

  get isDone(): boolean {
    return this.done;
  }

  /** Returns true once the tween has finished. */
  step(dt: number): boolean {
    if (this.done) return true;
    this.elapsed += dt;
    const delay = this.options.delay ?? 0;
    if (this.elapsed < delay) return false;

    const record = this.target as Record<string, number> | null;
    if (!this.started) {
      this.started = true;
      if (record) for (const key of this.keys) this.from.push(record[key]);
      this.options.onStart?.();
    }

    const duration = Math.max(this.options.duration, 1e-4);
    const t = Math.min((this.elapsed - delay) / duration, 1);
    const k = (this.options.ease ?? Easing.outCubic)(t);

    if (record) {
      for (let i = 0; i < this.keys.length; i++) {
        record[this.keys[i]] = this.from[i] + (this.to[i] - this.from[i]) * k;
      }
    }
    this.options.onUpdate?.(k);

    if (t >= 1) this.finish();
    return this.done;
  }

  /** Stops the tween where it is. Its `finished` promise still resolves so awaiting code never hangs. */
  kill(): void {
    if (this.done) return;
    this.done = true;
    this.resolveFinished?.();
  }

  private finish(): void {
    this.done = true;
    this.options.onComplete?.();
    this.resolveFinished?.();
  }
}

/**
 * Lightweight tween engine driven by the game clock (not wall time), so it
 * pauses with the playable and costs nothing when idle.
 */
export class Tweener {
  private tweens: Tween[] = [];

  to<T extends object>(target: T, props: Partial<Record<NumericKeys<T>, number>>, options: TweenOptions): Tween {
    const keys = Object.keys(props);
    const values = keys.map((key) => (props as Record<string, number>)[key]);
    return this.add(new Tween(target, keys, values, options));
  }

  /** A property-less tween: drive anything through `onUpdate(progress)`. */
  tween(options: TweenOptions): Tween {
    return this.add(new Tween(null, [], [], options));
  }

  delay(seconds: number): Promise<void> {
    return this.tween({ duration: seconds, ease: Easing.linear }).finished;
  }

  killTweensOf(target: object): void {
    for (const tween of this.tweens) if (tween.target === target) tween.kill();
  }

  killAll(): void {
    for (const tween of this.tweens) tween.kill();
    this.tweens = [];
  }

  update(dt: number): void {
    const list = this.tweens;
    if (list.length === 0) return;
    let write = 0;
    // Tweens created by callbacks during this loop are appended and stepped in the same pass.
    for (let i = 0; i < list.length; i++) {
      const tween = list[i];
      if (!tween.step(dt)) list[write++] = tween;
    }
    // killAll() may have swapped the list from inside a callback — only compact our own.
    if (this.tweens === list) list.length = write;
  }

  get activeCount(): number {
    return this.tweens.length;
  }

  private add(tween: Tween): Tween {
    this.tweens.push(tween);
    return tween;
  }
}
