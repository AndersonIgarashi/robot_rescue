import { Vector3 } from 'three';
import type { AICharacterRequest, AICharacterResult, IAICharacterGenerator } from '../ai/IAICharacterGenerator';
import { MockAICharacterGenerator } from '../ai/MockAICharacterGenerator';
import type { AdBridge } from '../ads/AdBridge';
import type { AnalyticsManager } from '../analytics/AnalyticsManager';
import type { AudioManager } from '../audio/AudioManager';
import type { CharacterAssembler } from '../character/CharacterAssembler';
import type { CharacterConfig } from '../character/CharacterConfig';
import type { BuildStage, CharacterController } from '../character/CharacterController';
import { Sequence } from '../core/Sequence';
import type { Tweener } from '../core/Tweener';
import type { AdConfig } from '../data/adConfig';
import { BUILD_STAGES } from '../data/buildStages';
import { getBodyType, getGadget, getPower } from '../data/catalog';
import type { SelectionKey } from '../data/steps';
import { DEFAULT_THEME } from '../data/theme';
import type { FXManager } from '../fx/FXManager';
import type { InputManager } from '../input/InputManager';
import type { CameraController } from '../scene/CameraController';
import type { ProgressSlotView } from '../ui/types';
import type { UIManager } from '../ui/UIManager';
import type { ChoiceChange, ChoiceManager } from './ChoiceManager';
import type { RaceDirector } from './RaceDirector';

export interface GameContext {
  ui: UIManager;
  input: InputManager;
  audio: AudioManager;
  analytics: AnalyticsManager;
  tweener: Tweener;
  fx: FXManager;
  camera: CameraController;
  assembler: CharacterAssembler;
  character: CharacterController;
  choices: ChoiceManager;
  race: RaceDirector;
  ai: IAICharacterGenerator;
  adBridge: AdBridge;
  config: AdConfig;
}

type FlowState = 'choice' | 'building' | 'reveal' | 'race' | 'launched';

const ASSEMBLY_CLANK: Partial<Record<BuildStage, number>> = { legs: 0, body: 1, arms: 2, head: 3 };
/** While the first question waits for its answer, the robot waves to draw the eye. */
const ATTRACT_WAVE_INTERVAL = 3.2;
const ATTRACT_FIRST_WAVE = 0.6;
/** How long the "YOUR AI IS READY!" beat holds before the race set rolls in. */
const REVEAL_HOLD = 2.6;
const RACE_HINT_DELAY = 2.2;
const CLIFFHANGER_HINT_DELAY = 1.4;

const center = new Vector3();
const ground = new Vector3();
const tmp = new Vector3();

/**
 * The playable's state machine: CHOICES (data-driven steps, the first one is
 * on screen at load) -> BUILD -> REVEAL -> RACE (end card, CTA) -> teaser run
 * -> cliffhanger.
 * It translates UI intent into ChoiceManager updates and orchestrates the
 * feedback (character, FX, camera, audio, analytics) — but owns none of those systems.
 */
export class GameFlow {
  private state: FlowState = 'choice';
  private stepIndex = 0;
  private busy = false;
  private sequence: Sequence | null = null;
  private generation = new AbortController();
  private readonly localAI = new MockAICharacterGenerator({ latencyMs: [0, 0] });
  private hintDelay = 0;
  private hintCountdown = -1;
  private waveTimer = 0;
  private startedAt = 0;
  private plays = 0;
  private result: AICharacterResult | null = null;

  constructor(private readonly ctx: GameContext) {
    const { ui, input, audio, character } = ctx;
    ui.events.on('select', ({ stepId, optionId, index }) => this.handleSelect(stepId, optionId, index));
    ui.events.on('cta', () => this.handleCta());
    ui.events.on('replay', () => this.handleReplay());
    ui.events.on('toggleSound', () => this.toggleSound());
    input.onAnyPointerDown(() => {
      audio.unlock();
      ui.hideHint();
      this.rearmHint();
    });
    character.hooks = {
      onLand: (strength) => audio.play('land', strength > 0.6 ? 1 : 0),
      onBuildStage: (stage) => this.onBuildStage(stage),
    };
  }

  private get steps() {
    return this.ctx.choices.steps;
  }

