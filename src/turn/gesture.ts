"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useDrag } from "@use-gesture/react";
import * as THREE from "three";
import { canTurnBack, canTurnForward } from "@/book/leaves";
import { PAGE_H, PAGE_W } from "@/scene/geometry";
import type { LeafPoint } from "@/scene/curl";
import { useReader } from "@/state/reader";
import type { TurnEngine, TurnSide } from "./turn";
import { tuning } from "./tuning";

interface Hit {
  /** Which half of the open book was hit: 1 is the left page, −1 the right. */
  half: TurnSide;
  /** Distance from the spine toward that page's outer edge, and height. */
  d: number;
  y: number;
}

interface Grab {
  side: TurnSide;
  g: LeafPoint;
  startXy: [number, number];
  startY: number;
}

/** Pointer down on a page, waiting for enough travel to choose a turn. */
interface Pending {
  hit: Hit;
  startXy: [number, number];
}

interface Crossfade {
  side: TurnSide;
  t: number;
  landed: boolean;
}

/**
 * Maps pointer, tap, keyboard and button input onto the turn engine. The page
 * follows the pointer on every move; the engine's spring only runs after release.
 *
 * Mushaf binding: next curls the left leaf, back curls the right. From the
 * shelf a drag does nothing; once a page is zoomed, taking its outer edge and
 * pulling it in toward the spine turns that leaf, with the corner under the finger.
 */
