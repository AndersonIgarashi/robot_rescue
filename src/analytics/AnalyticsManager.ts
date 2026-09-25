export type AnalyticsEventName =
  | 'PLAYABLE_STARTED'
  | 'GADGET_SELECTED'
  | 'POWER_SELECTED'
  | 'BODY_SELECTED'
  | 'CHARACTER_GENERATED'
  | 'PLAYABLE_COMPLETED'
  | 'CTA_CLICKED'
  | 'RESTARTED';

export type AnalyticsMetadata = Record<string, string | number | boolean | null>;

export interface AnalyticsEvent {
  eventName: AnalyticsEventName;
  /** Epoch milliseconds. */
  timestamp: number;
  /** Milliseconds since the playable booted — the metric UA teams chart. */
  sessionTime: number;
  sessionId: string;
  metadata: AnalyticsMetadata;
}

/** Where events go. Swap/add sinks to forward to a real network or MMP. */
export interface AnalyticsSink {
  handle(event: AnalyticsEvent): void;
}

export class ConsoleSink implements AnalyticsSink {
  handle(event: AnalyticsEvent): void {
    console.info(
      `%c[analytics]%c ${event.eventName}`,
      'color:#7c5cff;font-weight:bold',
      'color:inherit',
      event.metadata,
    );
  }
}

/** Persists the last N events locally for inspection (demo stand-in for a backend). */
export class LocalStorageSink implements AnalyticsSink {
  constructor(
    private readonly key = 'bya.analytics',
    private readonly limit = 100,
  ) {}

  handle(event: AnalyticsEvent): void {
    try {
      const stored = JSON.parse(window.localStorage.getItem(this.key) ?? '[]') as AnalyticsEvent[];
      stored.push(event);
      window.localStorage.setItem(this.key, JSON.stringify(stored.slice(-this.limit)));
    } catch {
      /* storage unavailable — events are still kept in memory */
    }
  }
}

/** In-house, dependency-free event tracker for the playable funnel. */
export class AnalyticsManager {
  private readonly events: AnalyticsEvent[] = [];
  private readonly listeners = new Set<(event: AnalyticsEvent) => void>();
  private readonly startedAt = performance.now();
  readonly sessionId = Math.random().toString(36).slice(2, 10);

  constructor(private readonly sinks: AnalyticsSink[] = []) {}

  track(eventName: AnalyticsEventName, metadata: AnalyticsMetadata = {}): AnalyticsEvent {
    const event: AnalyticsEvent = {
      eventName,
      timestamp: Date.now(),
      sessionTime: Math.round(performance.now() - this.startedAt),
      sessionId: this.sessionId,
      metadata,
    };
    this.events.push(event);
    for (const sink of this.sinks) {
      try {
        sink.handle(event);
      } catch {
        /* a broken sink must not break gameplay */
      }
    }
    for (const listener of this.listeners) listener(event);
    return event;
  }

  subscribe(listener: (event: AnalyticsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get history(): readonly AnalyticsEvent[] {
    return this.events;
  }
}
