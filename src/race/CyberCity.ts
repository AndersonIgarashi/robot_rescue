import {
  BoxGeometry,
  BufferAttribute,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tweener } from '../core/Tweener';
import { RACE_LAYOUT } from '../data/raceLayout';
import { CITY_COLORS } from '../data/theme';
import { Easing } from '../utils/easing';
import { TAU, clamp01, createRandom, hashString, lerp } from '../utils/math';
import {
  createBeamMaterial,
  createBuildingMaterial,
  createGridMaterial,
  createHologramMaterial,
  createSignMaterial,
  createSkyMaterial,
} from './cityShaders';
import { SIGN_CELLS, createHologramTexture, createSignAtlas, whenFontReady, type SignCell } from './cityTextures';

/** The ground (and the neon grid) sits far below the elevated highway. */
export const GROUND_Y = -9;
const SKY_RADIUS = 420;
const HOLOGRAM = { width: 92, y: 19, z: -250 } as const;

interface Tower {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  side: number;
  /** 0-2 outskirts rows (0 = by the road), 3 downtown, 4 landmarks, 5 far skyline. */
  row: number;
  /** When it rises out of the ground (in `uRise` units). */
  delay: number;
}

interface Drone {
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  rz: number;
  speed: number;
  phase: number;
  scale: number;
  led: Color;
}

interface TrafficLane {
  x: number;
  y: number;
  /** -1 flies away from the camera (tail lights), +1 towards it (head lights). */
  dir: number;
  speed: number;
}

const TRAFFIC_LANES: readonly TrafficLane[] = [
  { x: -15, y: 13, dir: -1, speed: 22 },
  { x: -21, y: 19, dir: 1, speed: 27 },
  { x: 17, y: 16, dir: -1, speed: 25 },
  { x: 24, y: 23, dir: 1, speed: 30 },
  { x: -38, y: 31, dir: -1, speed: 26 },
  { x: 42, y: 29, dir: 1, speed: 24 },
];
const CARS_PER_LANE = 8;
const TRAFFIC_NEAR = -55;
const TRAFFIC_FAR = -330;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/** How far a building (and its signs) sinks below the ground before rising. */
const riseDrop = (tower: Tower): number => tower.h + 2;

const matrix = new Matrix4();
const quaternion = new Quaternion();
const position = new Vector3();
const scale = new Vector3();
const dummy = new Object3D();
dummy.rotation.order = 'YXZ';

function layoutTowers(rand: () => number): Tower[] {
  const towers: Array<Omit<Tower, 'delay'>> = [];
  const finish = RACE_LAYOUT.finishZ;

  // Outskirts: three rows per side along the highway, growing taller towards downtown.
  const rows = [
    { inner: 9, spread: 4, w: [3.5, 3], d: [4, 4], h: [5, 9], gap: [3, 5] },
    { inner: 19, spread: 8, w: [5, 5], d: [5, 6], h: [9, 16], gap: [2, 4] },
    { inner: 36, spread: 22, w: [7, 8], d: [7, 9], h: [16, 30], gap: [1, 3] },
  ] as const;
  for (const side of [-1, 1]) {
    rows.forEach((row, rowIndex) => {
      let z = -2 - rand() * 8;
      while (z > finish + 4) {
        const growth = smoothstep(-15, finish, z);
        const w = row.w[0] + rand() * row.w[1];
        const d = row.d[0] + rand() * row.d[1];
        const h = (row.h[0] + rand() * row.h[1]) * (1 + growth * 2.2);
        towers.push({ x: side * (row.inner + rand() * row.spread + w / 2), z: z - d / 2, w, d, h, side, row: rowIndex });
        z -= d + row.gap[0] + rand() * row.gap[1];
      }
    });
  }

  // Downtown: dense blocks past the finish gate, tallest along the road.
  for (let z = finish - 8; z > -330; z -= 11 + rand() * 4) {
    for (const side of [-1, 1]) {
      for (let x = 7.5 + rand() * 2; x < 100; x += 10 + rand() * 5) {
        if (rand() < 0.12) continue;
        const w = 5 + rand() * 4;
        const d = 5 + rand() * 5;
        const nearRoad = 1 - smoothstep(8, 70, x);
        const h = 20 + rand() * 26 + nearRoad * (26 + rand() * 46);
        towers.push({ x: side * (x + w / 2), z, w, d, h, side, row: 3 });
      }
    }
  }

  // Landmarks: the spire the road leads to, and a few giants either side.
  towers.push({ x: 0, z: -338, w: 20, d: 16, h: 150, side: 0, row: 4 });
  for (const [x, z, h] of [
    [-26, -200, 120],
    [30, -235, 136],
    [-44, -268, 110],
    [52, -190, 96],
  ] as const) {
    towers.push({ x, z, w: 12, d: 12, h, side: Math.sign(x), row: 4 });
  }

  // Far skyline silhouettes.
  for (let i = 0; i < 44; i++) {
    const x = (rand() * 2 - 1) * 280;
    towers.push({ x, z: -360 - rand() * 130, w: 14 + rand() * 22, d: 14 + rand() * 22, h: 50 + rand() * 140, side: Math.sign(x), row: 5 });
  }
  // The city rises from the start line towards the horizon, following the track as it unrolls.
  return towers.map((tower) => ({ ...tower, delay: clamp01(-tower.z / 420) * 0.72 + rand() * 0.08 }));
}

