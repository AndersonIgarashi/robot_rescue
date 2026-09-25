import {
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from 'three';
import type { GeometryLibrary } from '../character/GeometryLibrary';
import { HALF_PI, addGroup, addMesh } from '../character/parts/kit';
import type { Tweener } from '../core/Tweener';
import { RACE_LAYOUT } from '../data/raceLayout';
import { CITY_COLORS, STAGE_COLORS } from '../data/theme';
import type { PowerDef } from '../data/types';
import type { FXManager } from '../fx/FXManager';
import { Easing } from '../utils/easing';
import { CyberCity, GROUND_Y } from './CyberCity';
import { HAZARD_FACTORIES, PICKUP_FACTORIES, type PropKit, type RaceProp } from './props';
import type { LightsState, PickupKind } from './types';

const ROAD_WIDTH = RACE_LAYOUT.roadWidth;
const START_Z = RACE_LAYOUT.roadStartZ;
const ROAD_LENGTH = START_Z - RACE_LAYOUT.roadEndZ;
const RAIL_X = ROAD_WIDTH / 2 + 0.2;
/** One road texture tile covers this many units of track. */
const TILE_LENGTH = 4;
/** Trackside start-light tree: left of the road, a few metres past the start line. */
const LIGHT_TREE = { x: -(RAIL_X + 0.6), z: -10 } as const;
/** Keep lamp posts out of the bullet-time side shot, which looks across this stretch. */
const FREEZE_SIGHTLINE = { minZ: -26, maxZ: -7 } as const;
const PROP_SCALE = RACE_LAYOUT.propScale;
const LIGHT_OFF = new Color(0x2a2f55);
const LIGHT_RED = new Color(0xff3b4e);
const LIGHT_AMBER = new Color(0xffb020);
const LIGHT_GREEN = new Color(0x3dff7a);

const matrix = new Matrix4();
const identity = new Quaternion();
const position = new Vector3();
const scale = new Vector3();

interface PickupSlot {
  prop: RaceProp;
  kind: PickupKind;
  lane: number;
  z: number;
  collected: boolean;
}

interface PropSet {
  root: Group;
  hazards: RaceProp[];
  pickups: PickupSlot[];
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Repeats the tile along the whole highway. */
function alongRoad(texture: CanvasTexture): CanvasTexture {
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, ROAD_LENGTH / TILE_LENGTH);
  texture.anisotropy = 8;
  return texture;
}

/** Road tile: dark asphalt with speed bands (lit by the scene). */
function roadTexture(): CanvasTexture {
  return alongRoad(
    canvasTexture(64, 128, (ctx) => {
      ctx.fillStyle = CITY_COLORS.road;
      ctx.fillRect(0, 0, 64, 128);
      ctx.fillStyle = CITY_COLORS.roadBand;
      ctx.fillRect(0, 64, 64, 64);
    }),
  );
}

/** Neon markings on black, used as the road's emissive map: dashed lane dividers and edge lines. */
function markingTexture(): CanvasTexture {
  return alongRoad(
    canvasTexture(256, 128, (ctx) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = CITY_COLORS.laneLine;
      for (const u of [1 / 3, 2 / 3]) ctx.fillRect(u * 256 - 3, 18, 6, 56);
      ctx.fillStyle = CITY_COLORS.edgeLine;
      ctx.fillRect(3, 0, 6, 128);
      ctx.fillRect(247, 0, 6, 128);
    }),
  );
}

