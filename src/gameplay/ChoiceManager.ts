import type { AICharacterRequest } from '../ai/IAICharacterGenerator';
import type { CharacterConfig } from '../character/CharacterConfig';
import { resolveCharacterConfig, resolveTheme } from '../character/CharacterConfigFactory';
import { isBodyTypeId, isGadgetId, isPowerId, type Selections } from '../data/catalog';
import { CHOICE_STEPS, type ChoiceStepDef, type SelectionKey } from '../data/steps';
import type { OptionDef, ThemeColors } from '../data/types';

export interface ChoiceChange {
  step: ChoiceStepDef;
  option: OptionDef;
  config: CharacterConfig;
  theme: ThemeColors;
}

function assign(selections: Selections, key: SelectionKey, id: string): boolean {
  switch (key) {
    case 'gadget':
      if (!isGadgetId(id)) return false;
      selections.gadget = id;
      return true;
    case 'power':
      if (!isPowerId(id)) return false;
      selections.power = id;
      return true;
    case 'bodyType':
      if (!isBodyTypeId(id)) return false;
      selections.bodyType = id;
      return true;
  }
}

/**
 * Holds the player's selections and derives the CharacterConfig from them.
 * The UI only ever calls select(); it never touches the character directly.
 */
export class ChoiceManager {
  private selections: Selections = {};
  private configValue: CharacterConfig = resolveCharacterConfig({});

  constructor(readonly steps: readonly ChoiceStepDef[] = CHOICE_STEPS) {}

  get config(): CharacterConfig {
    return this.configValue;
  }

  get theme(): ThemeColors {
    return resolveTheme(this.selections);
  }

  /** The option chosen for a step, if any. */
  selectedOption(step: ChoiceStepDef): OptionDef | undefined {
    const id = this.selections[step.id];
    return id ? step.options.find((option) => option.id === id) : undefined;
  }

  select(stepId: SelectionKey, optionId: string): ChoiceChange | null {
    const step = this.steps.find((candidate) => candidate.id === stepId);
    const option = step?.options.find((candidate) => candidate.id === optionId);
    if (!step || !option || !assign(this.selections, stepId, optionId)) return null;
    this.configValue = resolveCharacterConfig(this.selections);
    return { step, option, config: this.configValue, theme: resolveTheme(this.selections) };
  }

  /** The AI request once every step has an answer. */
  toRequest(): AICharacterRequest | null {
    const { gadget, power, bodyType } = this.selections;
    return gadget && power && bodyType ? { gadget, power, bodyType } : null;
  }

  reset(): void {
    this.selections = {};
    this.configValue = resolveCharacterConfig({});
  }
}
