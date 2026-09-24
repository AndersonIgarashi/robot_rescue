import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  NormalBlending,
  Points,
  ShaderMaterial,
  Sphere,
  Vector3,
} from 'three';

/** Procedural sprite shapes, drawn in the fragment shader (no textures). */
export const ParticleShape = {
  Glow: 0,
  Disc: 1,
  Confetti: 2,
  Sparkle: 3,
  Snow: 4,
  Ring: 5,
  Blob: 6,
} as const;

export type ParticleShapeId = (typeof ParticleShape)[keyof typeof ParticleShape];

export type ParticleBlend = 'additive' | 'alpha';

/** Mutable spawn descriptor. Callers reuse a single instance, so spawning never allocates. */
export class ParticleSpawn {
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  r = 1;
  g = 1;
  b = 1;
  size = 0.1;
  sizeEnd = 0;
  life = 1;
  /** Vertical acceleration (negative falls, positive rises). */
  gravity = 0;
  /** Exponential velocity damping per second. */
  drag = 0;
  alpha = 1;
  shape: ParticleShapeId = ParticleShape.Glow;
  rotation = 0;
  spin = 0;
  /** Horizontal sway amplitude (snow, confetti). */
  wobble = 0;
}

const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aRot;
  attribute float aShape;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  varying float vShape;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vRot = aRot;
    vShape = aShape;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * uScale / max(-mvPosition.z, 0.1);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRot;
  varying float vShape;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vRot);
    float s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float d = length(p);
    float a;

    if (vShape < 0.5) {
      // Soft glow.
      a = 1.0 - smoothstep(0.0, 1.0, d);
      a *= a;
    } else if (vShape < 1.5) {
      // Solid disc with an anti-aliased edge.
      a = 1.0 - smoothstep(0.8, 1.0, d);
    } else if (vShape < 2.5) {
      // Confetti ribbon.
      vec2 q = abs(p);
      a = (1.0 - smoothstep(0.8, 0.95, q.x)) * (1.0 - smoothstep(0.34, 0.46, q.y));
    } else if (vShape < 3.5) {
      // Four-point sparkle with a hot core.
      vec2 q = abs(p);
      a = 1.0 - smoothstep(0.5, 1.0, sqrt(q.x) + sqrt(q.y));
      a = max(a, (1.0 - smoothstep(0.0, 0.4, d)) * 0.85);
    } else if (vShape < 4.5) {
      // Six-spoke snowflake.
      float angle = atan(p.y, p.x);
      float sector = mod(angle + 0.5236, 1.0472) - 0.5236;
      float spoke = 1.0 - smoothstep(0.07, 0.15, d * abs(sin(sector)));
      a = max(spoke * (1.0 - smoothstep(0.82, 1.0, d)), 1.0 - smoothstep(0.18, 0.3, d));
    } else if (vShape < 5.5) {
      // Thin ring.
      a = 1.0 - smoothstep(0.06, 0.18, abs(d - 0.78));
    } else {
      // Soft cartoon blob (flames, puffs): solid core, feathered edge.
      a = 1.0 - smoothstep(0.35, 1.0, d);
    }

    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, vAlpha * a);
    #include <colorspace_fragment>
  }
