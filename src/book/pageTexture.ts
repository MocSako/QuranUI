import {
  BASMALA,
  BASMALA_LATIN,
  TRANSLITERATION_KEY,
  showsBasmala,
  type BookPage,
  type PageSegment,
} from "./samplePages";

const PAPER = "#f1e6cc";
const INK = "#1d1610";
const GLOSS = "#6b5436";
const GOLD = "#a8823a";
const GOLD_DEEP = "#7d5d24";
const BAND = "#eadab4";
const CARTOUCHE = "#e7d4a8";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function arabicNumber(n: number): string {
  return String(n)
    .split("")
    .map((c) => ARABIC_DIGITS[Number(c)])
    .join("");
}

/** Deterministic, so a page looks the same on every load. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 7): void {
  const rnd = random(seed);
  const u = w / 1000;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 26; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = (120 + rnd() * 260) * u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? "255,250,235" : "196,170,120";
    g.addColorStop(0, `rgba(${tone},0.06)`);
    g.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const fibres = ["168,139,92", "201,178,138", "255,248,230", "140,112,72"];
  ctx.lineCap = "round";
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const len = (2 + rnd() * 8) * u;
    const a = rnd() * Math.PI;
    ctx.strokeStyle = `rgba(${fibres[Math.floor(rnd() * fibres.length)]},${0.03 + rnd() * 0.05})`;
    ctx.lineWidth = (0.4 + rnd() * 0.8) * u;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  for (const rot of [0, Math.PI / 4]) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

export interface PageFrame {
  textLeft: number;
  textRight: number;
  textTop: number;
  textBottom: number;
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number): PageFrame {
  const u = w / 1000;
  const m = 52 * u;
  const band = 20 * u;

  ctx.fillStyle = BAND;
  ctx.fillRect(m, m, w - 2 * m, band);
  ctx.fillRect(m, h - m - band, w - 2 * m, band);
  ctx.fillRect(m, m, band, h - 2 * m);
  ctx.fillRect(w - m - band, m, band, h - 2 * m);

  ctx.fillStyle = "#c4a25a";
  const step = 26 * u;
  const dr = 4.2 * u;
  const diamond = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - dr);
    ctx.lineTo(x + dr, y);
    ctx.lineTo(x, y + dr);
    ctx.lineTo(x - dr, y);
    ctx.closePath();
    ctx.fill();
  };
  for (let x = m + band + step / 2; x < w - m - band; x += step) {
    diamond(x, m + band / 2);
    diamond(x, h - m - band / 2);
  }
  for (let y = m + band + step / 2; y < h - m - band; y += step) {
    diamond(m + band / 2, y);
    diamond(w - m - band / 2, y);
  }

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4.5 * u;
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 1.6 * u;
  ctx.strokeRect(m + band, m + band, w - 2 * (m + band), h - 2 * (m + band));
  ctx.strokeRect(m - 9 * u, m - 9 * u, w - 2 * (m - 9 * u), h - 2 * (m - 9 * u));

  ctx.fillStyle = GOLD;
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 1.2 * u;
  for (const [x, y] of [
    [m + band / 2, m + band / 2],
    [w - m - band / 2, m + band / 2],
    [m + band / 2, h - m - band / 2],
    [w - m - band / 2, h - m - band / 2],
  ]) {
    star(ctx, x, y, 17 * u);
  }

  const inset = m + band + 44 * u;
  return { textLeft: inset, textRight: w - inset, textTop: inset, textBottom: h - inset };
}

type Token = { kind: "word"; text: string; width: number } | { kind: "marker"; n: number; width: number };

function layoutLines(ctx: CanvasRenderingContext2D, tokens: Token[], width: number, space: number): Token[][] {
  const lines: Token[][] = [];
  let line: Token[] = [];
  let used = 0;
  for (const t of tokens) {
    const add = (line.length ? space : 0) + t.width;
    if (line.length && used + add > width) {
      lines.push(line);
      line = [t];
      used = t.width;
    } else {
      line.push(t);
      used += add;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
  n: number,
  font: string,
  digits: "arabic" | "western",
): void {
  const u = s / 70;
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.4 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.44, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 1 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `${s * 0.46}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = digits === "arabic" ? "rtl" : "ltr";
  ctx.fillText(digits === "arabic" ? arabicNumber(n) : String(n), cx, cy + s * 0.04);
}

function drawCartouche(ctx: CanvasRenderingContext2D, cx: number, top: number, width: number, height: number, s: number): void {
  const u = s / 70;
  const tip = height * 0.45;
  const l = cx - width / 2;
  const r = cx + width / 2;
  const mid = top + height / 2;
  const shape = (inset: number) => {
    ctx.beginPath();
    ctx.moveTo(l + tip + inset, top + inset);
    ctx.lineTo(r - tip - inset, top + inset);
    ctx.lineTo(r - inset, mid);
    ctx.lineTo(r - tip - inset, top + height - inset);
    ctx.lineTo(l + tip + inset, top + height - inset);
    ctx.lineTo(l + inset, mid);
    ctx.closePath();
  };
  ctx.fillStyle = CARTOUCHE;
  shape(0);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3 * u;
  ctx.stroke();
  ctx.strokeStyle = GOLD_DEEP;
  ctx.lineWidth = 1.1 * u;
  shape(7 * u);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.lineWidth = 1 * u;
  star(ctx, l + tip + 30 * u, mid, 11 * u);
  star(ctx, r - tip - 30 * u, mid, 11 * u);
}

type Block =
  | { kind: "cartouche"; text: string }
  | { kind: "kicker"; text: string }
  | { kind: "basmala" }
  | { kind: "lines"; lines: Token[][] };

function ayahTokens(ctx: CanvasRenderingContext2D, texts: string[], start: number, marker: number): Token[] {
  const tokens: Token[] = [];
  texts.forEach((ayah, i) => {
    for (const word of ayah.split(" ")) {
      if (!word) continue;
      tokens.push({ kind: "word", text: word, width: ctx.measureText(word).width });
    }
    tokens.push({ kind: "marker", n: start + i, width: marker });
  });
  return tokens;
}

function nameOf(segment: PageSegment, arabic: boolean): string {
  return arabic ? segment.nameArabic : segment.nameLatin;
}

function layoutBlocks(
  ctx: CanvasRenderingContext2D,
  segments: PageSegment[],
  texts: (seg: PageSegment) => string[],
  names: (seg: PageSegment) => string,
  width: number,
  s: number,
  space: number,
): Block[] {
  const blocks: Block[] = [];
  for (const seg of segments) {
    if (seg.start === 1) {
      blocks.push({ kind: "cartouche", text: names(seg) });
      if (showsBasmala(seg)) blocks.push({ kind: "basmala" });
    } else {
      blocks.push({ kind: "kicker", text: `${names(seg)} ${seg.start}–${seg.end}` });
    }
    blocks.push({ kind: "lines", lines: layoutLines(ctx, ayahTokens(ctx, texts(seg), seg.start, s * 0.98), width, space) });
  }
  return blocks;
}

function blockHeight(blocks: Block[], s: number, lh: number, gap: number): number {
  let h = 0;
  for (const b of blocks) {
    switch (b.kind) {
      case "cartouche":
        h += s * 1.45 + s * 0.55;
        break;
      case "kicker":
        h += s * 0.85;
        break;
      case "basmala":
        h += lh + gap;
        break;
      case "lines":
        h += b.lines.length * lh + gap;
        break;
      default: {
        const unreachable: never = b;
        throw new Error(`Unknown block ${(unreachable as Block).kind}`);
      }
    }
  }
  return h;
}

function paintLines(
  ctx: CanvasRenderingContext2D,
  lines: Token[][],
  frame: PageFrame,
  y: number,
  s: number,
  lh: number,
  space: number,
  font: string,
  rtl: boolean,
): number {
  const width = frame.textRight - frame.textLeft;
  const cx = (frame.textLeft + frame.textRight) / 2;
  lines.forEach((line, li) => {
    const natural = line.reduce((sum, t) => sum + t.width, 0) + space * (line.length - 1);
    const gaps = line.length - 1;
    const extra = width - natural;
    const last = li === lines.length - 1;
    // Only open gaps. An over-wide line keeps the natural space instead of stacking words.
    const justify = !last && gaps > 0 && extra > 0 && extra / gaps < space * (rtl ? 2.5 : 2.8);
    const gap = justify ? space + extra / gaps : space;
    let x = rtl ? (justify ? frame.textRight : cx + natural / 2) : justify ? frame.textLeft : cx - natural / 2;
    const baseline = y + lh * (rtl ? 0.62 : 0.72);
    for (const t of line) {
      if (t.kind === "word") {
        ctx.fillStyle = INK;
        ctx.font = `${s}px ${font}`;
        ctx.textAlign = rtl ? "right" : "left";
        ctx.textBaseline = "alphabetic";
        ctx.direction = rtl ? "rtl" : "ltr";
        ctx.fillText(t.text, x, baseline);
      } else {
        drawMarker(ctx, x + (rtl ? -t.width / 2 : t.width / 2), baseline - s * (rtl ? 0.28 : 0.22), s, t.n, font, rtl ? "arabic" : "western");
      }
      x += (rtl ? -1 : 1) * (t.width + gap);
    }
    y += lh;
  });
  return y;
}

interface FittedPage {
  frame: PageFrame;
  blocks: Block[];
  s: number;
  lh: number;
  space: number;
  gap: number;
  blockH: number;
  available: number;
}

/** Text box inset used by the gilt frame (m + band + 44u). */
function frameForSize(w: number, h: number): PageFrame {
  const u = w / 1000;
  const inset = 52 * u + 20 * u + 44 * u;
  return { textLeft: inset, textRight: w - inset, textTop: inset, textBottom: h - inset };
}

