import {
  AdditiveBlending,
  CircleGeometry,
  Color,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  TorusGeometry,
  Vector2,
  type CanvasTexture,
} from 'three';
import type { Tweener } from '../core/Tweener';
import { STAGE_COLORS } from '../data/theme';
import { Easing } from '../utils/easing';

const PEDESTAL_RADIUS = 1.07;

function flatDisc(radius: number, material: MeshBasicMaterial, y: number): Mesh {
  const mesh = new Mesh(new CircleGeometry(radius, 40), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/** The chunky display pedestal (shown while building; it drops away when the race starts). */
export class Stage {
  readonly root = new Group();
  private readonly ringMaterial = new MeshBasicMaterial({ toneMapped: false });
  private readonly glowMaterial: MeshBasicMaterial;

  constructor(gradient: CanvasTexture) {
    const profile = [
      [0.9, -0.3],
      [1.05, -0.3],
      [1.13, -0.27],
      [1.16, -0.2],
      [1.16, -0.08],
      [1.13, -0.02],
      [PEDESTAL_RADIUS, 0],
    ].map(([x, y]) => new Vector2(x, y));
    const side = new Mesh(
      new LatheGeometry(profile, 48),
      new MeshStandardMaterial({ color: STAGE_COLORS.pedestalSide, roughness: 0.42, metalness: 0.05 }),
    );

    const top = new Mesh(new CircleGeometry(PEDESTAL_RADIUS, 48), new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTop, roughness: 0.55 }));
    top.rotation.x = -Math.PI / 2;

    const trim = new Mesh(new TorusGeometry(1.14, 0.05, 8, 48), new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTrim, roughness: 0.5 }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -0.24;

    const ring = new Mesh(new TorusGeometry(0.95, 0.028, 8, 64), this.ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.012;

    const inset = new Mesh(
      new RingGeometry(0.56, 0.6, 48),
      new MeshBasicMaterial({ color: 0xdfe3ff, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    inset.rotation.x = -Math.PI / 2;
    inset.position.y = 0.004;

    this.glowMaterial = new MeshBasicMaterial({
      map: gradient,
      transparent: true,
      opacity: 0.4,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const glow = flatDisc(1.05, this.glowMaterial, 0.008);

    const floorShadow = flatDisc(
      2.1,
      new MeshBasicMaterial({ color: 0x140c40, map: gradient, transparent: true, opacity: 0.32, depthWrite: false }),
      -0.31,
    );
    floorShadow.scale.set(1, 0.7, 1);

    this.root.add(floorShadow, side, top, trim, inset, ring, glow);
    this.root.traverse((object) => {
      if (object === this.root) return;
      object.updateMatrix();
      object.matrixAutoUpdate = false;
    });
  }

  /** Drops the pedestal away (race) or pops it back (replay). */
  setVisible(visible: boolean, tweener: Tweener, animate = true): void {
    const scale = this.root.scale;
    tweener.killTweensOf(scale);
    this.root.visible = true;
    const target = visible ? 1 : 0.001;
    if (!animate) {
      scale.setScalar(target);
      this.root.visible = visible;
      return;
    }
    tweener.to(scale, { x: target, y: target, z: target }, {
      duration: visible ? 0.45 : 0.3,
      ease: visible ? Easing.outBack : Easing.inBack,
      onComplete: () => (this.root.visible = visible),
    });
  }

  update(time: number, energy: Color): void {
    if (!this.root.visible) return;
    const pulse = 0.85 + Math.sin(time * 3) * 0.15;
    this.ringMaterial.color.copy(energy).multiplyScalar(pulse);
    this.glowMaterial.color.copy(energy);
    this.glowMaterial.opacity = 0.32 + Math.sin(time * 2.2) * 0.06;
  }
}
