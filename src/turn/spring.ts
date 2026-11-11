/** One step of a critically damped spring: x'' = ω²(target − x) − 2ω x'. */
export function springStep(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  // Semi-implicit Euler in small substeps stays stable at any frame time.
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const a = omega * omega * (target - x) - 2 * omega * v;
    v += a * h;
    x += v * h;
  }
  return [x, v];
}
