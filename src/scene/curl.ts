import { tuning } from "@/turn/tuning";

/**
 * A point on a leaf, in the leaf's own frame: `d` is the distance from the
 * spine toward the outer edge, `y` runs along the spine (0 at mid-height).
 */
export interface LeafPoint {
  d: number;
  y: number;
}

/** The fold line (through `p0`, normal `n` pointing to the outer edge) and cylinder radius. */
export interface Fold {
  p0x: number;
  p0y: number;
  nx: number;
  ny: number;
  r: number;
  /** 0 with the page flat where it started, 1 once it lies flat on the other side. */
  progress: number;
}

export const FLAT_FOLD: Fold = { p0x: 0, p0y: 0, nx: 1, ny: 0, r: 0, progress: 0 };

/**
 * Places the cylinder so the grabbed point `g` follows the pointer `q`. Points
 * past the fold wrap around a cylinder of radius r and then lie flat, mirrored,
 * so the grabbed point lands on the pointer; r shrinks to zero as the page lands
 * so the final state is an exact mirror about the spine.
 */
export function computeFold(g: LeafPoint, q: LeafPoint, pageWidth: number, pageHeight: number): Fold {
  const vx = g.d - q.d;
  const vy = g.y - q.y;
  const len = Math.hypot(vx, vy);
  const progress = Math.min(1, Math.max(0, len / (2 * Math.max(g.d, 1e-4))));
  const r = tuning.curlRadius * pageWidth * (1 - progress);

  let angle = len < 1e-6 ? 0 : Math.atan2(vy, Math.max(vx, 1e-6));
  angle = Math.max(-tuning.maxFoldAngle, Math.min(tuning.maxFoldAngle, angle));

  const sG = (len + Math.PI * r) / 2;
  let nx = Math.cos(angle);
  let ny = Math.sin(angle);
  let p0x = g.d - nx * sG;
  let p0y = g.y - ny * sG;

  // The leaf is bound at the spine: straighten the fold until it no longer
  // crosses the spine edge, except in the last stretch of the turn.
  for (let i = 0; i < 12 && progress < 0.9; i++) {
    const dTop = p0x - (pageHeight / 2 - p0y) * (ny / nx);
    const dBottom = p0x - (-pageHeight / 2 - p0y) * (ny / nx);
    if (Math.min(dTop, dBottom) >= 0) break;
    angle *= 0.75;
    nx = Math.cos(angle);
    ny = Math.sin(angle);
    p0x = g.d - nx * sG;
    p0y = g.y - ny * sG;
  }

  return { p0x, p0y, nx, ny, r, progress };
}

export const leafVertexShader = /* glsl */ `
#define PI 3.141592653589793
uniform vec2 uP0;
uniform vec2 uN;
uniform float uR;
uniform float uSide;
uniform float uActive;
uniform float uZFrom;
uniform float uZTo;
uniform float uW;
uniform float uOpen;
uniform float uCrossAll;
varying vec2 vUv;
varying vec3 vNormal;
varying float vD;
varying float vBend;

vec3 rotY(vec3 v, float b) {
  float c = cos(b);
  float s = sin(b);
  return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

void main() {
  vec2 p = vec2(-position.x, position.y);
  float s = uActive > 0.5 ? dot(p - uP0, uN) : -1.0;
  float R = max(uR, 1e-5);
  float a = clamp(s / R, 0.0, PI);
  float sp;
  float z;
  if (s <= 0.0) {
    sp = s;
    z = 0.0;
  } else if (s < PI * R) {
    sp = R * sin(a);
    z = R * (1.0 - cos(a));
  } else {
    sp = PI * R - s;
    z = 2.0 * R;
  }
  vec2 m = p + uN * (sp - s);

  float ca = cos(a);
  float sa = sin(a);
  vec3 td = vec3(1.0 + (ca - 1.0) * uN.x * uN.x, (ca - 1.0) * uN.x * uN.y, sa * uN.x);
  vec3 ty = vec3((ca - 1.0) * uN.x * uN.y, 1.0 + (ca - 1.0) * uN.y * uN.y, sa * uN.y);
  td.x *= -uSide;
  ty.x *= -uSide;

  // Past the spine the leaf bends into the other half of the open book and
  // rests on that half's page block; before it, it stays above its own.
  float crossed = -m.x;
  float t = crossed >= 0.0 ? max(smoothstep(0.0, 0.12 * uW, crossed), uCrossAll) : 0.0;
  vec3 pos = vec3(-uSide * m.x, m.y, mix(uZFrom, uZTo, t) + z);
  float beta = -uSide * 2.0 * uOpen * t;
  pos = rotY(pos, beta);
  td = rotY(td, beta);
  ty = rotY(ty, beta);

  vNormal = normalize(cross(ty, td));
  vUv = uv;
  vD = p.x;
  vBend = a / PI;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const leafFragmentShader = /* glsl */ `
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uPaper;
uniform vec3 uLight;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uInk;
uniform float uGutter;
uniform float uW;
varying vec2 vUv;
varying vec3 vNormal;
varying float vD;
varying float vBend;