  /** No title screen: the first question is the first thing the player sees. */
  start(): void {
    const { ui, audio, camera, choices, config } = this.ctx;
    ui.setMuted(audio.muted);
    ui.setTheme(DEFAULT_THEME, choices.config.color.energy);
    camera.setSubject(getBodyType(choices.config.bodyType).bounds);
    this.startedAt = performance.now();
    this.goToStep(0);
    this.armHint(config.hintDelayFirst);
  }

  update(dt: number): void {
    if (this.hintCountdown > 0) {
      this.hintCountdown -= dt;
      if (this.hintCountdown <= 0) this.ctx.ui.showHint();
    }
    if (this.state === 'choice' && this.stepIndex === 0 && !this.busy) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.waveTimer = ATTRACT_WAVE_INTERVAL;
        this.ctx.character.wave();
      }
    }
  }

  // --- Input handlers -------------------------------------------------------

  private handleSelect(stepId: SelectionKey, optionId: string, index: number): void {
    if (this.state !== 'choice' || this.busy) return;
    const step = this.steps[this.stepIndex];
    if (step.id !== stepId) return;
    const change = this.ctx.choices.select(stepId, optionId);
    if (!change) return;

    const { ui, analytics, character, config } = this.ctx;
    this.busy = true;
    this.disarmHint();
    ui.markSelected(optionId, this.progress(this.stepIndex));
    ui.setTheme(change.theme, change.config.color.energy);
    this.applyConfig(change.config, true);
    character.react(step.reaction);
    this.playChoiceFeedback(change, index);
    analytics.track(step.event, { [step.id]: optionId, step: this.stepIndex + 1 });

    this.runSequence(async (seq) => {
      await seq.wait(config.autoAdvanceDelay);
      if (this.stepIndex + 1 < this.steps.length) this.goToStep(this.stepIndex + 1);
      else await this.build(seq);
    });
  }

  /**
   * RUN! opens the store. In the ad the player lands in the store while the
   * racer launches off the line behind it; the teaser run ends on a freeze
   * with a second CTA.
   */
  private handleCta(): void {
    if (this.state !== 'race' && this.state !== 'launched') return;
    const { analytics, audio, camera, adBridge, ui, config, race } = this.ctx;
    const fromStartLine = this.state === 'race';
    analytics.track('CTA_CLICKED', {
      name: this.result?.name ?? null,
      label: fromStartLine ? config.ctaLabel : config.ctaFollowUpLabel,
      placement: fromStartLine ? 'start_line' : 'cliffhanger',
      environment: adBridge.environment,
    });
    audio.play('cta');
    camera.punch(0.05);
    const redirected = adBridge.openStore(config.storeUrl);
    ui.showToast(redirected ? 'OPENING STORE\u2026' : 'CTA_CLICKED \u00b7 STORE REDIRECT (DEMO)');
    if (!fromStartLine) return;

    this.state = 'launched';
    this.disarmHint();
    this.hintDelay = 0;
    this.runSequence((seq) =>
      race.launch(seq, {
        onCountdown: (beat) => ui.showCountdown(beat === 'GO' ? 'GO!' : String(beat)),
        onCliffhanger: () => {
          ui.showRaceCliffhanger(config.ctaFollowUpLabel);
          audio.play('powerUp');
          this.armHint(CLIFFHANGER_HINT_DELAY);
        },
      }),
    );
  }

  private handleReplay(): void {
    if (this.state !== 'race' && this.state !== 'launched') return;
    const { analytics, tweener, fx, character, choices, ui, audio, race } = this.ctx;
    this.plays++;
    analytics.track('RESTARTED', { playCount: this.plays });

    // Tear down everything in flight, then rebuild state from scratch — no page reload.
    this.sequence?.cancel();
    this.sequence = null;
    this.generation.abort();
    this.generation = new AbortController();
    tweener.killAll();
    fx.clear();
    race.reset();
    character.reset();
    choices.reset();
    this.applyConfig(choices.config, false);

    ui.hideToast();
    ui.setTheme(DEFAULT_THEME, choices.config.color.energy);
    ui.flash();
    audio.play('whoosh');
    this.result = null;
    this.startedAt = performance.now();
    character.react('body');
    this.goToStep(0);
  }

  private toggleSound(): void {
    const { audio, ui } = this.ctx;
    audio.unlock();
    audio.setMuted(!audio.muted);
    ui.setMuted(audio.muted);
    audio.play('tap');
  }

  // --- Flow -------------------------------------------------------------------

  private goToStep(index: number): void {
    const { ui, camera, config } = this.ctx;
    const step = this.steps[index];
    this.state = 'choice';
    this.stepIndex = index;
    this.busy = false;
    if (index === 0) this.waveTimer = ATTRACT_FIRST_WAVE;
    ui.showChoice({ stepId: step.id, title: step.title, options: step.options, progress: this.progress(index) });
    camera.setShot('choice');
    this.armHint(config.hintDelayChoice);
  }

  private async build(seq: Sequence): Promise<void> {
    const { choices, ui, camera, character, analytics } = this.ctx;
    const request = choices.toRequest();
    if (!request) return;

    this.state = 'building';
    ui.showBuild();
    camera.setShot('build');

    // The AI call runs while the assembly plays, hiding its latency behind the show.
    const generation = this.generate(request);
    await character.playAssembly(seq);
    const result = await seq.await(generation);

    this.result = result;
    analytics.track('CHARACTER_GENERATED', {
      name: result.name,
      model: result.model,
      latencyMs: result.latencyMs,
      gadget: request.gadget,
      power: request.power,
      bodyType: request.bodyType,
    });
    this.applyConfig(result.config, true);
    await this.reveal(result, seq);
    this.enterRace(result);
  }

  /** Celebration beat: name, tagline, confetti — then the race set rolls in. */
  private async reveal(result: AICharacterResult, seq: Sequence): Promise<void> {
    const { ui, audio, camera } = this.ctx;
    this.state = 'reveal';
    ui.showReveal({
      name: result.name,
      designation: result.designation,
      bodyLabel: getBodyType(result.config.bodyType).label,
      tagline: result.tagline,
      description: result.description,
    });
    camera.setShot('reveal');
    camera.punch(0.08);
    audio.play('success');
    this.celebrate(1);
    await seq.wait(REVEAL_HOLD);
  }

  /** The end card: the racer on the start line of a track themed by its power. */
  private enterRace(result: AICharacterResult): void {
    const { ui, race, analytics, audio, config } = this.ctx;
    const power = getPower(result.config.power);
    const gadget = getGadget(result.config.gadget);
    const body = getBodyType(result.config.bodyType);
    if (!power || !gadget) return;

    this.state = 'race';
    this.busy = false;
    race.enter(power, result.name);
    ui.showRace({
      name: result.name,
      hazardLabel: power.hazard.label,
      hazardIcon: power.hazard.icon,
      pickupLabel: power.pickup.label,
      pickupIcon: power.icon,
      chips: [
        { icon: gadget.icon, label: gadget.label },
        { icon: power.icon, label: power.label },
        { icon: body.icon, label: body.ability },
      ],
      stats: result.stats,
      ctaLabel: config.ctaLabel,
    });
    audio.play('whoosh');
    analytics.track('PLAYABLE_COMPLETED', { durationMs: Math.round(performance.now() - this.startedAt), name: result.name });
    this.armHint(RACE_HINT_DELAY);
  }

  /** Never rejects: any failure (or a restart) falls back to the local generator. */
  private async generate(request: AICharacterRequest): Promise<AICharacterResult> {
    try {
      return await this.ctx.ai.generateCharacter(request, { signal: this.generation.signal });
    } catch (error) {
      if (!this.generation.signal.aborted) console.warn('[flow] AI generation failed — using local result.', error);
      return this.localAI.generateCharacter(request);
    }
  }

  // --- Feedback ---------------------------------------------------------------

  private playChoiceFeedback(change: ChoiceChange, index: number): void {
    const { audio, camera, fx, character, assembler, tweener, ui } = this.ctx;
    const tint = assembler.materials.tint;

    switch (change.step.reaction) {
      case 'select':
        audio.play('select', index);
        camera.punch(0.05);
        assembler.materials.flash(0.8);
        tweener.tween({
          duration: 0.3,
          onComplete: () => {
            for (const object of assembler.mountedObjects(change.config.accessories)) {
              fx.burst('sparkleBurst', object.getWorldPosition(tmp), 8, tint);
            }
            audio.play('pop', 1);
          },
        });
        break;
      case 'power': {
        const power = getPower(change.config.power);
        if (!power) break;
        audio.play(power.sfx);
        tweener.tween({
          duration: 0.16,
          onComplete: () => {
            character.getAnchor('center', center);
            character.getAnchor('ground', ground);
            fx.powerBurst(power.burst, center, ground, tint);
            camera.shake(0.55);
            assembler.materials.flash(1);
            ui.flash();
          },
        });
        break;
      }
      case 'body':
        audio.play('pop', 2);
        audio.play('whoosh');
        camera.shake(0.2);
        camera.punch(0.06);
        break;
    }
  }

  private onBuildStage(stage: BuildStage): void {
    const { ui, audio, camera, fx, character, assembler, tweener } = this.ctx;
    const power = getPower(assembler.config.power);
    const beat = BUILD_STAGES[stage];
    ui.setBuildProgress(beat.progress, beat.status.replace('{power}', power?.label ?? 'POWER'));
    const tint = assembler.materials.tint;

    switch (stage) {
      case 'scan': {
        audio.play('powerUp');
        character.getAnchor('ground', ground);
        fx.energy.scan(ground, tint[0], 0, getBodyType(assembler.config.bodyType).bounds.top, 0.95, 1);
        break;
      }
      case 'legs':
      case 'body':
      case 'arms':
      case 'head':
        audio.play('clank', ASSEMBLY_CLANK[stage] ?? 0);
        camera.shake(stage === 'head' ? 0.32 : 0.14);
        break;
      case 'accessories':
        audio.play('pop', 1);
        tweener.tween({ duration: 0.14, onComplete: () => audio.play('pop', 2) });
        break;
      case 'power':
        if (power) audio.play(power.sfx);
        audio.play('powerUp');
        character.getAnchor('center', center);
        character.getAnchor('ground', ground);
        fx.energy.beamBurst(ground, tint[0], 0.75, 0.7);
        if (power) fx.powerBurst(power.burst, center, ground, tint);
        camera.shake(0.6);
        ui.flash();
        break;
      case 'hero':
        audio.play('whoosh');
        break;
    }
  }

  private celebrate(intensity: number): void {
    const { fx, character, assembler } = this.ctx;
    character.getAnchor('ground', ground);
    for (const side of [-1, 1]) {
      tmp.set(ground.x + side * 1.15, 0.2, ground.z + 0.5);
      fx.burst('confetti', tmp, 50 * intensity);
    }
    fx.energy.shockwave(ground, assembler.materials.tint[0], 3.2);
  }

  // --- Helpers ------------------------------------------------------------------

  private applyConfig(config: CharacterConfig, animate: boolean): void {
    const change = this.ctx.assembler.apply(config, animate);
    if (change.rigChanged) this.ctx.camera.setSubject(getBodyType(config.bodyType).bounds);
  }

  private progress(currentIndex: number): ProgressSlotView[] {
    return this.steps.map((step, i) => {
      const chosen = this.ctx.choices.selectedOption(step);
      return {
        icon: chosen?.icon ?? step.placeholderIcon,
        done: chosen !== undefined,
        current: i === currentIndex && chosen === undefined,
        card: chosen?.card,
      };
    });
  }

  private runSequence(body: (seq: Sequence) => Promise<void>): void {
    this.sequence?.cancel();
    const sequence = new Sequence(this.ctx.tweener);
    this.sequence = sequence;
    Sequence.run(sequence, body).catch((error: unknown) => {
      console.error('[flow] sequence failed', error);
      this.busy = false;
    });
  }

  private armHint(delay: number): void {
    this.hintDelay = delay;
    this.hintCountdown = delay;
  }

  private rearmHint(): void {
    const idleState = this.state !== 'building' && this.state !== 'reveal';
    if (!this.busy && idleState && this.hintDelay > 0) this.hintCountdown = this.hintDelay;
  }

  private disarmHint(): void {
    this.hintCountdown = -1;
    this.ctx.ui.hideHint();
  }
}
