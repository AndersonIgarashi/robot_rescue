/**
 * Where things sit on the 3-lane teaser track (lane index 0..2, z runs into the screen).
 * The highway runs from behind the camera to the neon city on the horizon;
 * the demo run is scripted: lane changes by distance, then a bullet-time freeze.
 */
export const RACE_LAYOUT = {
  laneX: [-1.9, 0, 1.9],
  /** Road surface width (three lanes) and where it starts / ends along z. */
  roadWidth: 5.8,
  roadStartZ: 14,
  roadEndZ: -300,
  /** The finish gate, at the city limits. */
  finishZ: -150,
  /** Hazards and pickups are scaled up from their modelled size to suit the wide lanes. */
  propScale: 1.3,
  hazards: [
    { lane: 1, z: -6 },
    { lane: 2, z: -10.4 },
    { lane: 0, z: -13.5 },
    { lane: 1, z: -17.6 },
    { lane: 2, z: -21.5 },
    { lane: 0, z: -24.5 },
    { lane: 1, z: -29 },
    { lane: 2, z: -33 },
  ],
  pickups: [
    { lane: 2, z: -7.4 },
    { lane: 2, z: -8.5 },
    { lane: 1, z: -11.6 },
    { lane: 1, z: -12.7 },
    { lane: 0, z: -16.2 },
    { lane: 2, z: -18.6 },
    { lane: 1, z: -22.8 },
    { lane: 0, z: -27 },
    { lane: 2, z: -30.5 },
  ],
  demoRun: {
    startLane: 1,
    topSpeed: 8.5,
    /** Change to `lane` once the runner passes `atZ`. */
    moves: [
      { atZ: -3.2, lane: 2 },
      { atZ: -8.9, lane: 1 },
    ],
    /** Bullet-time kicks in here, just before the next hazard in the runner lane. */
    freezeAtZ: -15.2,
  },
} as const;
