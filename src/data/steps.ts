import type { AnalyticsEventName } from '../analytics/AnalyticsManager';
import type { ReactionKind } from '../character/types';
import { BODY_TYPES } from './bodyTypes';
import { PERSONALITIES } from './personalities';
import { POWERS } from './powers';
import type { IconId, OptionDef } from './types';

export type SelectionKey = 'personality' | 'power' | 'bodyType';

export interface ChoiceStepDef {
  readonly id: SelectionKey;
  readonly title: string;
  readonly options: readonly OptionDef[];
  /** Icon shown in the progress tracker before a choice is made. */
  readonly placeholderIcon: IconId;
  readonly event: AnalyticsEventName;
  readonly reaction: ReactionKind;
}

/** The playable's flow is this list. Reorder, remove or add steps here. */
export const CHOICE_STEPS: readonly ChoiceStepDef[] = [
  {
    id: 'personality',
    title: "WHAT'S YOUR AI LIKE?",
    options: PERSONALITIES,
    placeholderIcon: 'brain',
    event: 'PERSONALITY_SELECTED',
    reaction: 'select',
  },
  {
    id: 'power',
    title: 'CHOOSE YOUR POWER',
    options: POWERS,
    placeholderIcon: 'bolt',
    event: 'POWER_SELECTED',
    reaction: 'power',
  },
  {
    id: 'bodyType',
    title: 'CHOOSE YOUR AI',
    options: BODY_TYPES,
    placeholderIcon: 'robot',
    event: 'BODY_SELECTED',
    reaction: 'body',
  },
];
