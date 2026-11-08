// Stage 5 · The bowl of equal ages. Pure script shared by the scene, the narration and the HUD.
// Travelers leave one event at many speeds. The places where each has aged τ form the hyperboloid
// t = √(τ² + x² + y²): a bowl every observer agrees on. Each traveler's now-plane just touches the bowl at their bead.

import { ramp, track, windowed } from '../time/tracks.ts';
import { bowlPoint, bowlT } from '../relativity/invariants.ts';
import { gamma } from '../relativity/lorentz.ts';
import { registerStage, type Readout } from './index.ts';

/** Display units: years and light-years (c = 1). */
export const TAUS = [1, 2, 3] as const;
/** Speeds of the fan (along each of six directions), plus the traveler who stays put. */
export const FAN_SPEEDS = [0.3, 0.6, 0.85] as const;
export const FAN_DIRECTIONS = 6;
/** The two travelers we follow: A stays at the origin's rest frame, B moves at 0.6c along +x. */
export const A_BETA = 0;
export const B_BETA = 0.6;
/** The bowl the knives touch. */
export const KNIFE_TAU = 2;

export interface Traveler {
  beta: number;
  /** Direction in the x–y plane, radians. */
  dir: number;
}

export const TRAVELERS: readonly Traveler[] = [
  { beta: 0, dir: 0 },
  ...FAN_SPEEDS.flatMap((beta) => Array.from({ length: FAN_DIRECTIONS }, (_, k) => ({ beta, dir: (k * 2 * Math.PI) / FAN_DIRECTIONS }))),
];

/** Index of A (at rest) and B (0.6c along +x) in TRAVELERS. */
export const A_INDEX = 0;
export const B_INDEX = TRAVELERS.findIndex((t) => t.beta === B_BETA && t.dir === 0);

/** Spacetime point [x, t, y] where a traveler has aged τ. */
export function beadOf(tr: Traveler, tau: number): [number, number, number] {
  const p = bowlPoint(tau, tr.beta);
  return [p.x * Math.cos(tr.dir), p.t, p.x * Math.sin(tr.dir)];
}

/** The tangent now-plane at a traveler's bead on the τ bowl (travelling along x): t = βx + τ/γ. */
export function tangentIntercept(beta: number, tau: number): number {
  return tau / gamma(beta);
}

export function agesState(local: number) {
  return {
    /** Travelers' worldlines drawn outward from the origin (fraction of their length). */
    fan: track([
      [0.12, 0],
      [0.3, 1],
    ])(local),
    /** Beads appear on each worldline at each bowl (fractional count). */
    beads: track([
      [0.28, 0],
      [0.36, 1],
      [0.44, 2],
      [0.5, 3],
    ])(local),
    /** Bowls shown (fractional count). */
    bowls: track([
      [0.32, 0],
      [0.4, 1],
      [0.46, 2],
      [0.52, 3],
    ])(local),
    /** Highlight A and B. */
    pick: ramp(local, 0.56, 0.62),
    knifeA: ramp(local, 0.62, 0.68),
    knifeB: ramp(local, 0.68, 0.74),
    /** View boosted from the origin frame (A's) to B's frame. */
    boost: track([
      [0.8, 0],
      [0.9, B_BETA],
    ])(local),
    /** Light cone of the origin event. */
    cone: windowed(local, 0.04, 1.01, 0.08, 0.001),
    settle: ramp(local, 0.9, 1),
  };
}

export const ages = registerStage('ages', {
  note: 'Exact geometry: every bead, bowl and tangent plane is computed from the speeds shown. Years and light-years, with light at 45°.',
  readouts(local) {
    const s = agesState(local);
    const rows: Readout[] = [];
    if (s.bowls < 0.5) {
      if (s.fan > 0.05) rows.push({ label: 'Travelers', value: `0 to ${FAN_SPEEDS.at(-1)!.toFixed(2)} c`, tone: 'plain' });
      return rows;
    }
    if (s.pick < 0.5) {
      const n = Math.min(3, Math.max(1, Math.round(s.bowls)));
      rows.push({ label: 'Bowls', value: `${TAUS.slice(0, n).join(', ')} year${n === 1 ? '' : 's'} old`, tone: 'warm' });
      // How much later, in A's frame, the fastest traveler turns one.
      const t1 = bowlT(1, bowlPoint(1, FAN_SPEEDS.at(-1)!).x);
      rows.push({ label: `At ${FAN_SPEEDS.at(-1)!.toFixed(2)} c, first birthday at`, value: `${t1.toFixed(2)} yr`, tone: 'mute' });
      return rows;
    }
    rows.push({ label: 'A', value: 'at rest', tone: 'a' });
    rows.push({ label: 'B', value: `${B_BETA.toFixed(2)} c`, tone: 'b' });
    rows.push({ label: 'Both aged', value: `${KNIFE_TAU} years`, tone: 'warm' });
    if (s.boost > 0.02) rows.push({ label: 'Drawn in', value: s.boost > B_BETA / 2 ? 'B’s frame' : 'A’s frame', tone: s.boost > B_BETA / 2 ? 'b' : 'a' });
    return rows;
  },
});
