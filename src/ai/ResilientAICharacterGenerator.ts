import type { AICharacterRequest, AICharacterResult, GenerateOptions, IAICharacterGenerator } from './IAICharacterGenerator';

/**
 * Decorator: gives the primary generator a time budget and falls back to a
 * local generator on timeout or error. A playable can never hang on a
 * spinner because a model endpoint is slow.
 */
export class ResilientAICharacterGenerator implements IAICharacterGenerator {
  readonly id: string;

  constructor(
    private readonly primary: IAICharacterGenerator,
    private readonly fallback: IAICharacterGenerator,
    private readonly timeoutMs: number,
  ) {
    this.id = `${primary.id}|fallback:${fallback.id}`;
  }

  async generateCharacter(request: AICharacterRequest, options: GenerateOptions = {}): Promise<AICharacterResult> {
    const controller = new AbortController();
    const forwardAbort = (): void => controller.abort();
    options.signal?.addEventListener('abort', forwardAbort, { once: true });
    const timer = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.primary.generateCharacter(request, { signal: controller.signal });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      console.warn(`[ai] ${this.primary.id} failed — using ${this.fallback.id}.`, error);
      return this.fallback.generateCharacter(request, { signal: options.signal });
    } finally {
      window.clearTimeout(timer);
      options.signal?.removeEventListener('abort', forwardAbort);
    }
  }
}