`;

/**
 * Pooled GPU point-sprite particles: one draw call per system, fixed-size
 * typed arrays (struct-of-arrays), swap-remove on death, zero per-frame allocations.
 */
export class ParticleSystem {
  readonly points: Points<BufferGeometry, ShaderMaterial>;

  private count = 0;
  private readonly position: Float32Array;
  private readonly color: Float32Array;
  private readonly sizeAttr: Float32Array;
  private readonly alphaAttr: Float32Array;
  private readonly rotation: Float32Array;
  private readonly shape: Float32Array;

  private readonly velocity: Float32Array;
  private readonly life: Float32Array;
  private readonly maxLife: Float32Array;
  private readonly size0: Float32Array;
  private readonly size1: Float32Array;
  private readonly alpha0: Float32Array;
  private readonly gravity: Float32Array;
  private readonly drag: Float32Array;
  private readonly spin: Float32Array;
  private readonly wobble: Float32Array;

  private readonly attributes: BufferAttribute[];

  constructor(
    private readonly capacity: number,
    blend: ParticleBlend,
  ) {
    this.position = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.sizeAttr = new Float32Array(capacity);
    this.alphaAttr = new Float32Array(capacity);
    this.rotation = new Float32Array(capacity);
    this.shape = new Float32Array(capacity);

    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.alpha0 = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.wobble = new Float32Array(capacity);

    const geometry = new BufferGeometry();
    const make = (name: string, array: Float32Array, itemSize: number): BufferAttribute => {
      const attribute = new BufferAttribute(array, itemSize).setUsage(DynamicDrawUsage);
      geometry.setAttribute(name, attribute);
      return attribute;
    };
    this.attributes = [
      make('position', this.position, 3),
      make('aColor', this.color, 3),
      make('aSize', this.sizeAttr, 1),
      make('aAlpha', this.alphaAttr, 1),
      make('aRot', this.rotation, 1),
      make('aShape', this.shape, 1),
    ];
    geometry.setDrawRange(0, 0);
    // Particles live around the stage; a fixed bound avoids per-frame bounding recomputation.
    geometry.boundingSphere = new Sphere(new Vector3(0, 1.5, 0), 12);

    const material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: { uScale: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: blend === 'additive' ? AdditiveBlending : NormalBlending,
    });

    this.points = new Points(geometry, material);
    this.points.renderOrder = blend === 'additive' ? 3 : 2;
  }

  get alive(): number {
    return this.count;
  }

  /** Pixels per world unit at distance 1: (buffer height / 2) / tan(fov / 2). */
  setPointScale(scale: number): void {
    this.points.material.uniforms.uScale.value = scale;
  }

  spawn(p: ParticleSpawn): boolean {
    if (this.count >= this.capacity) return false;
    const i = this.count++;
    const i3 = i * 3;
    this.position[i3] = p.x;
    this.position[i3 + 1] = p.y;
    this.position[i3 + 2] = p.z;
    this.velocity[i3] = p.vx;
    this.velocity[i3 + 1] = p.vy;
    this.velocity[i3 + 2] = p.vz;
    this.color[i3] = p.r;
    this.color[i3 + 1] = p.g;
    this.color[i3 + 2] = p.b;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.size0[i] = p.size;
    this.size1[i] = p.sizeEnd;
    this.sizeAttr[i] = p.size;
    this.alpha0[i] = p.alpha;
    this.alphaAttr[i] = 0;
    this.gravity[i] = p.gravity;
    this.drag[i] = p.drag;
    this.rotation[i] = p.rotation;
    this.spin[i] = p.spin;
    this.wobble[i] = p.wobble;
    this.shape[i] = p.shape;
    return true;
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const life = this.life[i] - dt;
      if (life <= 0) {
        this.removeAt(i);
        continue;
      }
      this.life[i] = life;

      const i3 = i * 3;
      const damping = Math.exp(-this.drag[i] * dt);
      let vx = this.velocity[i3] * damping;
      let vy = (this.velocity[i3 + 1] + this.gravity[i] * dt) * damping;
      let vz = this.velocity[i3 + 2] * damping;
      this.velocity[i3] = vx;
      this.velocity[i3 + 1] = vy;
      this.velocity[i3 + 2] = vz;

      const t = 1 - life / this.maxLife[i];
      const wobble = this.wobble[i];
      if (wobble !== 0) {
        vx += Math.cos(t * 9 + this.spin[i]) * wobble;
        vz += Math.sin(t * 7 + this.spin[i]) * wobble * 0.5;
      }

      this.position[i3] += vx * dt;
      this.position[i3 + 1] += vy * dt;
      this.position[i3 + 2] += vz * dt;
      this.rotation[i] += this.spin[i] * dt;

      this.sizeAttr[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      const fadeIn = Math.min(1, t * 10);
      this.alphaAttr[i] = this.alpha0[i] * fadeIn * (1 - t * t * t);
      i++;
    }

    this.points.geometry.setDrawRange(0, this.count);
    for (const attribute of this.attributes) {
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, this.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }

  clear(): void {
    this.count = 0;
    this.points.geometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }

  private removeAt(i: number): void {
    const last = --this.count;
    if (i === last) return;
    const i3 = i * 3;
    const l3 = last * 3;
    for (let k = 0; k < 3; k++) {
      this.position[i3 + k] = this.position[l3 + k];
      this.velocity[i3 + k] = this.velocity[l3 + k];
      this.color[i3 + k] = this.color[l3 + k];
    }
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.size0[i] = this.size0[last];
    this.size1[i] = this.size1[last];
    this.sizeAttr[i] = this.sizeAttr[last];
    this.alpha0[i] = this.alpha0[last];
    this.alphaAttr[i] = this.alphaAttr[last];
    this.gravity[i] = this.gravity[last];
    this.drag[i] = this.drag[last];
    this.rotation[i] = this.rotation[last];
    this.spin[i] = this.spin[last];
    this.wobble[i] = this.wobble[last];
    this.shape[i] = this.shape[last];
  }
}
