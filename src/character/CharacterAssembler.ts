import { Group, Mesh, SphereGeometry, type Object3D } from 'three';
import type { Tweener } from '../core/Tweener';
import { EmitterState, type FXManager } from '../fx/FXManager';
import { Easing } from '../utils/easing';
import type { CharacterConfig } from './CharacterConfig';
import { CharacterMaterials } from './CharacterMaterials';
import { GeometryLibrary } from './GeometryLibrary';
import { ACCESSORY_FACTORIES } from './parts/accessories';
import { streamFrom, type Attachment, type AttachmentContext } from './parts/Attachment';
import type { BodyRig } from './parts/BodyRig';
import { EFFECT_FACTORIES } from './parts/effects';
import { buildFace, type FaceRig } from './parts/face';
import type { PartKit } from './parts/kit';
import { RIG_BUILDERS } from './parts/rigs';
import type { AccessoryId, BodyRigId, EffectId } from './types';

export type AttachmentId = AccessoryId | EffectId;

export interface AssemblyChange {
  rigChanged: boolean;
  faceChanged: boolean;
  added: AttachmentId[];
  removed: AttachmentId[];
}

type MutableContext = { -readonly [K in keyof AttachmentContext]: AttachmentContext[K] };

const POP_IN_DURATION = 0.42;
const POP_OUT_DURATION = 0.16;
const HIDDEN_SCALE = 0.001;

const isAccessory = (id: AttachmentId): id is AccessoryId => id in ACCESSORY_FACTORIES;
const faceKey = (config: CharacterConfig): string =>
  `${config.rig}:${config.face.eyes}:${config.face.mouth}:${config.face.blush ? 1 : 0}`;

/**
 * Builds the character from a CharacterConfig. It diffs each new config
 * against what is mounted and only touches what changed: paint is a colour
 * tween, parts pop in/out, and rigs/faces/attachments are cached for reuse.
 */
export class CharacterAssembler {
  readonly root = new Group();
  readonly materials: CharacterMaterials;
  readonly geometry = new GeometryLibrary();

  private readonly kit: PartKit;
  private readonly rigs = new Map<BodyRigId, BodyRig>();
  private readonly faces = new Map<string, FaceRig>();
  private readonly attachmentCache = new Map<string, Attachment>();
  private readonly active = new Map<AttachmentId, Attachment>();
  private readonly rigEmitterStates = new Map<object, EmitterState>();
  private readonly context: MutableContext;

  private rigValue: BodyRig;
  private faceValue: FaceRig;
  private faceKeyValue: string;
  private configValue: CharacterConfig;
  private attachmentsShown = true;

  constructor(
    private readonly tweener: Tweener,
    fx: FXManager,
    initial: CharacterConfig,
  ) {
    this.root.name = 'character';
    this.materials = new CharacterMaterials(tweener);
    this.kit = { geo: this.geometry, mat: this.materials };

    this.configValue = initial;
    this.rigValue = this.getRig(initial.rig);
    this.root.add(this.rigValue.root);
    this.faceKeyValue = faceKey(initial);
    this.faceValue = this.getFace(initial);
    this.rigValue.sockets.face.add(this.faceValue.root);

    this.context = { dt: 0, time: 0, fx, tint: this.materials.tint, active: true, rig: this.rigValue };
    this.apply(initial, false);
  }

  get rig(): BodyRig {
    return this.rigValue;
  }

  get face(): FaceRig {
    return this.faceValue;
  }

  get config(): CharacterConfig {
    return this.configValue;
  }

  get attachmentsVisible(): boolean {
    return this.attachmentsShown;
  }

  apply(config: CharacterConfig, animate: boolean): AssemblyChange {
    this.configValue = config;
    this.materials.applyPalette(config.color, animate ? 0.5 : 0);
    this.materials.setGlow(config.tuning.glow);

    const rigChanged = config.rig !== this.rigValue.id;
    if (rigChanged) this.swapRig(config.rig);

    const nextFaceKey = faceKey(config);
    const faceChanged = rigChanged || nextFaceKey !== this.faceKeyValue;
    if (faceChanged) {
      this.faceValue.root.removeFromParent();
      this.faceKeyValue = nextFaceKey;
      this.faceValue = this.getFace(config);
      this.faceValue.joy.visible = false;
      this.faceValue.eyes.visible = true;
      this.faceValue.mouth.visible = true;
      this.rigValue.sockets.face.add(this.faceValue.root);
    }

    const desired: AttachmentId[] = [...config.accessories, ...config.effects];
    const removed = [...this.active.keys()].filter((id) => !desired.includes(id));
    const added = desired.filter((id) => !this.active.has(id));

    for (const id of removed) {
      const attachment = this.active.get(id);
      if (attachment) this.unmount(attachment, animate);
      this.active.delete(id);
    }

    if (rigChanged) {
      // Re-seat everything that stays on the new rig's sockets.
      for (const [id, previous] of this.active) {
        this.unmount(previous, false);
        const next = this.getAttachment(id);
        this.active.set(id, next);
        this.mount(next, false, 0);
      }
    }

    added.forEach((id, index) => {
      const attachment = this.getAttachment(id);
      this.active.set(id, attachment);
      this.mount(attachment, animate, index * 0.09);
    });

    this.updateAntenna();
    return { rigChanged, faceChanged, added, removed };
  }

