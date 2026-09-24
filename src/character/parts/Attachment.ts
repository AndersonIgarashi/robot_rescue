import { Vector3, type Object3D } from 'three';
import { EmitterState, type FXManager, type Tint } from '../../fx/FXManager';
import type { FxPresetId } from '../../fx/presets';
import type { AccessoryId, EffectId, SocketId } from '../types';
import type { BodyRig } from './BodyRig';
import type { PartKit } from './kit';

export interface AttachmentMount {
  readonly socket: SocketId;
  readonly object: Object3D;
}

export interface AttachmentContext {
  readonly dt: number;
  readonly time: number;
  readonly fx: FXManager;
  readonly tint: Tint;
  /** False while the character is powered down (build sequence). */
  readonly active: boolean;
  readonly rig: BodyRig;
}

/** A modular add-on (accessory or power effect) mounted on one or more rig sockets. */
export interface Attachment {
  readonly id: AccessoryId | EffectId;
  readonly mounts: readonly AttachmentMount[];
  /** Hides the rig's antenna when this attachment would collide with it. */
  readonly hidesAntenna?: boolean;
  update?(ctx: AttachmentContext): void;
}

export type AttachmentFactory = (kit: PartKit, rig: BodyRig) => Attachment;

const tmpWorld = new Vector3();

/** Streams a preset from a socket's current world position. */
export function streamFrom(
  ctx: AttachmentContext,
  state: EmitterState,
  socket: Object3D,
  preset: FxPresetId,
  rate: number,
  tint: Tint = ctx.tint,
): void {
  socket.getWorldPosition(tmpWorld);
  ctx.fx.stream(state, preset, tmpWorld, rate, ctx.dt, tint);
}

export { EmitterState };