/** Shrink type (then leading) until the block sits above the folio and key. */
function fitMushafPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: BookPage,
  font: string,
  rtl: boolean,
  frame: PageFrame = frameForSize(w, h),
): FittedPage {
  const width = frame.textRight - frame.textLeft;
  const folioH = 0.024 * h;
  const keyH = rtl ? 0 : 0.028 * h;
  const available = frame.textBottom - frame.textTop - folioH - keyH;
  const texts = (seg: PageSegment) => (rtl ? seg.ayahs : seg.transliteration);
  const names = (seg: PageSegment) => nameOf(seg, rtl);

  const start = rtl ? 0.095 * w : 0.055 * w;
  // Dense faces (two surah openings on one page) need room below the old 70% floor.
  const floor = Math.max(11, start * 0.32);
  // Keep enough leading that descenders and diacritics do not collide.
  const lhFloor = rtl ? 1.45 : 1.55;
  let s = start;
  let lhMul = rtl ? 2.05 : 1.75;
  let gapMul = 0.45;
  let blocks: Block[] = [];
  let lh = 0;
  let space = 0;
  let gap = 0;
  let blockH = 0;
  for (let i = 0; i < 100; i++) {
    space = s * (rtl ? 0.3 : 0.38);
    lh = s * lhMul;
    gap = s * gapMul;
    ctx.font = `${s}px ${font}`;
    ctx.direction = rtl ? "rtl" : "ltr";
    blocks = layoutBlocks(ctx, page.segments, texts, names, width, s, space);
    blockH = blockHeight(blocks, s, lh, gap);
    if (blockH <= available) break;
    if (s > floor) {
      s = Math.max(floor, s * 0.94);
      continue;
    }
    if (gapMul > 0.28) {
      gapMul = Math.max(0.28, gapMul * 0.95);
      continue;
    }
    if (lhMul > lhFloor) {
      lhMul = Math.max(lhFloor, lhMul * 0.97);
      continue;
    }
    break;
  }
  return { frame, blocks, s, lh, space, gap, blockH, available };
}

