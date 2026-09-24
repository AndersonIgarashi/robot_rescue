export interface PointerInfo {
  x: number;
  y: number;
  pointerType: string;
  event: PointerEvent | KeyboardEvent;
}

export interface InteractiveHandlers {
  pointerDown?(info: PointerInfo): void;
  pointerUp?(info: PointerInfo): void;
  pointerEnter?(info: PointerInfo): void;
  pointerLeave?(info: PointerInfo): void;
  click?(info: PointerInfo): void;
}

export interface DragHandlers {
  start?(info: PointerInfo): void;
  move(dx: number, dy: number, dt: number): void;
  end?(): void;
}

const PRESSED_CLASS = 'is-pressed';

/**
 * One input path for mouse, touch and pen via Pointer Events, plus keyboard
 * activation for accessibility. Exposes high-level pointerDown / pointerUp /
 * pointerEnter / pointerLeave / click, fired on release inside the element
 * (instant on mobile — no 300 ms click delay, no ghost clicks).
 */
export class InputManager {
  /** Normalised pointer position (-1..1, y up) for gaze/parallax. */
  readonly pointer = { x: 0, y: 0, active: false };
  private readonly anyDownListeners = new Set<(info: PointerInfo) => void>();
  private lastMoveTime = 0;

  constructor(root: HTMLElement) {
    window.addEventListener('pointermove', this.onGlobalMove, { passive: true });
    window.addEventListener('pointerdown', this.onGlobalDown, { passive: true, capture: true });
    root.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** Binds high-level handlers to an interactive element. Returns an unbind function. */
  bind(element: HTMLElement, handlers: InteractiveHandlers): () => void {
    let activePointer: number | null = null;

    const info = (event: PointerEvent | KeyboardEvent): PointerInfo => {
      const pointerEvent = event instanceof PointerEvent ? event : null;
      return {
        x: pointerEvent?.clientX ?? 0,
        y: pointerEvent?.clientY ?? 0,
        pointerType: pointerEvent?.pointerType ?? 'keyboard',
        event,
      };
    };

    const release = (event: PointerEvent): void => {
      if (activePointer !== event.pointerId) return;
      activePointer = null;
      element.classList.remove(PRESSED_CLASS);
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };

    const onDown = (event: PointerEvent): void => {
      if (activePointer !== null || event.button > 0) return;
      activePointer = event.pointerId;
      element.setPointerCapture(event.pointerId);
      element.classList.add(PRESSED_CLASS);
      handlers.pointerDown?.(info(event));
    };

    const onUp = (event: PointerEvent): void => {
      if (activePointer !== event.pointerId) return;
      const rect = element.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      release(event);
      handlers.pointerUp?.(info(event));
      if (inside) handlers.click?.(info(event));
    };

    const onEnter = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse') handlers.pointerEnter?.(info(event));
    };
    const onLeave = (event: PointerEvent): void => {
      if (event.pointerType === 'mouse') handlers.pointerLeave?.(info(event));
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      handlers.click?.(info(event));
    };
    const onCancel = (event: PointerEvent): void => release(event);

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);
    element.addEventListener('pointerenter', onEnter);
    element.addEventListener('pointerleave', onLeave);
    element.addEventListener('keydown', onKey);

    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
      element.removeEventListener('pointerenter', onEnter);
      element.removeEventListener('pointerleave', onLeave);
      element.removeEventListener('keydown', onKey);
      element.classList.remove(PRESSED_CLASS);
    };
  }

  /** Horizontal/vertical drag gestures on a surface (the 3D canvas). */
  bindDrag(element: HTMLElement, handlers: DragHandlers): () => void {
    let activePointer: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;

    const onDown = (event: PointerEvent): void => {
      if (activePointer !== null) return;
      activePointer = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = event.timeStamp;
      element.setPointerCapture(event.pointerId);
      handlers.start?.({ x: lastX, y: lastY, pointerType: event.pointerType, event });
    };
    const onMove = (event: PointerEvent): void => {
      if (activePointer !== event.pointerId) return;
      const dt = Math.max(0.001, (event.timeStamp - lastTime) / 1000);
      handlers.move(event.clientX - lastX, event.clientY - lastY, dt);
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = event.timeStamp;
    };
    const onEnd = (event: PointerEvent): void => {
      if (activePointer !== event.pointerId) return;
      activePointer = null;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      handlers.end?.();
    };

    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onEnd);
    element.addEventListener('pointercancel', onEnd);
    return () => {
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onEnd);
      element.removeEventListener('pointercancel', onEnd);
    };
  }

  /** Fires on any press anywhere (audio unlock, idle-hint reset). */
  onAnyPointerDown(listener: (info: PointerInfo) => void): () => void {
    this.anyDownListeners.add(listener);
    return () => this.anyDownListeners.delete(listener);
  }

  /** Marks the pointer inactive after a period without movement (gaze drifts home). */
  update(now: number): void {
    if (this.pointer.active && now - this.lastMoveTime > 2500) this.pointer.active = false;
  }

  private readonly onGlobalMove = (event: PointerEvent): void => {
    // The playable is full-viewport, so window size avoids a layout read per move event.
    this.pointer.x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
    this.pointer.y = -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
    this.pointer.active = true;
    this.lastMoveTime = performance.now();
  };

  private readonly onGlobalDown = (event: PointerEvent): void => {
    this.onGlobalMove(event);
    const info: PointerInfo = { x: event.clientX, y: event.clientY, pointerType: event.pointerType, event };
    for (const listener of this.anyDownListeners) listener(info);
  };
}
