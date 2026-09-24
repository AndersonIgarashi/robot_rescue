import { Group, Vector3 } from 'three';
import { clamp, randRange, randSigned } from '../../utils/math';
import type { EffectId } from '../types';
import { EmitterState, streamFrom, type AttachmentFactory } from './Attachment';
import { addMesh, type PartKit } from './kit';

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpC = new Vector3();

function crystalCluster({ geo, mat }: PartKit, side: -1 | 1, scale: number): Group {
  const cluster = new Group();
  cluster.rotation.z = side * -0.45;
  cluster.scale.setScalar(scale);
  addMesh(cluster, geo.octahedron(), mat.ice, { p: [0, 0.15, 0], s: [0.09, 0.26, 0.09] });
  addMesh(cluster, geo.octahedron(), mat.ice, { p: [side * 0.09, 0.09, 0.03], r: [0, 0, side * -0.55], s: [0.065, 0.18, 0.065] });
  addMesh(cluster, geo.octahedron(), mat.ice, { p: [-side * 0.07, 0.08, -0.04], r: [0.3, 0, side * 0.5], s: [0.06, 0.16, 0.06] });
  return cluster;
}

/** Registry: power effect id -> factory. Effects are attachments that mostly emit VFX. */
export const EFFECT_FACTORIES: Record<EffectId, AttachmentFactory> = {
  flameHands: (_kit, rig) => {
    const states = [new EmitterState(), new EmitterState(), new EmitterState()];
    return {
      id: 'flameHands',
      mounts: [],
      update: (ctx) => {
        if (!ctx.active) return;
        streamFrom(ctx, states[0], rig.sockets.handL, 'flame', 36);
        streamFrom(ctx, states[1], rig.sockets.handR, 'flame', 36);
        if (rig.antenna.visible) streamFrom(ctx, states[2], rig.sockets.antennaTip, 'flame', 10);
      },
    };
  },

  emberAura: (_kit, rig) => {
    const state = new EmitterState();
    return {
      id: 'emberAura',
      mounts: [],
      update: (ctx) => {
        if (!ctx.active) return;
        rig.root.getWorldPosition(tmpA);
        tmpA.y += 1.1;
        ctx.fx.stream(state, 'ember', tmpA, 9, ctx.dt, ctx.tint);
      },
    };
  },

  iceCrystals: (kit, rig) => {
    const scale = clamp(rig.metrics.chestWidth / 0.58, 0.75, 1);
    const left = crystalCluster(kit, -1, scale);
    const right = crystalCluster(kit, 1, scale);
    const states = [new EmitterState(), new EmitterState()];
    return {
      id: 'iceCrystals',
      mounts: [
        { socket: 'shoulderL', object: left },
        { socket: 'shoulderR', object: right },
      ],
      update: (ctx) => {
        if (!ctx.active) return;
        streamFrom(ctx, states[0], left, 'iceSparkle', 2.5);
        streamFrom(ctx, states[1], right, 'iceSparkle', 2.5);
      },
    };
  },

  snowAura: (_kit, rig) => {
    const snow = new EmitterState();
    const mist = new EmitterState();
    return {
      id: 'snowAura',
      mounts: [],
      update: (ctx) => {
        if (!ctx.active) return;
        rig.root.getWorldPosition(tmpA);
        tmpB.set(tmpA.x, 2.9, tmpA.z);
        ctx.fx.stream(snow, 'snow', tmpB, 12, ctx.dt);
        tmpB.set(tmpA.x, 0.1, tmpA.z);
        ctx.fx.stream(mist, 'frostMist', tmpB, 5, ctx.dt, ctx.tint);
      },
    };
  },

  lightningArcs: (_kit, rig) => {
    let cooldown = 0;
    return {
      id: 'lightningArcs',
      mounts: [],
      update: (ctx) => {
        if (!ctx.active) return;
        cooldown -= ctx.dt;
        if (cooldown > 0) return;
        cooldown = randRange(0.06, 0.16) / Math.max(0.3, ctx.fx.density);
        const { sockets } = rig;
        const roll = Math.random();
        const color = ctx.tint[0];

        if (roll < 0.35) {
          // Hand-to-hand arc bowing in front of the chest.
          sockets.handL.getWorldPosition(tmpA);
          sockets.handR.getWorldPosition(tmpB);
          sockets.chest.getWorldPosition(tmpC);
          tmpC.z += 0.35;
          ctx.fx.arcs.spawn(tmpA, tmpC, color, randRange(0.08, 0.14), 0.13);
          ctx.fx.arcs.spawn(tmpC, tmpB, color, randRange(0.08, 0.14), 0.13);
        } else if (roll < 0.55 && rig.antenna.visible) {
          sockets.antennaTip.getWorldPosition(tmpA);
          tmpB.set(tmpA.x + randSigned(0.5), tmpA.y + randRange(0.1, 0.5), tmpA.z + randSigned(0.3));
          ctx.fx.arcs.spawn(tmpA, tmpB, color, randRange(0.07, 0.12), 0.11);
        } else {
          const hand = Math.random() < 0.5 ? sockets.handL : sockets.handR;
          hand.getWorldPosition(tmpA);
          tmpB.set(tmpA.x + randSigned(0.6), tmpA.y - randRange(0.1, 0.5), tmpA.z + randSigned(0.4));
          ctx.fx.arcs.spawn(tmpA, tmpB, color, randRange(0.07, 0.12), 0.11);
        }
      },
    };
  },

  sparkAura: (_kit, rig) => {
    const states = [new EmitterState(), new EmitterState()];
    return {
      id: 'sparkAura',
      mounts: [],
      update: (ctx) => {
        if (!ctx.active) return;
        streamFrom(ctx, states[0], rig.sockets.handL, 'spark', 12);
        streamFrom(ctx, states[1], rig.sockets.handR, 'spark', 12);
      },
    };
  },
};
