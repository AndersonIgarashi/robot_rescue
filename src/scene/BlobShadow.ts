import { CanvasTexture, CircleGeometry, Mesh, MeshBasicMaterial, SRGBColorSpace } from 'three';

/** 64px radial gradient drawn once — shared by every soft shadow and glow. */
export function createRadialTexture(): CanvasTexture {
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

/**
 * Fake contact shadow that travels with the character (pedestal or race
 * track) and shrinks/fades as the body lifts off the ground.
 */
export class BlobShadow {
  readonly mesh: Mesh<CircleGeometry, MeshBasicMaterial>;

  constructor(texture: CanvasTexture) {
    this.mesh = new Mesh(
      new CircleGeometry(0.72, 32),
      new MeshBasicMaterial({ color: 0x1d1646, map: texture, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.012;
    this.mesh.renderOrder = 1;
  }

  /** @param lift body height above the ground (hover + hop) */
  update(lift: number): void {
    const spread = 1 / (1 + lift * 0.7);
    this.mesh.scale.setScalar(spread);
    this.mesh.material.opacity = 0.42 * spread;
  }
}
