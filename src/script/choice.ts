// Stage 11 · Already written? What the block universe means for choice. The life from stage 10, paused at 35: lived
// from inside, the future branches; in the block there is one thread. Fixed is not forced: a choice is an event whose
// future light cone is downstream of it, and the past cone holds every record it could have. Pure script shared by
// the scene and the HUD.

import { ramp, track, windowed } from '../time/tracks.ts';
import { ANDROMEDA_LY, C_M_S, LY_M, YEAR_S } from '../relativity/units.ts';
import { LIFE_T0, LIFE_T1, lifeAt, tOfAge } from './you.ts';
import { registerStage, type Readout } from './index.ts';

/** The age the life is paused at, and where that moment sits in the block. */
export const CHOICE_AGE = 35;
export const T_CHOICE = tOfAge(CHOICE_AGE);
export const CHOICE_P: readonly [number, number, number] = (() => {
  const [x, y] = lifeAt(T_CHOICE);
  return [x, T_CHOICE, y];
})();

/**
 * Possible futures as lived (a metaphor): branch 0 is the life that happens; the others drift away from it after the
 * choice. Spread grows as u²/(0.5 + u), whose slope stays below 1, so every branch is a timelike path.
 */
const SPREAD: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.5, 0.12],
  [-0.46, 0.26],
  [0.26, -0.3],
  [-0.2, -0.16],
  [0.1, 0.36],
  [-0.52, -0.06],
];
export const BRANCHES = SPREAD.length;

export function branchAt(k: number, t: number): [number, number] {
  const [x, y] = lifeAt(t);
  const u = Math.max(0, t - T_CHOICE);
  const g = (u * u) / (0.5 + u);
  const [a, b] = SPREAD[k]!;
  return [x + a * g, y + b * g];
}

export type ConeSide = 'future' | 'past' | 'elsewhere';

/** Where a spacetime point sits relative to the choice's light cone (c = 1). */
export function coneSide(p: readonly number[]): ConeSide {
  const dt = p[1]! - CHOICE_P[1];
  const r = Math.hypot(p[0]! - CHOICE_P[0], p[2]! - CHOICE_P[2]);
  if (dt > r) return 'future';
  if (-dt > r) return 'past';
  return 'elsewhere';
}

/** Other things that happen in the block around the life (schematic placement). */
export const EVENTS: readonly (readonly [number, number, number])[] = [
  [0.2, 1.1, -0.3],
  [-0.3, 0.55, 0.6],
  [0.75, 1.7, 0.45],
  [-1.9, 1.55, 0.5],
  [-1.25, 0.95, -0.55],
  [-0.45, -1.35, -0.15],
  [-1.5, -1.05, 0.55],
  [-0.6, -0.8, 0.5],
  [1.5, 0.25, -0.4],
  [1.15, -0.6, 0.45],
  [-2.3, 0.15, -0.6],
];

/** Light-travel time from here to Andromeda, years: the earliest a choice made here can make a difference there. */
export const ANDROMEDA_REACH_YEARS = (ANDROMEDA_LY * LY_M) / (C_M_S * YEAR_S);

/** The now-sheet: paused at 35, then (Weyl's "crawling" awareness) sweeping the whole life, then back at 35. */
const knifeTrack = track(
  [
    [0.445, T_CHOICE],
    [0.4451, LIFE_T0 + 0.15],
    [0.555, LIFE_T1 - 0.15],
    [0.565, LIFE_T1 - 0.15],
    [0.5651, T_CHOICE],
  ],
  (s) => s,
);
const knifeOpacity = track([
  [0.03, 0],
  [0.11, 1],
  [0.425, 1],
  [0.445, 0],
  [0.465, 1],
  [0.545, 1],
  [0.565, 0],
  [0.6, 1],
]);

export function choiceState(local: number) {
  return {
    knifeT: knifeTrack(local),
    knife: knifeOpacity(local),
    /** The sweep (Weyl's crawling awareness). */
    scan: windowed(local, 0.445, 0.565, 0.02),
    /** Lived view: the growing-block filter hides the thread above the now. */
    lived: track([
      [0.13, 0],
      [0.2, 1],
      [0.27, 1],
      [0.33, 0],
    ])(local),
    /** Possible futures grow up from the now. */
    branches: ramp(local, 0.14, 0.23),
    /** ...and all but the real one fade when the block comes back. */
    collapse: ramp(local, 0.27, 0.34),
    /** The thread above the now glows: tomorrow is as much there as yesterday. */
    fixed: windowed(local, 0.33, 0.46, 0.04),
    /** The terms card (fatalism, determinism, eternalism, predestination). */
    terms: windowed(local, 0.555, 0.645, 0.02),
    /** The choice lights up; its future cone grows, then its past cone. */
    choice: ramp(local, 0.6, 0.64),
    future: ramp(local, 0.62, 0.73),
    past: ramp(local, 0.73, 0.81),
    /** Labels for the two cones and elsewhere. */
    zones: ramp(local, 0.76, 0.83),
    /** Labels quieten as the camera pulls back for the last caption. */
    pull: ramp(local, 0.88, 1),
  };
}

const fmtYears = (y: number) => (y >= 1e6 ? `${(y / 1e6).toFixed(1)} million years` : `${Math.round(y)} years`);

export const choice = registerStage('choice', {
  note: 'Philosophy, not physics: no experiment bears on free will. The branches are a metaphor for possibilities, not something the block contains, and the life’s path through space is drawn far wider than any real one.',
  readouts(local): Readout[] {
    const s = choiceState(local);
    const rows: Readout[] = [];
    if (local > 0.04 && s.scan < 0.5) rows.push({ label: 'You', value: `age ${CHOICE_AGE}`, tone: 'a' });
    if (s.zones > 0.3) {
      rows.push({ label: 'Past cone', value: 'can know · can’t change', tone: 'warm' });
      rows.push({ label: 'Future cone', value: 'can change · can’t know', tone: 'light' });
    } else if (s.future > 0.2) {
      rows.push({ label: 'Future cone', value: 'what your choice can affect', tone: 'light' });
      rows.push({ label: 'Earliest it reaches Andromeda', value: fmtYears(ANDROMEDA_REACH_YEARS), tone: 'light' });
    } else if (s.terms > 0.3) {
      rows.push({ label: 'Fixed', value: 'yes, on the block view', tone: 'both' });
      rows.push({ label: 'Forced', value: 'no', tone: 'warm' });
    } else if (s.scan > 0.5) {
      rows.push({ label: 'Every slice of the life', value: 'equally there', tone: 'both' });
    } else if (s.branches > 0.3 && s.collapse < 0.5) {
      rows.push({ label: 'Above the now', value: 'branches (as lived)', tone: 'warm' });
    } else if (s.collapse >= 0.5) {
      rows.push({ label: 'Above the now', value: 'one thread (the block)', tone: 'both' });
    }
    return rows;
  },
});
