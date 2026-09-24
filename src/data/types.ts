import type { SfxId } from '../audio/sfx';
import type { AccessoryId, AnimationSetId, BodyRigId, EffectId, EyeStyle, MouthStyle, PoseId } from '../character/types';
import type { FxPresetId } from '../fx/presets';

export type IconId = 'brain' | 'rocket' | 'palette' | 'flame' | 'snowflake' | 'bolt' | 'robot' | 'android' | 'drone';

export interface CardStyle {
  /** Card gradient top colour. */
  top: string;
  /** Card gradient bottom colour. */
  bottom: string;
  /** Chunky bottom edge / outline colour. */
  edge: string;
}

export interface ThemeColors {
  bgTop: string;
  bgBottom: string;
  glow: string;
}

export interface StatBlock {
  brain: number;
  speed: number;
  style: number;
}

/** Everything the UI needs to render a choice card. */
export interface OptionDef {
  readonly id: string;
  readonly label: string;
  readonly icon: IconId;
  readonly card: CardStyle;
  readonly theme?: ThemeColors;
}

export interface PersonalityDef extends OptionDef {
  readonly article: 'A' | 'An';
  readonly adjective: string;
  readonly paint: { readonly primary: number; readonly secondary: number; readonly accent: number };
  readonly energy: number;
  readonly face: { readonly eyes: EyeStyle; readonly mouth: MouthStyle; readonly blush: boolean };
  readonly accessories: readonly AccessoryId[];
  readonly animationSet: AnimationSetId;
  /** Pose struck at the end of the build sequence. */
  readonly heroPose: PoseId;
  readonly stats: StatBlock;
}

export interface PowerBurstDef {
  readonly preset: FxPresetId;
  readonly count: number;
  /** Lightning-style strike from the sky onto the character. */
  readonly strike?: boolean;
}

export interface PowerDef extends OptionDef {
  readonly title: string;
  readonly phrase: string;
  readonly energy: number;
  readonly energyAlt: number;
  readonly effects: readonly EffectId[];
  readonly burst: PowerBurstDef;
  readonly sfx: SfxId;
  readonly stats: Partial<StatBlock>;
}

export interface BodyTypeDef extends OptionDef {
  readonly noun: string;
  readonly rig: BodyRigId;
  readonly designation: string;
  /** World-space framing bounds used by the camera (feet at y = 0). */
  readonly bounds: { readonly bottom: number; readonly top: number; readonly width: number };
  readonly stats: Partial<StatBlock>;
}