function checkerTexture(columns: number, rows: number): CanvasTexture {
  const size = 16;
  return canvasTexture(columns * size, rows * size, (ctx) => {
    for (let x = 0; x < columns; x++) {
      for (let y = 0; y < rows; y++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#1d1646' : '#ffffff';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
  });
}

/**
 * The race teaser set: an elevated 3-lane highway that unrolls from the
 * start line to a neon city on the horizon, themed hazards and pickups taken
 * from the chosen power, a start-light tree and a finish gate at the city limits.
 */
export class RaceTrack {
  readonly root = new Group();
  private readonly road = new Group();
  private readonly city: CyberCity;
  private readonly lightTree: Group;
  private readonly lights: MeshBasicMaterial[] = [];
  private readonly railGlow = new MeshBasicMaterial({ toneMapped: false });
  private readonly kit: PropKit;
  private readonly sets = new Map<string, PropSet>();
  private active: PropSet | null = null;
  private lightsState: LightsState = 'off';
  private time = 0;

  constructor(
    private readonly geo: GeometryLibrary,
    private readonly tweener: Tweener,
  ) {
    const candies = new Map<number, MeshStandardMaterial>();
    const glows = new Map<number, MeshBasicMaterial>();
    this.kit = {
      geo,
      candy: (color) => {
        let material = candies.get(color);
        if (!material) {
          material = new MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.18 });
          candies.set(color, material);
        }
        return material;
      },
      glow: (color) => {
        let material = glows.get(color);
        if (!material) {
          material = new MeshBasicMaterial({ color, toneMapped: false });
          glows.set(color, material);
        }
        return material;
      },
      dark: new MeshStandardMaterial({ color: 0x2c3252, roughness: 0.5, metalness: 0.3 }),
      water: new MeshStandardMaterial({
        color: 0x4fc3ff,
        emissive: 0x1a8cff,
        emissiveIntensity: 0.35,
        roughness: 0.08,
        transparent: true,
        opacity: 0.82,
      }),
      foam: new MeshStandardMaterial({ color: 0xd8f6ff, emissive: 0x8fdcff, emissiveIntensity: 0.3, roughness: 0.2 }),
    };

    this.city = new CyberCity(tweener);
    this.root.add(this.city.root);
    this.buildRoad();
    this.buildSupports();
    this.lightTree = this.buildLightTree();
    this.buildFinish();
    this.root.visible = false;
  }

  get lanes(): readonly number[] {
    return RACE_LAYOUT.laneX;
  }

  /**
   * Builds every power's prop set and lets the caller compile their shaders
   * (and upload the city's sign atlas) while hidden, so the race never
   * hitches on first show.
   */
  prewarm(powers: readonly PowerDef[], compile: () => void, upload: (texture: Texture) => void): void {
    this.city.prewarm(upload);
    for (const power of powers) this.prepare(power);
    const wasVisible = this.root.visible;
    this.root.visible = true;
    for (const set of this.sets.values()) this.root.add(set.root);
    compile();
    for (const set of this.sets.values()) if (set !== this.active) set.root.removeFromParent();
    this.root.visible = wasVisible;
  }

  /** Spawns (or reuses) the hazards/pickups for a power. */
  prepare(power: PowerDef): void {
    const key = `${power.hazard.kind}:${power.pickup.kind}`;
    let set = this.sets.get(key);
    if (!set) {
      set = this.buildProps(power.hazard.kind, power.pickup.kind);
      this.sets.set(key, set);
    }
    if (this.active && this.active !== set) this.active.root.removeFromParent();
    this.active = set;
    this.root.add(set.root);
    for (const slot of set.pickups) {
      slot.collected = false;
      slot.prop.root.visible = true;
      slot.prop.root.scale.setScalar(PROP_SCALE);
    }
  }

  /** The highway rolls out to the horizon, the city rises, the light tree drops in and props pop up by distance. */
  show(racerName: string, energy: Color): void {
    this.root.visible = true;
    this.road.scale.z = 0.001;
    this.tweener.to(this.road.scale, { z: 1 }, { duration: 1.1, ease: Easing.outCubic });
    this.lightTree.position.y = 5;
    this.tweener.to(this.lightTree.position, { y: 0 }, { duration: 0.6, delay: 0.35, ease: Easing.outBack });
    const props = [...(this.active?.hazards ?? []), ...(this.active?.pickups.map((slot) => slot.prop) ?? [])];
    for (const prop of props) {
      const s = prop.root.scale;
      s.setScalar(0.001);
      const delay = 0.3 + Math.min(1, -prop.root.position.z / 45) * 0.6;
      this.tweener.to(s, { x: PROP_SCALE, y: PROP_SCALE, z: PROP_SCALE }, { duration: 0.45, delay, ease: Easing.outBackStrong });
    }
    this.city.show(racerName, energy);
    this.setLights('ready');
  }

  hide(): void {
    this.root.visible = false;
    this.city.hide();
    this.setLights('off');
  }

  setLights(state: LightsState): void {
    this.lightsState = state;
    this.applyLights();
  }

  /** Collects a pickup within reach of the runner; returns its kind for feedback. */
  collectNear(x: number, z: number, reach = 0.6): PickupKind | null {
    if (!this.active) return null;
    for (const slot of this.active.pickups) {
      if (slot.collected || Math.abs(slot.z - z) > reach || Math.abs(this.lanes[slot.lane] - x) > reach) continue;
      slot.collected = true;
      const s = slot.prop.root.scale;
      const pop = PROP_SCALE * 1.8;
      this.tweener.to(s, { x: pop, y: pop, z: pop }, {
        duration: 0.12,
        ease: Easing.outQuad,
        onComplete: () => {
          this.tweener.to(s, { x: 0.001, y: 0.001, z: 0.001 }, {
            duration: 0.14,
            onComplete: () => (slot.prop.root.visible = false),
          });
        },
      });
      return slot.kind;
    }
    return null;
  }

  update(dt: number, fx: FXManager, energy: Color, cameraPosition: Vector3): void {
    if (!this.root.visible) return;
    this.time += dt;
    this.railGlow.color.copy(energy);
    if (this.lightsState === 'ready') this.applyLights();
    const ctx = { dt, time: this.time, fx };
    if (this.active) {
      for (const hazard of this.active.hazards) hazard.update(ctx);
      for (const slot of this.active.pickups) if (slot.prop.root.visible) slot.prop.update(ctx);
    }
    this.city.update(dt, cameraPosition);
  }

  private applyLights(): void {
    const state = this.lightsState;
    const blink = 0.55 + Math.sin(this.time * 6) * 0.45;
    this.lights.forEach((material, i) => {
      if (state === 'off') material.color.copy(LIGHT_OFF);
      else if (state === 'ready') material.color.copy(LIGHT_OFF).lerp(LIGHT_AMBER, blink);
      else if (state === 'go') material.color.copy(LIGHT_GREEN);
      else material.color.copy(i < 4 - state ? LIGHT_RED : LIGHT_OFF);
    });
  }

  /** The deck: a thick slab, neon-marked asphalt, and side rails with an energy-coloured strip. */
  private buildRoad(): void {
    const { geo } = this;
    this.road.position.z = START_Z;
    this.root.add(this.road);
    const centerZ = -ROAD_LENGTH / 2;
    const slab = new MeshStandardMaterial({ color: CITY_COLORS.roadSide, roughness: 0.5 });
    const rail = new MeshStandardMaterial({ color: CITY_COLORS.rail, roughness: 0.45, metalness: 0.2 });

    addMesh(this.road, geo.roundedBox(ROAD_WIDTH + 0.9, 0.5, ROAD_LENGTH, 0.14), slab, { p: [0, -0.26, centerZ] });
    const top = new Mesh(
      new PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH),
      new MeshStandardMaterial({ map: roadTexture(), emissive: 0xffffff, emissiveMap: markingTexture(), roughness: 0.55, metalness: 0.1 }),
    );
    top.rotation.x = -HALF_PI;
    top.position.set(0, 0.002, centerZ);
    this.road.add(top);

    for (const side of [-1, 1]) {
      addMesh(this.road, geo.roundedBox(0.34, 0.46, ROAD_LENGTH, 0.1), rail, { p: [side * RAIL_X, 0.06, centerZ] });
      addMesh(this.road, geo.roundedBox(0.08, 0.05, ROAD_LENGTH, 0.02), this.railGlow, { p: [side * RAIL_X, 0.3, centerZ] });
    }

    const start = new Mesh(new PlaneGeometry(ROAD_WIDTH, 0.5), new MeshBasicMaterial({ map: checkerTexture(24, 2) }));
    start.rotation.x = -HALF_PI;
    start.position.set(0, 0.004, 0.75 - START_Z);
    this.road.add(start);
  }

  /** Pillars down to the neon grid, and glowing bollard lamps along both rails. */
  private buildSupports(): void {
    const { geo } = this;
    const pillarMaterial = new MeshStandardMaterial({ color: CITY_COLORS.pillar, roughness: 0.6 });
    const spacing = 16;
    const rows = Math.floor(ROAD_LENGTH / spacing);
    const pillars = new InstancedMesh(geo.cylinder(1, 12), pillarMaterial, rows * 2);
    const height = -0.5 - GROUND_Y;
    for (let i = 0; i < rows; i++) {
      for (const [n, side] of [-1, 1].entries()) {
        matrix.compose(position.set(side * 1.7, GROUND_Y + height / 2, -4 - i * spacing - START_Z), identity, scale.set(0.55, height, 0.55));
        pillars.setMatrixAt(i * 2 + n, matrix);
      }
    }

    const lamps: Array<[number, number]> = [];
    for (let z = -6; z > RACE_LAYOUT.roadEndZ + 10; z -= 12) {
      for (const side of [-1, 1]) {
        if (side > 0 && z > FREEZE_SIGHTLINE.minZ && z < FREEZE_SIGHTLINE.maxZ) continue;
        lamps.push([side, z]);
      }
    }
    const poles = new InstancedMesh(geo.cylinder(1, 8), new MeshStandardMaterial({ color: CITY_COLORS.rail, roughness: 0.4 }), lamps.length);
    const heads = new InstancedMesh(geo.capsule(0.5, 1), new MeshBasicMaterial({ toneMapped: false }), lamps.length);
    const neon = [new Color(CITY_COLORS.neon[0]), new Color(CITY_COLORS.neon[1])];
    lamps.forEach(([side, z], i) => {
      const x = side * (RAIL_X + 0.05);
      matrix.compose(position.set(x, 1.45, z - START_Z), identity, scale.set(0.07, 2.4, 0.07));
      poles.setMatrixAt(i, matrix);
      matrix.compose(position.set(x, 2.8, z - START_Z), identity, scale.set(0.2, 0.2, 0.2));
      heads.setMatrixAt(i, matrix);
      heads.setColorAt(i, neon[i % 2]);
    });
    for (const mesh of [pillars, poles, heads]) {
      mesh.frustumCulled = false;
      this.road.add(mesh);
    }
  }

  private buildLightTree(): Group {
    const { geo } = this;
    const frame = new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTrim, roughness: 0.45 });
    const holder = addGroup(this.root, [LIGHT_TREE.x, 0, LIGHT_TREE.z]);
    const tree = addGroup(holder);
    addMesh(tree, geo.cylinder(), frame, { p: [0, 1.4, 0], s: [0.09, 2.8, 0.09] });
    addMesh(tree, geo.roundedBox(0.66, 1.8, 0.4, 0.14), this.kit.dark, { p: [0, 3.3, 0] });
    addMesh(tree, geo.roundedBox(0.76, 0.12, 0.5, 0.05), frame, { p: [0, 4.24, 0] });
    for (let i = 0; i < 3; i++) {
      const y = 3.83 - i * 0.53;
      const material = new MeshBasicMaterial({ color: LIGHT_OFF, toneMapped: false });
      this.lights.push(material);
      addMesh(tree, geo.cylinder(), material, { p: [0, y, 0.21], r: [HALF_PI, 0, 0], s: [0.2, 0.05, 0.2] });
    }
    return tree;
  }

  /** Neon finish gate at the city limits. */
  private buildFinish(): void {
    const { geo } = this;
    const frame = new MeshStandardMaterial({ color: CITY_COLORS.rail, roughness: 0.45 });
    const halfSpan = RAIL_X + 0.5;
    const arch = addGroup(this.road, [0, 0, RACE_LAYOUT.finishZ - START_Z]);
    for (const side of [-1, 1]) {
      addMesh(arch, geo.roundedBox(0.6, 7, 0.6, 0.15), frame, { p: [side * halfSpan, 3.5, 0] });
      addMesh(arch, geo.roundedBox(0.14, 6.6, 0.14, 0.04), this.railGlow, { p: [side * halfSpan, 3.5, 0.32] });
    }
    addMesh(arch, geo.roundedBox(halfSpan * 2 + 0.6, 1.5, 0.5, 0.15), frame, { p: [0, 6.9, 0] });
    const banner = new Mesh(new PlaneGeometry(halfSpan * 2 - 0.4, 1.1), new MeshBasicMaterial({ map: checkerTexture(20, 2) }));
    banner.position.set(0, 6.9, 0.26);
    arch.add(banner);
  }

  private buildProps(hazard: keyof typeof HAZARD_FACTORIES, pickup: PickupKind): PropSet {
    const root = new Group();
    const place = (prop: RaceProp, lane: number, z: number): RaceProp => {
      prop.root.position.set(this.lanes[lane], 0, z);
      prop.root.scale.setScalar(PROP_SCALE);
      root.add(prop.root);
      return prop;
    };
    const hazards = RACE_LAYOUT.hazards.map(({ lane, z }) => place(HAZARD_FACTORIES[hazard](this.kit), lane, z));
    const pickups = RACE_LAYOUT.pickups.map(({ lane, z }) => ({
      prop: place(PICKUP_FACTORIES[pickup](this.kit), lane, z),
      kind: pickup,
      lane,
      z,
      collected: false,
    }));
    return { root, hazards, pickups };
  }
}
