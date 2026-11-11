import * as THREE from "three";

/**
 * Front face of one rehal board: a long plank with rounded tips and
 * fretwork that faces the seated reader.
 */
export function boardShape(length: number, width: number): THREE.Shape {
  const hx = length / 2;
  const hy = width / 2;
  const r = hy * 0.92;

  const shape = new THREE.Shape();
  shape.moveTo(-hx + r, -hy);
  shape.lineTo(hx - r, -hy);
  shape.absarc(hx - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-hx + r, hy);
  shape.absarc(-hx + r, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  shape.closePath();

  const holes: THREE.Path[] = [];
  holes.push(starRing(0, 0, width * 0.36, width * 0.2));

  for (const side of [-1, 1]) {
    const petal = new THREE.Path();
    ellipse(petal, side * length * 0.22, 0, width * 0.1, width * 0.22, 0);
    holes.push(petal);

    const roundel = new THREE.Path();
    roundel.absarc(side * length * 0.36, 0, width * 0.12, 0, Math.PI * 2, false);
    holes.push(roundel);
  }

  shape.holes = holes;
  return shape;
}

function starRing(cx: number, cy: number, outer: number, inner: number): THREE.Path {
  const path = new THREE.Path();
  for (let i = 0; i <= 16; i++) {
    const a = (i * Math.PI) / 8;
    const rr = i % 2 === 0 ? outer : outer * 0.7;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  for (let i = 16; i >= 0; i--) {
    const a = Math.PI / 16 + (i * Math.PI) / 8;
    const rr = i % 2 === 0 ? inner : inner * 0.7;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 16) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

function ellipse(path: THREE.Path, cx: number, cy: number, rx: number, ry: number, rot: number): void {
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const lx = Math.cos(t) * rx;
    const ly = Math.sin(t) * ry;
    const x = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
    const y = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
}
