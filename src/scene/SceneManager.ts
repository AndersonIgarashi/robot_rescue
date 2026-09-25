import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  NeutralToneMapping,
  PMREMGenerator,
  Scene,
  Vector2,
  WebGLRenderer,
  type Camera,
  type Object3D,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CITY_COLORS, CITY_FOG, STAGE_COLORS } from '../data/theme';
import { lerp } from '../utils/math';

const WHITE = new Color(0xffffff);
/** Fog that never reaches anything: kept on the scene so shaders never recompile when it comes on. */
const FOG_OFF = 1e5;

const MOOD = {
  hemiSky: [new Color(STAGE_COLORS.hemiSky), new Color(CITY_COLORS.hemiSky)],
  hemiGround: [new Color(STAGE_COLORS.hemiGround), new Color(CITY_COLORS.hemiGround)],
  key: [new Color(STAGE_COLORS.key), new Color(CITY_COLORS.key)],
} as const;

export interface SceneOptions {
  maxPixelRatio: number;
}

/**
 * Owns the WebGL renderer, the scene graph root and lighting. The canvas is
 * transparent: the gradient background is CSS, which costs no fill-rate.
 */
export class SceneManager {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly canvas: HTMLCanvasElement;
  readonly fog = new Fog(CITY_COLORS.horizon, FOG_OFF, FOG_OFF + 1);
  private readonly hemiLight: HemisphereLight;
  private readonly keyLight: DirectionalLight;
  private readonly rimLight: DirectionalLight;
  private readonly bufferSize = new Vector2();
  private pixelRatio = 1;
  private maxPixelRatio: number;

  constructor(container: HTMLElement, options: SceneOptions) {
    this.maxPixelRatio = options.maxPixelRatio;
    this.renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'scene-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    container.append(this.canvas);

    this.scene.fog = this.fog;
    this.hemiLight = new HemisphereLight(STAGE_COLORS.hemiSky, STAGE_COLORS.hemiGround, 1.5);
    this.scene.add(this.hemiLight);

    this.keyLight = new DirectionalLight(STAGE_COLORS.key, 2.3);
    this.keyLight.position.set(3, 6, 5);
    this.scene.add(this.keyLight);

    const fill = new DirectionalLight(0xc4d6ff, 0.55);
    fill.position.set(-4, 2, 3);
    this.scene.add(fill);

    this.rimLight = new DirectionalLight(0xffffff, 2.2);
    this.rimLight.position.set(-2.5, 3, -5);
    this.scene.add(this.rimLight);

    // Soft studio reflections for the glossy "vinyl toy" look. Generated once, no texture download.
    const pmrem = new PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.65;
    pmrem.dispose();
  }

  get currentPixelRatio(): number {
    return this.pixelRatio;
  }

  add(...objects: Object3D[]): void {
    this.scene.add(...objects);
  }

  /**
   * 0 = bright studio (choices, build), 1 = neon dusk (race): tints the lights
   * and pulls the fog in so the highway fades into the horizon.
   */
  setMood(amount: number): void {
    this.hemiLight.color.lerpColors(MOOD.hemiSky[0], MOOD.hemiSky[1], amount);
    this.hemiLight.groundColor.lerpColors(MOOD.hemiGround[0], MOOD.hemiGround[1], amount);
    this.keyLight.color.lerpColors(MOOD.key[0], MOOD.key[1], amount);
    const on = amount > 0.001;
    this.fog.near = on ? lerp(FOG_OFF, CITY_FOG.near, Math.sqrt(amount)) : FOG_OFF;
    this.fog.far = on ? lerp(FOG_OFF, CITY_FOG.far, Math.sqrt(amount)) : FOG_OFF + 1;
  }

  /** Rim light follows the character's energy colour for a coloured silhouette edge. */
  setRimColor(color: Color): void {
    this.rimLight.color.copy(color).lerp(WHITE, 0.25);
  }

  setMaxPixelRatio(value: number): void {
    this.maxPixelRatio = value;
  }

  resize(width: number, height: number): void {
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height, false);
  }

  /** Drawing-buffer height in device pixels (for particle size attenuation). */
  get bufferHeight(): number {
    return this.renderer.getDrawingBufferSize(this.bufferSize).y;
  }

  /** Compiles shaders for objects before they are first seen, avoiding mid-play hitches. */
  compile(objects: Object3D, camera: Camera): void {
    this.scene.add(objects);
    this.renderer.compile(this.scene, camera);
    this.scene.remove(objects);
  }

  render(camera: Camera): void {
    this.renderer.render(this.scene, camera);
  }
}
