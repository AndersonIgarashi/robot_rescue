export interface CameraShot {
  /** Vertical focus point as a fraction of the subject height (0 = bottom, 1 = top). */
  focus: number;
  /** How much of the stage slot the subject fills (0 - 1). */
  fill: number;
  /** Camera elevation in degrees (positive = looking down). */
  pitch: number;
  /** Orbit angle in degrees around the subject. */
  yaw: number;
  /** Minimum framed width in world units (default: the pedestal). */
  minWidth?: number;
  /** Look this far down the track (-Z) past the subject. */
  lookAhead?: number;
  /**
   * Never get closer than this. Race shots are about the track, so the racer
   * keeps a similar share of the screen whether the layout slot is tall or wide.
   */
  minDistance?: number;
}

export const CAMERA_SHOTS = {
  intro: { focus: 0.5, fill: 0.92, pitch: 8, yaw: -14 },
  choice: { focus: 0.5, fill: 0.96, pitch: 7, yaw: -9 },
  build: { focus: 0.55, fill: 0.8, pitch: 5, yaw: 0 },
  reveal: { focus: 0.5, fill: 0.94, pitch: 3, yaw: 12 },
  race: { focus: 0.2, fill: 0.92, pitch: 27, yaw: 0, minWidth: 3.7, lookAhead: 5.5, minDistance: 15 },
  chase: { focus: 0.3, fill: 0.92, pitch: 24, yaw: 0, minWidth: 3.7, lookAhead: 6.5, minDistance: 14 },
  freeze: { focus: 0.42, fill: 0.9, pitch: 9, yaw: 82, minWidth: 3.8, lookAhead: 0.8, minDistance: 11 },
} as const satisfies Record<string, CameraShot>;

export type CameraShotId = keyof typeof CAMERA_SHOTS;
