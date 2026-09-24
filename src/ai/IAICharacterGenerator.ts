import type { CharacterConfig, VisualTuning } from '../character/CharacterConfig';
import type { BodyTypeId } from '../data/bodyTypes';
import type { PersonalityId } from '../data/personalities';
import type { PowerId } from '../data/powers';
import type { StatBlock } from '../data/types';

export interface AICharacterRequest {
  personality: PersonalityId;
  power: PowerId;
  bodyType: BodyTypeId;
  locale?: string;
}

export interface AICharacterResult {
  requestId: string;
  /** Which generator/model produced this result (logged to analytics). */
  model: string;
  name: string;
  /** Model code shown on the name card, e.g. "MK-07". */
  designation: string;
  tagline: string;
  description: string;
  /** Final, render-ready configuration consumed by the CharacterAssembler. */
  config: CharacterConfig;
  /** Visual parameters the generator tuned on top of the player's choices. */
  visual: VisualTuning;
  stats: StatBlock;
  latencyMs: number;
}

export interface GenerateOptions {
  signal?: AbortSignal;
}

/**
 * The seam between the playable and "the AI". The game only ever talks to
 * this interface: swapping the mock for a real LLM/image backend is a
 * one-line change in createAIGenerator().
 */
export interface IAICharacterGenerator {
  readonly id: string;
  generateCharacter(request: AICharacterRequest, options?: GenerateOptions): Promise<AICharacterResult>;
}
