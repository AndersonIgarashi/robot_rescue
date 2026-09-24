import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  Sphere,
  Vector3,
} from 'three';

const SEGMENTS = 9;
const MAX_ARCS = 10;
const LAYERS = 2; // wide coloured glow + thin white core
const QUADS = MAX_ARCS * SEGMENTS * LAYERS;
const REJAG_INTERVAL = 0.045;

interface Arc {
  active: boolean;
  from: Vector3;
  to: Vector3;
  points: Vector3[];
  color: Color;
  width: number;
  amplitude: number;
  life: number;
  maxLife: number;
  rejag: number;
}

const tmpDir = new Vector3();
const tmpView = new Vector3();
const tmpSide = new Vector3();
const tmpRand = new Vector3();

/**
 * Camera-facing ribbon lightning. All arcs share one geometry and one draw
 * call; the jagged path is regenerated a few times per second for flicker.
 */
export class LightningArcs {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly arcs: Arc[] = [];
  private readonly positions = new Float32Array(QUADS * 4 * 3);
  private readonly colors = new Float32Array(QUADS * 4 * 3);
  private readonly positionAttr: BufferAttribute;
  private readonly colorAttr: BufferAttribute;

  constructor() {
    const geometry = new BufferGeometry();
    this.positionAttr = new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage);
    this.colorAttr = new BufferAttribute(this.colors, 3).setUsage(DynamicDrawUsage);
    geometry.setAttribute('position', this.positionAttr);
    geometry.setAttribute('color', this.colorAttr);

    const indices = new Uint16Array(QUADS * 6);
    for (let q = 0; q < QUADS; q++) {
      const v = q * 4;
      indices.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], q * 6);
    }
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);
    geometry.boundingSphere = new Sphere(new Vector3(0, 2, 0), 12);

    this.mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.mesh.renderOrder = 4;

    for (let i = 0; i < MAX_ARCS; i++) {
      this.arcs.push({
        active: false,
        from: new Vector3(),
        to: new Vector3(),
        points: Array.from({ length: SEGMENTS + 1 }, () => new Vector3()),
        color: new Color(),
        width: 0.05,
        amplitude: 0.1,
        life: 0,
        maxLife: 1,
        rejag: 0,
      });
    }
  }

  spawn(from: Vector3, to: Vector3, color: Color, life = 0.14, width = 0.06, amplitude?: number): void {
    const arc = this.arcs.find((candidate) => !candidate.active) ?? this.oldest();
    arc.active = true;
    arc.from.copy(from);
    arc.to.copy(to);
    arc.color.copy(color);
    arc.width = width;
    arc.amplitude = amplitude ?? from.distanceTo(to) * 0.16;
    arc.life = life;
    arc.maxLife = life;
    arc.rejag = 0;
    this.jag(arc);
  }

  update(dt: number, cameraPosition: Vector3): void {
    let quad = 0;
    for (const arc of this.arcs) {
      if (!arc.active) continue;
      arc.life -= dt;
      if (arc.life <= 0) {
        arc.active = false;
        continue;
      }
      arc.rejag -= dt;
      if (arc.rejag <= 0) this.jag(arc);

      const fade = Math.min(1, (arc.life / arc.maxLife) * 1.6);
      for (let layer = 0; layer < LAYERS; layer++) {
        const core = layer === 1;
        const width = core ? arc.width * 0.32 : arc.width;
        const intensity = core ? fade : fade * 0.55;
        const r = core ? intensity : arc.color.r * intensity;
        const g = core ? intensity : arc.color.g * intensity;
        const b = core ? intensity : arc.color.b * intensity;
        for (let s = 0; s < SEGMENTS; s++) {
          this.writeQuad(quad++, arc.points[s], arc.points[s + 1], width, cameraPosition, r, g, b);
        }
      }
    }

    this.mesh.geometry.setDrawRange(0, quad * 6);
    const floats = quad * 12;
    for (const attribute of [this.positionAttr, this.colorAttr]) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, floats);
      attribute.needsUpdate = true;
    }
  }

  clear(): void {
    for (const arc of this.arcs) arc.active = false;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  get activeCount(): number {
    return this.arcs.reduce((sum, arc) => sum + (arc.active ? 1 : 0), 0);
  }

  private oldest(): Arc {
    return this.arcs.reduce((a, b) => (a.life < b.life ? a : b));
  }

  private jag(arc: Arc): void {
    arc.rejag = REJAG_INTERVAL;
    tmpDir.subVectors(arc.to, arc.from);
    const length = tmpDir.length() || 1;
    tmpDir.divideScalar(length);
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const point = arc.points[i].lerpVectors(arc.from, arc.to, t);
      if (i === 0 || i === SEGMENTS) continue;
      tmpRand.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
      tmpRand.addScaledVector(tmpDir, -tmpRand.dot(tmpDir));
      point.addScaledVector(tmpRand, arc.amplitude * Math.sin(Math.PI * t));
    }
  }

  private writeQuad(
    quad: number,
    a: Vector3,
    b: Vector3,
    width: number,
    camera: Vector3,
    r: number,
    g: number,
    bl: number,
  ): void {
    tmpDir.subVectors(b, a);
    tmpView.subVectors(camera, a);
    tmpSide.crossVectors(tmpDir, tmpView).normalize().multiplyScalar(width * 0.5);
    const o = quad * 12;
    const p = this.positions;
    p[o] = a.x - tmpSide.x;
    p[o + 1] = a.y - tmpSide.y;
    p[o + 2] = a.z - tmpSide.z;
    p[o + 3] = a.x + tmpSide.x;
    p[o + 4] = a.y + tmpSide.y;
    p[o + 5] = a.z + tmpSide.z;
    p[o + 6] = b.x - tmpSide.x;
    p[o + 7] = b.y - tmpSide.y;
    p[o + 8] = b.z - tmpSide.z;
    p[o + 9] = b.x + tmpSide.x;
    p[o + 10] = b.y + tmpSide.y;
    p[o + 11] = b.z + tmpSide.z;
    for (let v = 0; v < 4; v++) {
      this.colors[o + v * 3] = r;
      this.colors[o + v * 3 + 1] = g;
      this.colors[o + v * 3 + 2] = bl;
    }
  }
}
