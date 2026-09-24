import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import type { GeometryLibrary } from '../character/GeometryLibrary';
import { HALF_PI, addGroup, addMesh } from '../character/parts/kit';
import type { Tweener } from '../core/Tweener';
import { RACE_LAYOUT } from '../data/raceLayout';
import { STAGE_COLORS } from '../data/theme';
import type { PowerDef } from '../data/types';
import type { FXManager } from '../fx/FXManager';
import { Easing } from '../utils/easing';
import { HAZARD_FACTORIES, PICKUP_FACTORIES, type PropKit, type RaceProp } from './props';
import type { LightsState, PickupKind } from './types';

const TRACK_WIDTH = 3.3;
const START_Z = 1.6;
/** Trackside start-light tree: left of the start line, facing the camera. */
const LIGHT_TREE = { x: -2.15, z: -3.4 } as const;
const LIGHT_OFF = new Color(0x2a2f55);
const LIGHT_RED = new Color(0xff3b4e);
const LIGHT_AMBER = new Color(0xffb020);
const LIGHT_GREEN = new Color(0x3dff7a);

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

/** One tile of road: speed bands, dashed lane dividers and edge lines. Repeated along the track. */
function roadTexture(): CanvasTexture {
  const texture = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#eef0ff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#e3e7ff';
    ctx.fillRect(0, 64, 128, 64);
    ctx.fillStyle = '#b8bfff';
    for (const u of [1 / 3, 2 / 3]) ctx.fillRect(u * 128 - 2.5, 14, 5, 40);
    ctx.fillStyle = '#9aa3ff';
    ctx.fillRect(2, 0, 4, 128);
    ctx.fillRect(122, 0, 4, 128);
  });
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1, RACE_LAYOUT.trackLength / 2);
  texture.anisotropy = 4;
  return texture;
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
 * The race teaser set: a floating 3-lane track that unrolls behind the
 * character, themed hazards and pickups taken from the chosen power, a
 * start gantry with countdown lights and a finish arch.
 */
export class RaceTrack {
  readonly root = new Group();
  private readonly road = new Group();
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

