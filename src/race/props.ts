import { Color, Group, MeshBasicMaterial, MeshStandardMaterial, Shape, Vector3, type Material } from 'three';
import type { GeometryLibrary } from '../character/GeometryLibrary';
import { HALF_PI, addGroup, addMesh } from '../character/parts/kit';
import { EmitterState, type FXManager, type Tint } from '../fx/FXManager';
import { TAU } from '../utils/math';
import type { HazardKind, PickupKind } from './types';

export interface PropKit {
  readonly geo: GeometryLibrary;
  /** Lit, slightly self-illuminated "toy" material. */
  candy(color: number): MeshStandardMaterial;
  /** Unlit glowing material (flames, fields). */
  glow(color: number): MeshBasicMaterial;
  readonly dark: Material;
  readonly water: Material;
  readonly foam: Material;
}

export interface PropContext {
  readonly dt: number;
  readonly time: number;
  readonly fx: FXManager;
}

/** A hazard or pickup placed on the track. Built at the origin of its lane. */
export interface RaceProp {
  readonly root: Group;
  update(ctx: PropContext): void;
}

const WATER_TINT: Tint = [new Color(0x4fc3ff), new Color(0xd8f6ff)];
/** Teardrop flame silhouette (radius, height), lathe-turned. */
const FLAME_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.2, 0.05],
  [0.3, 0.24],
  [0.3, 0.46],
  [0.22, 0.74],
  [0.11, 1.02],
  [0, 1.32],
];
const FIELD_BLUE = new Color(0x62b8ff);
const tmpA = new Vector3();
const tmpB = new Vector3();