/** True when a face still cannot fit after the smallest readable type. */
export function pageOverflows(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: BookPage,
  font: string,
): boolean {
  const rtl = page.kind === "arabic";
  const fit = fitMushafPage(ctx, w, h, page, font, rtl);
  return fit.blockH > fit.available;
}

/** Layout metrics after fitting; used for overflow diagnostics. */
export function measurePageFit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: BookPage,
  font: string,
): { blockH: number; available: number; s: number; lh: number; overflow: number } {
  const rtl = page.kind === "arabic";
  const fit = fitMushafPage(ctx, w, h, page, font, rtl);
  return {
    blockH: fit.blockH,
    available: fit.available,
    s: fit.s,
    lh: fit.lh,
    overflow: fit.blockH - fit.available,
  };
}

function drawMushafPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: BookPage,
  font: string,
  rtl: boolean,
): void {
  drawPaper(ctx, w, h, page.mushafPage * 31 + (rtl ? 7 : 19));
  const frame = drawFrame(ctx, w, h);
  const { blocks, s, lh, space, gap, blockH, available } = fitMushafPage(ctx, w, h, page, font, rtl, frame);
  const width = frame.textRight - frame.textLeft;
  const folioH = 0.024 * h;

  const top = frame.textTop + Math.max(0, (available - blockH) / 2);
  const cx = (frame.textLeft + frame.textRight) / 2;
  let y = top;

  for (const b of blocks) {
    switch (b.kind) {
      case "cartouche": {
        drawCartouche(ctx, cx, y, width * 0.9, s * 1.45, s);
        ctx.fillStyle = INK;
        ctx.font = `${s * (rtl ? 0.58 : 0.52)}px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.direction = rtl ? "rtl" : "ltr";
        ctx.fillText(b.text, cx, y + s * 0.74);
        y += s * 1.45 + s * 0.55;
        break;
      }
      case "kicker": {
        ctx.fillStyle = GLOSS;
        ctx.font = `${s * 0.42}px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.direction = rtl ? "rtl" : "ltr";
        ctx.fillText(b.text, cx, y + s * 0.55);
        y += s * 0.85;
        break;
      }
      case "basmala": {
        ctx.fillStyle = rtl ? INK : GLOSS;
        ctx.font = `${s}px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.direction = rtl ? "rtl" : "ltr";
        ctx.fillText(rtl ? BASMALA : BASMALA_LATIN, cx, y + lh * (rtl ? 0.62 : 0.7));
        y += lh + gap;
        break;
      }
      case "lines": {
        y = paintLines(ctx, b.lines, frame, y, s, lh, space, font, rtl);
        y += gap;
        break;
      }
      default: {
        const unreachable: never = b;
        throw new Error(`Unknown block ${(unreachable as Block).kind}`);
      }
    }
  }

  if (!rtl) {
    ctx.fillStyle = GLOSS;
    ctx.font = `${Math.max(11, 0.016 * h)}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.direction = "ltr";
    ctx.fillText(TRANSLITERATION_KEY, cx, frame.textBottom - folioH - 2);
  }

  ctx.fillStyle = GLOSS;
  ctx.font = `${Math.max(12, 0.018 * h)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = rtl ? "rtl" : "ltr";
  ctx.fillText(rtl ? arabicNumber(page.mushafPage) : String(page.mushafPage), cx, frame.textBottom - folioH / 2);
}

/** Bump when on-page type metrics change so texture caches redraw. */
export const PAGE_DRAW_REVISION = 5;

/** Draws one printed face: Arabic or its facing transliteration. */
export function drawBookPage(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  page: BookPage,
  arabicFont: string,
  latinFont: string,
): void {
  switch (page.kind) {
    case "arabic":
      drawMushafPage(ctx, w, h, page, arabicFont, true);
      return;
    case "transliteration":
      drawMushafPage(ctx, w, h, page, latinFont, false);
      return;
    default: {
      const unreachable: never = page.kind;
      throw new Error(`Unknown page ${unreachable}`);
    }
  }
}
