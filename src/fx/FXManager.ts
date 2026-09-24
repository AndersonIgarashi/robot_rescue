import { Color, Group, Vector3 } from 'three';
import type { PowerBurstDef } from '../data/types';
import { TAU, randRange } from '../utils/math';
import { EnergyFX } from './EnergyFX';
import { LightningArcs } from './LightningArcs';
import { ParticleSpawn, ParticleSystem, type ParticleBlend } from './ParticleSystem';
import { FX_PRESETS, type EmitterPreset, type FxPresetId } from './presets';

/** Two colours a preset can draw from when it has no fixed palette. */
export type Tint = readonly [Color, Color];

/** Per-emitter accumulator so continuous streams emit fractional rates smoothly. */
export class EmitterState {
  accumulator = 0;
}

const WHITE_TINT: Tint = [new Color(0xffffff), new Color(0xffffff)];
const tmpStrikeFrom = new Vector3();
const tmpStrikeTo = new Vector3();

/** Facade over all VFX primitives. Gameplay code asks for effects by preset name. */
export class FXManager {
  readonly root = new Group();
  readonly energy = new EnergyFX();
  readonly arcs = new LightningArcs();
  /** Global emission multiplier (lowered by adaptive quality on slow devices). */
  density = 1;

  private readonly systems: Record<ParticleBlend, ParticleSystem>;
  private readonly spawn = new ParticleSpawn();
  private readonly presetColors = new Map<string, Color[]>();

  constructor() {
    this.systems = {
      alpha: new ParticleSystem(1200, 'alpha'),
      additive: new ParticleSystem(400, 'additive'),
    };
    this.root.add(this.systems.alpha.points, this.systems.additive.points, this.arcs.mesh, this.energy.root);

    for (const [id, preset] of Object.entries(FX_PRESETS) as [string, EmitterPreset][]) {
      if (preset.colors) this.presetColors.set(id, preset.colors.map((hex) => new Color(hex)));
    }
  }

  /** Emits `count` particles of a preset at a world position. */
  emit(id: FxPresetId, position: Vector3, count: number, tint: Tint = WHITE_TINT): void {
    const preset: EmitterPreset = FX_PRESETS[id];
    const system = this.systems[preset.blend];
    const palette = this.presetColors.get(id);
    const [dx, dy, dz] = preset.direction;
    const [jx, jy, jz] = preset.jitter;
    const s = this.spawn;

    for (let n = 0; n < count; n++) {
      // Random direction biased toward the preset direction.
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * TAU;
      const ring = Math.sqrt(1 - u * u);
      let vx = dx * (1 - preset.spread) + ring * Math.cos(theta) * preset.spread;
      let vy = dy * (1 - preset.spread) + u * preset.spread;
      let vz = dz * (1 - preset.spread) + ring * Math.sin(theta) * preset.spread;
      const speed = randRange(preset.speed[0], preset.speed[1]) / (Math.hypot(vx, vy, vz) || 1);
      vx *= speed;
      vy *= speed;
      vz *= speed;

      const color = palette ? palette[(Math.random() * palette.length) | 0] : tint[Math.random() < 0.6 ? 0 : 1];
      const size = randRange(preset.size[0], preset.size[1]);

      s.x = position.x + (Math.random() * 2 - 1) * jx;
      s.y = position.y + (Math.random() * 2 - 1) * jy;
      s.z = position.z + (Math.random() * 2 - 1) * jz;
      s.vx = vx;
      s.vy = vy;
      s.vz = vz;
      s.r = color.r;
      s.g = color.g;
      s.b = color.b;
      s.size = size;
      s.sizeEnd = size * preset.sizeEnd;
      s.life = randRange(preset.life[0], preset.life[1]);
      s.gravity = preset.gravity;
      s.drag = preset.drag;
      s.alpha = preset.alpha ?? 1;
      s.shape = preset.shape;
      s.rotation = Math.random() * TAU;
      s.spin = preset.spin ? randRange(preset.spin[0], preset.spin[1]) : 0;
      s.wobble = preset.wobble ?? 0;
      system.spawn(s);
    }
  }

  /** Continuous emission at `rate` particles per second. */
  stream(state: EmitterState, id: FxPresetId, position: Vector3, rate: number, dt: number, tint?: Tint): void {
    state.accumulator += rate * this.density * dt;
    const count = Math.floor(state.accumulator);
    if (count <= 0) return;
    state.accumulator -= count;
    this.emit(id, position, count, tint);
  }

  burst(id: FxPresetId, position: Vector3, count: number, tint?: Tint): void {
    this.emit(id, position, Math.max(1, Math.round(count * this.density)), tint);
  }

  /** Signature activation effect for a power (data-driven through PowerBurstDef). */
  powerBurst(def: PowerBurstDef, center: Vector3, ground: Vector3, tint: Tint): void {
    this.burst(def.preset, center, def.count, tint);
    this.burst('sparkleBurst', center, 26, tint);
    this.energy.shockwave(ground, tint[0], 2.8);
    if (def.strike) this.strike(center, tint[0]);
  }

  /** Lightning bolts from the sky onto a target. */
  strike(target: Vector3, color: Color): void {
    for (let i = 0; i < 3; i++) {
      tmpStrikeFrom.set(target.x + randRange(-1.6, 1.6), target.y + randRange(4.5, 6), target.z + randRange(-1, 0.4));
      tmpStrikeTo.set(target.x + randRange(-0.25, 0.25), target.y + randRange(-0.2, 0.4), target.z);
      this.arcs.spawn(tmpStrikeFrom, tmpStrikeTo, color, randRange(0.22, 0.34), 0.26, 0.5);
    }
  }

  setPointScale(scale: number): void {
    this.systems.alpha.setPointScale(scale);
    this.systems.additive.setPointScale(scale);
  }

  update(dt: number, cameraPosition: Vector3): void {
    this.systems.alpha.update(dt);
    this.systems.additive.update(dt);
    this.arcs.update(dt, cameraPosition);
    this.energy.update(dt);
  }

  clear(): void {
    this.systems.alpha.clear();
    this.systems.additive.clear();
    this.arcs.clear();
    this.energy.clear();
  }

  get particleCount(): number {
    return this.systems.alpha.alive + this.systems.additive.alive;
  }
}
