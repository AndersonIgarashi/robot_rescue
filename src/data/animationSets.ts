import type { AnimationSetId } from '../character/types';

/** Procedural idle "attitude" per personality. */
export interface AnimationSetDef {
  bobAmplitude: number;
  bobFrequency: number;
  armSway: number;
  headBob: number;
  headTilt: number;
  tempo: number;
}

export const ANIMATION_SETS: Record<AnimationSetId, AnimationSetDef> = {
  steady: { bobAmplitude: 0.03, bobFrequency: 1.7, armSway: 0.05, headBob: 0.03, headTilt: 0.05, tempo: 1 },
  zippy: { bobAmplitude: 0.035, bobFrequency: 3.4, armSway: 0.09, headBob: 0.05, headTilt: 0.04, tempo: 1.5 },
  bouncy: { bobAmplitude: 0.06, bobFrequency: 2.3, armSway: 0.12, headBob: 0.09, headTilt: 0.1, tempo: 1.2 },
};
