import type { IconId } from '../data/types';

/**
 * Hand-authored inline SVG icons (no icon font, no requests). `--ic-ink` is
 * set by the parent card so details pick up the card's edge colour.
 */
export const CHOICE_ICONS: Record<IconId, string> = {
  brain: `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="#fff"><circle cx="22" cy="21" r="11"/><circle cx="42" cy="21" r="11"/><circle cx="15" cy="33" r="10"/><circle cx="49" cy="33" r="10"/><circle cx="23" cy="44" r="10"/><circle cx="41" cy="44" r="10"/><rect x="17" y="19" width="30" height="30" rx="6"/></g><g fill="none" stroke="var(--ic-ink)" stroke-width="3.6" stroke-linecap="round"><path d="M32 12v40"/><path d="M19 26c3 0 6 2 6 6"/><path d="M45 26c-3 0-6 2-6 6"/><path d="M16 40c3-1 7 0 8 4"/><path d="M48 40c-3-1-7 0-8 4"/></g></svg>`,
  rocket: `<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(40 32 32)"><path d="M26 47h12l-2 12h-8z" fill="#ffd23f"/><path d="M32 3c9 7 13 18 13 30v13H19V33c0-12 4-23 13-30z" fill="#fff"/><path d="M19 34l-8 10v7l8-4zM45 34l8 10v7l-8-4z" fill="#fff"/><circle cx="32" cy="25" r="6" fill="var(--ic-ink)"/><circle cx="30" cy="23" r="2" fill="#fff"/></g></svg>`,
  palette: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5C17 5 5 16 5 31c0 13 10 24 23 24 4 0 7-2 7-6 0-2-1-3-1-5 0-3 2-5 5-5h7c8 0 14-6 14-14C60 14 47 5 32 5z" fill="#fff"/><circle cx="19" cy="26" r="5.5" fill="#ff5fa8"/><circle cx="31" cy="16" r="5.5" fill="#ffd23f"/><circle cx="45" cy="20" r="5.5" fill="#20c9b0"/><circle cx="18" cy="40" r="5.5" fill="#7c5cff"/></svg>`,
  flame: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M33 3c2 11 16 17 16 34a17 17 0 0 1-34 0c0-8 4-14 9-18 0 6 2 9 5 10-2-10 1-19 4-26z" fill="#fff"/><path d="M32 31c2 6 9 9 9 17a9 9 0 0 1-18 0c0-4 2-7 5-9 0 3 1 5 3 6-1-5-1-10 1-14z" fill="#ffd23f"/></svg>`,
  snowflake: `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M32 32V6M24 11l8 8 8-8"/><path d="M32 32V6M24 11l8 8 8-8" transform="rotate(60 32 32)"/><path d="M32 32V6M24 11l8 8 8-8" transform="rotate(120 32 32)"/><path d="M32 32V6M24 11l8 8 8-8" transform="rotate(180 32 32)"/><path d="M32 32V6M24 11l8 8 8-8" transform="rotate(240 32 32)"/><path d="M32 32V6M24 11l8 8 8-8" transform="rotate(300 32 32)"/></g><circle cx="32" cy="32" r="6" fill="#fff"/></svg>`,
  bolt: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M38 3L11 36h17l-5 25 30-35H36z" fill="#fff" stroke="var(--ic-ink)" stroke-width="3" stroke-linejoin="round"/></svg>`,
  robot: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="30" y="4" width="4" height="11" fill="#fff"/><circle cx="32" cy="6" r="4.5" fill="#fff"/><rect x="8" y="14" width="48" height="40" rx="13" fill="#fff"/><rect x="15" y="22" width="34" height="23" rx="8" fill="var(--ic-ink)"/><circle cx="25" cy="33" r="4.5" fill="#fff"/><circle cx="39" cy="33" r="4.5" fill="#fff"/><rect x="3" y="27" width="6" height="14" rx="3" fill="#fff"/><rect x="55" y="27" width="6" height="14" rx="3" fill="#fff"/></svg>`,
  android: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="#fff"/><rect x="11" y="24" width="42" height="16" rx="8" fill="var(--ic-ink)"/><rect x="19" y="29" width="9" height="6" rx="3" fill="#fff"/><rect x="36" y="29" width="9" height="6" rx="3" fill="#fff"/><rect x="4" y="27" width="5" height="10" rx="2.5" fill="#fff"/><rect x="55" y="27" width="5" height="10" rx="2.5" fill="#fff"/></svg>`,
  drone: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="11" width="22" height="5" rx="2.5" fill="#fff"/><rect x="40" y="11" width="22" height="5" rx="2.5" fill="#fff"/><rect x="11" y="14" width="4" height="11" fill="#fff"/><rect x="49" y="14" width="4" height="11" fill="#fff"/><rect x="11" y="23" width="42" height="6" rx="3" fill="#fff"/><circle cx="32" cy="39" r="17" fill="#fff"/><rect x="20" y="33" width="24" height="11" rx="5.5" fill="var(--ic-ink)"/><circle cx="27" cy="38.5" r="2.8" fill="#fff"/><circle cx="37" cy="38.5" r="2.8" fill="#fff"/></svg>`,
};

export const UI_ICONS = {
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  soundOn: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
  replay: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M19.5 4v5h-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hand: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 37V11a6 6 0 0 1 12 0v16a6 6 0 0 1 11 2.5 6 6 0 0 1 10 3.5v10c0 11-8 18-19 18h-4c-7 0-12-4-16-10l-8-12a5 5 0 0 1 8-6z" fill="#fff" stroke="#1d1646" stroke-width="3" stroke-linejoin="round"/><path d="M34 27v8M45 30v6" stroke="#1d1646" stroke-width="3" stroke-linecap="round"/></svg>`,
  sparkle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1c1 6 5 10 11 11-6 1-10 5-11 11-1-6-5-10-11-11 6-1 10-5 11-11z" fill="currentColor"/></svg>`,
} as const;

/** Hand SVG fingertip, as a fraction of the icon box (for aiming the tutorial hand). */
export const HAND_HOTSPOT = { x: 28 / 64, y: 6 / 64 } as const;
