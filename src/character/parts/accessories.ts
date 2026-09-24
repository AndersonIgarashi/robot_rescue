import { Group, Shape, type Object3D } from 'three';
import { TAU, clamp } from '../../utils/math';
import type { AccessoryId } from '../types';
import { EmitterState, streamFrom, type AttachmentFactory } from './Attachment';
import { faceLayout } from './face';
import { HALF_PI, addGroup, addMesh } from './kit';

const SIDES = [-1, 1] as const;

function starShape(): Shape {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? 0.1 : 0.045;
    const angle = (i / 10) * TAU + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function heartShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0, -0.09);
  shape.bezierCurveTo(-0.03, -0.06, -0.11, -0.02, -0.11, 0.03);
  shape.bezierCurveTo(-0.11, 0.08, -0.05, 0.1, 0, 0.05);
  shape.bezierCurveTo(0.05, 0.1, 0.11, 0.08, 0.11, 0.03);
  shape.bezierCurveTo(0.11, -0.02, 0.03, -0.06, 0, -0.09);
  return shape;
}

function finShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0.26, 0);
  shape.lineTo(-0.3, 0);
  shape.quadraticCurveTo(-0.52, 0.06, -0.56, 0.46);
  shape.quadraticCurveTo(-0.2, 0.36, 0.26, 0);
  return shape;
}

