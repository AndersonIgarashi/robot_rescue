import { Group, Vector3, type Object3D } from 'three';
import type { BodyRigId, SocketId } from '../types';
import type { AssemblyPiece, AssemblyStage, BodyRig } from './BodyRig';
import { HALF_PI, addGroup, addMesh, type PartKit, type Vec3Tuple } from './kit';

const SIDES = [-1, 1] as const;

const piece = (object: Object3D, stage: AssemblyStage, explode: Vec3Tuple, spin: Vec3Tuple): AssemblyPiece => ({
  object,
  stage,
  explode: new Vector3(...explode),
  spin: new Vector3(...spin),
});

function createRoot(id: BodyRigId): Group {
  const root = new Group();
  root.name = `rig:${id}`;
  return root;
}

/** Chunky, friendly box robot — the hero silhouette of the playable. */
function buildRobot({ geo, mat }: PartKit): BodyRig {
  const root = createRoot('robot');
  const hips = addGroup(root, [0, 0.45, 0], 'hips');

  const legs = SIDES.map((side) => {
    const joint = addGroup(hips, [side * 0.22, 0, 0]);
    const wrap = addGroup(joint);
    addMesh(wrap, geo.cylinder(), mat.joint, { p: [0, -0.14, 0], s: [0.12, 0.3, 0.12] });
    addMesh(wrap, geo.roundedBox(0.32, 0.18, 0.42, 0.08), mat.secondary, { p: [0, -0.36, 0.05] });
    return { joint, wrap };
  });

  const torso = addGroup(hips, [0, 0.04, 0], 'torso');
  const torsoWrap = addGroup(torso);
  addMesh(torsoWrap, geo.cylinder(), mat.joint, { p: [0, 0.03, 0], s: [0.3, 0.12, 0.26] });
  addMesh(torsoWrap, geo.roundedBox(0.9, 0.72, 0.66, 0.2), mat.primary, { p: [0, 0.4, 0] });
  addMesh(torsoWrap, geo.roundedBox(0.58, 0.42, 0.1, 0.06), mat.secondary, { p: [0, 0.38, 0.3] });
  addMesh(torsoWrap, geo.roundedBox(0.5, 0.42, 0.16, 0.06), mat.secondary, { p: [0, 0.42, -0.36] });
  const chest = addGroup(torsoWrap, [0, 0.39, 0.36], 'chest');
  addMesh(chest, geo.cylinder(), mat.energy, { r: [HALF_PI, 0, 0], s: [0.11, 0.05, 0.11] });
  addMesh(chest, geo.torus(0.25), mat.joint, { p: [0, 0, -0.005], s: 0.13 });
  const back = addGroup(torsoWrap, [0, 0.42, -0.45], 'back');
  const shoulderL = addGroup(torsoWrap, [-0.48, 0.74, 0]);
  const shoulderR = addGroup(torsoWrap, [0.48, 0.74, 0]);

  const arms = SIDES.map((side) => {
    const joint = addGroup(torso, [side * 0.53, 0.6, 0]);
    const wrap = addGroup(joint);
    addMesh(wrap, geo.sphere(), mat.secondary, { s: 0.15 });
    addMesh(wrap, geo.capsule(0.1, 0.24), mat.primary, { p: [0, -0.24, 0] });
    addMesh(wrap, geo.sphere(), mat.secondary, { p: [0, -0.5, 0], s: 0.14 });
    return { joint, wrap, hand: addGroup(wrap, [0, -0.52, 0]) };
  });

  const head = addGroup(torso, [0, 0.8, 0], 'head');
  const headWrap = addGroup(head);
  addMesh(headWrap, geo.cylinder(), mat.joint, { p: [0, 0.03, 0], s: [0.14, 0.12, 0.14] });
  addMesh(headWrap, geo.roundedBox(1.0, 0.78, 0.84, 0.24), mat.primary, { p: [0, 0.47, 0] });
  addMesh(headWrap, geo.roundedBox(0.8, 0.52, 0.08, 0.1), mat.screen, { p: [0, 0.47, 0.4] });
  for (const side of SIDES) {
    addMesh(headWrap, geo.cylinder(), mat.secondary, { p: [side * 0.53, 0.47, 0], r: [0, 0, HALF_PI], s: [0.13, 0.1, 0.13] });
    addMesh(headWrap, geo.torus(0.3), mat.energy, { p: [side * 0.585, 0.47, 0], r: [0, HALF_PI, 0], s: 0.085 });
  }
  const antenna = addGroup(headWrap, [0.26, 0.84, -0.12], 'antenna');
  addMesh(antenna, geo.cylinder(), mat.joint, { p: [0, 0.12, 0], s: [0.025, 0.24, 0.025] });
  addMesh(antenna, geo.sphere(), mat.energy, { p: [0, 0.27, 0], s: 0.07 });

  const sockets: Record<SocketId, Object3D> = {
    root,
    headCenter: addGroup(headWrap, [0, 0.47, 0]),
    headTop: addGroup(headWrap, [0, 0.86, 0]),
    face: addGroup(headWrap, [0, 0.47, 0.445]),
    earL: addGroup(headWrap, [-0.56, 0.47, 0]),
    earR: addGroup(headWrap, [0.56, 0.47, 0]),
    chest,
    back,
    handL: arms[0].hand,
    handR: arms[1].hand,
    shoulderL,
    shoulderR,
    antennaTip: addGroup(antenna, [0, 0.27, 0]),
  };

  return {
    id: 'robot',
    root,
    hips,
    torso,
    head,
    armL: arms[0].joint,
    armR: arms[1].joint,
    legL: legs[0].joint,
    legR: legs[1].joint,
    antenna,
    sockets,
    spinners: [],
    emitters: [],
    assembly: [
      piece(legs[0].wrap, 'legs', [-0.45, -0.15, 0.35], [0.4, 0, -0.6]),
      piece(legs[1].wrap, 'legs', [0.45, -0.15, 0.35], [0.4, 0, 0.6]),
      piece(torsoWrap, 'body', [0, -0.1, 0.55], [0.4, 0.3, 0]),
      piece(arms[0].wrap, 'arms', [-0.8, 0.2, 0.3], [0, 0, -1.2]),
      piece(arms[1].wrap, 'arms', [0.8, 0.2, 0.3], [0, 0, 1.2]),
      piece(headWrap, 'head', [0, 0.75, 0.25], [-0.4, 0.6, 0]),
    ],
    metrics: {
      headWidth: 1,
      headTopY: 0.39,
      faceWidth: 0.8,
      faceHeight: 0.52,
      earX: 0.56,
      earY: 0,
      chestWidth: 0.58,
      armPoseScale: 1,
      headTiltScale: 1,
      bobScale: 1,
      hover: 0,
    },
  };
}

