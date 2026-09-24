import type { AnalyticsEvent, AnalyticsManager } from '../analytics/AnalyticsManager';
import type { InputManager } from '../input/InputManager';
import { el } from '../utils/dom';

export interface RenderStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  particles: number;
  pixelRatio: number;
}

const STAT_LABELS: ReadonlyArray<[keyof RenderStats | 'fps', string]> = [
  ['fps', 'FPS'],
  ['calls', 'DRAW CALLS'],
  ['triangles', 'TRIANGLES'],
  ['geometries', 'GEOMETRIES'],
  ['programs', 'SHADERS'],
  ['particles', 'PARTICLES'],
];
const MAX_LOG = 40;
const REFRESH_INTERVAL = 0.5;

/**
 * Portfolio-mode overlay: live render stats and the analytics event stream.
 * Toggle with the DEV pill or the "D" key; hide completely with `?dev=0`.
 */
export class DevPanel {
  readonly toggle: HTMLButtonElement;
  readonly panel: HTMLElement;
  private readonly values = new Map<string, HTMLElement>();
  private readonly log: HTMLElement;
  private open = false;
  private frames = 0;
  private elapsed = 0;

  constructor(input: InputManager, analytics: AnalyticsManager, environment: string) {
    this.toggle = el('button', 'dev-toggle', { type: 'button', 'aria-expanded': 'false' }, ['DEV']);
    const stats = el(
      'div',
      'dev-stats',
      {},
      STAT_LABELS.map(([key, label]) => {
        const value = el('b', '', {}, ['-']);
        this.values.set(key, value);
        return el('div', '', {}, [value, el('span', '', {}, [label])]);
      }),
    );
    this.log = el('ul', 'dev-log');
    const meta = el('div', 'dev-meta', {}, [`session ${analytics.sessionId} · ad env: ${environment}`]);
    this.panel = el('aside', 'dev-panel', { 'aria-label': 'Developer overlay' }, [
      el('h3', '', {}, ['RENDER']),
      stats,
      el('h3', '', {}, ['ANALYTICS EVENTS']),
      this.log,
      meta,
    ]);

    input.bind(this.toggle, { click: () => this.setOpen(!this.open) });
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'd' && !event.repeat) this.setOpen(!this.open);
    });
    for (const event of analytics.history) this.append(event);
    analytics.subscribe((event) => this.append(event));
  }

  update(dt: number, stats: RenderStats): void {
    this.frames++;
    this.elapsed += dt;
    if (this.elapsed < REFRESH_INTERVAL) return;
    const fps = Math.round(this.frames / this.elapsed);
    this.frames = 0;
    this.elapsed = 0;
    if (!this.open) return;
    this.set('fps', String(fps));
    this.set('calls', String(stats.calls));
    this.set('triangles', stats.triangles >= 1000 ? `${(stats.triangles / 1000).toFixed(1)}k` : String(stats.triangles));
    this.set('geometries', String(stats.geometries));
    this.set('programs', String(stats.programs));
    this.set('particles', String(stats.particles));
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.panel.classList.toggle('is-open', open);
    this.toggle.setAttribute('aria-expanded', String(open));
  }

  private set(key: string, value: string): void {
    const node = this.values.get(key);
    if (node && node.textContent !== value) node.textContent = value;
  }

  private append(event: AnalyticsEvent): void {
    const metadata = Object.keys(event.metadata).length ? JSON.stringify(event.metadata) : '';
    const item = el('li', '', {}, [
      el('time', '', {}, [`+${(event.sessionTime / 1000).toFixed(2)}s`]),
      el('b', '', {}, [event.eventName]),
      ...(metadata ? [el('code', '', {}, [metadata])] : []),
    ]);
    this.log.prepend(item);
    while (this.log.childElementCount > MAX_LOG) this.log.lastElementChild?.remove();
  }
}
