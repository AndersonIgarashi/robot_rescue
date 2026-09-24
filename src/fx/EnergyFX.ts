import {
  AdditiveBlending,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from 'three';
import { Easing } from '../utils/easing';

const BEAM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** uMode 0: beam fading upward. uMode 1: thin band peaking in the middle (scanner). */
const BEAM_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uMode;
  varying vec2 vUv;
  void main() {
    float beam = pow(1.0 - vUv.y, 1.6);
    float band = pow(1.0 - abs(vUv.y * 2.0 - 1.0), 2.0);
    float a = mix(beam, band, uMode) * uOpacity;
    gl_FragColor = vec4(uColor, a);
    #include <colorspace_fragment>
  }
`;

interface Ring {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  t: number;
  duration: number;
  maxScale: number;
  active: boolean;
}

interface Pulse {
  mesh: Mesh<CylinderGeometry, ShaderMaterial>;
  t: number;
  duration: number;
  active: boolean;
  fromY: number;
  toY: number;
  radius: number;
}

const makeBeamMaterial = (mode: number): ShaderMaterial =>
  new ShaderMaterial({
    vertexShader: BEAM_VERTEX,
    fragmentShader: BEAM_FRAGMENT,
    uniforms: { uColor: { value: new Color() }, uOpacity: { value: 0 }, uMode: { value: mode } },
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
  });

/** Pooled energy primitives: ground shockwaves, a vertical power beam and a scanner band. */
export class EnergyFX {
  readonly root = new Group();
  private readonly rings: Ring[] = [];
  private readonly beam: Pulse;
  private readonly scanner: Pulse;

  constructor() {
    const ringGeometry = new RingGeometry(0.86, 1, 56);
    ringGeometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const mesh = new Mesh(
        ringGeometry,
        new MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
          side: DoubleSide,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.root.add(mesh);
      this.rings.push({ mesh, t: 0, duration: 0.6, maxScale: 2.5, active: false });
    }

    const cylinder = new CylinderGeometry(1, 1, 1, 28, 1, true);
    cylinder.translate(0, 0.5, 0);
    this.beam = this.makePulse(cylinder, 0);
    this.scanner = this.makePulse(cylinder, 1);
  }

  shockwave(position: Vector3, color: Color, maxScale = 2.6, duration = 0.65): void {
    const ring = this.rings.find((candidate) => !candidate.active) ?? this.rings[0];
    ring.active = true;
    ring.t = 0;
    ring.duration = duration;
    ring.maxScale = maxScale;
    ring.mesh.visible = true;
    ring.mesh.position.copy(position);
    ring.mesh.material.color.copy(color);
  }

  /** Vertical light pillar that flares and collapses. */
  beamBurst(position: Vector3, color: Color, radius = 0.9, duration = 0.8): void {
    this.startPulse(this.beam, position, color, radius, duration, 0, 0);
    this.beam.mesh.scale.y = 7;
  }

  /** Horizontal scanner band sweeping up the character. */
  scan(position: Vector3, color: Color, fromY: number, toY: number, radius: number, duration: number): void {
    this.startPulse(this.scanner, position, color, radius, duration, fromY, toY);
    this.scanner.mesh.scale.y = 0.16;
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.active) continue;
      ring.t += dt / ring.duration;
      if (ring.t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const scale = 0.25 + (ring.maxScale - 0.25) * Easing.outCubic(ring.t);
      ring.mesh.scale.setScalar(scale);
      ring.mesh.material.opacity = Math.pow(1 - ring.t, 1.4);
    }

    this.updateBeam(dt);
    this.updateScanner(dt);
  }

  clear(): void {
    for (const ring of this.rings) {
      ring.active = false;
      ring.mesh.visible = false;
    }
    for (const pulse of [this.beam, this.scanner]) {
      pulse.active = false;
      pulse.mesh.visible = false;
    }
  }

  private updateBeam(dt: number): void {
    const pulse = this.beam;
    if (!this.advance(pulse, dt)) return;
    const t = pulse.t;
    const width = t < 0.25 ? Easing.outBack(t / 0.25) : 1 - Easing.inCubic((t - 0.25) / 0.75);
    pulse.mesh.scale.x = pulse.mesh.scale.z = Math.max(0.001, width * pulse.radius);
    pulse.mesh.material.uniforms.uOpacity.value = Math.min(0.55, (1 - t) * 0.9);
  }

  private updateScanner(dt: number): void {
    const pulse = this.scanner;
    if (!this.advance(pulse, dt)) return;
    const t = Easing.inOutCubic(pulse.t);
    pulse.mesh.position.y = pulse.fromY + (pulse.toY - pulse.fromY) * t;
    pulse.mesh.material.uniforms.uOpacity.value = Math.sin(Math.PI * pulse.t) * 1.2;
  }

  private advance(pulse: Pulse, dt: number): boolean {
    if (!pulse.active) return false;
    pulse.t += dt / pulse.duration;
    if (pulse.t >= 1) {
      pulse.active = false;
      pulse.mesh.visible = false;
      return false;
    }
    return true;
  }

  private startPulse(
    pulse: Pulse,
    position: Vector3,
    color: Color,
    radius: number,
    duration: number,
    fromY: number,
    toY: number,
  ): void {
    pulse.active = true;
    pulse.t = 0;
    pulse.duration = duration;
    pulse.radius = radius;
    pulse.fromY = position.y + fromY;
    pulse.toY = position.y + toY;
    pulse.mesh.visible = true;
    pulse.mesh.position.copy(position);
    pulse.mesh.position.y = pulse.fromY;
    pulse.mesh.scale.x = pulse.mesh.scale.z = radius;
    pulse.mesh.material.uniforms.uColor.value.copy(color);
  }

  private makePulse(geometry: CylinderGeometry, mode: number): Pulse {
    const mesh = new Mesh(geometry, makeBeamMaterial(mode));
    mesh.visible = false;
    mesh.renderOrder = 3;
    this.root.add(mesh);
    return { mesh, t: 0, duration: 1, active: false, fromY: 0, toY: 0, radius: 1 };
  }
}