void main() {
  bool front = gl_FrontFacing;
  vec2 uv = front ? vUv : vec2(1.0 - vUv.x, vUv.y);
  vec3 printed = front ? texture2D(uA, uv).rgb : texture2D(uB, uv).rgb;
  vec3 paper = texture2D(uPaper, uv).rgb;
  vec3 col = mix(paper, printed, uInk);

  vec3 N = normalize(front ? vNormal : -vNormal);
  float flatLight = uAmbient + uDiffuse * max(uLight.z, 0.0);
  float lit = (uAmbient + uDiffuse * max(dot(N, uLight), 0.0)) / flatLight;
  float gutter = 1.0 - uGutter * exp(-max(vD, 0.0) / (0.06 * uW));
  float sheen = pow(max(dot(reflect(-uLight, N), vec3(0.0, 0.0, 1.0)), 0.0), 18.0) * 0.07 * vBend;

  float grazing = 1.0 - abs(N.z);
  float edge = 1.0 - 0.35 * grazing * grazing;

  gl_FragColor = vec4(col * lit * gutter * edge + sheen, 1.0);
}
`;

export const shadowVertexShader = /* glsl */ `
varying vec2 vXY;
void main() {
  vXY = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const shadowFragmentShader = /* glsl */ `
#define PI 3.141592653589793
uniform vec2 uP0;
uniform vec2 uN;
uniform float uR;
uniform float uSide;
uniform float uActive;
uniform float uIsFrom;
uniform float uW;
uniform float uH;
uniform float uStrength;
varying vec2 vXY;

void main() {
  if (uActive < 0.5) discard;
  vec2 p = vec2(-uSide * vXY.x, vXY.y);
  float s = dot(p - uP0, uN);
  float R = max(uR, 1e-5);

  // The curl seen from above covers s in [0, R]; the shadow it throws on the
  // page beneath starts at that edge so it reads as the fold's silhouette.
  float under = 0.0;
  if (uIsFrom > 0.5 && s > 0.0 && p.x >= 0.0) {
    under = s < R ? 1.0 : exp(-(s - R) / (1.2 * R + 0.05 * uW));
  }

  // Around the edge of the part that has already folded over.
  vec2 q = p - 2.0 * uN * (s - 0.5 * PI * R);
  float rim = 0.0;
  if (dot(q - uP0, uN) >= PI * R) {
    vec2 o = vec2(max(-q.x, q.x - uW), abs(q.y) - 0.5 * uH);
    float sd = max(o.x, o.y);
    rim = 0.55 * (1.0 - smoothstep(0.0, 0.025 * uW + 0.6 * R, sd));
  }

  float alpha = uStrength * max(under, rim);
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(0.05, 0.035, 0.02, alpha);}
`;
