import { CanvasTexture, SRGBColorSpace } from 'three';

/** Neon signs are painted at runtime into one atlas: no image downloads, one draw call. */
export const ATLAS_WIDTH = 1024;
export const ATLAS_HEIGHT = 512;
const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';

/** Paints once the display font is ready (canvas text never waits for web fonts by itself). */
export function whenFontReady(paint: () => void): void {
  const fonts = document.fonts;
  if (fonts && !fonts.check('40px "Lilita One"')) fonts.ready.then(paint, paint);
  else paint();
}

export interface SignCell {
  readonly vertical: boolean;
  /** Atlas UV rectangle. */
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

interface SignDesign {
  text: string;
  color: string;
}

const HORIZONTAL: readonly SignDesign[] = [
  { text: 'AI', color: '#3df2ff' },
  { text: 'RACE', color: '#ff3fd0' },
  { text: 'BOT', color: '#fff05a' },
  { text: 'VOLT', color: '#7dff5a' },
  { text: 'NEO', color: '#ff8a3d' },
  { text: 'CYBER', color: '#a77bff' },
  { text: 'ZAP!', color: '#3df2ff' },
  { text: '24/7', color: '#ff3fd0' },
];

const VERTICAL: readonly SignDesign[] = [
  { text: 'ROBO', color: '#ff3fd0' },
  { text: 'BAR', color: '#3df2ff' },
  { text: 'GO', color: '#fff05a' },
  { text: 'HOT', color: '#ff8a3d' },
  { text: 'FUEL', color: '#7dff5a' },
  { text: 'ZONE', color: '#a77bff' },
  { text: 'TECH', color: '#3df2ff' },
  { text: 'BYTE', color: '#ff3fd0' },
];

const H_CELL = { w: 256, h: 128 };
const V_CELL = { w: 128, h: 256 };

function cellRect(vertical: boolean, index: number): { x: number; y: number; w: number; h: number } {
  if (vertical) return { x: index * V_CELL.w, y: 256, ...V_CELL };
  return { x: (index % 4) * H_CELL.w, y: Math.floor(index / 4) * H_CELL.h, ...H_CELL };
}

function toCell(vertical: boolean, index: number): SignCell {
  const { x, y, w, h } = cellRect(vertical, index);
  // Canvas textures are flipped on upload: v runs bottom-up.
  return {
    vertical,
    u0: x / ATLAS_WIDTH,
    u1: (x + w) / ATLAS_WIDTH,
    v0: 1 - (y + h) / ATLAS_HEIGHT,
    v1: 1 - y / ATLAS_HEIGHT,
  };
}

export const SIGN_CELLS = {
  horizontal: HORIZONTAL.map((_, i) => toCell(false, i)),
  vertical: VERTICAL.map((_, i) => toCell(true, i)),
} as const;

function neonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.4;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = size * 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.75;
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

function neonFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  const inset = 10;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, 16);
  ctx.stroke();
}

function fitSize(ctx: CanvasRenderingContext2D, text: string, size: number, maxWidth: number): number {
  ctx.font = `${size}px ${FONT}`;
  const width = ctx.measureText(text).width;
  return width > maxWidth ? Math.floor((size * maxWidth) / width) : size;
}

export function createSignAtlas(): { texture: CanvasTexture; draw: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_WIDTH;
  canvas.height = ATLAS_HEIGHT;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  const draw = (): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT);
    HORIZONTAL.forEach((sign, i) => {
      const { x, y, w, h } = cellRect(false, i);
      neonFrame(ctx, x, y, w, h, sign.color);
      neonText(ctx, sign.text, x + w / 2, y + h / 2 + 4, fitSize(ctx, sign.text, 82, w - 50), sign.color);
    });
    VERTICAL.forEach((sign, i) => {
      const { x, y, w, h } = cellRect(true, i);
      neonFrame(ctx, x, y, w, h, sign.color);
      const letters = [...sign.text];
      const step = (h - 44) / letters.length;
      const size = Math.min(64, step * 1.05);
      letters.forEach((letter, n) => neonText(ctx, letter, x + w / 2, y + 22 + step * (n + 0.5) + 3, size, sign.color));
    });
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  };
  return { texture, draw };
}

/** "GO {NAME}!" in the racer's energy colour: dark outline, glowing fill, white core. */
export function createHologramTexture(): { texture: CanvasTexture; draw: (name: string, color: string) => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const draw = (name: string, color: string): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const text = `GO ${name}!`;
    const size = fitSize(ctx, text, 180, canvas.width - 110);
    const x = canvas.width / 2;
    const y = canvas.height / 2 + 8;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 34;
    ctx.lineWidth = 22;
    ctx.strokeStyle = 'rgba(16, 8, 44, 0.85)';
    ctx.strokeText(text, x, y);
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x, y - size * 0.04);
    ctx.globalAlpha = 1;
    texture.needsUpdate = true;
  };
  return { texture, draw };
}
