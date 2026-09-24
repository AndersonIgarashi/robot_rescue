import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA_SHOTS, type CameraShot, type CameraShotId } from '../data/cameraShots';
import { DEG2RAD, damp } from '../utils/math';

export interface SubjectBounds {
  bottom: number;
  top: number;
  width: number;
}

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimum framed width: the pedestal must always be fully visible. */
const STAGE_WIDTH = 2.4;
export const CAMERA_FOV = 30;
const FOV = CAMERA_FOV;
const tmp = new Vector3();

/**
 * Frames the character inside a DOM-defined "stage slot" rectangle. The
 * layout decides where the hero goes (portrait: between header and cards;
 * landscape: left column) and the camera distance + view offset follow, so
 * the 3D never fights the UI on any aspect ratio.
 */
export class CameraController {
  readonly camera = new PerspectiveCamera(FOV, 1, 0.1, 60);

  private shot: CameraShot = CAMERA_SHOTS.intro;
  private subject: SubjectBounds = { bottom: -0.32, top: 2.34, width: 1.6 };
  private viewport = { width: 1, height: 1 };
  private slot: ScreenRect = { x: 0, y: 0, width: 1, height: 1 };

  private distance = 10;
  private pitch = 8;
  private yaw = 0;
  private focusY = 1;
  private offsetX = 0;
  private offsetY = 0;

  private trauma = 0;
  private time = 0;
  private zoomPunch = 0;
  private pointerX = 0;
  private pointerY = 0;

  setShot(id: CameraShotId): void {
    this.shot = CAMERA_SHOTS[id];
  }

  setSubject(bounds: SubjectBounds): void {
    this.subject = bounds;
  }

  setViewport(width: number, height: number, slot: ScreenRect): void {
    this.viewport = { width: Math.max(1, width), height: Math.max(1, height) };
    this.slot = slot.width > 1 && slot.height > 1 ? slot : { x: 0, y: 0, width, height };
    this.camera.aspect = this.viewport.width / this.viewport.height;
  }

  /** Camera shake using a decaying "trauma" value (squared for a natural falloff). */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Brief push-in (e.g. on selection). */
  punch(amount: number): void {
    this.zoomPunch = Math.min(0.2, this.zoomPunch + amount);
  }

  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  /** Jump straight to the target framing (first frame / resize before start). */
  snap(): void {
    const target = this.computeTarget();
    this.distance = target.distance;
    this.focusY = target.focusY;
    this.offsetX = target.offsetX;
    this.offsetY = target.offsetY;
    this.pitch = this.shot.pitch;
    this.yaw = this.shot.yaw;
    this.apply();
  }

  update(dt: number): void {
    this.time += dt;
    const target = this.computeTarget();
    const lambda = 4.5;
    this.distance = damp(this.distance, target.distance, lambda, dt);
    this.focusY = damp(this.focusY, target.focusY, lambda, dt);
    this.offsetX = damp(this.offsetX, target.offsetX, lambda * 1.4, dt);
    this.offsetY = damp(this.offsetY, target.offsetY, lambda * 1.4, dt);
    this.pitch = damp(this.pitch, this.shot.pitch, 3, dt);
    this.yaw = damp(this.yaw, this.shot.yaw, 3, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.zoomPunch = damp(this.zoomPunch, 0, 5, dt);
    this.apply();
  }

  /** World -> CSS pixel coordinates (used to aim the CSS light rays at the hero). */
  project(world: Vector3, out: { x: number; y: number }): void {
    tmp.copy(world).project(this.camera);
    out.x = (tmp.x * 0.5 + 0.5) * this.viewport.width;
    out.y = (-tmp.y * 0.5 + 0.5) * this.viewport.height;
  }

  private computeTarget(): { distance: number; focusY: number; offsetX: number; offsetY: number } {
    const { width: W, height: H } = this.viewport;
    const slot = this.slot;
    const height = this.subject.top - this.subject.bottom;
    const width = Math.max(this.subject.width, STAGE_WIDTH);
    const tanHalf = Math.tan((FOV * DEG2RAD) / 2);
    const fill = this.shot.fill;
    const byHeight = (height * H) / (2 * tanHalf * fill * slot.height);
    const byWidth = (width * H) / (2 * tanHalf * fill * slot.width);
    return {
      distance: Math.max(byHeight, byWidth) * (1 - this.zoomPunch),
      focusY: this.subject.bottom + height * this.shot.focus,
      offsetX: slot.x + slot.width / 2 - W / 2,
      offsetY: slot.y + slot.height / 2 - H / 2,
    };
  }

  private apply(): void {
    const pitch = (this.pitch + this.pointerY * 2) * DEG2RAD;
    const yaw = (this.yaw + this.pointerX * 4) * DEG2RAD;
    const d = this.distance;
    const camera = this.camera;
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, this.focusY + Math.sin(pitch) * d, Math.cos(yaw) * Math.cos(pitch) * d);
    camera.lookAt(0, this.focusY, 0);

    const shake = this.trauma * this.trauma;
    if (shake > 0.0001) {
      const t = this.time;
      camera.position.x += (Math.sin(t * 41.3) + Math.sin(t * 17.9)) * 0.06 * shake;
      camera.position.y += (Math.sin(t * 37.1) + Math.sin(t * 23.3)) * 0.06 * shake;
      camera.rotation.z += Math.sin(t * 29.7) * 0.025 * shake;
    }

    const { width: W, height: H } = this.viewport;
    camera.setViewOffset(W, H, -this.offsetX, -this.offsetY, W, H);
  }
}
