import { Color, MeshBasicMaterial, MeshStandardMaterial, type Material } from 'three';
import type { Tween, Tweener } from '../core/Tweener';
import { CHARACTER_BASE_COLORS, NEUTRAL_PALETTE } from '../data/theme';
import type { Tint } from '../fx/FXManager';
import { Easing } from '../utils/easing';
import { clamp, damp } from '../utils/math';
import type { CharacterPalette } from './CharacterConfig';

type PaintRole = 'primary' | 'secondary' | 'accent';

const WHITE = new Color(0xffffff);
const tmp = new Color();

/**
 * Shared, role-based materials. Every part of every rig uses these few
 * instances, so a paint change is a colour tween on ~10 materials instead of a
 * rebuild, and the whole character renders with a handful of shader programs.
 */
export class CharacterMaterials {
  readonly primary = new MeshStandardMaterial({ roughness: 0.36, metalness: 0.02 });
  readonly secondary = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.04 });
  readonly accent = new MeshStandardMaterial({ roughness: 0.34, metalness: 0.06 });
  readonly screen = new MeshStandardMaterial({ color: CHARACTER_BASE_COLORS.screen, roughness: 0.16, metalness: 0.25 });
  readonly joint = new MeshStandardMaterial({ color: CHARACTER_BASE_COLORS.joint, roughness: 0.48, metalness: 0.35 });
  /** Self-lit glowing parts (core, antenna tip, stripes). Not tone mapped so they stay punchy. */
  readonly energy = new MeshBasicMaterial({ toneMapped: false });
  readonly eye = new MeshBasicMaterial({ toneMapped: false });
  readonly highlight = new MeshBasicMaterial({ color: CHARACTER_BASE_COLORS.highlight, toneMapped: false });
  readonly blush = new MeshBasicMaterial({
    color: CHARACTER_BASE_COLORS.blush,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  readonly ice = new MeshStandardMaterial({
    color: CHARACTER_BASE_COLORS.ice,
    emissive: CHARACTER_BASE_COLORS.iceGlow,
    emissiveIntensity: 0.55,
    roughness: 0.12,
    metalness: 0.05,
    flatShading: true,
    transparent: true,
    opacity: 0.9,
  });

  /** Animated energy colours (linear space), readable by FX and the stage. */
  readonly energyColor = new Color(NEUTRAL_PALETTE.energy);
  readonly energyAltColor = new Color(NEUTRAL_PALETTE.energyAlt);
  readonly tint: Tint = [new Color(), new Color()];

  private readonly candies = new Map<number, MeshStandardMaterial>();
  private readonly paintTweens = new Map<string, Tween>();
  private powerLevel = 1;
  private powerTween: Tween | null = null;
  private flashAmount = 0;
  private glow = 1;

  constructor(private readonly tweener: Tweener) {
    this.applyPalette(NEUTRAL_PALETTE, 0);
    this.update(0);
  }

  /** Current "on" level of the energy system (0 = powered down). */
  get power(): number {
    return this.powerLevel;
  }

  applyPalette(palette: CharacterPalette, duration: number): void {
    this.tweenColor('primary', this.primary.color, palette.primary, duration);
    this.tweenColor('secondary', this.secondary.color, palette.secondary, duration);
    this.tweenColor('accent', this.accent.color, palette.accent, duration);
    this.tweenColor('energy', this.energyColor, palette.energy, duration);
    this.tweenColor('energyAlt', this.energyAltColor, palette.energyAlt, duration);
  }

  setGlow(glow: number): void {
    this.glow = clamp(glow, 0.5, 1.5);
  }

  setPowerLevel(level: number, duration: number): Tween | null {
    this.powerTween?.kill();
    if (duration <= 0) {
      this.powerLevel = level;
      this.powerTween = null;
      return null;
    }
    const start = this.powerLevel;
    this.powerTween = this.tweener.tween({
      duration,
      ease: Easing.outCubic,
      onUpdate: (k) => (this.powerLevel = start + (level - start) * k),
    });
    return this.powerTween;
  }

  /** Brief over-bright flash of every glowing part (selection / power-on feedback). */
  flash(amount = 1): void {
    this.flashAmount = Math.max(this.flashAmount, amount);
  }

  /** Cached fixed-colour "candy" materials for colourful props. */
  candy(color: number): MeshStandardMaterial {
    let material = this.candies.get(color);
    if (!material) {
      material = new MeshStandardMaterial({ color, roughness: 0.32, emissive: color, emissiveIntensity: 0.22 });
      this.candies.set(color, material);
    }
    return material;
  }

  paint(role: PaintRole): MeshStandardMaterial {
    return this[role];
  }

  update(dt: number): void {
    this.flashAmount = damp(this.flashAmount, 0, 7, dt);
    const on = 0.06 + 0.94 * this.powerLevel;
    const boost = this.glow * on;

    tmp.copy(this.energyColor).multiplyScalar(boost).lerp(WHITE, this.flashAmount * 0.75);
    this.energy.color.copy(tmp);

    tmp.copy(this.energyColor).lerp(WHITE, 0.5).multiplyScalar(on).lerp(WHITE, this.flashAmount * 0.6);
    this.eye.color.copy(tmp);
    this.highlight.color.setScalar(on);

    this.tint[0].copy(this.energyColor);
    this.tint[1].copy(this.energyAltColor);
  }

  get all(): Material[] {
    return [
      this.primary,
      this.secondary,
      this.accent,
      this.screen,
      this.joint,
      this.energy,
      this.eye,
      this.highlight,
      this.blush,
      this.ice,
      ...this.candies.values(),
    ];
  }

  dispose(): void {
    for (const material of this.all) material.dispose();
  }

  private tweenColor(key: string, target: Color, hex: number, duration: number): void {
    this.paintTweens.get(key)?.kill();
    const to = new Color(hex);
    if (duration <= 0 || target.equals(to)) {
      target.copy(to);
      return;
    }
    const from = target.clone();
    this.paintTweens.set(
      key,
      this.tweener.tween({ duration, ease: Easing.inOutCubic, onUpdate: (k) => target.lerpColors(from, to, k) }),
    );
  }
}