function coloredGeometry(geometry: BufferGeometry, hex: number): BufferGeometry {
  const c = new Color(hex);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

/** Quadcopter: body, crossed arms and four light rotor discs, merged into one geometry. */
function droneGeometry(): BufferGeometry {
  const parts = [coloredGeometry(new SphereGeometry(0.34, 14, 8).scale(1, 0.42, 1), 0x2d3160)];
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    parts.push(coloredGeometry(new BoxGeometry(1.02, 0.05, 0.07).rotateY(angle), 0x3c4270));
  }
  for (const [x, z] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    parts.push(coloredGeometry(new CylinderGeometry(0.2, 0.2, 0.025, 14).translate(x * 0.36, 0.05, z * 0.36), 0xc9d0ff));
  }
  return mergeGeometries(parts);
}

/**
 * The race backdrop: a synthwave dusk sky, a neon grid far below the
 * highway and a procedurally laid-out cyberpunk city that rises out of the
 * ground when the race set appears. Everything that repeats is instanced,
 * so the whole city costs about a dozen draw calls.
 */
export class CyberCity {
  readonly root = new Group();
  private readonly sky: Mesh;
  private readonly skyMaterial = createSkyMaterial();
  private readonly gridMaterial = createGridMaterial();
  private readonly buildingMaterial = createBuildingMaterial();
  private readonly atlas = createSignAtlas();
  private readonly signMaterial: ShaderMaterial;
  private readonly hologramTexture = createHologramTexture();
  private readonly hologramMaterial: ShaderMaterial;
  private readonly beamMaterial = createBeamMaterial();
  private readonly beams: Mesh[] = [];
  private readonly drones: Drone[] = [];
  private readonly droneBodies: InstancedMesh;
  private readonly droneLeds: InstancedMesh;
  private readonly traffic: InstancedMesh;
  private readonly state = { sky: 0, rise: 0, lights: 0, signs: 0, hologram: 0 };
  private readonly ledColor = new Color();
  private atlasDrawn = false;
  private hologramKey = '';
  private time = 0;

