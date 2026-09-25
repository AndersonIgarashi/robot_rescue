export interface CameraShot {
  /** Vertical focus point as a fraction of the subject height (0 = bottom, 1 = top). */
  focus: number;
  /** How much of the stage slot the subject fills (0 - 1). */
  fill: number;
  /** Camera elevation in degrees (positive = looking down). */
  pitch: number;
  /** Orbit angle in degrees around the subject. */
  yaw: number;
  /** Vertical field of view in degrees (default: a flattering 30° "product shot" lens). */
  fov?: number;
  /** Minimum framed width in world units (default: the pedestal). */
  minWidth?: number;
  /** Look this far down the track (-Z) past the subject. */
  lookAhead?: number;
  /**
   * Never get closer than this. Race shots are about the track, so the racer
   * keeps a similar share of the screen whether the layout slot is tall or wide.
   */
  minDistance?: number;
  /**
   * Lowest the subject's feet may sit, as a fraction of the stage slot
   * (0 = top, 1 = bottom). For shots that look far ahead, on short slots.
   */
  groundMax?: number;
}

export const CAMERA_SHOTS = {
  choice: { focus: 0.5, fill: 0.96, pitch: 7, yaw: -9 },
  build: { focus: 0.55, fill: 0.8, pitch: 5, yaw: 0 },
  reveal: { focus: 0.5, fill: 0.94, pitch: 3, yaw: 12 },
  // Race shots use a wide, low lens: the highway converges on the city at the horizon.
  race: { fov: 52, focus: 0.3, fill: 0.9, pitch: 13, yaw: 0, minWidth: 4.9, lookAhead: 23, minDistance: 10, groundMax: 0.9 },
  chase: { fov: 56, focus: 0.35, fill: 0.9, pitch: 15, yaw: 0, minWidth: 5.2, lookAhead: 20, minDistance: 10, groundMax: 0.9 },
  freeze: { fov: 44, focus: 0.42, fill: 0.9, pitch: 7, yaw: 82, minWidth: 3.8, lookAhead: 0.8, minDistance: 8 },
} as const satisfies Record<string, CameraShot>;

export type CameraShotId = keyof typeof CAMERA_SHOTS;
