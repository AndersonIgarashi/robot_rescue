import { Vector3, type Object3D } from 'three';
import { createAIGenerator } from '../ai/createAIGenerator';
import { AdBridge } from '../ads/AdBridge';
import { AnalyticsManager, ConsoleSink, LocalStorageSink } from '../analytics/AnalyticsManager';
import { AudioManager } from '../audio/AudioManager';
import { CharacterAssembler } from '../character/CharacterAssembler';
import { CharacterController } from '../character/CharacterController';
import { POWERS } from '../data/powers';
import { loadAdConfig, type AdConfig } from '../data/adConfig';
import { FXManager } from '../fx/FXManager';
import { ChoiceManager } from '../gameplay/ChoiceManager';
import { GameFlow } from '../gameplay/GameFlow';
import { RaceDirector } from '../gameplay/RaceDirector';
import { InputManager } from '../input/InputManager';
import { RaceTrack } from '../race/RaceTrack';
import { Backdrop } from '../scene/Backdrop';
import { BlobShadow, createRadialTexture } from '../scene/BlobShadow';
import { CameraController } from '../scene/CameraController';
import { SceneManager } from '../scene/SceneManager';
import { Stage } from '../scene/Stage';
import { DevPanel } from '../ui/DevPanel';
import { UIManager } from '../ui/UIManager';
import { DEG2RAD, damp } from '../utils/math';
import { QualityManager, type QualityLevel } from './QualityManager';
import { Tweener } from './Tweener';

const MAX_FRAME_DT = 1 / 20;

/** Temporarily shows hidden descendants (so the renderer compiles their shaders), then restores them. */
function withHiddenRevealed(root: Object3D, action: () => void): void {
  const hidden: Object3D[] = [];
  root.traverse((object) => {
    if (!object.visible) {
      hidden.push(object);
      object.visible = true;
    }
  });
  action();
  for (const object of hidden) object.visible = false;
}

/**
 * Composition root and main loop. Creates every system, wires them together
 * and drives them each frame. Game rules live in GameFlow, not here.
 */
export class GameApp {
  private readonly config: AdConfig = loadAdConfig();
  private readonly tweener = new Tweener();
  private readonly analytics = new AnalyticsManager([new ConsoleSink(), new LocalStorageSink()]);
  private readonly adBridge = new AdBridge();
  private readonly audio: AudioManager;
  private readonly input: InputManager;
  private readonly sceneManager: SceneManager;
  private readonly camera = new CameraController();
  private readonly fx = new FXManager();
  private readonly gradient = createRadialTexture();
  private readonly stage = new Stage(this.gradient);
  private readonly shadow = new BlobShadow(this.gradient);
  private readonly backdrop = new Backdrop();
  private readonly choices = new ChoiceManager();
  private readonly assembler: CharacterAssembler;
  private readonly character: CharacterController;
  private readonly raceTrack: RaceTrack;
  private readonly race: RaceDirector;
  private readonly ui: UIManager;
  private readonly flow: GameFlow;
  private readonly quality: QualityManager;
  private readonly devPanel: DevPanel | null = null;

  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  /** World time: slows down with the race bullet-time; UI and camera keep real time. */
  private worldTime = 0;
  private running = false;
  private contextLost = false;
  private resizeQueued = false;
  private pointScaleFov = 0;
  private parallaxX = 0;
  private parallaxY = 0;
  private readonly focusWorld = new Vector3();
  private readonly focusScreen = { x: 0, y: 0 };

  constructor(private readonly root: HTMLElement) {
    this.audio = new AudioManager(this.config.soundEnabled);
    this.input = new InputManager(root);
    this.sceneManager = new SceneManager(root, { maxPixelRatio: this.config.maxPixelRatio });
    this.assembler = new CharacterAssembler(this.tweener, this.fx, this.choices.config);
    this.character = new CharacterController(this.assembler, this.tweener, this.fx);
    this.assembler.root.add(this.shadow.mesh);
    this.raceTrack = new RaceTrack(this.assembler.geometry, this.tweener);
    this.race = new RaceDirector({
      track: this.raceTrack,
      atmosphere: this.sceneManager,
      character: this.character,
      assembler: this.assembler,
      camera: this.camera,
      stage: this.stage,
      backdrop: this.backdrop,
      fx: this.fx,
      tweener: this.tweener,
      audio: this.audio,
    });
    this.sceneManager.add(this.backdrop.root, this.stage.root, this.raceTrack.root, this.assembler.root, this.fx.root);

    this.ui = new UIManager(root, this.input, this.audio, this.tweener);
    this.ui.onLayoutChange = () => this.updateViewport();

    this.flow = new GameFlow({
      ui: this.ui,
      input: this.input,
      audio: this.audio,
      analytics: this.analytics,
      tweener: this.tweener,
      fx: this.fx,
      camera: this.camera,
      assembler: this.assembler,
      character: this.character,
      choices: this.choices,
      race: this.race,
      ai: createAIGenerator(this.config),
      adBridge: this.adBridge,
      config: this.config,
    });

    this.quality = new QualityManager(this.config.maxPixelRatio, (level) => this.applyQuality(level));

    if (this.config.showDevTools) {
      this.devPanel = new DevPanel(this.input, this.analytics, this.adBridge.environment);
      this.ui.root.append(this.devPanel.toggle, this.devPanel.panel);
    }

    this.bindCanvasDrag();
    this.bindLifecycle();
  }

