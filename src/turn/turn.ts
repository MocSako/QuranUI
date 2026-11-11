import { computeFold, FLAT_FOLD, type Fold, type LeafPoint } from "@/scene/curl";
import { springStep } from "./spring";
import { tuning } from "./tuning";

/** `landed` holds the finished page in place until the book has moved it to its new side. */
export type TurnPhase = "rest" | "dragging" | "settling" | "returning" | "landed";

/** +1: a leaf lifts off the left half (forward). −1: off the right half (back). */
export type TurnSide = 1 | -1;

export type TurnOutcome = "landed" | "returned" | null;

/**
 * The page under the finger. Mutable on purpose: it changes every frame and is
 * read straight into shader uniforms, outside React.
 */
export class TurnEngine {
  phase: TurnPhase = "rest";
  side: TurnSide = 1;
  fold: Fold = FLAT_FOLD;

  private g: LeafPoint = { d: 0, y: 0 };
  private q: LeafPoint = { d: 0, y: 0 };
  private v: LeafPoint = { d: 0, y: 0 };
  private target: LeafPoint = { d: 0, y: 0 };
  private lastDragAt = 0;

  constructor(
    private pageWidth: number,
    private pageHeight: number,
  ) {}

  get active(): boolean {
    return this.phase !== "rest";
  }

  get animating(): boolean {
    return this.phase === "settling" || this.phase === "returning";
  }

  grab(side: TurnSide, at: LeafPoint, now: number): void {
    this.side = side;
    this.g = { d: Math.max(at.d, 0.35 * this.pageWidth), y: at.y };
    this.q = { ...this.g };
    this.v = { d: 0, y: 0 };
    this.lastDragAt = now;
    this.phase = "dragging";
    this.updateFold();
  }

  drag(to: LeafPoint, now: number): void {
    if (this.phase !== "dragging") return;
    const dt = Math.max((now - this.lastDragAt) / 1000, 1 / 240);
    const vd = (to.d - this.q.d) / dt;
    const vy = (to.y - this.q.y) / dt;
    this.v = { d: this.v.d * 0.4 + vd * 0.6, y: this.v.y * 0.4 + vy * 0.6 };
    this.q = { ...to };
    this.lastDragAt = now;
    this.updateFold();
  }

  /**
   * `flick` is true when the pointer left fast enough toward the spine. Touch
   * ends carry no velocity, so the page's own recent speed counts as a flick too.
   */
  release(flick: boolean, now: number, commitProgress: number = tuning.commitProgress): void {
    if (this.phase !== "dragging") return;
    const moving = now - this.lastDragAt < 100 && -this.v.d > tuning.flickPageSpeed * this.pageWidth;
    const complete = flick || moving || this.fold.progress > commitProgress;
    this.phase = complete ? "settling" : "returning";
    this.target = complete ? { d: -this.g.d, y: this.g.y } : { ...this.g };
  }

  /** A full turn by the same physics, from a tap, a key or a button. */
  turn(side: TurnSide, grabY: number): void {
    this.side = side;
    this.g = { d: this.pageWidth, y: grabY };
    this.q = { ...this.g };
    this.v = { d: 0, y: 0 };
    this.target = { d: -this.g.d, y: this.g.y };
    this.phase = "settling";
    this.updateFold();
  }

  step(dt: number): TurnOutcome {
    if (!this.animating) return null;
    const omega = tuning.settleOmega;
    [this.q.d, this.v.d] = springStep(this.q.d, this.v.d, this.target.d, omega, dt);
    [this.q.y, this.v.y] = springStep(this.q.y, this.v.y, this.target.y, omega, dt);
    this.updateFold();

    const rest = 0.0008 * this.pageWidth;
    const still = Math.abs(this.q.d - this.target.d) < rest && Math.abs(this.v.d) < rest * 10;
    if (!still) return null;

    if (this.phase === "settling") {
      this.q = { ...this.target };
      this.updateFold();
      this.phase = "landed";
      return "landed";
    }
    this.phase = "rest";
    this.fold = FLAT_FOLD;
    return "returned";
  }

  acknowledge(): void {
    if (this.phase !== "landed") return;
    this.phase = "rest";
    this.fold = FLAT_FOLD;
  }

  private updateFold(): void {
    this.fold = computeFold(this.g, this.q, this.pageWidth, this.pageHeight);
  }
}
