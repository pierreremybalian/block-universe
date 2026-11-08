// Special relativity in natural units (c = 1). Pure and allocation-free on the hot paths (write into `out`).
// Display layout for 2+1 spacetime is (x, t, y): world Y is time. Boosts are along x.

export interface Event2 {
  t: number;
  x: number;
}
export interface Event3 extends Event2 {
  y: number;
}

/** Lorentz factor. |β| must be < 1. */
export function gamma(beta: number): number {
  return 1 / Math.sqrt(1 - beta * beta);
}

export function rapidity(beta: number): number {
  return Math.atanh(beta);
}

export function betaFromRapidity(phi: number): number {
  return Math.tanh(phi);
}

/** Relativistic velocity addition (collinear): u ⊕ v. */
export function addVelocities(u: number, v: number): number {
  return (u + v) / (1 + u * v);
}

/** Coordinates of event e in a frame moving at β along x (relative to the frame e is given in). */
export function boost<T extends Event2>(e: T, beta: number, out: Event2 = { t: 0, x: 0 }): Event2 {
  const g = gamma(beta);
  const t = g * (e.t - beta * e.x);
  const x = g * (e.x - beta * e.t);
  out.t = t;
  out.x = x;
  return out;
}

/**
 * Boost a display-layout point (x, t, y) in place-safe fashion. Writes into out[0..2].
 * Mirror of the TSL `toView` boost (src/shared/block/view.ts).
 */
export function boostXTY(x: number, t: number, y: number, beta: number, out: Float64Array | number[]): void {
  const g = gamma(beta);
  out[0] = g * (x - beta * t);
  out[1] = g * (t - beta * x);
  out[2] = y;
}

/** Squared interval with signature (+, −, −): > 0 timelike, < 0 spacelike, 0 lightlike. */
export function intervalSq(a: Event3 | Event2, b: Event3 | Event2): number {
  const dt = b.t - a.t;
  const dx = b.x - a.x;
  const dy = ('y' in b ? b.y : 0) - ('y' in a ? a.y : 0);
  return dt * dt - dx * dx - dy * dy;
}

export type Separation = 'timelike' | 'spacelike' | 'lightlike';

export function separation(a: Event3 | Event2, b: Event3 | Event2, eps = 1e-12): Separation {
  const s = intervalSq(a, b);
  const scale = Math.max(1, Math.abs(b.t - a.t) ** 2);
  if (Math.abs(s) <= eps * scale) return 'lightlike';
  return s > 0 ? 'timelike' : 'spacelike';
}
