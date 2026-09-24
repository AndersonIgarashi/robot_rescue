import type { AdConfig } from '../data/adConfig';
import type { IAICharacterGenerator } from './IAICharacterGenerator';
import { MockAICharacterGenerator } from './MockAICharacterGenerator';
import { RemoteAICharacterGenerator } from './RemoteAICharacterGenerator';
import { ResilientAICharacterGenerator } from './ResilientAICharacterGenerator';

/**
 * Composition root for the AI layer — the only place that knows which
 * implementation is live. `?ai=remote` routes to a server endpoint, still
 * guarded by a timeout and the local mock as fallback.
 */
export function createAIGenerator(config: AdConfig): IAICharacterGenerator {
  const mock = new MockAICharacterGenerator();
  if (config.aiProvider === 'remote') {
    return new ResilientAICharacterGenerator(new RemoteAICharacterGenerator(config.aiEndpoint), mock, config.aiTimeoutMs);
  }
  return mock;
}
