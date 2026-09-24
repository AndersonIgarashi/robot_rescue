import type { Group, Object3D, Vector3 } from 'three';
import type { FxPresetId } from '../../fx/presets';
import type { BodyRigId, SocketId } from '../types';

export type AssemblyStage = 'legs' | 'body' | 'arms' | 'head';

/** A wrapper group that flies in during the build sequence (rest transform = identity). */
export interface AssemblyPiece {
  readonly object: Object3D;
  readonly stage: AssemblyStage;
  /** Local offset the piece is blown out to before re-assembling. */
  readonly explode: Vector3;
  /** Extra rotation (radians) while exploded. */
  readonly spin: Vector3;
}

export interface RigMetrics {
  headWidth: number;
  /** Distance from the headCenter socket to the top of the head. */
  headTopY: number;
  faceWidth: number;
  faceHeight: number;
  earX: number;
  /** Vertical offset of the ear line from the headCenter socket. */
  earY: number;
  chestWidth: number;
  /** Multiplier applied to arm poses (drones barely tilt their rotor pods). */
  armPoseScale: number;
  headTiltScale: number;
  bobScale: number;
  /** Resting height of the body above the ground (drones float). */
  hover: number;
}

/** Continuous emitter owned by the rig itself (e.g. the drone's thruster). */
export interface RigEmitter {
  readonly socket: Object3D;
  readonly preset: FxPresetId;
  readonly rate: number;
}

/**
 * Contract every body type fulfils. Accessories, effects, faces and
 * animation only talk to this interface, never to a specific body.
 *
 * Hierarchy: root > hips > (legs, torso > (arms, head)). Joints animate;
 * each joint holds a wrapper (AssemblyPiece) that carries the meshes.
 */
export interface BodyRig {
  readonly id: BodyRigId;
  readonly root: Group;
  readonly hips: Group;
  readonly torso: Group;
  readonly head: Group;
  readonly armL: Group;
  readonly armR: Group;
  readonly legL: Group | null;
  readonly legR: Group | null;
  readonly antenna: Object3D;
  readonly sockets: Readonly<Record<SocketId, Object3D>>;
  readonly spinners: readonly Object3D[];
  readonly emitters: readonly RigEmitter[];
  readonly assembly: readonly AssemblyPiece[];
  readonly metrics: RigMetrics;
}
