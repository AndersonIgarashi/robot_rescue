import {
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  TorusGeometry,
  type BufferGeometry,
} from 'three';
import { STAGE_COLORS } from '../data/theme';

interface Floater {
  mesh: Mesh;
  baseY: number;
  phase: number;
  spinX: number;
  spinY: number;
}

// [x, y, z, scale, geometry index, colour index]
const LAYOUT: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [-1.9, 2.9, -4.2, 0.24, 0, 1],
  [1.9, 2.6, -4.8, 0.2, 1, 2],
  [-2.5, 0.8, -5.4, 0.28, 2, 1],
  [2.5, 1.0, -4.4, 0.24, 3, 3],
  [-1.4, -0.4, -3.6, 0.16, 1, 2],
  [1.6, -0.6, -3.8, 0.18, 0, 1],
  [-3.9, 2.4, -7.2, 0.4, 3, 2],
  [4.0, 3.1, -7.6, 0.36, 0, 3],
  [3.4, -0.8, -6.2, 0.28, 2, 1],
];

/** Slow-drifting low-poly shapes that add depth and parallax behind the stage. */
export class Backdrop {
  readonly root = new Group();
  private readonly floaters: Floater[] = [];

  constructor() {
    const geometries: BufferGeometry[] = [
      new IcosahedronGeometry(1, 0),
      new OctahedronGeometry(1, 0),
      new TorusGeometry(1, 0.38, 6, 12),
      new ConeGeometry(1, 1.5, 5),
    ];
    const materials = STAGE_COLORS.backdrop.map(
      (color) => new MeshStandardMaterial({ color, flatShading: true, roughness: 0.55, emissive: color, emissiveIntensity: 0.12 }),
    );

    LAYOUT.forEach(([x, y, z, scale, geometryIndex, colorIndex], i) => {
      const mesh = new Mesh(geometries[geometryIndex], materials[colorIndex]);
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(scale);
      mesh.rotation.set(i * 0.7, i * 1.3, 0);
      this.root.add(mesh);
      this.floaters.push({ mesh, baseY: y, phase: i * 1.37, spinX: 0.15 + (i % 3) * 0.08, spinY: 0.2 + (i % 4) * 0.07 });
    });
  }

  update(dt: number, time: number): void {
    for (const floater of this.floaters) {
      floater.mesh.position.y = floater.baseY + Math.sin(time * 0.6 + floater.phase) * 0.12;
      floater.mesh.rotation.x += floater.spinX * dt;
      floater.mesh.rotation.y += floater.spinY * dt;
    }
  }
}
