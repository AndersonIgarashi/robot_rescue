import type { SfxId } from '../audio/sfx';
import type { AccessoryId, AnimationSetId, BodyRigId, EffectId, EyeStyle, MouthStyle, PoseId } from '../character/types';
import type { FxPresetId } from '../fx/presets';
import type { HazardKind, PickupKind } from '../race/types';

export type IconId =
  | 'shield'
  | 'rocket'
  | 'blaster'
  | 'flame'
  | 'snowflake'
  | 'bolt'
  | 'robot'
  | 'android'
  | 'drone'
  | 'water'
  | 'magnet';

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

/** Runner stats shown on the end card. */
export interface StatBlock {
  speed: number;
  armor: number;
  power: number;
}

/** Everything the UI needs to render a choice card. */
export interface OptionDef {
  readonly id: string;
  readonly label: string;
  readonly icon: IconId;
  readonly card: CardStyle;
  readonly theme?: ThemeColors;
}

/** Gadget = the racer's special ability: paint job + face + accessory kit + idle attitude. */
export interface GadgetDef extends OptionDef {
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
  /** The element this power is weak to — it becomes the race's obstacles. */
  readonly hazard: { readonly kind: HazardKind; readonly label: string; readonly icon: IconId };
  /** The element this power collects on the track. */
  readonly pickup: { readonly kind: PickupKind; readonly label: string };
}

export interface BodyTypeDef extends OptionDef {
  readonly noun: string;
  readonly rig: BodyRigId;
  readonly designation: string;
  /** Runner ability shown on the end card. */
  readonly ability: string;
  /** World-space framing bounds used by the camera (feet at y = 0). */
  readonly bounds: { readonly bottom: number; readonly top: number; readonly width: number };
  readonly stats: Partial<StatBlock>;
}
