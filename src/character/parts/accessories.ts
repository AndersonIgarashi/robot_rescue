import { Group, Path, Shape, type Object3D } from 'three';
import { TAU, clamp } from '../../utils/math';
import type { AccessoryId } from '../types';
import { EmitterState, streamFrom, type AttachmentFactory } from './Attachment';
import type { BodyRig } from './BodyRig';
import { faceLayout } from './face';
import { HALF_PI, addGroup, addMesh } from './kit';

const SIDES = [-1, 1] as const;
const MISSILE_RED = 0xff4d5e;

/** Scale for props sized on the chunky robot (chest width 0.58). */
const bodyScale = (rig: BodyRig, min: number): number => clamp(rig.metrics.chestWidth / 0.58, min, 1);

function finShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0.26, 0);
  shape.lineTo(-0.3, 0);
  shape.quadraticCurveTo(-0.52, 0.06, -0.56, 0.46);
  shape.quadraticCurveTo(-0.2, 0.36, 0.26, 0);
  return shape;
}

/** Heater-shield badge with a round window for the chest core. */
function emblemShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0, 0.19);
  shape.lineTo(0.18, 0.13);
  shape.lineTo(0.16, -0.04);
  shape.quadraticCurveTo(0.11, -0.15, 0, -0.21);
  shape.quadraticCurveTo(-0.11, -0.15, -0.16, -0.04);
  shape.lineTo(-0.18, 0.13);
  shape.closePath();
  const window = new Path();
  window.absarc(0, 0, 0.135, 0, TAU, true);
  shape.holes.push(window);
  return shape;
}

