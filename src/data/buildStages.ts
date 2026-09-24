import type { BuildStage } from '../character/CharacterController';

/** Progress bar value and status copy for each beat of the build sequence. */
export const BUILD_STAGES: Record<BuildStage, { progress: number; status: string }> = {
  scan: { progress: 12, status: 'SCANNING PARTS' },
  legs: { progress: 28, status: 'ATTACHING LEGS' },
  body: { progress: 44, status: 'LOCKING BODY' },
  arms: { progress: 58, status: 'CONNECTING ARMS' },
  head: { progress: 72, status: 'MOUNTING HEAD' },
  accessories: { progress: 86, status: 'INSTALLING PERSONALITY' },
  power: { progress: 96, status: 'CHARGING {power}' },
  hero: { progress: 100, status: 'BOOTING AI' },
};
