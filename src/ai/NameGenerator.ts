import { NAME_RULES, type NameRule } from '../data/names';
import type { AICharacterRequest } from './IAICharacterGenerator';

const FIELDS = ['gadget', 'power', 'bodyType'] as const;

/** Picks the most specific matching name rule (see data/names.ts). */
export function resolveName(request: AICharacterRequest, rules: readonly NameRule[] = NAME_RULES): string {
  let best: NameRule | null = null;
  let bestScore = -1;
  for (const rule of rules) {
    let score = 0;
    let matches = true;
    for (const field of FIELDS) {
      const value = rule[field];
      if (value === undefined) continue;
      if (value !== request[field]) {
        matches = false;
        break;
      }
      score++;
    }
    if (matches && score > bestScore) {
      best = rule;
      bestScore = score;
    }
  }
  return best?.name ?? 'NOVA';
}
