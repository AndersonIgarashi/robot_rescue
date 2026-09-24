import type { BodyTypeId } from '../data/bodyTypes';
import type { GadgetId } from '../data/gadgets';
import type { PowerId } from '../data/powers';
import type { AccessoryId, AnimationSetId, BodyRigId, EffectId, EyeStyle, MouthStyle, PoseId } from './types';

export interface CharacterPalette {
  primary: number;
  secondary: number;
  accent: number;
  energy: number;
  energyAlt: number;
}

export interface FaceConfig {
  eyes: EyeStyle;
  mouth: MouthStyle;
  blush: boolean;
}

/** Fine-grained visual parameters. The (mock) AI generator is allowed to tune these. */
export interface VisualTuning {
  /** Emissive/energy strength multiplier (0.6 - 1.4). */
  glow: number;
  /** Idle animation speed multiplier. */
  idleTempo: number;
  /** Particle emission multiplier. */
  fxDensity: number;
  /** Pose struck at the end of the build sequence. */
  heroPose: PoseId;
}

/**
 * The single source of truth for what the character looks like.
 * UI -> ChoiceManager -> CharacterConfig -> CharacterAssembler -> Three.js scene.
 */
export interface CharacterConfig {
  gadget: GadgetId | null;
  power: PowerId | null;
  bodyType: BodyTypeId;
  rig: BodyRigId;
  color: CharacterPalette;
  face: FaceConfig;
  accessories: readonly AccessoryId[];
  effects: readonly EffectId[];
  animationSet: AnimationSetId;
  tuning: VisualTuning;
}