/** Sleeker humanoid with a curved visor. */
function buildAndroid({ geo, mat }: PartKit): BodyRig {
  const root = createRoot('android');
  const hips = addGroup(root, [0, 0.98, 0], 'hips');

  const legs = SIDES.map((side) => {
    const joint = addGroup(hips, [side * 0.15, -0.02, 0]);
    const wrap = addGroup(joint);
    addMesh(wrap, geo.capsule(0.085, 0.3), mat.primary, { p: [0, -0.22, 0] });
    addMesh(wrap, geo.sphere(), mat.joint, { p: [0, -0.47, 0], s: 0.075 });
    addMesh(wrap, geo.capsule(0.075, 0.28), mat.primary, { p: [0, -0.68, 0] });
    addMesh(wrap, geo.roundedBox(0.2, 0.16, 0.32, 0.07), mat.secondary, { p: [0, -0.88, 0.04] });
    return { joint, wrap };
  });

  const torso = addGroup(hips, [0, 0.02, 0], 'torso');
  const torsoWrap = addGroup(torso);
  addMesh(torsoWrap, geo.sphere(), mat.joint, { p: [0, -0.02, 0], s: [0.21, 0.12, 0.16] });
  addMesh(
    torsoWrap,
    geo.lathe('androidTorso', [
      [0, 0],
      [0.17, 0],
      [0.215, 0.08],
      [0.3, 0.32],
      [0.335, 0.48],
      [0.3, 0.6],
      [0.15, 0.69],
      [0, 0.71],
    ]),
    mat.primary,
    { s: [1, 1, 0.72] },
  );
  addMesh(torsoWrap, geo.roundedBox(0.34, 0.2, 0.06, 0.03), mat.secondary, { p: [0, 0.46, 0.225] });
  addMesh(torsoWrap, geo.torus(0.3), mat.joint, { p: [0, 0.66, 0], r: [HALF_PI, 0, 0], s: 0.16 });
  const chest = addGroup(torsoWrap, [0, 0.46, 0.26], 'chest');
  addMesh(chest, geo.cylinder(), mat.energy, { r: [HALF_PI, 0, 0], s: [0.07, 0.04, 0.07] });
  const back = addGroup(torsoWrap, [0, 0.42, -0.23], 'back');
  const shoulderL = addGroup(torsoWrap, [-0.36, 0.66, 0]);
  const shoulderR = addGroup(torsoWrap, [0.36, 0.66, 0]);

  const arms = SIDES.map((side) => {
    const joint = addGroup(torso, [side * 0.4, 0.58, 0]);
    const wrap = addGroup(joint);
    addMesh(wrap, geo.sphere(), mat.secondary, { p: [0, 0.02, 0], s: [0.14, 0.12, 0.14] });
    addMesh(wrap, geo.capsule(0.065, 0.2), mat.primary, { p: [0, -0.2, 0] });
    addMesh(wrap, geo.sphere(), mat.joint, { p: [0, -0.37, 0], s: 0.062 });
    addMesh(wrap, geo.capsule(0.06, 0.2), mat.primary, { p: [0, -0.54, 0] });
    addMesh(wrap, geo.sphere(), mat.secondary, { p: [0, -0.71, 0], s: 0.08 });
    return { joint, wrap, hand: addGroup(wrap, [0, -0.73, 0]) };
  });

  const head = addGroup(torso, [0, 0.72, 0], 'head');
  const headWrap = addGroup(head);
  addMesh(headWrap, geo.cylinder(), mat.joint, { p: [0, 0.04, 0], s: [0.075, 0.14, 0.075] });
  addMesh(headWrap, geo.sphere(), mat.primary, { p: [0, 0.42, 0], s: [0.36, 0.39, 0.35] });
  addMesh(headWrap, geo.sphereCap(HALF_PI - 1, 2, 1.2, 0.72), mat.screen, {
    p: [0, 0.42, 0],
    s: [0.375, 0.405, 0.365],
  });
  for (const side of SIDES) {
    addMesh(headWrap, geo.cylinder(), mat.secondary, { p: [side * 0.37, 0.42, 0], r: [0, 0, HALF_PI], s: [0.085, 0.08, 0.085] });
    addMesh(headWrap, geo.cylinder(), mat.energy, { p: [side * 0.415, 0.42, 0], r: [0, 0, HALF_PI], s: [0.055, 0.02, 0.055] });
  }
  const antenna = addGroup(headWrap, [0.18, 0.74, -0.1], 'antenna');
  addMesh(antenna, geo.cylinder(), mat.joint, { p: [0, 0.09, 0], s: [0.02, 0.18, 0.02] });
  addMesh(antenna, geo.sphere(), mat.energy, { p: [0, 0.2, 0], s: 0.055 });

  const sockets: Record<SocketId, Object3D> = {
    root,
    headCenter: addGroup(headWrap, [0, 0.42, 0]),
    headTop: addGroup(headWrap, [0, 0.8, 0]),
    face: addGroup(headWrap, [0, 0.42, 0.37]),
    earL: addGroup(headWrap, [-0.38, 0.42, 0]),
    earR: addGroup(headWrap, [0.38, 0.42, 0]),
    chest,
    back,
    handL: arms[0].hand,
    handR: arms[1].hand,
    shoulderL,
    shoulderR,
    antennaTip: addGroup(antenna, [0, 0.2, 0]),
  };

  return {
    id: 'android',
    root,
    hips,
    torso,
    head,
    armL: arms[0].joint,
    armR: arms[1].joint,
    legL: legs[0].joint,
    legR: legs[1].joint,
    antenna,
    sockets,
    spinners: [],
    emitters: [],
    assembly: [
      piece(legs[0].wrap, 'legs', [-0.4, -0.2, 0.35], [0.5, 0, -0.5]),
      piece(legs[1].wrap, 'legs', [0.4, -0.2, 0.35], [0.5, 0, 0.5]),
      piece(torsoWrap, 'body', [0, -0.1, 0.5], [0.5, 0.4, 0]),
      piece(arms[0].wrap, 'arms', [-0.7, 0.2, 0.3], [0, 0, -1.2]),
      piece(arms[1].wrap, 'arms', [0.7, 0.2, 0.3], [0, 0, 1.2]),
      piece(headWrap, 'head', [0, 0.6, 0.25], [-0.4, 0.7, 0]),
    ],
    metrics: {
      headWidth: 0.72,
      headTopY: 0.39,
      faceWidth: 0.44,
      faceHeight: 0.26,
      earX: 0.38,
      earY: 0,
      chestWidth: 0.36,
      armPoseScale: 1,
      headTiltScale: 1,
      bobScale: 0.9,
      hover: 0,
    },
  };
}