  constructor(private readonly tweener: Tweener) {
    const rand = createRandom(hashString('neon-city'));

    this.sky = new Mesh(new SphereGeometry(SKY_RADIUS, 32, 16), this.skyMaterial);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;

    const ground = new Mesh(new PlaneGeometry(1400, 1400), this.gridMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, GROUND_Y, -250);

    const towers = layoutTowers(rand);
    const buildings = this.buildTowers(towers, rand);

    this.signMaterial = createSignMaterial(this.atlas.texture);
    const signs = new Mesh(this.buildSigns(towers, rand), this.signMaterial);
    signs.frustumCulled = false;

    this.hologramMaterial = createHologramMaterial(this.hologramTexture.texture);
    const hologram = new Mesh(new PlaneGeometry(HOLOGRAM.width, HOLOGRAM.width / 4), this.hologramMaterial);
    hologram.position.set(0, HOLOGRAM.y, HOLOGRAM.z);
    hologram.renderOrder = 5;

    const beamGeometry = new CylinderGeometry(9, 0.8, 200, 20, 1, true).translate(0, 100, 0);
    for (const [x, z] of [
      [-48, -240],
      [40, -272],
      [-8, -352],
    ] as const) {
      const beam = new Mesh(beamGeometry, this.beamMaterial);
      beam.position.set(x, GROUND_Y, z);
      this.beams.push(beam);
    }

    this.droneBodies = new InstancedMesh(droneGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 }), 24);
    this.droneLeds = new InstancedMesh(new SphereGeometry(0.16, 8, 6).scale(1, 0.6, 1).translate(0, -0.14, 0), new MeshBasicMaterial({ toneMapped: false }), 24);
    this.layoutDrones(rand);

    this.traffic = new InstancedMesh(
      new CapsuleGeometry(0.4, 2.2, 3, 8).rotateX(Math.PI / 2),
      new MeshBasicMaterial({ toneMapped: false }),
      TRAFFIC_LANES.length * CARS_PER_LANE,
    );
    const tail = new Color(0xff3f6e);
    const head = new Color(0xc8fbff);
    TRAFFIC_LANES.forEach((lane, l) => {
      for (let c = 0; c < CARS_PER_LANE; c++) this.traffic.setColorAt(l * CARS_PER_LANE + c, lane.dir < 0 ? tail : head);
    });

    for (const mesh of [this.droneBodies, this.droneLeds, this.traffic]) mesh.frustumCulled = false;
    this.root.add(this.sky, ground, buildings, signs, hologram, ...this.beams, this.droneBodies, this.droneLeds, this.traffic);
    this.update(0, position.set(0, 3, 10));
  }

  /** Paints the sign atlas ahead of time (canvas glow is slow) and hands it over for GPU upload. */
  prewarm(upload: (texture: Texture) => void): void {
    whenFontReady(() => {
      this.drawAtlas();
      upload(this.atlas.texture);
    });
  }

  /** Dusk falls, the city rises out of the ground and lights up, then the hologram flickers on. */
  show(racerName: string, energy: Color): void {
    this.drawAtlas();
    const key = `${racerName}:${energy.getHexString()}`;
    if (this.hologramKey !== key) {
      this.hologramTexture.draw(racerName, `#${energy.getHexString(SRGBColorSpace)}`);
      this.hologramKey = key;
    }

    const state = this.state;
    this.tweener.killTweensOf(state);
    Object.assign(state, { sky: 0, rise: 0, lights: 0, signs: 0, hologram: 0 });
    this.tweener.to(state, { sky: 1 }, { duration: 0.7, ease: Easing.outQuad });
    this.tweener.to(state, { rise: 1.35 }, { duration: 2.2, delay: 0.15, ease: Easing.linear });
    this.tweener.to(state, { lights: 1 }, { duration: 1.6, delay: 0.8, ease: Easing.linear });
    this.tweener.to(state, { signs: 1 }, { duration: 1.2, delay: 1.3, ease: Easing.linear });
    this.tweener.to(state, { hologram: 1 }, { duration: 0.9, delay: 1.8, ease: Easing.linear });
  }

  hide(): void {
    this.tweener.killTweensOf(this.state);
    Object.assign(this.state, { sky: 0, rise: 0, lights: 0, signs: 0, hologram: 0 });
  }

  update(dt: number, cameraPosition: Vector3): void {
    this.time += dt;
    const t = this.time;
    const { state } = this;
    this.sky.position.copy(cameraPosition);
    this.skyMaterial.uniforms.uOpacity.value = state.sky;
    this.skyMaterial.uniforms.uTime.value = t;
    this.gridMaterial.uniforms.uTime.value = t;
    const building = this.buildingMaterial.uniforms;
    building.uRise.value = state.rise;
    building.uLights.value = state.lights;
    building.uTime.value = t;
    this.signMaterial.uniforms.uRise.value = state.rise;
    this.signMaterial.uniforms.uOn.value = state.signs;
    this.signMaterial.uniforms.uTime.value = t;
    // Flickers on like a failing tube, then holds.
    const flicker = state.hologram >= 1 || Math.random() < state.hologram ? 1 : 0.15;
    this.hologramMaterial.uniforms.uOpacity.value = state.hologram * flicker;
    this.hologramMaterial.uniforms.uTime.value = t;
    this.beamMaterial.uniforms.uOpacity.value = state.lights;
    this.beams.forEach((beam, i) => {
      beam.rotation.z = Math.sin(t * 0.35 + i * 2.1) * 0.42;
      beam.rotation.x = -0.22 + Math.sin(t * 0.27 + i) * 0.12;
    });
    this.updateDrones(t);
    this.updateTraffic(t);
  }

  private drawAtlas(): void {
    if (this.atlasDrawn) return;
    this.atlas.draw();
    this.atlasDrawn = true;
  }

  private buildTowers(towers: readonly Tower[], rand: () => number): InstancedMesh {
    const geometry = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const count = towers.length;
    const neon = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const rise = new Float32Array(count * 2);
    const neonColors = CITY_COLORS.neon.map((hex) => new Color(hex));
    const mesh = new InstancedMesh(geometry, this.buildingMaterial, count);
    towers.forEach((tower, i) => {
      matrix.compose(position.set(tower.x, GROUND_Y, tower.z), quaternion, scale.set(tower.w, tower.h, tower.d));
      mesh.setMatrixAt(i, matrix);
      const c = neonColors[Math.floor(rand() * neonColors.length)];
      neon.set([c.r, c.g, c.b], i * 3);
      seed[i] = rand();
      rise.set([tower.delay, riseDrop(tower)], i * 2);
    });
    geometry.setAttribute('aNeon', new InstancedBufferAttribute(neon, 3));
    geometry.setAttribute('aSeed', new InstancedBufferAttribute(seed, 1));
    geometry.setAttribute('aRise', new InstancedBufferAttribute(rise, 2));
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Blade signs off the roadside facades and billboards on downtown fronts, merged into one mesh. */
  private buildSigns(towers: readonly Tower[], rand: () => number): BufferGeometry {
    const parts: BufferGeometry[] = [];
    let horizontal = 0;
    let vertical = 0;
    const add = (tower: Tower, cell: SignCell, x: number, y: number, z: number, w: number, h: number): void => {
      const plane = new PlaneGeometry(w, h);
      const uv = plane.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(cell.u0, cell.u1, uv.getX(i)), lerp(cell.v0, cell.v1, uv.getY(i)));
      plane.translate(x, y, z);
      plane.setAttribute('aSeed', new BufferAttribute(new Float32Array(uv.count).fill(rand()), 1));
      // Signs ride up with their building.
      const rise = new Float32Array(uv.count * 2);
      for (let i = 0; i < uv.count; i++) rise.set([tower.delay, riseDrop(tower)], i * 2);
      plane.setAttribute('aRise', new BufferAttribute(rise, 2));
      parts.push(plane);
    };
    for (const tower of towers) {
      const top = GROUND_Y + tower.h;
      const front = tower.z + tower.d / 2;
      if (tower.row === 0 && tower.h > 7 && rand() < 0.6) {
        const w = 1.7;
        const h = 4.6;
        const innerFace = tower.x - tower.side * (tower.w / 2);
        add(tower, SIGN_CELLS.vertical[vertical++ % SIGN_CELLS.vertical.length], innerFace - tower.side * (w / 2 + 0.1), top - h / 2 - 0.7, front - 0.9, w, h);
      } else if ((tower.row === 3 && Math.abs(tower.x) < 45 && rand() < 0.4) || tower.row === 4) {
        const w = Math.min(tower.w - 1, tower.row === 4 ? 11 : 7.5);
        add(tower, SIGN_CELLS.horizontal[horizontal++ % SIGN_CELLS.horizontal.length], tower.x, top - w / 4 - 2.2, front + 0.06, w, w / 2);
      }
    }
    return mergeGeometries(parts);
  }

  private layoutDrones(rand: () => number): void {
    const leds = [0x3df2ff, 0xff3fd0, 0xff4d5e, 0x7dff5a].map((hex) => new Color(hex));
    // A few close to the highway, hovering over the first stretch of the race...
    // [x, y, z, orbit radius]: the wide orbits sweep across the view.
    const near: ReadonlyArray<readonly [number, number, number, number]> = [
      [-5.5, 6.5, -20, 1],
      [6, 7.5, -27, 4.5],
      [-7.5, 9, -36, 1.5],
      [8.5, 7, -44, 1.2],
      [-4, 10.5, -55, 6],
      [4.5, 11, -68, 2],
    ];
    for (const [cx, cy, cz, radius] of near) {
      this.drones.push({ cx, cy, cz, rx: radius, rz: 1.2 + rand() * 1.5, speed: 0.45 + rand() * 0.35, phase: rand() * TAU, scale: 0.85, led: leds[this.drones.length % leds.length] });
    }
    // ...and swarms circling downtown.
    while (this.drones.length < this.droneBodies.count) {
      this.drones.push({
        cx: (rand() * 2 - 1) * 70,
        cy: 12 + rand() * 38,
        cz: -120 - rand() * 170,
        rx: 6 + rand() * 16,
        rz: 6 + rand() * 16,
        speed: (0.18 + rand() * 0.3) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * TAU,
        scale: 2.8,
        led: leds[this.drones.length % leds.length],
      });
    }
  }

  private updateDrones(t: number): void {
    this.drones.forEach((drone, i) => {
      const a = t * drone.speed + drone.phase;
      dummy.position.set(drone.cx + Math.cos(a) * drone.rx, drone.cy + Math.sin(t * 1.9 + drone.phase) * 0.35, drone.cz + Math.sin(a) * drone.rz);
      const vx = -Math.sin(a) * drone.rx * drone.speed;
      const vz = Math.cos(a) * drone.rz * drone.speed;
      dummy.rotation.set(0.2, Math.atan2(vx, vz), Math.sin(t * 2.3 + i) * 0.06);
      dummy.scale.setScalar(drone.scale);
      dummy.updateMatrix();
      this.droneBodies.setMatrixAt(i, dummy.matrix);
      this.droneLeds.setMatrixAt(i, dummy.matrix);
      const blink = (t * 1.4 + drone.phase) % 1 < 0.18 ? 1.4 : 0.7;
      this.droneLeds.setColorAt(i, this.ledColor.copy(drone.led).multiplyScalar(blink));
    });
    this.droneBodies.instanceMatrix.needsUpdate = true;
    this.droneLeds.instanceMatrix.needsUpdate = true;
    if (this.droneLeds.instanceColor) this.droneLeds.instanceColor.needsUpdate = true;
  }

  /** Flying traffic: streams of light shuttling between the outskirts and downtown. */
  private updateTraffic(t: number): void {
    const length = TRAFFIC_NEAR - TRAFFIC_FAR;
    TRAFFIC_LANES.forEach((lane, l) => {
      for (let c = 0; c < CARS_PER_LANE; c++) {
        const s = (((c / CARS_PER_LANE) * length + t * lane.speed + l * 37) % length + length) % length;
        const z = lane.dir < 0 ? TRAFFIC_NEAR - s : TRAFFIC_FAR + s;
        const fade = smoothstep(0, 14, s) * smoothstep(0, 14, length - s);
        matrix.compose(position.set(lane.x, lane.y + Math.sin(t + c) * 0.3, z), quaternion, scale.setScalar(1.5 * fade + 0.001));
        this.traffic.setMatrixAt(l * CARS_PER_LANE + c, matrix);
      }
    });
    this.traffic.instanceMatrix.needsUpdate = true;
  }
}
