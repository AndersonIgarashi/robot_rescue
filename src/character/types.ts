/** Vocabulary of the modular character system. Everything the assembler can build is named here. */

export type BodyRigId = 'robot' | 'android' | 'drone';

export type EyeStyle = 'round' | 'focus' | 'sharp' | 'sparkle';

export type MouthStyle = 'smile' | 'line' | 'grin';

export type AccessoryId =
  | 'armShield'
  | 'shieldOrbit'
  | 'chestEmblem'
  | 'headFin'
  | 'jetBoosters'
  | 'speedStripes'
  | 'armCannon'
  | 'missilePods'
  | 'scopeVisor';

export type EffectId = 'flameHands' | 'emberAura' | 'iceCrystals' | 'snowAura' | 'lightningArcs' | 'sparkAura';

export type AnimationSetId = 'steady' | 'zippy' | 'bouncy';

export type PoseId = 'idle' | 'cheer' | 'hero' | 'crouch' | 'power' | 'aim' | 'ready';

/** How the character reacts when a choice is applied. */
export type ReactionKind = 'select' | 'power' | 'body';

export type SocketId =
  | 'root'
  | 'headCenter'
  | 'headTop'
  | 'face'
  | 'earL'
  | 'earR'
  | 'chest'
  | 'back'
  | 'handL'
  | 'handR'
  | 'shoulderL'
  | 'shoulderR'
  | 'antennaTip';
