/**
 * Where things sit on the 3-lane teaser track (lane index 0..2, z runs into the screen).
 * The demo run is scripted: lane changes by distance, then a bullet-time freeze.
 */
export const RACE_LAYOUT = {
  laneX: [-1.15, 0, 1.15],
  trackLength: 30,
  finishZ: -28,
  hazards: [
    { lane: 1, z: -6 },
    { lane: 2, z: -10.4 },
    { lane: 0, z: -13.5 },
    { lane: 1, z: -17.6 },
    { lane: 2, z: -21.5 },
    { lane: 0, z: -24.5 },
  ],
  pickups: [
    { lane: 2, z: -7.4 },
    { lane: 2, z: -8.5 },
    { lane: 1, z: -11.6 },
    { lane: 1, z: -12.7 },
    { lane: 0, z: -16.2 },
    { lane: 2, z: -18.6 },
    { lane: 1, z: -22.8 },
  ],
  demoRun: {
    startLane: 1,
    topSpeed: 8.5,
    /** Change to `lane` once the runner passes `atZ`. */
    moves: [
      { atZ: -3.4, lane: 2 },
      { atZ: -9.1, lane: 1 },
    ],
    /** Bullet-time kicks in here, just before the next hazard in the runner lane. */
    freezeAtZ: -15.2,
  },
} as const;