/** Floating orb with rotor pods and a thruster. */
function buildDrone({ geo, mat }: PartKit): BodyRig {
  const root = createRoot('drone');
  const hips = addGroup(root, [0, 0.62, 0], 'hips');

  const torso = addGroup(hips, [0, 0, 0], 'torso');
  const torsoWrap = addGroup(torso);
  addMesh(torsoWrap, geo.cylinder(0.72), mat.joint, { p: [0, -0.02, 0], s: [0.24, 0.2, 0.24] });
  addMesh(torsoWrap, geo.cylinder(), mat.energy, { p: [0, -0.12, 0], s: [0.17, 0.03, 0.17] });
  addMesh(torsoWrap, geo.torus(0.25), mat.secondary, { p: [0, 0.1, 0], r: [HALF_PI, 0, 0], s: 0.26 });
  for (const side of SIDES) {
    addMesh(torsoWrap, geo.cylinder(), mat.joint, { p: [side * 0.585, 0.55, 0], r: [0, 0, HALF_PI], s: [0.05, 0.28, 0.05] });
  }
  const chest = addGroup(torsoWrap, [0, -0.02, 0.25], 'chest');
  const exhaust = addGroup(torsoWrap, [0, -0.16, 0], 'exhaust');

  const arms = SIDES.map((side) => {
    const joint = addGroup(torso, [side * 0.72, 0.55, 0]);
    const wrap = addGroup(joint);
    addMesh(wrap, geo.cylinder(), mat.joint, { p: [side * 0.08, 0, 0], r: [0, 0, HALF_PI], s: [0.04, 0.16, 0.04] });
    addMesh(wrap, geo.torus(0.2), mat.secondary, { p: [side * 0.28, 0.05, 0], r: [HALF_PI, 0, 0], s: 0.25 });
    addMesh(wrap, geo.torus(0.12), mat.energy, { p: [side * 0.28, -0.01, 0], r: [HALF_PI, 0, 0], s: 0.19 });
    addMesh(wrap, geo.cylinder(), mat.joint, { p: [side * 0.28, 0.05, 0], s: [0.06, 0.1, 0.06] });
    const blades = addGroup(wrap, [side * 0.28, 0.1, 0], 'rotor');
    addMesh(blades, geo.roundedBox(0.42, 0.02, 0.07, 0.01), mat.joint);
    addMesh(blades, geo.roundedBox(0.42, 0.02, 0.07, 0.01), mat.joint, { r: [0, HALF_PI, 0] });
    return { joint, wrap, blades, hand: addGroup(wrap, [side * 0.28, 0.05, 0]) };
  });

  const head = addGroup(torso, [0, 0.55, 0], 'head');
  const headWrap = addGroup(head);
  addMesh(headWrap, geo.sphere(), mat.primary, { s: 0.58 });
  addMesh(headWrap, geo.torus(0.14), mat.secondary, { p: [0, -0.3, 0], r: [HALF_PI, 0, 0], s: 0.5 });
  addMesh(headWrap, geo.sphereCap(HALF_PI - 0.95, 1.9, 1.02, 0.82), mat.screen, { s: 0.6 });
  addMesh(headWrap, geo.cylinder(), mat.secondary, { p: [0, 0.56, 0], s: [0.2, 0.06, 0.2] });
  const antenna = addGroup(headWrap, [-0.22, 0.5, -0.12], 'antenna');
  addMesh(antenna, geo.cylinder(), mat.joint, { p: [0, 0.11, 0], s: [0.025, 0.22, 0.025] });
  addMesh(antenna, geo.sphere(), mat.energy, { p: [0, 0.25, 0], s: 0.07 });

  const sockets: Record<SocketId, Object3D> = {
    root,
    headCenter: addGroup(headWrap, [0, 0, 0]),
    headTop: addGroup(headWrap, [0, 0.58, 0]),
    face: addGroup(headWrap, [0, 0.075, 0.6]),
    earL: addGroup(headWrap, [-0.5, 0.2, 0]),
    earR: addGroup(headWrap, [0.5, 0.2, 0]),
    chest,
    back: addGroup(headWrap, [0, 0, -0.58]),
    handL: arms[0].hand,
    handR: arms[1].hand,
    shoulderL: addGroup(headWrap, [-0.34, 0.38, -0.1]),
    shoulderR: addGroup(headWrap, [0.34, 0.38, -0.1]),
    antennaTip: addGroup(antenna, [0, 0.25, 0]),
  };

  return {
    id: 'drone',
    root,
    hips,
    torso,
    head,
    armL: arms[0].joint,
    armR: arms[1].joint,
    legL: null,
    legR: null,
    antenna,
    sockets,
    spinners: arms.map((arm) => arm.blades),
    emitters: [{ socket: exhaust, preset: 'thruster', rate: 26 }],
    assembly: [
      piece(torsoWrap, 'body', [0, -0.5, 0.4], [0.6, 0, 0.3]),
      piece(arms[0].wrap, 'arms', [-0.5, 0.3, 0.3], [0, 0.8, -0.8]),
      piece(arms[1].wrap, 'arms', [0.5, 0.3, 0.3], [0, -0.8, 0.8]),
      piece(headWrap, 'head', [0, 0.6, 0.25], [-0.5, 0.8, 0]),
    ],
    metrics: {
      headWidth: 1.16,
      headTopY: 0.58,
      faceWidth: 0.52,
      faceHeight: 0.34,
      earX: 0.5,
      earY: 0.22,
      chestWidth: 0.3,
      armPoseScale: 0.22,
      headTiltScale: 0.45,
      bobScale: 2.2,
      hover: 0.62,
    },
  };
}

export const RIG_BUILDERS: Record<BodyRigId, (kit: PartKit) => BodyRig> = {
  robot: buildRobot,
  android: buildAndroid,
  drone: buildDrone,
};
