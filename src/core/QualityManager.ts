export interface QualityLevel {
  name: string;
  maxPixelRatio: number;
  fxDensity: number;
}

const WARMUP_SECONDS = 2.5;
const WINDOW_SECONDS = 1.5;
/** Average frame time above this (~40 fps) counts as a slow window. */
const SLOW_FRAME = 1 / 40;
const SLOW_WINDOWS_TO_DOWNGRADE = 2;

/**
 * Adaptive quality: watches frame time and steps down pixel ratio / particle
 * density on struggling devices, so low-end phones stay smooth instead of the
 * whole creative stuttering.
 */
export class QualityManager {
  private readonly levels: QualityLevel[];
  private level = 0;
  private age = 0;
  private windowTime = 0;
  private windowFrames = 0;
  private slowWindows = 0;

  constructor(
    maxPixelRatio: number,
    private readonly apply: (level: QualityLevel) => void,
  ) {
    this.levels = [
      { name: 'high', maxPixelRatio, fxDensity: 1 },
      { name: 'medium', maxPixelRatio: Math.min(maxPixelRatio, 1.5), fxDensity: 0.7 },
      { name: 'low', maxPixelRatio: 1, fxDensity: 0.45 },
    ];
  }

  get current(): QualityLevel {
    return this.levels[this.level];
  }

  sample(dt: number): void {
    this.age += dt;
    if (this.age < WARMUP_SECONDS || this.level >= this.levels.length - 1) return;
    this.windowTime += dt;
    this.windowFrames++;
    if (this.windowTime < WINDOW_SECONDS) return;

    const average = this.windowTime / this.windowFrames;
    this.windowTime = 0;
    this.windowFrames = 0;
    this.slowWindows = average > SLOW_FRAME ? this.slowWindows + 1 : 0;
    if (this.slowWindows < SLOW_WINDOWS_TO_DOWNGRADE) return;

    this.slowWindows = 0;
    this.level++;
    console.info(`[quality] ${(1 / average).toFixed(0)} fps average — switching to "${this.current.name}"`);
    this.apply(this.current);
  }

  /** Frames produced while the tab was hidden must not count. */
  resetWindow(): void {
    this.windowTime = 0;
    this.windowFrames = 0;
    this.slowWindows = 0;
  }
}
