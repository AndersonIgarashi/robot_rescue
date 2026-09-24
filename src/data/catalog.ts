import { BODY_TYPES, DEFAULT_BODY_TYPE, type BodyTypeId } from './bodyTypes';
import { GADGETS, type GadgetId } from './gadgets';
import { POWERS, type PowerId } from './powers';

export type Gadget = (typeof GADGETS)[number];
export type Power = (typeof POWERS)[number];
export type BodyType = (typeof BODY_TYPES)[number];

/** What the player has picked so far. Missing keys mean "not chosen yet". */
export interface Selections {
  gadget?: GadgetId;
  power?: PowerId;
  bodyType?: BodyTypeId;
}

export const getGadget = (id: GadgetId | null | undefined): Gadget | undefined =>
  id ? GADGETS.find((entry) => entry.id === id) : undefined;

export const getPower = (id: PowerId | null | undefined): Power | undefined =>
  id ? POWERS.find((entry) => entry.id === id) : undefined;

export const getBodyType = (id: BodyTypeId | null | undefined): BodyType =>
  BODY_TYPES.find((entry) => entry.id === (id ?? DEFAULT_BODY_TYPE)) ?? BODY_TYPES[0];

export const isGadgetId = (value: string): value is GadgetId => GADGETS.some((entry) => entry.id === value);

export const isPowerId = (value: string): value is PowerId => POWERS.some((entry) => entry.id === value);

export const isBodyTypeId = (value: string): value is BodyTypeId => BODY_TYPES.some((entry) => entry.id === value);
