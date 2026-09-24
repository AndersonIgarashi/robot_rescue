/** Vocabulary of the race teaser. Powers reference these ids from data. */

/** What a power must avoid on the track. */
export type HazardKind = 'waterJet' | 'flameJet' | 'magnet';

/** What a power collects on the track (its own element). */
export type PickupKind = 'flameOrb' | 'snowflake' | 'battery';

export type LightsState = 'off' | 'ready' | 1 | 2 | 3 | 'go';
