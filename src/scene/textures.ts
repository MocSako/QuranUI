import * as THREE from "three";

/** Warm brown, the default finish: carved recess, base, grain highlight. */
export const WOOD = { recess: "#3f2516", base: "#7b4a2a", highlight: "#a0673c" } as const;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return [c, ctx];
}

function texture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function random(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Grain and a carved groove for the extruded board faces. The fretwork is
 * cut in the geometry, so this map stays opaque.
 */
export function woodBoardTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 768;
  const [c, ctx] = canvas(W, H);
  const rnd = random(4211);

  ctx.fillStyle = WOOD.base;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const y0 = rnd() * H;
    ctx.strokeStyle = rnd() > 0.5 ? WOOD.highlight : WOOD.recess;
    ctx.globalAlpha = 0.08 + rnd() * 0.14;
    ctx.lineWidth = 0.6 + rnd() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= W; x += 32) {
      ctx.lineTo(x, y0 + Math.sin(x * 0.006 + i) * 6 + Math.sin(x * 0.021 + i * 3) * 2);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = WOOD.recess;
  ctx.lineWidth = 7;
  ctx.strokeRect(70, 52, W - 140, H - 104);
  ctx.strokeStyle = WOOD.highlight;
  ctx.lineWidth = 2;
  ctx.strokeRect(78, 60, W - 156, H - 120);

  return texture(c);
}

/** The visible stack of page edges, one fine line per few leaves. */
export function pageEdgeTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 512);
  const rnd = random(77);
  ctx.fillStyle = "#e6d8b6";
  ctx.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 2 + Math.floor(rnd() * 2)) {
    ctx.fillStyle = `rgba(120,96,60,${0.12 + rnd() * 0.18})`;
    ctx.fillRect(0, y, 64, 1);
  }
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const KILIM = {
  field: "#6e241c",
  border: "#e4d2a4",
  indigo: "#1c3a4c",
  saffron: "#c4a15a",
  ink: "#2a1a14",
  orange: "#c45c28",
  cream: "#f3e6c8",
  outline: "#4a2c1a",
} as const;

function softMap(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = texture(c);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function diamond(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  stroke?: string,
  line = 1.5,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = line;
    ctx.stroke();
  }
}

/**
 * One red banded kilim for the floor: madder field, rows of small diamonds,
 * cream border, fringe on the near edge. Clamp-wrapped so the border appears once.
 */
