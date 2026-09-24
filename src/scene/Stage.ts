import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
} from 'three';
import { STAGE_COLORS } from '../data/theme';

const PEDESTAL_RADIUS = 1.07;

/** 64px radial gradient drawn once at startup — the only "texture" in the playable. */
function radialTexture(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function flatDisc(radius: number, material: MeshBasicMaterial, y: number): Mesh {
  const mesh = new Mesh(new CircleGeometry(radius, 40), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  return mesh;
}

/**
 * The chunky display pedestal. Shadows are faked with blob textures instead
 * of shadow maps — the classic mobile trick: zero extra render passes.
 */
export class Stage {
  readonly root = new Group();
  private readonly ringMaterial = new MeshBasicMaterial({ toneMapped: false });
  private readonly glowMaterial: MeshBasicMaterial;
  private readonly shadowMaterial: MeshBasicMaterial;
  private readonly shadow: Mesh;

  constructor() {
    const gradient = radialTexture();

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

    const topMaterial = new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTop, roughness: 0.55 });
    const top = new Mesh(new CircleGeometry(PEDESTAL_RADIUS, 48), topMaterial);
    top.rotation.x = -Math.PI / 2;

    const trim = new Mesh(
      new TorusGeometry(1.14, 0.05, 8, 48),
      new MeshStandardMaterial({ color: STAGE_COLORS.pedestalTrim, roughness: 0.5 }),
    );
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

    this.shadowMaterial = new MeshBasicMaterial({ color: 0x1d1646, map: gradient, transparent: true, opacity: 0.4, depthWrite: false });
    this.shadow = flatDisc(0.72, this.shadowMaterial, 0.01);

    const floorShadow = flatDisc(
      2.1,
      new MeshBasicMaterial({ color: 0x140c40, map: gradient, transparent: true, opacity: 0.32, depthWrite: false }),
      -0.31,
    );
    floorShadow.scale.set(1, 0.7, 1);

    this.root.add(floorShadow, side, top, trim, inset, ring, glow, this.shadow);
    this.root.traverse((object) => {
      object.matrixAutoUpdate = object === this.shadow;
      object.updateMatrix();
    });
  }

  /**
   * @param energy current character energy colour
   * @param lift body height above the pedestal (hover + hop)
   */
  update(time: number, energy: Color, lift: number): void {
    const pulse = 0.85 + Math.sin(time * 3) * 0.15;
    this.ringMaterial.color.copy(energy).multiplyScalar(pulse);
    this.glowMaterial.color.copy(energy);
    this.glowMaterial.opacity = 0.32 + Math.sin(time * 2.2) * 0.06;

    const spread = 1 / (1 + lift * 0.7);
    this.shadow.scale.setScalar(spread);
    this.shadowMaterial.opacity = 0.42 * spread;
  }
}