  /** Shows/hides every mounted attachment (used by the build sequence). */
  setAttachmentsVisible(visible: boolean, animate: boolean, stagger = 0.07): Promise<void> {
    this.attachmentsShown = visible;
    const pending: Promise<void>[] = [];
    let index = 0;
    for (const attachment of this.active.values()) {
      for (const mount of attachment.mounts) {
        const scale = mount.object.scale;
        this.tweener.killTweensOf(scale);
        mount.object.visible = true;
        const target = visible ? 1 : HIDDEN_SCALE;
        if (!animate) {
          scale.setScalar(target);
          mount.object.visible = visible;
          continue;
        }
        const tween = this.tweener.to(
          scale,
          { x: target, y: target, z: target },
          {
            duration: visible ? POP_IN_DURATION : POP_OUT_DURATION,
            delay: visible ? index * stagger : 0,
            ease: visible ? Easing.outBackStrong : Easing.inCubic,
            onComplete: () => (mount.object.visible = visible),
          },
        );
        pending.push(tween.finished);
        index++;
      }
    }
    return Promise.all(pending).then(() => undefined);
  }

  /** World positions of attachments that just popped in (for sparkle feedback). */
  mountedObjects(ids: readonly AttachmentId[]): Object3D[] {
    return ids.flatMap((id) => this.active.get(id)?.mounts.map((mount) => mount.object) ?? []);
  }

  update(dt: number, time: number): void {
    this.materials.update(dt);
    const ctx = this.context;
    ctx.dt = dt;
    ctx.time = time;
    ctx.rig = this.rigValue;
    ctx.active = this.attachmentsShown && this.materials.power > 0.6;
    for (const attachment of this.active.values()) attachment.update?.(ctx);

    if (this.materials.power > 0.3) {
      for (const emitter of this.rigValue.emitters) {
        let state = this.rigEmitterStates.get(emitter);
        if (!state) {
          state = new EmitterState();
          this.rigEmitterStates.set(emitter, state);
        }
        streamFrom(ctx, state, emitter.socket, emitter.preset, emitter.rate);
      }
    }
  }

  /** Builds every rig/face/attachment combination ahead of time so choices never hitch. */
  prewarm(): void {
    for (const rigId of Object.keys(RIG_BUILDERS) as BodyRigId[]) {
      const rig = this.getRig(rigId);
      for (const id of [...Object.keys(ACCESSORY_FACTORIES), ...Object.keys(EFFECT_FACTORIES)] as AttachmentId[]) {
        this.getAttachment(id, rig);
      }
    }
  }

  /** One tiny mesh per material so the renderer can compile every shader up front. */
  createShaderWarmup(): Group {
    const group = new Group();
    const geometry = new SphereGeometry(0.01, 4, 2);
    for (const material of this.materials.all) {
      const mesh = new Mesh(geometry, material);
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }

  private swapRig(id: BodyRigId): void {
    this.rigValue.root.removeFromParent();
    this.rigValue = this.getRig(id);
    this.root.add(this.rigValue.root);
  }

  private mount(attachment: Attachment, animate: boolean, delay: number): void {
    for (const mount of attachment.mounts) {
      const scale = mount.object.scale;
      this.tweener.killTweensOf(scale);
      this.rigValue.sockets[mount.socket].add(mount.object);
      if (!this.attachmentsShown) {
        scale.setScalar(HIDDEN_SCALE);
        mount.object.visible = false;
        continue;
      }
      mount.object.visible = true;
      if (animate) {
        scale.setScalar(HIDDEN_SCALE);
        this.tweener.to(scale, { x: 1, y: 1, z: 1 }, { duration: POP_IN_DURATION, delay, ease: Easing.outBackStrong });
      } else {
        scale.setScalar(1);
      }
    }
  }

  private unmount(attachment: Attachment, animate: boolean): void {
    for (const mount of attachment.mounts) {
      const scale = mount.object.scale;
      this.tweener.killTweensOf(scale);
      if (!animate) {
        mount.object.removeFromParent();
        continue;
      }
      this.tweener.to(
        scale,
        { x: HIDDEN_SCALE, y: HIDDEN_SCALE, z: HIDDEN_SCALE },
        { duration: POP_OUT_DURATION, ease: Easing.inCubic, onComplete: () => mount.object.removeFromParent() },
      );
    }
  }

  private updateAntenna(): void {
    let hidden = false;
    for (const attachment of this.active.values()) hidden ||= attachment.hidesAntenna === true;
    this.rigValue.antenna.visible = !hidden;
  }

  private getRig(id: BodyRigId): BodyRig {
    let rig = this.rigs.get(id);
    if (!rig) {
      rig = RIG_BUILDERS[id](this.kit);
      this.rigs.set(id, rig);
    }
    return rig;
  }

  private getFace(config: CharacterConfig): FaceRig {
    const key = faceKey(config);
    let face = this.faces.get(key);
    if (!face) {
      const { faceWidth, faceHeight } = this.getRig(config.rig).metrics;
      face = buildFace(this.kit, config.face, faceWidth, faceHeight);
      this.faces.set(key, face);
    }
    return face;
  }

  private getAttachment(id: AttachmentId, rig: BodyRig = this.rigValue): Attachment {
    const key = `${id}:${rig.id}`;
    let attachment = this.attachmentCache.get(key);
    if (!attachment) {
      attachment = isAccessory(id) ? ACCESSORY_FACTORIES[id](this.kit, rig) : EFFECT_FACTORIES[id](this.kit, rig);
      this.attachmentCache.set(key, attachment);
    }
    return attachment;
  }
}