  async start(): Promise<void> {
    await this.adBridge.ready();
    this.resize();
    // Show the first screen before snapping, so the camera starts framed on the real layout.
    this.flow.start();
    this.camera.snap();
    this.running = true;
    this.lastTime = performance.now();
    this.update(0, this.lastTime);
    this.sceneManager.render(this.camera.camera);
    this.rafId = requestAnimationFrame(this.frame);

    this.analytics.track('PLAYABLE_STARTED', {
      adEnvironment: this.adBridge.environment,
      viewport: `${this.root.clientWidth}x${this.root.clientHeight}`,
      pixelRatio: this.sceneManager.currentPixelRatio,
      ctaLabel: this.config.ctaLabel,
    });

    // After the first frame is on screen: build every part combination and
    // compile every shader, so no choice ever hitches mid-play.
    const warm = (): void => this.prewarm();
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warm, { timeout: 600 });
    else window.setTimeout(warm, 50);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);
    const dt = Math.min((now - this.lastTime) / 1000, MAX_FRAME_DT);
    this.lastTime = now;
    this.update(dt, now);
    this.sceneManager.render(this.camera.camera);
    this.quality.sample(dt);
    if (this.devPanel) {
      const info = this.sceneManager.renderer.info;
      this.devPanel.update(dt, {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        particles: this.fx.particleCount,
        pixelRatio: this.sceneManager.currentPixelRatio,
      });
    }
  };

  private update(dt: number, now: number): void {
    this.elapsed += dt;
    this.input.update(now);
    this.tweener.update(dt);
    this.flow.update(dt);
    this.race.update(dt);
    const worldDt = dt * this.race.timeScale;
    this.worldTime += worldDt;

    const pointer = this.input.pointer;
    this.character.update(worldDt, pointer);
    this.assembler.update(worldDt, this.worldTime);

    this.parallaxX = damp(this.parallaxX, pointer.active ? pointer.x : 0, 2.5, dt);
    this.parallaxY = damp(this.parallaxY, pointer.active ? pointer.y : 0, 2.5, dt);
    this.camera.setPointer(this.parallaxX, this.parallaxY);
    this.camera.update(dt);
    if (Math.abs(this.camera.fov - this.pointScaleFov) > 0.05) this.syncPointScale();

    this.fx.update(worldDt, this.camera.camera.position);
    const energy = this.assembler.materials.energyColor;
    this.raceTrack.update(worldDt, this.fx, energy, this.camera.camera.position);
    const rig = this.assembler.rig;
    this.stage.update(this.elapsed, energy);
    this.shadow.update(rig.metrics.hover + rig.root.position.y);
    this.backdrop.update(dt, this.elapsed);
    this.sceneManager.setRimColor(this.assembler.materials.energyColor);
    this.updateFocus();
  }

  /** Keeps the CSS glow/rays centred on the hero wherever the layout puts it. */
  private updateFocus(): void {
    this.character.getAnchor('center', this.focusWorld);
    this.focusWorld.y += 0.35;
    this.camera.project(this.focusWorld, this.focusScreen);
    this.ui.setFocus(this.focusScreen.x, this.focusScreen.y);
  }

  private prewarm(): void {
    try {
      this.assembler.prewarm();
      const warmup = this.assembler.createShaderWarmup();
      withHiddenRevealed(this.fx.root, () => this.sceneManager.compile(warmup, this.camera.camera));
      const { renderer, scene } = this.sceneManager;
      this.raceTrack.prewarm(
        POWERS,
        () => renderer.compile(scene, this.camera.camera),
        (texture) => renderer.initTexture(texture),
      );
    } catch (error) {
      console.warn('[app] prewarm skipped', error);
    }
  }

  private resize(): void {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    this.sceneManager.resize(width, height);
    this.syncPointScale();
    this.ui.refreshLayout();
  }

  /** Particle sizes are in world units: their pixel scale follows the buffer height and the lens. */
  private syncPointScale(): void {
    this.pointScaleFov = this.camera.fov;
    this.fx.setPointScale(this.sceneManager.bufferHeight / 2 / Math.tan((this.pointScaleFov * DEG2RAD) / 2));
  }

  private updateViewport(): void {
    this.camera.setViewport(this.root.clientWidth, this.root.clientHeight, this.ui.stage);
  }

  private applyQuality(level: QualityLevel): void {
    this.fx.density = level.fxDensity;
    this.sceneManager.setMaxPixelRatio(level.maxPixelRatio);
    this.resize();
  }

  private bindCanvasDrag(): void {
    this.input.bindDrag(this.sceneManager.canvas, {
      start: () => {
        this.audio.unlock();
        this.character.beginDrag();
      },
      move: (dx, _dy, dt) => this.character.drag(dx, dt),
      end: () => this.character.endDrag(),
    });
  }

  private bindLifecycle(): void {
    const queueResize = (): void => {
      if (this.resizeQueued) return;
      this.resizeQueued = true;
      requestAnimationFrame(() => {
        this.resizeQueued = false;
        this.resize();
      });
    };
    window.addEventListener('resize', queueResize);
    window.addEventListener('orientationchange', queueResize);
    window.visualViewport?.addEventListener('resize', queueResize);

    // Ad containers require the creative to go quiet and idle when hidden.
    document.addEventListener('visibilitychange', () => {
      const hidden = document.visibilityState === 'hidden';
      this.audio.setSuspended(hidden);
      if (hidden) this.pause();
      else this.resume();
    });

    const canvas = this.sceneManager.canvas;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.pause();
      this.ui.showToast('RELOADING GRAPHICS…', 0);
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.ui.hideToast();
      this.resume();
    });
  }

  private pause(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private resume(): void {
    if (this.running || this.contextLost || document.visibilityState === 'hidden') return;
    this.running = true;
    this.lastTime = performance.now();
    this.quality.resetWindow();
    this.rafId = requestAnimationFrame(this.frame);
  }
}
