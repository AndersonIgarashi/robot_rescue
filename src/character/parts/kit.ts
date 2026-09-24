import { Group, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';
import type { CharacterMaterials } from '../CharacterMaterials';
import type { GeometryLibrary } from '../GeometryLibrary';

/** Shared building blocks handed to every part factory. */
export interface PartKit {
  readonly geo: GeometryLibrary;
  readonly mat: CharacterMaterials;
}

export type Vec3Tuple = readonly [number, number, number];

export interface MeshOptions {
  p?: Vec3Tuple;
  r?: Vec3Tuple;
  s?: number | Vec3Tuple;
}

/**
 * Adds a static mesh. Its local matrix is baked once (matrixAutoUpdate off):
 * only joint/wrapper groups animate, so ~100 part meshes cost no per-frame
 * matrix composition.
 */
export function addMesh(parent: Object3D, geometry: BufferGeometry, material: Material, options: MeshOptions = {}): Mesh {
  const mesh = new Mesh(geometry, material);
  if (options.p) mesh.position.set(...options.p);
  if (options.r) mesh.rotation.set(...options.r);
  if (options.s !== undefined) {
    if (typeof options.s === 'number') mesh.scale.setScalar(options.s);
    else mesh.scale.set(...options.s);
  }
  mesh.updateMatrix();
  mesh.matrixAutoUpdate = false;
  parent.add(mesh);
  return mesh;
}

export function addGroup(parent: Object3D, position: Vec3Tuple = [0, 0, 0], name = ''): Group {
  const group = new Group();
  group.name = name;
  group.position.set(...position);
  parent.add(group);
  return group;
}

export const HALF_PI = Math.PI / 2;
