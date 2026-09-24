import { Vector3, type Group } from 'three';
import type { Sequence } from '../core/Sequence';
import type { Tweener } from '../core/Tweener';
import { ANIMATION_SETS } from '../data/animationSets';
import type { FXManager } from '../fx/FXManager';
import { Easing } from '../utils/easing';
import { damp } from '../utils/math';
import { Spring } from '../utils/Spring';
import type { CharacterAssembler } from './CharacterAssembler';
import type { AssemblyStage } from './parts/BodyRig';
import { POSES, POSE_KEYS, type PoseValues } from './poses';
import type { PoseId, ReactionKind } from './types';

export type BuildStage = 'scan' | AssemblyStage | 'accessories' | 'power' | 'hero';
export type CharacterAnchor = 'center' | 'head' | 'ground';

export interface CharacterHooks {
  onLand?(strength: number): void;
  onBuildStage?(stage: BuildStage): void;
}

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

const GRAVITY = 18;
const ASSEMBLY_ORDER: readonly AssemblyStage[] = ['legs', 'body', 'arms', 'head'];
const tmp = new Vector3();

/**
 * Procedural animation for whatever rig is mounted: idle attitude, pose
 * blending, squash & stretch, hops, blinking, gaze, drag-to-spin and the
 * build choreography. No skeletal animation or clips — all maths, all cheap.
 */
export class CharacterController {
  hooks: CharacterHooks = {};

  private readonly pose: PoseValues = { ...POSES.idle };
  private poseTarget: PoseValues = POSES.idle;
  private poseHold = 0;
  private readonly squash = new Spring(210, 13);
  private readonly punch = new Spring(160, 10);
  private hopHeight = 0;
  private hopVelocity = 0;
  private airborne = false;
  private pendingHop: { delay: number; velocity: number; pose: PoseId; hold: number } | null = null;
  private yaw = 0;
  private yawVelocity = 0;
  private dragging = false;
  private releaseTimer = 0;
  private lookX = 0;
  private lookY = 0;
  private blinkTimer = 2.2;
  private blinkPhase = -1;
  private joyTimer = 0;
  private clock = 0;
  private readonly hipBaseY = new WeakMap<Group, number>();

  constructor(
    private readonly assembler: CharacterAssembler,
    private readonly tweener: Tweener,
    private readonly fx: FXManager,
  ) {}

  getAnchor(anchor: CharacterAnchor, target: Vector3): Vector3 {
    const { sockets, root } = this.assembler.rig;
    if (anchor === 'center') return sockets.chest.getWorldPosition(target);
    if (anchor === 'head') return sockets.headCenter.getWorldPosition(target);
    root.getWorldPosition(target);
    target.y = 0.03;
    return target;
  }

  setPose(id: PoseId, hold = 0): void {
    this.poseTarget = POSES[id];
    this.poseHold = hold;
  }

  hop(velocity: number): void {
    this.airborne = true;
    this.hopVelocity = Math.max(this.hopVelocity, velocity);
    this.squash.impulse(velocity * 0.55);
  }

  expressJoy(duration: number): void {
    this.joyTimer = duration;
    this.setJoy(true);
  }

  react(kind: ReactionKind): void {
    switch (kind) {
      case 'select':
        this.punch.impulse(3.4);
        this.hop(3.2);
        this.setPose('cheer', 0.55);
        this.expressJoy(0.9);
        this.fx.burst('sparkleBurst', this.getAnchor('head', tmp), 22, this.assembler.materials.tint);
        break;
      case 'power':
        this.setPose('crouch', 0.3);
        this.pendingHop = { delay: 0.14, velocity: 5.4, pose: 'power', hold: 1 };
        this.expressJoy(1.2);
        break;
      case 'body':
        this.punch.impulse(4.6);
        this.hop(3.6);
        this.setPose('cheer', 0.5);
        this.expressJoy(0.9);
        this.getAnchor('center', tmp);
        this.fx.burst('puff', tmp, 18);
        this.fx.burst('sparkleBurst', tmp, 18, this.assembler.materials.tint);
        break;
    }
  }

  beginDrag(): void {
    this.dragging = true;
    this.yawVelocity = 0;
  }

  drag(deltaPixels: number, dt: number): void {
    const delta = deltaPixels * 0.012;
    this.yaw += delta;
    this.yawVelocity = this.yawVelocity * 0.5 + (delta / Math.max(dt, 1 / 120)) * 0.5;
  }

