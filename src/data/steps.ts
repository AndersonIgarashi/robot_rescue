import type { AnalyticsEventName } from '../analytics/AnalyticsManager';
import type { ReactionKind } from '../character/types';
import { BODY_TYPES } from './bodyTypes';
import { GADGETS } from './gadgets';
import { POWERS } from './powers';
import type { IconId, OptionDef } from './types';

export type SelectionKey = 'gadget' | 'power' | 'bodyType';

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
    id: 'gadget',
    title: 'CHOOSE YOUR GADGET',
    options: GADGETS,
    placeholderIcon: 'shield',
    event: 'GADGET_SELECTED',
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
    title: 'CHOOSE YOUR BODY',
    options: BODY_TYPES,
    placeholderIcon: 'robot',
    event: 'BODY_SELECTED',
    reaction: 'body',
  },
];