/** Registry: accessory id -> factory. Adding an accessory = adding one entry. */
export const ACCESSORY_FACTORIES: Record<AccessoryId, AttachmentFactory> = {
  glasses: ({ geo, mat }, rig) => {
    const { faceWidth, faceHeight } = rig.metrics;
    const { eyeX, eyeY, eyeSize: s } = faceLayout(faceWidth, faceHeight);
    const root = new Group();
    const w = s * 1.75;
    const h = s * 1.4;
    const t = Math.max(0.018, s * 0.16);
    for (const side of SIDES) {
      addMesh(root, geo.roundedFrame(w, h, s * 0.42, t, 0.03), mat.accent, { p: [side * eyeX, eyeY, 0.03] });
    }
    addMesh(root, geo.roundedBox(Math.max(0.02, eyeX * 2 - w + t), t, 0.03, t * 0.45), mat.accent, {
      p: [0, eyeY + h * 0.18, 0.03],
    });
    return { id: 'glasses', mounts: [{ socket: 'face', object: root }] };
  },

  headset: ({ geo, mat }, rig) => {
    const { earX, earY, headTopY, headWidth } = rig.metrics;
    const radius = Math.max(earX, headTopY - earY) + 0.05;
    const podRadius = 0.15 * clamp(headWidth, 0.7, 1);
    const root = new Group();
    root.position.y = earY;
    for (const side of SIDES) {
      addMesh(root, geo.cylinder(), mat.secondary, { p: [side * radius, 0, 0], r: [0, 0, HALF_PI], s: [podRadius, 0.1, podRadius] });
      addMesh(root, geo.torus(0.28), mat.energy, { p: [side * (radius + 0.055), 0, 0], r: [0, HALF_PI, 0], s: podRadius * 0.62 });
    }
    addMesh(root, geo.torus(0.035 / radius, Math.PI), mat.secondary, { s: radius });
    addMesh(root, geo.cylinder(), mat.joint, { p: [-radius * 0.93, -0.1, 0.14], r: [HALF_PI, 0, -0.35], s: [0.016, 0.26, 0.016] });
    addMesh(root, geo.sphere(), mat.energy, { p: [-radius * 0.86, -0.1, 0.27], s: 0.04 });
    return { id: 'headset', mounts: [{ socket: 'headCenter', object: root }], hidesAntenna: true };
  },

  dataOrbit: ({ geo, mat }, rig) => {
    const radius = rig.metrics.headWidth * 0.62 + 0.28;
    const root = new Group();
    const ring = addGroup(root);
    ring.rotation.set(0.35, 0, -0.25);
    const spin = addGroup(ring);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * TAU;
      addMesh(spin, geo.roundedBox(0.11, 0.11, 0.11, 0.03), mat.energy, {
        p: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius],
        r: [0.6, angle, 0.4],
      });
    }
    return {
      id: 'dataOrbit',
      mounts: [{ socket: 'headCenter', object: root }],
      update: ({ dt }) => {
        spin.rotation.y += dt * 1.4;
      },
    };
  },

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
    const scale = clamp(rig.metrics.chestWidth / 0.58, 0.7, 1);
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

  beret: ({ geo, mat }, rig) => {
    const k = clamp(rig.metrics.headWidth, 0.75, 1.05);
    const root = new Group();
    const cap = addGroup(root, [0.04 * k, -0.02 * k, 0]);
    cap.rotation.set(-0.12, 0, 0.28);
    addMesh(cap, geo.sphere(), mat.secondary, { p: [0, 0.05 * k, 0], s: [0.42 * k, 0.15 * k, 0.4 * k] });
    addMesh(cap, geo.cylinder(), mat.secondary, { p: [0, 0.21 * k, 0], s: [0.03 * k, 0.08 * k, 0.03 * k] });
    addMesh(cap, geo.torus(0.16), mat.accent, { p: [0, -0.02 * k, 0], r: [HALF_PI, 0, 0], s: 0.37 * k });
    return { id: 'beret', mounts: [{ socket: 'headTop', object: root }], hidesAntenna: true };
  },

  paintBrush: ({ geo, mat }, rig) => {
    const root = new Group();
    const brush = addGroup(root);
    brush.rotation.set(0.9, 0, -0.15);
    brush.scale.setScalar(clamp(rig.metrics.chestWidth / 0.58, 0.65, 1));
    addMesh(brush, geo.cylinder(), mat.accent, { p: [0, 0.1, 0], s: [0.032, 0.56, 0.032] });
    addMesh(brush, geo.cylinder(), mat.joint, { p: [0, 0.41, 0], s: [0.042, 0.08, 0.042] });
    addMesh(brush, geo.sphere(), mat.secondary, { p: [0, 0.5, 0], s: [0.055, 0.11, 0.055] });
    addMesh(brush, geo.sphere(), mat.energy, { p: [0, 0.58, 0], s: 0.04 });
    const tip = addGroup(brush, [0, 0.6, 0]);
    const state = new EmitterState();
    return {
      id: 'paintBrush',
      mounts: [{ socket: 'handR', object: root }],
      update: (ctx) => {
        if (ctx.active) streamFrom(ctx, state, tip, 'paintDrop', 2.5);
      },
    };
  },

  shapeOrbit: ({ geo, mat }, rig) => {
    const radius = rig.metrics.headWidth * 0.62 + 0.32;
    const root = new Group();
    const ring = addGroup(root);
    ring.rotation.set(0.3, 0, 0.18);
    const spin = addGroup(ring);
    const shapes = [
      { geometry: geo.extrude('star', starShape, 0.05, 0.012), color: 0xffd23f, scale: 0.95 },
      { geometry: geo.extrude('heart', heartShape, 0.05, 0.012), color: 0xff5fa8, scale: 0.95 },
      { geometry: geo.torus(0.42), color: 0x4ef0c8, scale: 0.075 },
      { geometry: geo.octahedron(), color: 0x5b8cff, scale: 0.085 },
    ];
    const holders = shapes.map((shape, i) => {
      const angle = (i / shapes.length) * TAU;
      const holder = addGroup(spin, [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
      addMesh(holder, shape.geometry, mat.candy(shape.color), { s: shape.scale });
      return holder;
    });
    return {
      id: 'shapeOrbit',
      mounts: [{ socket: 'headCenter', object: root }],
      update: ({ dt, time }) => {
        spin.rotation.y += dt * 0.9;
        holders.forEach((holder, i) => {
          holder.rotation.y += dt * 2.2;
          holder.position.y = Math.sin(time * 2.4 + i * 1.7) * 0.05;
        });
      },
    };
  },
};