function snowflakeShape(): Shape {
  const shape = new Shape();
  for (let i = 0; i < 12; i++) {
    const radius = i % 2 === 0 ? 0.24 : 0.075;
    const angle = (i / 12) * TAU + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function base(kit: PropKit, root: Group, ringColor: number): void {
  addMesh(root, kit.geo.cylinder(0.8), kit.dark, { p: [0, 0.07, 0], s: [0.36, 0.14, 0.36] });
  addMesh(root, kit.geo.torus(0.18), kit.candy(ringColor), { p: [0, 0.145, 0], r: [HALF_PI, 0, 0], s: 0.27 });
}

/** Hazards: the element each power is weak to (data: PowerDef.hazard). */
export const HAZARD_FACTORIES: Record<HazardKind, (kit: PropKit) => RaceProp> = {
  waterJet: (kit) => {
    const root = new Group();
    base(kit, root, 0x2f9bff);
    const column = addGroup(root, [0, 0.14, 0]);
    addMesh(column, kit.geo.cylinder(0.75), kit.water, { p: [0, 0.8, 0], s: [0.2, 1.6, 0.2] });
    addMesh(column, kit.geo.sphere(), kit.foam, { p: [0, 1.62, 0], s: [0.24, 0.15, 0.24] });
    const top = addGroup(column, [0, 1.7, 0]);
    const spray = new EmitterState();
    return {
      root,
      update: ({ dt, time, fx }) => {
        column.scale.y = 1 + Math.sin(time * 9) * 0.1 + Math.sin(time * 23) * 0.04;
        fx.stream(spray, 'waterSpray', top.getWorldPosition(tmpA), 22, dt, WATER_TINT);
      },
    };
  },

  flameJet: (kit) => {
    const root = new Group();
    base(kit, root, 0xff7a1a);
    addMesh(root, kit.geo.cylinder(), kit.glow(0xffb02e), { p: [0, 0.15, 0], s: [0.25, 0.01, 0.25] });
    const flame = addGroup(root, [0, 0.12, 0]);
    const shape = kit.geo.lathe('flame', FLAME_PROFILE, 18);
    addMesh(flame, shape, kit.glow(0xff4d1f), { s: [1, 1, 1] });
    // Inner layers sit forward so the hot core reads through the outer flame.
    addMesh(flame, shape, kit.glow(0xff9a1f), { p: [0, 0.02, 0.12], s: [0.7, 0.78, 0.7] });
    addMesh(flame, shape, kit.glow(0xffe36a), { p: [0, 0.03, 0.21], s: [0.4, 0.5, 0.4] });
    const tip = addGroup(flame, [0, 0.55, 0]);
    const fire = new EmitterState();
    return {
      root,
      update: ({ dt, time, fx }) => {
        flame.scale.set(1 + Math.sin(time * 19) * 0.07, 1 + Math.sin(time * 13) * 0.12, 1 + Math.cos(time * 17) * 0.07);
        flame.rotation.z = Math.sin(time * 7) * 0.08;
        fx.stream(fire, 'bonfire', tip.getWorldPosition(tmpA), 30, dt);
      },
    };
  },

  magnet: (kit) => {
    const root = new Group();
    const red = kit.candy(0xff4d5e);
    const silver = kit.candy(0xe4ebf7);
    addMesh(root, kit.geo.torus(0.32, Math.PI), red, { p: [0, 0.98, 0], s: 0.38 });
    for (const side of [-1, 1]) {
      addMesh(root, kit.geo.cylinder(), red, { p: [side * 0.38, 0.62, 0], s: [0.122, 0.72, 0.122] });
      addMesh(root, kit.geo.cylinder(), silver, { p: [side * 0.38, 0.13, 0], s: [0.128, 0.26, 0.128] });
    }
    const rings = [0, 1].map((i) =>
      addMesh(root, kit.geo.torus(0.08), kit.glow(0x62b8ff), { p: [0, 0.35 + i * 0.3, 0], r: [HALF_PI, 0, 0], s: 0.18 }),
    );
    for (const ring of rings) ring.matrixAutoUpdate = true;
    const tipL = addGroup(root, [-0.38, 0.1, 0.05]);
    const tipR = addGroup(root, [0.38, 0.1, 0.05]);
    let zapTimer = 0;
    return {
      root,
      update: ({ dt, time, fx }) => {
        rings.forEach((ring, i) => {
          const phase = (time * 1.6 + i * 0.5) % 1;
          ring.scale.setScalar(0.12 + phase * 0.35);
          ring.visible = phase < 0.85;
        });
        zapTimer -= dt;
        if (zapTimer <= 0) {
          zapTimer = 0.25 + Math.random() * 0.3;
          fx.arcs.spawn(tipL.getWorldPosition(tmpA), tipR.getWorldPosition(tmpB), FIELD_BLUE, 0.12, 0.08, 0.14);
        }
      },
    };
  },
};

/** Pickups: the power's own element, floating and spinning. */
export const PICKUP_FACTORIES: Record<PickupKind, (kit: PropKit) => RaceProp> = {
  flameOrb: (kit) => {
    const root = new Group();
    const orb = addGroup(root, [0, 0.75, 0]);
    addMesh(orb, kit.geo.sphere(), kit.glow(0xffa22e), { s: 0.15 });
    addMesh(orb, kit.geo.torus(0.14), kit.candy(0xff5a1a), { r: [HALF_PI, 0, 0], s: 0.22 });
    const embers = new EmitterState();
    return {
      root,
      update: ({ dt, time, fx }) => {
        orb.position.y = 0.75 + Math.sin(time * 3 + root.position.z) * 0.08;
        orb.rotation.y += dt * 2.5;
        fx.stream(embers, 'flame', orb.getWorldPosition(tmpA), 5, dt);
      },
    };
  },

  snowflake: (kit) => {
    const root = new Group();
    const flake = addGroup(root, [0, 0.75, 0]);
    addMesh(flake, kit.geo.extrude('snowflake', snowflakeShape, 0.05, 0.012), kit.candy(0x8feaff));
    addMesh(flake, kit.geo.sphere(), kit.glow(0xe8fdff), { s: 0.06 });
    return {
      root,
      update: ({ dt, time }) => {
        flake.position.y = 0.75 + Math.sin(time * 3 + root.position.z) * 0.08;
        flake.rotation.y += dt * 2.4;
      },
    };
  },

  battery: (kit) => {
    const root = new Group();
    const cell = addGroup(root, [0, 0.75, 0]);
    cell.rotation.z = 0.35;
    addMesh(cell, kit.geo.cylinder(), kit.candy(0xffd23f), { s: [0.12, 0.3, 0.12] });
    addMesh(cell, kit.geo.cylinder(), kit.dark, { p: [0, -0.1, 0], s: [0.125, 0.09, 0.125] });
    addMesh(cell, kit.geo.cylinder(), kit.candy(0xe4ebf7), { p: [0, 0.18, 0], s: [0.05, 0.06, 0.05] });
    return {
      root,
      update: ({ dt, time }) => {
        cell.position.y = 0.75 + Math.sin(time * 3 + root.position.z) * 0.08;
        cell.rotation.y += dt * 2.4;
      },
    };
  },
};
