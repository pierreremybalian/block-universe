// The shared block (HANDOFF §1): one cast of worldlines and events reused by the stages, so the block stacked in
// stage 2 is the block sliced in stage 6 and seen whole in stage 9. Display units: c = 1; one unit is one
// light-hour of space and one hour of time. A is at rest at the centre; B passes through the same here-now.

import type { Bounds } from './block/glassBlock.ts';
import { PAL, type RGB } from './block/palette.ts';

export const WORLD: Bounds = { x0: -3, x1: 3, t0: -2, t1: 2, y0: -1.5, y1: 1.5 };

/** Lamps at rest in A's frame; each flashes once (a beacon event). */
export interface Beacon {
  n: number;
  x: number;
  t: number;
  y: number;
  colour: RGB;
}

export const BEACONS: readonly Beacon[] = [
  { n: 1, x: -2.4, t: -0.8, y: 0.4, colour: PAL.line },
  { n: 2, x: 2.2, t: -0.6, y: -0.5, colour: PAL.line },
  { n: 3, x: -1.2, t: 0.4, y: 0.4, colour: PAL.line },
  { n: 4, x: 1.6, t: 0.8, y: -0.5, colour: PAL.line },
  { n: 5, x: 2.5, t: 0.2, y: 0.6, colour: PAL.line },
  { n: 6, x: -2.5, t: 0.0, y: -0.6, colour: PAL.line },
  { n: 7, x: 0.9, t: -1.2, y: 0.9, colour: PAL.line },
];

/** Cause → effect pairs among the beacons: 1 → 3 by light, 2 → 4 by a slower messenger. Their order never flips. */
export const CAUSAL: readonly { from: number; to: number; kind: 'light' | 'messenger' }[] = [
  { from: 1, to: 3, kind: 'light' },
  { from: 2, to: 4, kind: 'messenger' },
];

/** A star with a planet on a helix, off to one side (schematic: not to scale). */
export const STAR = { x: -1.2, y: -0.9, colour: PAL.sun };
export const PLANET = { r: 0.32, period: 1.35, phase: 0.4, colour: PAL.earth };

export function planetAt(t: number): [number, number] {
  const a = ((t / PLANET.period) * 2 + PLANET.phase) * Math.PI;
  return [STAR.x + PLANET.r * Math.cos(a), STAR.y + PLANET.r * Math.sin(a)];
}

export function beacon(n: number): Beacon {
  const b = BEACONS.find((e) => e.n === n);
  if (!b) throw new Error(`no beacon ${n}`);
  return b;
}
