import * as THREE from "three";
import { tuning } from "@/turn/tuning";

/** Page width; every other length is relative to it. */
export const PAGE_W = 1;
/** A Madani mushaf page is about 1.42 times as tall as it is wide. */
export const PAGE_H = 1.42;
/** Both page blocks together, at full thickness. */
export const BLOCK_DEPTH = 0.06;
export const BLOCK_MIN = 0.0025;
export const COVER_PAD = 0.03;
export const COVER_THICKNESS = 0.026;

export const OPEN_ANGLE = THREE.MathUtils.degToRad(tuning.openAngleDeg);

/** The X frame: where the boards cross, their angle from the floor, arm lengths. */
export const STAND = {
  crossY: 0.48,
  angle: THREE.MathUtils.degToRad(52),
  armLength: 0.64,
  /** How far the boards run under the book, along the spine. */
  depth: 0.72,
  /** Visible width of each arm of the X, facing the reader. */
  thickness: 0.09,
} as const;

const armTipX = Math.cos(STAND.angle) * STAND.armLength;
const armTipY = STAND.crossY + Math.sin(STAND.angle) * STAND.armLength;

/** Height of the spine, so the cover rests on the tips of the upper arms. */
export const SPINE_Y = armTipY - armTipX * Math.tan(OPEN_ANGLE) + COVER_THICKNESS + 0.028;

/** Book frame: x across the spread, y along the spine (page top), z out of the page. */
export function bookToWorld(v: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, SPINE_Y + v.z, -v.y);
}

/** Half frames lean up from the spine by the open angle: left is +1, right is −1. */
export function halfToBook(v: THREE.Vector3, side: 1 | -1): THREE.Vector3 {
  return v.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), side * OPEN_ANGLE);
}

export function blockThickness(mushafPage: number, mushafPages: number): { right: number; left: number } {
  const read = (mushafPage - 1) / (mushafPages - 1);
  return {
    right: Math.max(BLOCK_MIN, BLOCK_DEPTH * read),
    left: Math.max(BLOCK_MIN, BLOCK_DEPTH * (1 - read)),
  };
}
