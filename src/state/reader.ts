import { create } from "zustand";
import { BOOK_PAGES, JUZ, MUSHAF_PAGES, SURAHS } from "@/book/samplePages";
import { buildLeaves, canStep, canTurnBack, canTurnForward, initialPosition, type Leaf } from "@/book/leaves";
import type { TurnSide } from "@/turn/turn";

export type TurnRequest = { side: TurnSide; id: number } | null;

interface ReaderState {
  leaves: Leaf[];
  position: number;
  /** A side is set while a leaf is off its stack, so the scene can lift it. */
  turning: TurnSide | null;
  /** Turns asked for by the keyboard or the bar; the scene runs them. */
  request: TurnRequest;
  /** Which open page is face-on, or null for the seated spread. */
  focus: TurnSide | null;
  /** Applied in `land` so a turn from a zoomed page finishes on the new page. */
  pendingFocus: TurnSide | null;
  barVisible: boolean;
  reducedMotion: boolean;
  texturesReady: boolean;

  setTurning: (side: TurnSide | null) => void;
  land: (side: TurnSide) => void;
  requestTurn: (side: TurnSide) => void;
  clearRequest: () => void;
  focusPage: (side: TurnSide) => void;
  clearFocus: () => void;
  step: (dir: TurnSide) => void;
  goToPosition: (mushafPage: number) => void;
  goToSurah: (n: number) => void;
  goToJuz: (n: number) => void;
  showBar: () => void;
  hideBar: () => void;
  setReducedMotion: (on: boolean) => void;
  setTexturesReady: () => void;
}

export const useReader = create<ReaderState>((set, get) => ({
  leaves: buildLeaves(BOOK_PAGES.length),
  position: initialPosition(),
  turning: null,
  request: null,
  focus: null,
  pendingFocus: null,
  barVisible: true,
  reducedMotion: false,
  texturesReady: false,

  setTurning: (turning) => set({ turning }),
  land: (side) =>
    set((s) => ({
      position: s.position + side,
      turning: null,
      focus: s.pendingFocus ?? s.focus,
      pendingFocus: null,
    })),
  requestTurn: (side) => {
    const s = get();
    if (s.turning !== null || s.request !== null) return;
    if (s.focus !== null) {
      s.step(side);
      return;
    }
    const allowed = side === 1 ? canTurnForward(s.leaves, s.position) : canTurnBack(s.position);
    if (allowed) set({ request: { side, id: Date.now() } });
  },
  clearRequest: () => set({ request: null }),
  focusPage: (side) => set({ focus: side, barVisible: false }),
  clearFocus: () => set({ focus: null, pendingFocus: null, barVisible: true }),
  step: (dir) => {
    const s = get();
    if (s.focus === null || s.turning !== null || s.request !== null) return;
    if (!canStep(s.leaves, s.position, s.focus, dir)) return;
    if (s.focus === -1 && dir === 1) {
      set({ focus: 1, barVisible: false });
      return;
    }
    if (s.focus === 1 && dir === -1) {
      set({ focus: -1, barVisible: false });
      return;
    }
    const side: TurnSide = dir;
    set({ focus: null, pendingFocus: dir === 1 ? -1 : 1, request: { side, id: Date.now() }, barVisible: false });
  },
  goToPosition: (mushafPage) => {
    const page = Math.max(1, Math.min(MUSHAF_PAGES, Math.round(mushafPage)));
    set({
      position: page,
      turning: null,
      request: null,
      focus: null,
      pendingFocus: null,
    });
  },
  goToSurah: (n) => {
    const surah = SURAHS[n - 1];
    if (surah) get().goToPosition(surah.startPage);
  },
  goToJuz: (n) => {
    const juz = JUZ[n - 1];
    if (juz) get().goToPosition(juz.page);
  },
  showBar: () => set({ barVisible: true }),
  hideBar: () => set({ barVisible: false }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTexturesReady: () => set({ texturesReady: true }),
}));