  endDrag(): void {
    this.dragging = false;
    this.releaseTimer = 0;
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
  }

  /** The "BUILDING YOUR AI" choreography: explode, scan, snap together, power on, hero jump. */
  async playAssembly(seq: Sequence): Promise<void> {
    const rig = this.assembler.rig;
    const materials = this.assembler.materials;
    const stage = (name: BuildStage): void => this.hooks.onBuildStage?.(name);

    this.setPose('idle');
    this.yawVelocity = 0;
    materials.setPowerLevel(0.05, 0.3);
    void this.assembler.setAttachmentsVisible(false, true);
    for (const piece of rig.assembly) {
      const { explode, spin } = piece;
      this.tweener.to(piece.object.position, { x: explode.x, y: explode.y, z: explode.z }, { duration: 0.36, ease: Easing.outCubic });
      this.tweener.to(piece.object.rotation, { x: spin.x, y: spin.y, z: spin.z }, { duration: 0.36, ease: Easing.outCubic });
    }
    stage('scan');
    await seq.wait(0.55);

    for (const name of ASSEMBLY_ORDER) {
      const pieces = rig.assembly.filter((piece) => piece.stage === name);
      if (pieces.length === 0) continue;
      for (const piece of pieces) {
        this.tweener.to(piece.object.position, { x: 0, y: 0, z: 0 }, { duration: 0.26, ease: Easing.outBack });
        this.tweener.to(piece.object.rotation, { x: 0, y: 0, z: 0 }, { duration: 0.24, ease: Easing.outCubic });
      }
      await seq.wait(0.17);
      stage(name);
      for (const piece of pieces) this.fx.burst('puff', piece.object.getWorldPosition(tmp), 6);
      this.punch.impulse(1.4);
      await seq.wait(0.08);
    }

    stage('accessories');
    await seq.await(this.assembler.setAttachmentsVisible(true, true, 0.07));

    stage('power');
    materials.setPowerLevel(1, 0.16);
    materials.flash(1);
    this.expressJoy(1.4);
    await seq.wait(0.32);

    this.setPose('crouch');
    await seq.wait(0.14);
    stage('hero');
    this.hop(5.8);
    this.setPose(this.assembler.config.tuning.heroPose);
    await seq.wait(0.6);
  }

  /** Snaps the current rig back to rest. Call before swapping configs on restart. */
  reset(): void {
    const rig = this.assembler.rig;
    for (const piece of rig.assembly) {
      this.tweener.killTweensOf(piece.object.position);
      this.tweener.killTweensOf(piece.object.rotation);
      piece.object.position.set(0, 0, 0);
      piece.object.rotation.set(0, 0, 0);
    }
    Object.assign(this.pose, POSES.idle);
    this.poseTarget = POSES.idle;
    this.poseHold = 0;
    this.squash.reset();
    this.punch.reset();
    this.hopHeight = 0;
    this.hopVelocity = 0;
    this.airborne = false;
    this.pendingHop = null;
    this.yaw = 0;
    this.yawVelocity = 0;
    this.dragging = false;
    this.joyTimer = 0;
    this.setJoy(false);
    this.assembler.materials.setPowerLevel(1, 0);
    void this.assembler.setAttachmentsVisible(true, false);
  }

