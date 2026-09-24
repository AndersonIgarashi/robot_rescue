import type { SelectionKey } from '../data/steps';
import type { CardStyle, IconId, OptionDef, StatBlock } from '../data/types';

/** Everything the UI can tell the game. The UI never mutates game state itself. */
export interface UIEvents {
  start: undefined;
  select: { stepId: SelectionKey; optionId: string; index: number };
  cta: undefined;
  replay: undefined;
  toggleSound: undefined;
}

export interface ProgressSlotView {
  icon: IconId;
  done: boolean;
  current: boolean;
  card?: CardStyle;
}

export interface ChoiceScreenView {
  stepId: SelectionKey;
  title: string;
  options: readonly OptionDef[];
  progress: ProgressSlotView[];
}

export interface RevealView {
  name: string;
  designation: string;
  bodyLabel: string;
  tagline: string;
  description: string;
  stats: StatBlock;
  ctaLabel: string;
}

/** Binds a pressable element with the shared press feedback (sound, haptics). */
export type BindButton = (element: HTMLElement, onClick: () => void, options?: { tapSound?: boolean }) => () => void;
