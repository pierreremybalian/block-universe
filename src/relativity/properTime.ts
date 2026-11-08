// Proper time along worldlines (natural units: t and x in the same unit, e.g. years and light-years).

import { gamma } from './lorentz.ts';

/** Proper time of a piecewise-straight worldline through points [t, x, y?][] (must be timelike everywhere). */
export function properTimeOfPath(points: readonly (readonly number[])[]): number {
  let tau = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dt = b[0]! - a[0]!;
    const dx = b[1]! - a[1]!;
    const dy = (b[2] ?? 0) - (a[2] ?? 0);
    const s = dt * dt - dx * dx - dy * dy;
    if (s < -1e-12) throw new Error('spacelike segment in worldline');
    tau += Math.sqrt(Math.max(0, s));
  }
  return tau;
}

/** Cumulative proper time at each point of a path (same layout as properTimeOfPath). */
export function cumulativeProperTime(points: readonly (readonly number[])[], out: number[] = []): number[] {
  out.length = points.length;
  out[0] = 0;
  for (let i = 1; i < points.length; i++) out[i] = out[i - 1]! + properTimeOfPath([points[i - 1]!, points[i]!]);
  return out;
}

export interface TwinTrip {
  /** Coordinate time on Earth for the round trip (years if distance is light-years). */
  homeYears: number;
  /** Proper time of the traveler. */
  travelerYears: number;
  gamma: number;
}

/** Instant turnaround round trip to a star `distanceLy` away at speed β. */
export function twinTrip(distanceLy: number, beta: number): TwinTrip {
  const g = gamma(beta);
  const homeYears = (2 * distanceLy) / beta;
  return { homeYears, travelerYears: homeYears / g, gamma: g };
}

/** Lifetime of a moving unstable particle in the lab. */
export function dilatedLifetime(tau0: number, g: number): number {
  return tau0 * g;
}