  update(dt: number, pointer: PointerState): void {
    const rig = this.assembler.rig;
    const config = this.assembler.config;
    const metrics = rig.metrics;
    const set = ANIMATION_SETS[config.animationSet];
    this.clock += dt * set.tempo * config.tuning.idleTempo;
    const t = this.clock;

    this.updateTimers(dt);
    this.updateHop(dt);
    const squash = this.squash.update(dt);
    const punch = this.punch.update(dt);

    const blend = 1 - Math.exp(-14 * dt);
    for (const key of POSE_KEYS) this.pose[key] += (this.poseTarget[key] - this.pose[key]) * blend;

    if (!this.dragging) {
      this.yaw += this.yawVelocity * dt;
      this.yawVelocity *= Math.exp(-4 * dt);
      this.releaseTimer += dt;
      if (this.releaseTimer > 0.9) this.yaw = damp(this.yaw, 0, 3, dt);
    }

    this.lookX = damp(this.lookX, pointer.active ? pointer.x : 0, 5, dt);
    this.lookY = damp(this.lookY, pointer.active ? pointer.y : 0, 5, dt);

    // Root: bob, hop, spin, squash & stretch.
    const bob = Math.sin(t * set.bobFrequency) * set.bobAmplitude * metrics.bobScale;
    rig.root.position.y = bob + this.hopHeight;
    rig.root.rotation.y = this.yaw;
    const sx = 1 - squash * 0.5 + punch;
    rig.root.scale.set(sx, 1 + squash + punch, sx);

    // Crouch lowers the hips and compresses the legs so feet stay planted.
    let hipBase = this.hipBaseY.get(rig.hips);
    if (hipBase === undefined) {
      hipBase = rig.hips.position.y;
      this.hipBaseY.set(rig.hips, hipBase);
    }
    const drop = this.pose.crouch * 0.1;
    rig.hips.position.y = hipBase - drop;
    const legScale = (hipBase - drop) / hipBase;
    rig.legL?.scale.set(1, legScale, 1);
    rig.legR?.scale.set(1, legScale, 1);

    const breathe = Math.sin(t * set.bobFrequency * 0.5);
    rig.torso.scale.set(1 - breathe * 0.008, 1 + breathe * 0.016, 1 - breathe * 0.008);
    rig.torso.rotation.x = this.pose.lean;

    const tilt = metrics.headTiltScale;
    rig.head.rotation.set(
      (this.pose.headPitch - this.lookY * 0.22 + Math.sin(t * set.bobFrequency + 0.6) * set.headBob) * tilt,
      this.lookX * 0.4 * tilt,
      (this.pose.headTilt + Math.sin(t * 0.9) * set.headTilt) * tilt,
    );

    const armScale = metrics.armPoseScale;
    const sway = Math.sin(t * set.bobFrequency + 1.2) * set.armSway;
    rig.armL.rotation.set(this.pose.armLx * armScale, 0, this.pose.armLz * armScale - sway);
    rig.armR.rotation.set(this.pose.armRx * armScale, 0, this.pose.armRz * armScale + sway);

    for (const spinner of rig.spinners) spinner.rotation.y += dt * 30;

    this.updateFace(dt);
  }

  private updateTimers(dt: number): void {
    if (this.poseHold > 0) {
      this.poseHold -= dt;
      if (this.poseHold <= 0) this.poseTarget = POSES.idle;
    }
    if (this.pendingHop) {
      this.pendingHop.delay -= dt;
      if (this.pendingHop.delay <= 0) {
        const { velocity, pose, hold } = this.pendingHop;
        this.pendingHop = null;
        this.hop(velocity);
        this.setPose(pose, hold);
      }
    }
    if (this.joyTimer > 0) {
      this.joyTimer -= dt;
      if (this.joyTimer <= 0) this.setJoy(false);
    }
  }

  private updateHop(dt: number): void {
    if (!this.airborne) return;
    this.hopVelocity -= GRAVITY * dt;
    this.hopHeight += this.hopVelocity * dt;
    if (this.hopHeight > 0) return;

    const impact = Math.min(1, -this.hopVelocity / 7);
    this.hopHeight = 0;
    this.hopVelocity = 0;
    this.airborne = false;
    this.squash.impulse(-5 * impact);
    this.hooks.onLand?.(impact);
    if (impact > 0.35 && this.assembler.rig.legL) {
      this.fx.burst('puff', this.getAnchor('ground', tmp), Math.round(10 * impact));
    }
  }

  private updateFace(dt: number): void {
    const face = this.assembler.face;
    const { faceWidth, faceHeight } = this.assembler.rig.metrics;
    face.look.position.set(this.lookX * faceWidth * 0.05, this.lookY * faceHeight * 0.07, 0);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0 && this.blinkPhase < 0) this.blinkPhase = 0;
    if (this.blinkPhase >= 0) {
      this.blinkPhase += dt / 0.14;
      const closed = Math.sin(Math.min(1, this.blinkPhase) * Math.PI);
      face.eyes.scale.y = 1 - closed * 0.9;
      if (this.blinkPhase >= 1) {
        this.blinkPhase = -1;
        face.eyes.scale.y = 1;
        this.blinkTimer = 1.8 + Math.random() * 2.6;
      }
    }
  }

  private setJoy(on: boolean): void {
    const face = this.assembler.face;
    face.joy.visible = on;
    face.eyes.visible = !on;
    face.mouth.visible = !on;
  }
}
