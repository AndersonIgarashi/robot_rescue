import { BODY_TYPES, DEFAULT_BODY_TYPE, type BodyTypeId } from './bodyTypes';
import { PERSONALITIES, type PersonalityId } from './personalities';
import { POWERS, type PowerId } from './powers';

export type Personality = (typeof PERSONALITIES)[number];
export type Power = (typeof POWERS)[number];
export type BodyType = (typeof BODY_TYPES)[number];

/** What the player has picked so far. Missing keys mean "not chosen yet". */
export interface Selections {
  personality?: PersonalityId;
  power?: PowerId;
  bodyType?: BodyTypeId;
}

export const getPersonality = (id: PersonalityId | null | undefined): Personality | undefined =>
  id ? PERSONALITIES.find((entry) => entry.id === id) : undefined;

export const getPower = (id: PowerId | null | undefined): Power | undefined =>
  id ? POWERS.find((entry) => entry.id === id) : undefined;

export const getBodyType = (id: BodyTypeId | null | undefined): BodyType =>
  BODY_TYPES.find((entry) => entry.id === (id ?? DEFAULT_BODY_TYPE)) ?? BODY_TYPES[0];

export const isPersonalityId = (value: string): value is PersonalityId =>
  PERSONALITIES.some((entry) => entry.id === value);

export const isPowerId = (value: string): value is PowerId => POWERS.some((entry) => entry.id === value);

export const isBodyTypeId = (value: string): value is BodyTypeId => BODY_TYPES.some((entry) => entry.id === value);