/** Registry: accessory id -> factory. Adding an accessory = adding one entry. */
export const ACCESSORY_FACTORIES: Record<AccessoryId, AttachmentFactory> = {
  // --- SHIELD: defense -------------------------------------------------------

  armShield: ({ geo, mat }, rig) => {
    const k = bodyScale(rig, 0.6);
    const root = new Group();
    // Built facing +Z, then turned to face out-and-forward from the left hand.
    const shield = addGroup(root, [-0.12 * k, 0.02, 0.09 * k]);
    shield.rotation.y = -0.93;
    shield.scale.setScalar(k);
    addMesh(shield, geo.cylinder(), mat.secondary, { r: [HALF_PI, 0, 0], s: [0.27, 0.06, 0.27] });
    addMesh(shield, geo.torus(0.1), mat.energy, { p: [0, 0, 0.012], s: 0.27 });
    addMesh(shield, geo.cylinder(1, 6), mat.accent, { p: [0, 0, 0.03], r: [HALF_PI, 0, 0], s: [0.12, 0.04, 0.12] });
    addMesh(shield, geo.sphere(), mat.energy, { p: [0, 0, 0.055], s: 0.04 });
    return { id: 'armShield', mounts: [{ socket: 'handL', object: root }] };
  },

  shieldOrbit: ({ geo, mat }, rig) => {
    const radius = rig.metrics.headWidth * 0.62 + 0.3;
    const root = new Group();
    const ring = addGroup(root);
    ring.rotation.set(0.28, 0, -0.18);
    const spin = addGroup(ring);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * TAU;
      addMesh(spin, geo.cylinder(1, 6), mat.energy, {
        p: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
        r: [0, -angle, HALF_PI],
        s: [0.13, 0.025, 0.13],
      });
    }
    return {
      id: 'shieldOrbit',
      mounts: [{ socket: 'headCenter', object: root }],
      update: ({ dt }) => {
        spin.rotation.y += dt * 1.3;
      },
    };
  },

  chestEmblem: ({ geo, mat }, rig) => {
    const k = rig.metrics.chestWidth / 0.58;
    const root = new Group();
    addMesh(root, geo.extrude('emblem', emblemShape, 0.03, 0.01), mat.accent, { p: [0, 0.01 * k, 0.012], s: k });
    return { id: 'chestEmblem', mounts: [{ socket: 'chest', object: root }] };
  },

  // --- TURBO: speed ----------------------------------------------------------

  headFin: ({ geo, mat }, rig) => {
    const scale = rig.metrics.headWidth * 0.9;
    const root = new Group();
    addMesh(root, geo.extrude('fin', finShape, 0.07, 0.02), mat.secondary, {
      p: [0, 0.2 * scale, -0.05 * scale],
      r: [0, -HALF_PI, 0],
      s: scale,
    });
    return { id: 'headFin', mounts: [{ socket: 'headTop', object: root }] };
  },

  jetBoosters: ({ geo, mat }, rig) => {
    const scale = bodyScale(rig, 0.7);
    const root = new Group();
    const nozzles: Object3D[] = [];
    for (const side of SIDES) {
      const booster = addGroup(root, [side * 0.17 * scale, 0, -0.06 * scale]);
      booster.rotation.z = side * 0.14;
      booster.scale.setScalar(scale);
      addMesh(booster, geo.cylinder(), mat.accent, { s: [0.1, 0.36, 0.1] });
      addMesh(booster, geo.cylinder(0), mat.secondary, { p: [0, 0.25, 0], s: [0.1, 0.14, 0.1] });
      addMesh(booster, geo.torus(0.2), mat.secondary, { p: [0, 0.06, 0], r: [HALF_PI, 0, 0], s: 0.105 });
      addMesh(booster, geo.cylinder(0.72), mat.joint, { p: [0, -0.23, 0], s: [0.12, 0.1, 0.12] });
      addMesh(booster, geo.cylinder(), mat.energy, { p: [0, -0.285, 0], s: [0.085, 0.02, 0.085] });
      nozzles.push(addGroup(booster, [0, -0.3, 0]));
    }
    const states = nozzles.map(() => new EmitterState());
    return {
      id: 'jetBoosters',
      mounts: [{ socket: 'back', object: root }],
      update: (ctx) => {
        if (!ctx.active) return;
        nozzles.forEach((nozzle, i) => streamFrom(ctx, states[i], nozzle, 'thruster', 30));
      },
    };
  },

  speedStripes: ({ geo, mat }, rig) => {
    const width = rig.metrics.chestWidth;
    const k = width / 0.58;
    const root = new Group();
    for (const side of SIDES) {
      for (let i = 0; i < 2; i++) {
        addMesh(root, geo.roundedBox(0.05, 0.3, 0.03, 0.012), mat.energy, {
          p: [side * (width * 0.3 + i * 0.075 * k), 0, 0.012],
          r: [0, 0, side * -0.35],
          s: [k, k, 1],
        });
      }
    }
    return { id: 'speedStripes', mounts: [{ socket: 'chest', object: root }] };
  },

  // --- BLASTER: attack -------------------------------------------------------

  armCannon: ({ geo, mat }, rig) => {
    const root = new Group();
    const cannon = addGroup(root);
    cannon.scale.setScalar(bodyScale(rig, 0.62));
    // Barrel runs along the arm (-Y) and swallows the hand.
    addMesh(cannon, geo.cylinder(), mat.secondary, { p: [0, -0.12, 0], s: [0.14, 0.46, 0.14] });
    for (const y of [0.06, -0.2]) {
      addMesh(cannon, geo.torus(0.22), mat.accent, { p: [0, y, 0], r: [HALF_PI, 0, 0], s: 0.15 });
    }
    addMesh(cannon, geo.cylinder(0.78), mat.joint, { p: [0, -0.39, 0], s: [0.16, 0.08, 0.16] });
    addMesh(cannon, geo.cylinder(), mat.energy, { p: [0, -0.435, 0], s: [0.1, 0.02, 0.1] });
    const muzzle = addGroup(cannon, [0, -0.46, 0]);
    const state = new EmitterState();
    return {
      id: 'armCannon',
      mounts: [{ socket: 'handR', object: root }],
      update: (ctx) => {
        if (ctx.active) streamFrom(ctx, state, muzzle, 'spark', 4);
      },
    };
  },

  missilePods: ({ geo, mat }, rig) => {
    const root = new Group();
    const pod = addGroup(root, [0, 0.02, -0.06]);
    pod.rotation.x = -0.28;
    pod.scale.setScalar(bodyScale(rig, 0.65));
    addMesh(pod, geo.roundedBox(0.46, 0.28, 0.22, 0.06), mat.secondary);
    addMesh(pod, geo.roundedBox(0.48, 0.05, 0.24, 0.02), mat.accent, { p: [0, 0.1, 0] });
    for (const x of [-0.13, 0, 0.13]) {
      addMesh(pod, geo.cylinder(), mat.primary, { p: [x, 0.24, 0], s: [0.05, 0.22, 0.05] });
      addMesh(pod, geo.cylinder(0), mat.candy(MISSILE_RED), { p: [x, 0.39, 0], s: [0.05, 0.09, 0.05] });
    }
    return { id: 'missilePods', mounts: [{ socket: 'back', object: root }] };
  },

  scopeVisor: ({ geo, mat }, rig) => {
    const { faceWidth, faceHeight } = rig.metrics;
    const { eyeX, eyeY, eyeSize: s } = faceLayout(faceWidth, faceHeight);
    const size = s * 1.7;
    const thickness = Math.max(0.016, s * 0.16);
    const root = new Group();
    const scope = addGroup(root, [eyeX, eyeY, 0.03]);
    addMesh(scope, geo.roundedFrame(size, size, size / 2, thickness, 0.03), mat.accent);
    addMesh(scope, geo.roundedBox(size * 0.8, 0.012, 0.012, 0.005), mat.energy, { p: [0, 0, 0.018] });
    addMesh(scope, geo.roundedBox(0.012, size * 0.8, 0.012, 0.005), mat.energy, { p: [0, 0, 0.018] });
    addMesh(scope, geo.roundedBox(faceWidth * 0.16, thickness, 0.03, thickness * 0.4), mat.accent, {
      p: [size / 2 + faceWidth * 0.07, 0, 0],
    });
    return { id: 'scopeVisor', mounts: [{ socket: 'face', object: root }] };
  },
};
