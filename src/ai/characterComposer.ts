import type { VisualTuning } from '../character/CharacterConfig';
import { resolveCharacterConfig } from '../character/CharacterConfigFactory';
import { POSES } from '../character/poses';
import type { PoseId } from '../character/types';
import { getBodyType, getPersonality, getPower } from '../data/catalog';
import type { StatBlock } from '../data/types';
import { clamp } from '../utils/math';
import type { AICharacterRequest, AICharacterResult } from './IAICharacterGenerator';
import { resolveName } from './NameGenerator';

const titleCase = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase();

/** Copy the templates produce when a generator supplies no text of its own. */
export function composeCopy(request: AICharacterRequest): { tagline: string; description: string } {
  const personality = getPersonality(request.personality);
  const power = getPower(request.power);
  const body = getBodyType(request.bodyType);
  if (!personality || !power) return { tagline: 'Your one-of-a-kind AI', description: 'A brand-new AI, built by you.' };
  return {
    tagline: `${titleCase(personality.label)} AI powered by ${power.title}`,
    description: `${personality.article} ${personality.adjective} ${body.noun} powered by ${power.phrase}.`,
  };
}

export function baseStats(request: AICharacterRequest): StatBlock {
  const personality = getPersonality(request.personality);
  const bonuses: Array<Partial<StatBlock> | undefined> = [getPower(request.power)?.stats, getBodyType(request.bodyType).stats];
  const stats: StatBlock = { ...(personality?.stats ?? { brain: 60, speed: 60, style: 60 }) };
  for (const bonus of bonuses) {
    stats.brain += bonus?.brain ?? 0;
    stats.speed += bonus?.speed ?? 0;
    stats.style += bonus?.style ?? 0;
  }
  return stats;
}

export const clampStat = (value: number): number => Math.round(clamp(value, 35, 99));

export const isPoseId = (value: unknown): value is PoseId => typeof value === 'string' && value in POSES;

export interface ComposeInput {
  request: AICharacterRequest;
  model: string;
  requestId: string;
  latencyMs: number;
  name?: string;
  tagline?: string;
  description?: string;
  visual: VisualTuning;
  stats: StatBlock;
  designationNumber: number;
}

/**
 * Builds the final result. Structure (which parts exist) always comes from
 * the validated request; a generator can only tune visuals and write copy.
 * That keeps any model — mock or real — inside the art-directed vocabulary.
 */
export function composeResult(input: ComposeInput): AICharacterResult {
  const copy = composeCopy(input.request);
  const body = getBodyType(input.request.bodyType);
  return {
    requestId: input.requestId,
    model: input.model,
    name: input.name ?? resolveName(input.request),
    designation: `${body.designation}-${String(input.designationNumber % 100).padStart(2, '0')}`,
    tagline: input.tagline ?? copy.tagline,
    description: input.description ?? copy.description,
    config: resolveCharacterConfig(input.request, input.visual),
    visual: input.visual,
    stats: {
      brain: clampStat(input.stats.brain),
      speed: clampStat(input.stats.speed),
      style: clampStat(input.stats.style),
    },
    latencyMs: Math.round(input.latencyMs),
  };
}