export function useTurnInput(
  engine: TurnEngine,
  ink: { value: number },
  left: RefObject<THREE.Group | null>,
  right: RefObject<THREE.Group | null>,
): void {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const grab = useRef<Grab | null>(null);
  const pending = useRef<Pending | null>(null);
  const fade = useRef<Crossfade | null>(null);
  const tools = useMemo(
    () => ({
      ray: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      plane: new THREE.Plane(),
      normal: new THREE.Vector3(),
      origin: new THREE.Vector3(),
      point: new THREE.Vector3(),
      q: new THREE.Quaternion(),
    }),
    [],
  );

  /** Where the pointer meets the plane of one half, in that half's frame. */
  const project = (
    clientX: number,
    clientY: number,
    half: TurnSide,
  ): (LeafPoint & { dist: number }) | null => {
    const group = half === 1 ? left.current : right.current;
    if (!group) return null;
    const rect = gl.domElement.getBoundingClientRect();
    tools.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    tools.ray.setFromCamera(tools.ndc, camera);
    group.getWorldQuaternion(tools.q);
    group.getWorldPosition(tools.origin);
    tools.normal.set(0, 0, 1).applyQuaternion(tools.q);
    tools.plane.setFromNormalAndCoplanarPoint(tools.normal, tools.origin);
    if (!tools.ray.ray.intersectPlane(tools.plane, tools.point)) return null;
    const dist = tools.ray.ray.origin.distanceTo(tools.point);
    const local = group.worldToLocal(tools.point.clone());
    return { d: -half * local.x, y: local.y, dist };
  };

  /** The nearer of the two page planes that the ray actually hits. */
  const hitBook = (clientX: number, clientY: number): Hit | null => {
    let best: (Hit & { dist: number }) | null = null;
    for (const half of [1, -1] as const) {
      const p = project(clientX, clientY, half);
      if (!p || p.d < 0 || p.d > PAGE_W || Math.abs(p.y) > PAGE_H / 2) continue;
      if (!best || p.dist < best.dist) best = { half, d: p.d, y: p.y, dist: p.dist };
    }
    return best ? { half: best.half, d: best.d, y: best.y } : null;
  };

  const startCrossfade = (side: TurnSide) => {
    const s = useReader.getState();
    s.setTurning(side);
    fade.current = { side, t: 0, landed: false };
    invalidate();
  };

  const startTurn = (side: TurnSide, grabY: number) => {
    const s = useReader.getState();
    if (s.reducedMotion) return startCrossfade(side);
    s.setTurning(side);
    engine.turn(side, grabY);
    invalidate();
  };

  const allowed = (side: TurnSide) => {
    const s = useReader.getState();
    return side === 1 ? canTurnForward(s.leaves, s.position) : canTurnBack(s.position);
  };

  /** Fold progress as the pointer moves from the outer edge in toward the spine. */
  const screenProgress = (side: TurnSide, startX: number, x: number): number => {
    const raw = side === 1 ? x - startX : startX - x;
    return Math.max(0, raw) * ((2 * PAGE_W) / tuning.dragFullTurnPx);
  };

  const beginGrab = (side: TurnSide, hit: Hit, startXy: [number, number], xy: [number, number]) => {
    const s = useReader.getState();
    const g: LeafPoint = { d: Math.max(hit.d, 0.35 * PAGE_W), y: hit.y };
    grab.current = { side, g, startXy, startY: hit.y };
    pending.current = null;
    if (s.reducedMotion) return;
    s.setTurning(side);
    engine.grab(side, g, performance.now());
    const projected = project(xy[0], xy[1], side);
    const leafY = projected?.y ?? hit.y;
    // The corner stays on the pointer. A fixed pixel ratio raced it to the spine.
    const qD = projected ? Math.min(g.d, projected.d) : g.d;
    engine.drag({ d: qD, y: leafY }, performance.now());
    invalidate();
  };

  useDrag(
    ({ first, last, tap, xy, initial, velocity: [vx], direction: [dx], event }) => {
      event?.preventDefault?.();
      const s = useReader.getState();

      if (tap) {
        if (grab.current) {
          grab.current = null;
          pending.current = null;
          return;
        }
        pending.current = null;
        if (s.focus !== null) {
          s.clearFocus();
          return;
        }
        const hit = hitBook(xy[0], xy[1]);
        if (hit && engine.phase === "rest" && !fade.current) s.focusPage(hit.half);
        else (s.barVisible ? s.hideBar : s.showBar)();
        return;
      }

      // The seated shelf is for looking. A page turns under the finger only once it is zoomed.
      if (s.focus === null) return;

      if (first) {
        grab.current = null;
        pending.current = null;
        if (engine.phase !== "rest" || fade.current) return;
        const hit = hitBook(initial[0], initial[1]);
        if (!hit) return;
        pending.current = { hit, startXy: [initial[0], initial[1]] };
        return;
      }

      if (pending.current && !grab.current) {
        const { hit, startXy } = pending.current;
        const dxPx = xy[0] - startXy[0];
        if (Math.abs(dxPx) < tuning.dragThresholdPx) {
          if (last) pending.current = null;
          return;
        }
        const towardSpine = hit.half === 1 ? dxPx > 0 : dxPx < 0;
        const side: TurnSide = hit.half;
        if (!towardSpine) {
          if (last) pending.current = null;
          return;
        }
        if (!allowed(side)) {
          pending.current = null;
          return;
        }
        beginGrab(side, hit, startXy, xy);
      }

      const held = grab.current;
      if (!held) {
        if (last) pending.current = null;
        return;
      }

      const travel = screenProgress(held.side, held.startXy[0], xy[0]);
      // Next completes rightward, toward the spine (+dx). Back completes leftward (−dx).
      const towardComplete = held.side === 1 ? 1 : -1;
      const flick = vx * dx * towardComplete > tuning.flickVelocity;

      if (s.reducedMotion) {
        if (last) {
          if (travel > 0.08 * PAGE_W || flick) {
            if (useReader.getState().focus !== null) useReader.setState({ pendingFocus: held.side === 1 ? -1 : 1 });
            startCrossfade(held.side);
          }
          grab.current = null;
          pending.current = null;
        }
        return;
      }

      const projected = project(xy[0], xy[1], held.side);
      const leafY = projected?.y ?? held.startY;
      const qD = projected ? Math.min(held.g.d, projected.d) : held.g.d - travel;
      engine.drag({ d: qD, y: leafY }, performance.now());
      if (last) {
        engine.release(flick, performance.now(), tuning.commitProgress);
        if (engine.phase === "settling" && useReader.getState().focus !== null) {
          useReader.setState({ pendingFocus: held.side === 1 ? -1 : 1 });
        }
        grab.current = null;
        pending.current = null;
      }
      invalidate();
    },
    {
      target: gl.domElement,
      filterTaps: true,
      pointer: { touch: true, capture: true },
      eventOptions: { passive: false },
    },
  );

  // Keyboard and the control bar ask through the store.
  const request = useReader((s) => s.request);
  useEffect(() => {
    if (!request) return;
    useReader.getState().clearRequest();
    if (engine.phase !== "rest" || fade.current) return;
    startTurn(request.side, PAGE_H * 0.18);
    // startTurn reads the store and the engine; neither changes identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 1 / 20);
    const outcome = engine.step(step);
    if (outcome === "landed") useReader.getState().land(engine.side);
    else if (outcome === "returned") useReader.getState().setTurning(null);
    if (engine.animating) invalidate();

    const f = fade.current;
    if (f) {
      f.t += (step * 1000) / tuning.crossfadeMs;
      if (!f.landed && f.t >= 1) {
        f.landed = true;
        useReader.getState().land(f.side);
      }
      ink.value = f.t < 1 ? 1 - f.t : Math.min(1, f.t - 1);
      if (f.t >= 2) {
        ink.value = 1;
        fade.current = null;
      }
      invalidate();
    }
  });
}
