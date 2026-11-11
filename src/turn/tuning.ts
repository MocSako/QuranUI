/**
 * Every constant that decides how the page feels. Lengths are fractions of the
 * page width unless noted, so the feel survives a change of book size.
 */
export const tuning = {
  /** Curl radius at the start of a turn; it shrinks to zero as the page lands. */
  curlRadius: 0.1,
  /** Largest fold angle away from vertical, in radians. A higher grab gives a steeper fold. */
  maxFoldAngle: 0.55,
  /** Share of the full turn past which a release completes it (0.5 is the spine). */
  commitProgress: 0.5,
  /** Pointer speed in the turn direction, in CSS pixels per millisecond, that completes a turn. */
  flickVelocity: 0.4,
  /** The same, measured on the page itself in page widths per second. */
  flickPageSpeed: 1.5,
  /** Spring frequency in rad/s. Critically damped, so it lands without bounce; 14 gives ~450 ms. */
  settleOmega: 14,
  /** Horizontal pointer travel in CSS pixels before a drag locks a turn direction. */
  dragThresholdPx: 24,
  /** Screen pixels of drag that map to a full leaf fold (g.d → −g.d). */
  dragFullTurnPx: 220,
  /** Darkness of the shadow under the lifted page, 0 to 1. */
  shadowStrength: 0.5,
  /** Darkening where the page curves into the spine, 0 to 1. */
  gutterShade: 0.2,
  /** Each half of the open book rises this many degrees from the spine. */
  openAngleDeg: 22,
  /** Camera spring between the seated view and a face-on page, in rad/s. */
  viewOmega: 6.2,
  /** Largest mouse-parallax yaw, in degrees, around the seated view. */
  parallaxDeg: 3,
  /** Horizontal swipe, in CSS pixels, that steps a page while zoomed in. */
  focusSwipe: 56,
  /** Reduced motion: each half of the crossfade, in ms. */
  crossfadeMs: 140,
  /** Camera glide from stand view to reading view, as a spring frequency in rad/s. */
  glideOmega: 3.4,
} as const;