    this.buildRoad();
    this.lightTree = this.buildLightTree();
    this.buildFinish();
    this.root.visible = false;
  }

  get lanes(): readonly number[] {
    return RACE_LAYOUT.laneX;
  }

  /**
   * Builds every power's prop set and lets the caller compile their shaders
   * while hidden, so the race never hitches on first show.
   */
  prewarm(powers: readonly PowerDef[], compile: () => void): void {
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
      slot.prop.root.scale.setScalar(1);
    }
  }

  /** The track rolls out from the start line, the gantry drops in and props pop up by distance. */
  show(): void {
    this.root.visible = true;
    this.road.scale.z = 0.001;
    this.tweener.to(this.road.scale, { z: 1 }, { duration: 0.75, ease: Easing.outCubic });
    this.lightTree.position.y = 4;
    this.tweener.to(this.lightTree.position, { y: 0 }, { duration: 0.6, delay: 0.35, ease: Easing.outBack });
    const props = [...(this.active?.hazards ?? []), ...(this.active?.pickups.map((slot) => slot.prop) ?? [])];
    for (const prop of props) {
      const scale = prop.root.scale;
      scale.setScalar(0.001);
      const delay = 0.3 + (-prop.root.position.z / RACE_LAYOUT.trackLength) * 0.7;
      this.tweener.to(scale, { x: 1, y: 1, z: 1 }, { duration: 0.45, delay, ease: Easing.outBackStrong });
    }
    this.setLights('ready');
  }

  hide(): void {
    this.root.visible = false;
    this.setLights('off');
  }

  setLights(state: LightsState): void {
    this.lightsState = state;
    this.applyLights();
  }

  /** Collects a pickup within reach of the runner; returns its kind for feedback. */
  collectNear(x: number, z: number, reach = 0.55): PickupKind | null {
    if (!this.active) return null;
    for (const slot of this.active.pickups) {
      if (slot.collected || Math.abs(slot.z - z) > reach || Math.abs(this.lanes[slot.lane] - x) > reach) continue;
      slot.collected = true;
      const scale = slot.prop.root.scale;
      this.tweener.to(scale, { x: 1.8, y: 1.8, z: 1.8 }, {
        duration: 0.12,
        ease: Easing.outQuad,
        onComplete: () => {
          this.tweener.to(scale, { x: 0.001, y: 0.001, z: 0.001 }, {
            duration: 0.14,
            onComplete: () => (slot.prop.root.visible = false),
          });
        },
      });
      return slot.kind;
    }
    return null;
  }

  update(dt: number, fx: FXManager, energy: Color): void {
    if (!this.root.visible) return;
    this.time += dt;
    this.railGlow.color.copy(energy);
    if (this.lightsState === 'ready') this.applyLights();
    const ctx = { dt, time: this.time, fx };
    if (this.active) {
      for (const hazard of this.active.hazards) hazard.update(ctx);
      for (const slot of this.active.pickups) if (slot.prop.root.visible) slot.prop.update(ctx);
    }
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

  private buildRoad(): void {
    const { geo } = this;
    const length = RACE_LAYOUT.trackLength;
    this.road.position.z = START_Z;
    this.root.add(this.road);
    const side = new MeshStandardMaterial({ color: STAGE_COLORS.pedestalSide, roughness: 0.45 });
    const trim = new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTrim, roughness: 0.5 });
    const centerZ = -length / 2;

    addMesh(this.road, geo.roundedBox(TRACK_WIDTH + 0.2, 0.34, length, 0.12), side, { p: [0, -0.18, centerZ] });
    const top = new Mesh(new PlaneGeometry(TRACK_WIDTH, length), new MeshStandardMaterial({ map: roadTexture(), roughness: 0.7 }));
    top.rotation.x = -HALF_PI;
    top.position.set(0, 0.002, centerZ);
    this.road.add(top);

    for (const side of [-1, 1]) {
      addMesh(this.road, geo.roundedBox(0.26, 0.42, length, 0.1), trim, { p: [side * 1.78, 0.04, centerZ] });
      addMesh(this.road, geo.roundedBox(0.06, 0.04, length, 0.015), this.railGlow, { p: [side * 1.78, 0.26, centerZ] });
    }

    const start = new Mesh(new PlaneGeometry(TRACK_WIDTH, 0.42), new MeshBasicMaterial({ map: checkerTexture(16, 2) }));
    start.rotation.x = -HALF_PI;
    start.position.set(0, 0.004, 0.75 - START_Z);
    this.road.add(start);
  }

  private buildLightTree(): Group {
    const { geo } = this;
    const frame = new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTrim, roughness: 0.45 });
    const holder = addGroup(this.root, [LIGHT_TREE.x, 0, LIGHT_TREE.z]);
    const tree = addGroup(holder);
    addMesh(tree, geo.cylinder(), frame, { p: [0, 1.1, 0], s: [0.07, 2.2, 0.07] });
    addMesh(tree, geo.roundedBox(0.5, 1.36, 0.32, 0.12), this.kit.dark, { p: [0, 2.55, 0] });
    addMesh(tree, geo.roundedBox(0.58, 0.1, 0.4, 0.04), frame, { p: [0, 3.26, 0] });
    for (let i = 0; i < 3; i++) {
      const y = 2.95 - i * 0.4;
      const material = new MeshBasicMaterial({ color: LIGHT_OFF, toneMapped: false });
      this.lights.push(material);
      addMesh(tree, geo.cylinder(), material, { p: [0, y, 0.17], r: [HALF_PI, 0, 0], s: [0.15, 0.04, 0.15] });
    }
    return tree;
  }

  private buildFinish(): void {
    const { geo } = this;
    const frame = new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTrim, roughness: 0.45 });
    const arch = addGroup(this.road, [0, 0, RACE_LAYOUT.finishZ - START_Z]);
    for (const side of [-1, 1]) addMesh(arch, geo.roundedBox(0.28, 3.2, 0.28, 0.1), frame, { p: [side * 2.02, 1.6, 0] });
    const banner = new Mesh(new PlaneGeometry(4.2, 0.6), new MeshBasicMaterial({ map: checkerTexture(14, 2) }));
    banner.position.set(0, 3.1, 0.15);
    arch.add(banner);
    addMesh(arch, geo.roundedBox(4.4, 0.7, 0.26, 0.12), frame, { p: [0, 3.1, 0] });
  }

  private buildProps(hazard: keyof typeof HAZARD_FACTORIES, pickup: PickupKind): PropSet {
    const root = new Group();
    const place = (prop: RaceProp, lane: number, z: number): RaceProp => {
      prop.root.position.set(this.lanes[lane], 0, z);
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
