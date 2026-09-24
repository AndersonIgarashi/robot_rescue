import { Group } from 'three';
import type { FaceConfig } from '../CharacterConfig';
import type { EyeStyle, MouthStyle } from '../types';
import { addGroup, addMesh, type PartKit } from './kit';

export interface FaceLayout {
  eyeX: number;
  eyeY: number;
  eyeSize: number;
  mouthY: number;
}

export interface FaceRig {
  readonly root: Group;
  /** Translated to make the eyes follow the pointer. */
  readonly look: Group;
  /** Default eyes (scaled on Y to blink). */
  readonly eyes: Group;
  readonly mouth: Group;
  /** Alternate happy expression (^ ^ + open smile), toggled on reactions. */
  readonly joy: Group;
}

/** Shared so accessories (glasses) line up with the eyes on any face size. */
export function faceLayout(width: number, height: number): FaceLayout {
  return {
    eyeX: width * 0.23,
    eyeY: height * 0.08,
    eyeSize: Math.min(width * 0.2, height * 0.5),
    mouthY: -height * 0.27,
  };
}

const EYE_Z = 0.004;
const HIGHLIGHT_Z = 0.008;

function buildEye(kit: PartKit, parent: Group, style: EyeStyle, x: number, y: number, s: number, side: -1 | 1): void {
  const { geo, mat } = kit;
  const eye = addGroup(parent, [x, y, 0]);
  switch (style) {
    case 'focus':
      addMesh(eye, geo.roundedRect(1, 0.62, 0.26), mat.eye, { p: [0, 0, EYE_Z], s: s * 1.05 });
      addMesh(eye, geo.circle(), mat.highlight, { p: [s * 0.28, s * 0.1, HIGHLIGHT_Z], s: s * 0.1 });
      break;
    case 'sharp':
      addMesh(eye, geo.roundedRect(1, 0.5, 0.22), mat.eye, { p: [0, 0, EYE_Z], r: [0, 0, side * -0.3], s: s * 1.1 });
      addMesh(eye, geo.circle(), mat.highlight, { p: [s * 0.2, s * 0.12, HIGHLIGHT_Z], s: s * 0.09 });
      break;
    case 'sparkle':
      addMesh(eye, geo.circle(), mat.eye, { p: [0, 0, EYE_Z], s: s * 0.62 });
      addMesh(eye, geo.circle(), mat.highlight, { p: [s * 0.2, s * 0.22, HIGHLIGHT_Z], s: s * 0.2 });
      addMesh(eye, geo.circle(), mat.highlight, { p: [-s * 0.2, -s * 0.2, HIGHLIGHT_Z], s: s * 0.09 });
      break;
    case 'round':
      addMesh(eye, geo.circle(), mat.eye, { p: [0, 0, EYE_Z], s: s * 0.52 });
      addMesh(eye, geo.circle(), mat.highlight, { p: [s * 0.18, s * 0.2, HIGHLIGHT_Z], s: s * 0.14 });
      break;
  }
}

function buildMouth(kit: PartKit, parent: Group, style: MouthStyle, y: number, s: number): void {
  const { geo, mat } = kit;
  switch (style) {
    case 'line':
      addMesh(parent, geo.roundedRect(1, 0.26, 0.13), mat.eye, { p: [0, y, EYE_Z], s: s * 0.5 });
      break;
    case 'grin':
      addMesh(parent, geo.torus(0.3, Math.PI), mat.eye, { p: [0, y + s * 0.1, EYE_Z], r: [0, 0, Math.PI], s: [s * 0.52, s * 0.3, s * 0.3] });
      break;
    case 'smile':
      addMesh(parent, geo.torus(0.3, Math.PI), mat.eye, { p: [0, y + s * 0.12, EYE_Z], r: [0, 0, Math.PI], s: s * 0.34 });
      break;
  }
}

export function buildFace(kit: PartKit, config: FaceConfig, width: number, height: number): FaceRig {
  const { geo, mat } = kit;
  const layout = faceLayout(width, height);
  const { eyeX, eyeY, eyeSize: s, mouthY } = layout;

  const root = new Group();
  root.name = 'face';
  const look = addGroup(root);
  const eyes = addGroup(look, [0, eyeY, 0]);
  buildEye(kit, eyes, config.eyes, -eyeX, 0, s, -1);
  buildEye(kit, eyes, config.eyes, eyeX, 0, s, 1);

  const mouth = addGroup(look);
  buildMouth(kit, mouth, config.mouth, mouthY, s);

  const joy = addGroup(look);
  for (const side of [-1, 1]) {
    addMesh(joy, geo.torus(0.28, Math.PI), mat.eye, { p: [side * eyeX, eyeY - s * 0.1, EYE_Z], s: s * 0.4 });
  }
  addMesh(joy, geo.circle(Math.PI, Math.PI), mat.eye, { p: [0, mouthY + s * 0.12, EYE_Z], s: s * 0.32 });
  joy.visible = false;

  if (config.blush) {
    for (const side of [-1, 1]) {
      addMesh(look, geo.circle(), mat.blush, {
        p: [side * width * 0.37, mouthY + height * 0.1, 0.002],
        s: [s * 0.34, s * 0.2, 1],
      });
    }
  }

  return { root, look, eyes, mouth, joy };
}
