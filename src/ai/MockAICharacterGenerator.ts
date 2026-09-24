import { getPersonality } from '../data/catalog';
import { createRandom, hashString } from '../utils/math';
import { baseStats, composeResult } from './characterComposer';
import type { AICharacterRequest, AICharacterResult, GenerateOptions, IAICharacterGenerator } from './IAICharacterGenerator';

export interface MockGeneratorOptions {
  /** Simulated network latency range in ms. */
  latencyMs?: readonly [number, number];
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Deterministic stand-in for a generative backend. Same inputs -> same AI,
 * with simulated latency so the UX is designed around a real async call.
 */
export class MockAICharacterGenerator implements IAICharacterGenerator {
  readonly id = 'mock-character-gen-v1';

  constructor(private readonly options: MockGeneratorOptions = {}) {}

  async generateCharacter(request: AICharacterRequest, options: GenerateOptions = {}): Promise<AICharacterResult> {
    const started = performance.now();
    const seed = hashString(`${request.personality}|${request.power}|${request.bodyType}`);
    const random = createRandom(seed);
    const [minLatency, maxLatency] = this.options.latencyMs ?? [450, 900];
    await wait(minLatency + random() * (maxLatency - minLatency), options.signal);

    const jitter = (): number => Math.round((random() - 0.5) * 8);
    const stats = baseStats(request);
    stats.brain += jitter();
    stats.speed += jitter();
    stats.style += jitter();

    return composeResult({
      request,
      model: this.id,
      requestId: `req_${seed.toString(36)}`,
      latencyMs: performance.now() - started,
      visual: {
        glow: Math.round((0.95 + random() * 0.25) * 100) / 100,
        idleTempo: Math.round((0.95 + random() * 0.15) * 100) / 100,
        fxDensity: 1,
        heroPose: getPersonality(request.personality)?.heroPose ?? 'hero',
      },
      stats,
      designationNumber: 10 + (seed % 90),
    });
  }
}
