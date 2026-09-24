import type { PoseId } from './types';

/** Joint targets (radians / normalised) blended by the controller. */
export interface PoseValues {
  armLz: number;
  armRz: number;
  armLx: number;
  armRx: number;
  headPitch: number;
  headTilt: number;
  lean: number;
  crouch: number;
}

export const POSE_KEYS = ['armLz', 'armRz', 'armLx', 'armRx', 'headPitch', 'headTilt', 'lean', 'crouch'] as const;

export const POSES: Record<PoseId, PoseValues> = {
  idle: { armLz: -0.14, armRz: 0.14, armLx: 0, armRx: 0, headPitch: 0, headTilt: 0, lean: 0, crouch: 0 },
  cheer: { armLz: -2.55, armRz: 2.55, armLx: -0.1, armRx: -0.1, headPitch: -0.18, headTilt: 0, lean: -0.04, crouch: 0 },
  hero: { armLz: -0.5, armRz: 2.75, armLx: 0.12, armRx: -0.3, headPitch: -0.12, headTilt: 0.1, lean: -0.05, crouch: 0 },
  crouch: { armLz: -0.6, armRz: 0.6, armLx: 0.35, armRx: 0.35, headPitch: 0.16, headTilt: 0, lean: 0.14, crouch: 1 },
  power: { armLz: -1.35, armRz: 1.35, armLx: -0.65, armRx: -0.65, headPitch: -0.1, headTilt: 0, lean: -0.06, crouch: 0 },
  aim: { armLz: -0.35, armRz: 0.25, armLx: 0.2, armRx: -1.45, headPitch: -0.05, headTilt: -0.08, lean: 0.04, crouch: 0.2 },
  ready: { armLz: -0.45, armRz: 0.45, armLx: -0.55, armRx: 0.5, headPitch: -0.08, headTilt: 0, lean: 0.16, crouch: 0.55 },
};