export function floorKilimTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 1152;
  const [c, ctx] = canvas(W, H);
  const rnd = random(9103);
  const fringe = 48;
  const border = 56;
  const inner = border + 18;

  ctx.fillStyle = KILIM.ink;
  ctx.fillRect(0, 0, W, H);

  // Fringe along the near edge (texture bottom → world +Z after the floor rotation).
  for (let x = border; x < W - border; x += 7) {
    const wobble = (rnd() - 0.5) * 3;
    ctx.strokeStyle = rnd() > 0.35 ? KILIM.border : KILIM.saffron;
    ctx.globalAlpha = 0.75 + rnd() * 0.25;
    ctx.lineWidth = 1.4 + rnd();
    ctx.beginPath();
    ctx.moveTo(x + wobble, H - 4);
    ctx.lineTo(x + wobble + (rnd() - 0.5) * 2, H - fringe + 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = KILIM.border;
  ctx.fillRect(0, 0, W, H - fringe);
  ctx.fillStyle = KILIM.field;
  ctx.fillRect(border, border, W - border * 2, H - fringe - border * 2);

  // Inner guard stripe.
  ctx.strokeStyle = KILIM.indigo;
  ctx.lineWidth = 5;
  ctx.strokeRect(inner, inner, W - inner * 2, H - fringe - inner * 2);
  ctx.strokeStyle = KILIM.saffron;
  ctx.lineWidth = 2;
  ctx.strokeRect(inner + 8, inner + 8, W - (inner + 8) * 2, H - fringe - (inner + 8) * 2);

  const fieldTop = inner + 16;
  const fieldBot = H - fringe - inner - 16;
  const fieldLeft = inner + 16;
  const fieldRight = W - inner - 16;
  const rowH = 36;
  let row = 0;
  for (let y = fieldTop + 20; y < fieldBot - 12; y += rowH) {
    const odd = row % 2 === 1;
    const step = 44;
    const start = fieldLeft + (odd ? step / 2 : 0) + 8;
    for (let x = start; x < fieldRight - 8; x += step) {
      const ink = odd ? KILIM.indigo : KILIM.saffron;
      const fill = odd ? KILIM.cream : KILIM.indigo;
      diamond(ctx, x, y, 9 + (rnd() - 0.5) * 1.5, fill, ink, 1.2);
      if (rnd() > 0.55) {
        ctx.fillStyle = KILIM.saffron;
        ctx.beginPath();
        ctx.arc(x + step * 0.45, y + 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Thin weft band between motif rows.
    ctx.strokeStyle = KILIM.ink;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fieldLeft, y + rowH * 0.5);
    ctx.lineTo(fieldRight, y + rowH * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    row += 1;
  }

  // Soft weave noise so the field is not flat paint.
  for (let i = 0; i < 900; i++) {
    const x = fieldLeft + rnd() * (fieldRight - fieldLeft);
    const y = fieldTop + rnd() * (fieldBot - fieldTop);
    ctx.fillStyle = rnd() > 0.5 ? KILIM.ink : KILIM.saffron;
    ctx.globalAlpha = 0.04 + rnd() * 0.06;
    ctx.fillRect(x, y, 1 + rnd() * 2, 1);
  }
  ctx.globalAlpha = 1;

  const t = softMap(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Orange diamond lattice for the hanging that flanks the book on the left. */
export function diamondKilimTexture(): THREE.CanvasTexture {
  const W = 768;
  const H = 1024;
  const [c, ctx] = canvas(W, H);
  const rnd = random(4401);
  const border = 36;

  ctx.fillStyle = KILIM.outline;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = KILIM.orange;
  ctx.fillRect(border, border, W - border * 2, H - border * 2);

  ctx.strokeStyle = KILIM.cream;
  ctx.lineWidth = 4;
  ctx.strokeRect(border + 8, border + 8, W - (border + 8) * 2, H - (border + 8) * 2);
  ctx.strokeStyle = KILIM.outline;
  ctx.lineWidth = 2;
  ctx.strokeRect(border + 16, border + 16, W - (border + 16) * 2, H - (border + 16) * 2);

  const left = border + 28;
  const right = W - border - 28;
  const top = border + 28;
  const bot = H - border - 28;
  const cell = 52;
  for (let y = top + cell / 2; y < bot; y += cell) {
    for (let x = left + cell / 2; x < right; x += cell) {
      const r = 18 + (rnd() - 0.5) * 2;
      diamond(ctx, x, y, r, KILIM.cream, KILIM.outline, 2);
      diamond(ctx, x, y, r * 0.45, KILIM.orange, KILIM.outline, 1.2);
    }
  }

  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = KILIM.outline;
    ctx.globalAlpha = 0.05 + rnd() * 0.07;
    ctx.fillRect(left + rnd() * (right - left), top + rnd() * (bot - top), 1 + rnd() * 2, 1);
  }
  ctx.globalAlpha = 1;

  const t = softMap(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/**
 * Narrow indigo / cream / saffron striped kilim for the hanging on the right.
 * Stripe widths are uneven, like a hand-woven banded kilim.
 */
export function stripedKilimTexture(): THREE.CanvasTexture {
  const W = 640;
  const H = 1024;
  const [c, ctx] = canvas(W, H);
  const rnd = random(7729);
  const border = 28;
  const stripes = [KILIM.indigo, KILIM.cream, KILIM.saffron, KILIM.field, KILIM.indigo, KILIM.cream];

  ctx.fillStyle = KILIM.ink;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = KILIM.border;
  ctx.fillRect(border * 0.45, border * 0.45, W - border * 0.9, H - border * 0.9);

  let y = border;
  const bot = H - border;
  let i = 0;
  while (y < bot) {
    const band = 18 + Math.floor(rnd() * 48) + (i % 5 === 0 ? 22 : 0);
    const h = Math.min(band, bot - y);
    ctx.fillStyle = stripes[i % stripes.length];
    ctx.fillRect(border, y, W - border * 2, h);
    // Thin counter-stripe inside wide bands.
    if (h > 36 && rnd() > 0.4) {
      ctx.fillStyle = KILIM.ink;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(border, y + h * 0.45, W - border * 2, 2);
      ctx.globalAlpha = 1;
    }
    y += h;
    i += 1;
  }

  ctx.strokeStyle = KILIM.indigo;
  ctx.lineWidth = 5;
  ctx.strokeRect(border, border, W - border * 2, H - border * 2);
  ctx.strokeStyle = KILIM.saffron;
  ctx.lineWidth = 2;
  ctx.strokeRect(border + 8, border + 8, W - (border + 8) * 2, H - (border + 8) * 2);

  for (let n = 0; n < 400; n++) {
    ctx.fillStyle = KILIM.ink;
    ctx.globalAlpha = 0.04 + rnd() * 0.06;
    ctx.fillRect(border + rnd() * (W - border * 2), border + rnd() * (H - border * 2), 1 + rnd() * 2, 1);
  }
  ctx.globalAlpha = 1;

  const t = softMap(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** A soft contact shadow under an object resting on another. */
export function contactShadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.55, "rgba(0,0,0,0.35)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return texture(c);
}
