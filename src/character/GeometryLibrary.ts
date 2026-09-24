import {
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  LatheGeometry,
  OctahedronGeometry,
  Path,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TAU } from '../utils/math';

const r3 = (value: number): string => value.toFixed(3);

function roundedRectPath<T extends Path>(target: T, w: number, h: number, r: number): T {
  const x = -w / 2;
  const y = -h / 2;
  const radius = Math.min(r, w / 2, h / 2);
  target.moveTo(x + radius, y);
  target.lineTo(x + w - radius, y);
  target.absarc(x + w - radius, y + radius, radius, -Math.PI / 2, 0, false);
  target.lineTo(x + w, y + h - radius);
  target.absarc(x + w - radius, y + h - radius, radius, 0, Math.PI / 2, false);
  target.lineTo(x + radius, y + h);
  target.absarc(x + radius, y + h - radius, radius, Math.PI / 2, Math.PI, false);
  target.lineTo(x, y + radius);
  target.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
  return target;
}

/**
 * Every character part is built from this cache. Unit primitives are shared
 * and sized with mesh.scale, so all rigs and accessories together use only a
 * few dozen geometries — and swapping parts never allocates new buffers.
 */
export class GeometryLibrary {
  private readonly cache = new Map<string, BufferGeometry>();

  get size(): number {
    return this.cache.size;
  }

  /** Unit sphere (radius 1). */
  sphere(): BufferGeometry {
    return this.get('sphere', () => new SphereGeometry(1, 28, 20));
  }

  /** Partial unit sphere — used for curved visors. Angles in radians. */
  sphereCap(phiStart: number, phiLength: number, thetaStart: number, thetaLength: number): BufferGeometry {
    const key = `cap:${r3(phiStart)}:${r3(phiLength)}:${r3(thetaStart)}:${r3(thetaLength)}`;
    return this.get(key, () => new SphereGeometry(1, 32, 12, phiStart, phiLength, thetaStart, thetaLength));
  }

  roundedBox(w: number, h: number, d: number, radius: number): BufferGeometry {
    return this.get(`rbox:${r3(w)}:${r3(h)}:${r3(d)}:${r3(radius)}`, () => new RoundedBoxGeometry(w, h, d, 3, radius));
  }

  /** Unit-height cylinder with bottom radius 1 and top radius `topRatio`. */
  cylinder(topRatio = 1): BufferGeometry {
    return this.get(`cyl:${r3(topRatio)}`, () => new CylinderGeometry(topRatio, 1, 1, 24));
  }

  capsule(radius: number, length: number): BufferGeometry {
    return this.get(`capsule:${r3(radius)}:${r3(length)}`, () => new CapsuleGeometry(radius, length, 6, 16));
  }

  /** Unit torus (major radius 1) lying in the XY plane. */
  torus(tubeRatio: number, arc = TAU): BufferGeometry {
    return this.get(`torus:${r3(tubeRatio)}:${r3(arc)}`, () => new TorusGeometry(1, tubeRatio, 10, 32, arc));
  }

  /** Unit disc facing +Z. */
  circle(thetaStart = 0, thetaLength = TAU): BufferGeometry {
    return this.get(`circle:${r3(thetaStart)}:${r3(thetaLength)}`, () => new CircleGeometry(1, 28, thetaStart, thetaLength));
  }

  octahedron(): BufferGeometry {
    return this.get('octa', () => new OctahedronGeometry(1, 0));
  }

  /** Flat rounded rectangle facing +Z. */
  roundedRect(w: number, h: number, radius: number): BufferGeometry {
    return this.get(`rrect:${r3(w)}:${r3(h)}:${r3(radius)}`, () =>
      new ShapeGeometry(roundedRectPath(new Shape(), w, h, radius), 6),
    );
  }

  /** Extruded rounded-rectangle frame (glasses, bezels). */
  roundedFrame(w: number, h: number, radius: number, thickness: number, depth: number): BufferGeometry {
    const key = `frame:${r3(w)}:${r3(h)}:${r3(radius)}:${r3(thickness)}:${r3(depth)}`;
    return this.get(key, () => {
      const shape = roundedRectPath(new Shape(), w, h, radius);
      shape.holes.push(roundedRectPath(new Path(), w - thickness * 2, h - thickness * 2, Math.max(0.001, radius - thickness)));
      const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 6 });
      geometry.translate(0, 0, -depth / 2);
      return geometry;
    });
  }

  lathe(key: string, profile: ReadonlyArray<readonly [number, number]>, segments = 28): BufferGeometry {
    return this.get(`lathe:${key}`, () => new LatheGeometry(profile.map(([x, y]) => new Vector2(x, y)), segments));
  }

  extrude(key: string, build: () => Shape, depth: number, bevel = 0.015): BufferGeometry {
    return this.get(`extrude:${key}`, () => {
      const geometry = new ExtrudeGeometry(build(), {
        depth,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 2,
        curveSegments: 10,
      });
      geometry.center();
      return geometry;
    });
  }

  dispose(): void {
    for (const geometry of this.cache.values()) geometry.dispose();
    this.cache.clear();
  }

  private get(key: string, create: () => BufferGeometry): BufferGeometry {
    let geometry = this.cache.get(key);
    if (!geometry) {
      geometry = create();
      this.cache.set(key, geometry);
    }
    return geometry;
  }
}
