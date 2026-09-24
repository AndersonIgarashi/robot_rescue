import type { Tween, Tweener } from './Tweener';

export class SequenceCancelled extends Error {
  constructor() {
    super('Sequence cancelled');
    this.name = 'SequenceCancelled';
  }
}

/**
 * Cancellable async choreography. Timed flows (build animation, reveal) read
 * top-to-bottom with `await seq.wait()` and abort cleanly on restart.
 */
export class Sequence {
  private cancelled = false;

  constructor(private readonly tweener: Tweener) {}

  get isCancelled(): boolean {
    return this.cancelled;
  }

  cancel(): void {
    this.cancelled = true;
  }

  async wait(seconds: number): Promise<void> {
    this.check();
    await this.tweener.delay(seconds);
    this.check();
  }

  async play(tween: Tween): Promise<void> {
    this.check();
    await tween.finished;
    this.check();
  }

  async await<T>(promise: Promise<T>): Promise<T> {
    this.check();
    const value = await promise;
    this.check();
    return value;
  }

  check(): void {
    if (this.cancelled) throw new SequenceCancelled();
  }

  /** Runs a choreography, swallowing cancellation but surfacing real errors. */
  static async run(sequence: Sequence, body: (seq: Sequence) => Promise<void>): Promise<boolean> {
    try {
      await body(sequence);
      return true;
    } catch (error) {
      if (error instanceof SequenceCancelled) return false;
      throw error;
    }
  }
}
