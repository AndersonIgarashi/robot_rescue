import { Vector3 } from 'three';
import type { AudioManager } from '../audio/AudioManager';
import type { CharacterAssembler } from '../character/CharacterAssembler';
import type { CharacterController } from '../character/CharacterController';
import type { Sequence } from '../core/Sequence';
import type { Tweener } from '../core/Tweener';
import { RACE_LAYOUT } from '../data/raceLayout';
import type { PowerDef } from '../data/types';
import { EmitterState, type FXManager } from '../fx/FXManager';
import type { RaceTrack } from '../race/RaceTrack';
import type { Backdrop } from '../scene/Backdrop';
import type { CameraController } from '../scene/CameraController';
import type { Stage } from '../scene/Stage';
import { damp } from '../utils/math';

export type CountdownBeat = 3 | 2 | 1 | 'GO';

export interface RaceHooks {
  onCountdown(beat: CountdownBeat): void;
  onCliffhanger(): void;
}

export interface RaceDeps {
  track: RaceTrack;
  character: CharacterController;
  assembler: CharacterAssembler;
  camera: CameraController;
  stage: Stage;
  backdrop: Backdrop;
  fx: FXManager;
  tweener: Tweener;
  audio: AudioManager;
}

type Phase = 'off' | 'ready' | 'countdown' | 'running' | 'frozen';

const BEAT_SECONDS = 0.42;
const ACCELERATION = 14;
const FROZEN_TIME_SCALE = 0.05;
/** The runner never reaches the hazard it freezes in front of. */
const FREEZE_STOP_MARGIN = 0.9;
const tmp = new Vector3();

/**
 * Stages the end card: the start line, the teaser run and the bullet-time
 * cliffhanger. It owns the world time scale; GameApp applies it to the
 * character, VFX and track so the slow-motion affects the world, not the UI.
 */
export class RaceDirector {
  private phase: Phase = 'off';
  private timeScaleValue = 1;
  private hooks: RaceHooks | null = null;
  private x = 0;
  private z = 0;
  private lane: number = RACE_LAYOUT.demoRun.startLane;
  private speed = 0;
  private moveIndex = 0;
  private collected = 0;
  private idleTimer = 0;
  private idleBeat = 0;
  private readonly dust = new EmitterState();

  constructor(private readonly deps: RaceDeps) {}

  get timeScale(): number {
    return this.timeScaleValue;
  }

  get isRunning(): boolean {
    return this.phase === 'running' || this.phase === 'frozen';
  }

  /** Swaps the pedestal for the race track and puts the racer on the start line. */
  enter(power: PowerDef): void {
    const { track, stage, backdrop, tweener, camera, character } = this.deps;
    track.prepare(power);
    track.show();
    stage.setVisible(false, tweener);
    backdrop.setVisible(false, tweener);
    this.lane = RACE_LAYOUT.demoRun.startLane;
    this.placeRunner(RACE_LAYOUT.laneX[this.lane], 0);
    camera.setAnchor(0, 0, true);
    camera.setShot('race');
    character.setPose('ready');
    character.setFacing(0);
    this.phase = 'ready';
    this.idleTimer = 1.2;
  }

  /** 3-2-1-GO, then the scripted run. Resolves when the runner is off the line. */
  async launch(seq: Sequence, hooks: RaceHooks): Promise<void> {
    if (this.phase !== 'ready') return;
    const { track, audio, character, camera } = this.deps;
    this.hooks = hooks;
    this.phase = 'countdown';
    character.setPose('crouch');
    for (const beat of [3, 2, 1] as const) {
      track.setLights(beat);
      hooks.onCountdown(beat);
      audio.play('beep');
      await seq.wait(BEAT_SECONDS);
    }
    track.setLights('go');
    hooks.onCountdown('GO');
    audio.play('go');
    camera.shake(0.25);
    character.setPose('idle');
    character.setFacing(Math.PI);
    character.setRunning(true);
    camera.setShot('chase');
    this.speed = 0;
    this.moveIndex = 0;
    this.collected = 0;
    this.phase = 'running';
  }

  /** Called every frame with real (unscaled) time. */
  update(dt: number): void {
    const target = this.phase === 'frozen' ? FROZEN_TIME_SCALE : 1;
    this.timeScaleValue = damp(this.timeScaleValue, target, this.phase === 'frozen' ? 5 : 8, dt);

    if (this.phase === 'ready') this.updateIdle(dt);
    if (this.isRunning) this.advance(dt * this.timeScaleValue);
  }

  reset(): void {
    const { track, stage, backdrop, tweener, camera, assembler } = this.deps;
    this.phase = 'off';
    this.timeScaleValue = 1;
    this.hooks = null;
    track.hide();
    stage.setVisible(true, tweener, false);
    backdrop.setVisible(true, tweener);
    assembler.root.position.set(0, 0, 0);
    assembler.root.rotation.set(0, 0, 0);
    camera.setAnchor(0, 0, true);
  }

  /** On the start line the racer stays alive: glances back at the track, bounces, revs. */
  private updateIdle(dt: number): void {
    this.idleTimer -= dt;
    if (this.idleTimer > 0) return;
    this.idleTimer = 2.4;
    const { character } = this.deps;
    if (this.idleBeat++ % 2 === 0) character.glance();
    else character.hop(2.4);
  }

  private advance(dt: number): void {
    const run = RACE_LAYOUT.demoRun;
    const { track, fx, audio, assembler, camera } = this.deps;

    this.speed = Math.min(run.topSpeed, this.speed + ACCELERATION * dt);
    this.z = Math.max(run.freezeAtZ - FREEZE_STOP_MARGIN, this.z - this.speed * dt);

    while (this.moveIndex < run.moves.length && this.z <= run.moves[this.moveIndex].atZ) {
      this.lane = run.moves[this.moveIndex].lane;
      this.moveIndex++;
      audio.play('whoosh');
    }
    const laneX = RACE_LAYOUT.laneX[this.lane];
    const previousX = this.x;
    this.x = damp(this.x, laneX, 11, dt);
    this.placeRunner(this.x, this.z);
    // Lean into lane changes.
    assembler.root.rotation.z = dt > 0 ? damp(assembler.root.rotation.z, (previousX - this.x) / dt * 0.05, 12, dt) : 0;
    camera.setAnchor(this.x * 0.5, this.z);

    const kind = track.collectNear(this.x, this.z);
    if (kind) {
      this.collected++;
      tmp.set(this.x, 0.9, this.z);
      fx.burst('sparkleBurst', tmp, 16, assembler.materials.tint);
      audio.play('collect', this.collected);
    }
    if (assembler.rig.legL) fx.stream(this.dust, 'runDust', tmp.set(this.x, 0.05, this.z + 0.2), 16, dt);

    if (this.phase === 'running' && this.z <= run.freezeAtZ) {
      // Bullet time: swing to a side angle so the racer and the threat ahead share the frame.
      this.phase = 'frozen';
      camera.setShot('freeze');
      camera.punch(0.08);
      this.hooks?.onCliffhanger();
    }
  }

  private placeRunner(x: number, z: number): void {
    this.x = x;
    this.z = z;
    this.deps.assembler.root.position.set(x, 0, z);
  }
}
