import { DEFAULT_TUNING } from '../data/theme';
import { clamp, hashString } from '../utils/math';
import { baseStats, composeResult, isPoseId } from './characterComposer';
import type { AICharacterRequest, AICharacterResult, GenerateOptions, IAICharacterGenerator } from './IAICharacterGenerator';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null;
const text = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
const num = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;

/**
 * Talks to a server-side LLM endpoint (the API key never ships in the ad).
 * Expected response (all fields optional):
 *   { name, tagline, description, tuning: { glow, idleTempo, fxDensity, heroPose }, stats: { brain, speed, style } }
 *
 * Model output is untrusted: every field is validated, clamped or dropped,
 * and the part structure is always derived from the request — never from
 * free-form model text.
 */
export class RemoteAICharacterGenerator implements IAICharacterGenerator {
  readonly id = 'remote-llm-character-gen';

  constructor(
    private readonly endpoint: string,
    private readonly fetchImpl: typeof fetch = (input, init) => window.fetch(input, init),
  ) {}

  async generateCharacter(request: AICharacterRequest, options: GenerateOptions = {}): Promise<AICharacterResult> {
    const started = performance.now();
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema: 'character-v1', ...request }),
      signal: options.signal,
    });
    if (!response.ok) throw new Error(`AI endpoint responded with HTTP ${response.status}`);
    const payload: unknown = await response.json();
    if (!isObject(payload)) throw new Error('AI endpoint returned a non-object payload');
    return this.parse(payload, request, performance.now() - started);
  }

  private parse(payload: Json, request: AICharacterRequest, latencyMs: number): AICharacterResult {
    const tuning = isObject(payload.tuning) ? payload.tuning : {};
    const stats = isObject(payload.stats) ? payload.stats : {};
    const base = baseStats(request);
    const rawName = text(payload.name, 12)?.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const seed = hashString(JSON.stringify(request));

    return composeResult({
      request,
      model: this.id,
      requestId: text(payload.requestId, 64) ?? `req_${seed.toString(36)}`,
      latencyMs,
      name: rawName || undefined,
      tagline: text(payload.tagline, 48),
      description: text(payload.description, 120),
      visual: {
        glow: num(tuning.glow, DEFAULT_TUNING.glow, 0.6, 1.4),
        idleTempo: num(tuning.idleTempo, DEFAULT_TUNING.idleTempo, 0.7, 1.5),
        fxDensity: num(tuning.fxDensity, DEFAULT_TUNING.fxDensity, 0.3, 1.5),
        heroPose: isPoseId(tuning.heroPose) ? tuning.heroPose : DEFAULT_TUNING.heroPose,
      },
      stats: {
        brain: num(stats.brain, base.brain, 0, 100),
        speed: num(stats.speed, base.speed, 0, 100),
        style: num(stats.style, base.style, 0, 100),
      },
      designationNumber: 10 + (seed % 90),
    });
  }
}
