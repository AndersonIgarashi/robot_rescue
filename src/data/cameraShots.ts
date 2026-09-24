export interface CameraShot {
  /** Vertical focus point as a fraction of the subject height (0 = bottom, 1 = top). */
  focus: number;
  /** How much of the stage slot the subject fills (0 - 1). */
  fill: number;
  /** Camera elevation in degrees (positive = looking down). */
  pitch: number;
  /** Orbit angle in degrees around the subject. */
  yaw: number;
}

export const CAMERA_SHOTS = {
  intro: { focus: 0.5, fill: 0.9, pitch: 8, yaw: -14 },
  choice: { focus: 0.5, fill: 0.94, pitch: 7, yaw: -9 },
  build: { focus: 0.55, fill: 0.78, pitch: 5, yaw: 0 },
  reveal: { focus: 0.5, fill: 0.9, pitch: 3, yaw: 12 },
} as const satisfies Record<string, CameraShot>;

export type CameraShotId = keyof typeof CAMERA_SHOTS;
