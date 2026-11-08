// Invariant geometry: the proper-time hyperboloid ("bowl of equal ages") and causal order. Natural units.

import { gamma } from './lorentz.ts';

/** Coordinate time of the τ-hyperboloid above (x, y): every event that is proper time τ after the origin. */
export function bowlT(tau: number, x: number, y = 0): number {
  return Math.sqrt(tau * tau + x * x + y * y);
}

/** Where a traveler leaving the origin at speed β (along x) sits after proper time τ: (t, x). */
export function bowlPoint(tau: number, beta: number): { t: number; x: number } {
  const g = gamma(beta);
  return { t: g * tau, x: g * beta * tau };
}

/** Slope dt/dx of the hyperboloid's section y = 0 at position x (equals the β of the traveler through it). */
export function bowlSlope(tau: number, x: number): number {
  return x / bowlT(tau, x);
}

/** Sign of Δt between two events in a frame moving at β: +1 if b after a, −1 if before, 0 if simultaneous. */
export function orderInFrame(a: { t: number; x: number }, b: { t: number; x: number }, beta: number): -1 | 0 | 1 {
  const dt = gamma(beta) * (b.t - a.t - beta * (b.x - a.x));
  return dt > 1e-12 ? 1 : dt < -1e-12 ? -1 : 0;
}

/** For a spacelike pair, the speed at which they are simultaneous (|β| < 1); null for timelike or lightlike pairs. */
export function flipSpeed(a: { t: number; x: number }, b: { t: number; x: number }): number | null {
  const dt = b.t - a.t;
  const dx = b.x - a.x;
  if (Math.abs(dt) >= Math.abs(dx)) return null;
  return dt / dx;
}

/** Time of b relative to a in the frame moving at β (natural units). */
export function dtInFrame(a: { t: number; x: number }, b: { t: number; x: number }, beta: number): number {
  return gamma(beta) * (b.t - a.t - beta * (b.x - a.x));
}
