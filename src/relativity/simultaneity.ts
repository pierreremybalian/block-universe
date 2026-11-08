// Relativity of simultaneity. Natural units unless a name says otherwise.

import { C2, C_M_S } from './units.ts';

/**
 * The now-slice of an observer moving at β (along x) through event (t₀, x₀), in the rest frame's coordinates:
 * t = t₀ + β (x − x₀). Returns the slice's t at position x.
 */
export function sliceT(beta: number, t0: number, x0: number, x: number): number {
  return t0 + beta * (x - x0);
}

/** Intercept c of the slice written as t = βx + c. */
export function sliceIntercept(beta: number, t0: number, x0: number): number {
  return t0 - beta * x0;
}

/**
 * How far a distant clock's "now" shifts (in its rest frame, seconds) for someone moving at v (m/s) along the line
 * to it, at distance d (m): Δt = v d / c². Exact for the slice through the observer's here-now (no γ: the slice
 * is t = βx in the rest frame of the distant object).
 */
export function simultaneityShiftS(vMs: number, dM: number): number {
  return (vMs * dM) / C2;
}

/** The widest possible "now" at distance d: every moment within ±d/c could be called now by someone here. Seconds. */
export function nowWidthS(dM: number): number {
  return dM / C_M_S;
}
