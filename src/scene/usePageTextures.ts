import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { drawBookPage, drawPaper, PAGE_DRAW_REVISION } from "@/book/pageTexture";
import { BOOK_PAGES, MUSHAF_PAGES } from "@/book/samplePages";
import { PAGE_H, PAGE_W } from "./geometry";
import { useReader } from "@/state/reader";

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, anisotropy: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = anisotropy;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Sized to the page as it appears on this screen, at device pixel ratio. */
function textureSize(): [number, number] {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const h = Math.round(Math.min(2048, Math.max(1024, window.innerHeight * 0.92 * dpr)));
  return [Math.round((h * PAGE_W) / PAGE_H), h];
}

/** Faces around the open mushaf page, nearest first, so a jump paints the spread first. */
function neededFaces(mushafPage: number): number[] {
  const order: number[] = [];
  const add = (m: number) => {
    if (m < 1 || m > MUSHAF_PAGES) return;
    order.push(2 * m - 1, 2 * m);
  };
  add(mushafPage);
  add(mushafPage + 1);
  add(mushafPage - 1);
  add(mushafPage + 2);
  add(mushafPage - 2);
  return [...new Set(order)];
}

export interface PageTextures {
  paper: THREE.Texture;
  /** By 1-based book page number; empty until the mushaf face has loaded. */
  pages: Map<number, THREE.Texture>;
}

export function usePageTextures(): PageTextures {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const position = useReader((s) => s.position);
  const setTexturesReady = useReader((s) => s.setTexturesReady);
  const anisotropy = gl.capabilities.getMaxAnisotropy();
  const size = useMemo(textureSize, []);
  const cache = useRef(new Map<number, THREE.Texture>());
  const cacheKey = useRef("");

  const paper = useMemo(
    () => canvasTexture(size[0], size[1], (ctx) => drawPaper(ctx, size[0], size[1]), anisotropy),
    [size, anisotropy],
  );
  const [pages, setPages] = useState<Map<number, THREE.Texture>>(() => new Map());

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-mushaf").trim() || "serif";
    const latin = getComputedStyle(document.documentElement).getPropertyValue("--font-latin").trim() || "serif";
    const want = neededFaces(position);

    const paint = (n: number) => {
      const page = BOOK_PAGES[n - 1];
      if (!page) return;
      const tex = canvasTexture(
        size[0],
        size[1],
        (ctx) => drawBookPage(ctx, size[0], size[1], page, family, latin),
        anisotropy,
      );
      cache.current.set(n, tex);
    };

    const yieldFrame = () =>
      new Promise<void>((resolve) => {
        frame = requestAnimationFrame(() => resolve());
      });

    document.fonts
      .load(`64px ${family}`, "بِسْمِ ٱللَّهِ ١٢٣")
      .then(() => document.fonts.load(`32px ${latin}`, "Bismi-LLâhir-Raḥmânir-Raḥeem ‘q̇ḍẓġ k͜h"))
      .catch(() => [])
      .then(async () => {
        if (cancelled) return;
        const key = `${size[0]}x${size[1]}:${anisotropy}:r${PAGE_DRAW_REVISION}`;
        if (cacheKey.current !== key) {
          cache.current.forEach((t) => t.dispose());
          cache.current.clear();
          cacheKey.current = key;
        }
        for (const n of want) {
          if (cancelled) return;
          if (!cache.current.has(n)) {
            paint(n);
            setPages(new Map(cache.current));
            invalidate();
            await yieldFrame();
          }
        }
        if (cancelled) return;
        const openRight = 2 * position - 1;
        const openLeft = 2 * position;
        if (cache.current.has(openRight) && cache.current.has(openLeft)) setTexturesReady();
        const keep = new Set(want);
        for (const [n, tex] of cache.current) {
          if (keep.has(n)) continue;
          tex.dispose();
          cache.current.delete(n);
        }
        setPages(new Map(cache.current));
        invalidate();
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [position, size, anisotropy, invalidate, setTexturesReady]);

  useEffect(
    () => () => {
      cache.current.forEach((t) => t.dispose());
      cache.current.clear();
    },
    [],
  );
  useEffect(() => () => paper.dispose(), [paper]);

  return { paper, pages };
}
