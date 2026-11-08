// Stage 10 · Your worldline. A life as a thread through the block, head and feet as two clocks that drift apart, and
// the arrow of time as an entropy gradient. Pure script shared by the scene and the HUD.

import { ramp, track, windowed } from '../time/tracks.ts';
import { headFeetDriftS } from '../relativity/gravity.ts';
import { HEAD_FEET_M, LIFE_YEARS, YEAR_S } from '../relativity/units.ts';
import { registerStage, type Readout } from './index.ts';

/** Display: the life runs from t = −2 (birth) to t = +2 (age 80): one display unit is 20 years. */
export const YEARS_PER_UNIT = LIFE_YEARS / 4;
export const LIFE_T0 = -2;
export const LIFE_T1 = 2;
/** The loupe magnifies the time gap between head and feet by this factor (shown on screen). */
export const LOUPE_FACTOR = 1e15;

export const tOfAge = (years: number) => LIFE_T0 + years / YEARS_PER_UNIT;
export const ageOfT = (t: number) => (t - LIFE_T0) * YEARS_PER_UNIT;

/** The life's wandering path in space (schematic: much wider than any real walk). */
export function lifeAt(t: number): [number, number] {
  return [
    -0.95 + 0.26 * Math.sin(1.3 * t + 0.4) + 0.1 * Math.sin(3.1 * t + 1.1),
    0.1 + 0.22 * Math.sin(0.9 * t + 2.0) + 0.08 * Math.sin(2.3 * t),
  ];
}

/** How far the head's clock is ahead of the feet's at a given age, seconds. */
export const headAheadS = (ageYears: number) => headFeetDriftS(HEAD_FEET_M, ageYears);

/** Display offset of the head's rung in the loupe (time gap × LOUPE_FACTOR, in display units). */
export const loupeOffset = (ageYears: number) =>
  (headAheadS(ageYears) * LOUPE_FACTOR) / (YEARS_PER_UNIT * YEAR_S);

export function youState(local: number) {
  return {
    /** The worldline is drawn from birth upward. */
    reveal: ramp(local, 0.04, 0.26),
    /** Head and feet separate into two threads. */
    split: ramp(local, 0.3, 0.38),
    /** The loupe inset. */
    loupe: windowed(local, 0.33, 0.64, 0.04),
    /** Age reached by the rungs in the loupe. */
    loupeAge: track([
      [0.38, 0],
      [0.56, LIFE_YEARS],
    ])(local),
    /** The ink drop's history appears, bottom up. */
    ink: ramp(local, 0.6, 0.74),
    /** Memories reach back down the worldline. */
    memories: ramp(local, 0.78, 0.9),
    /** A now-slice scans the life (what each slice can remember). */
    scan: track([
      [0.8, LIFE_T0 + 0.1],
      [0.97, LIFE_T1 - 0.1],
    ])(local),
    scanOn: windowed(local, 0.79, 1.01, 0.03),
    /** Camera eases toward the inset, then back out. */
    focus: windowed(local, 0.3, 0.66, 0.08),
    inkFocus: windowed(local, 0.6, 0.86, 0.08),
    pull: ramp(local, 0.88, 1),
  };
}

function fmtUs(s: number): string {
  const us = s * 1e6;
  return us < 0.0095 ? `${(us * 1000).toFixed(1)} ns` : `${us.toFixed(2)} µs`;
}

export const you = registerStage('you', {
  note: 'Your path through space is drawn far wider than any real life; in the inset, the gap between the head’s and the feet’s clocks is magnified 10¹⁵ times. The 0.47 µs is computed, not drawn.',
  readouts(local): Readout[] {
    const s = youState(local);
    const rows: Readout[] = [];
    if (s.reveal > 0.02)
      rows.push({ label: 'Life', value: `${Math.round(s.reveal * LIFE_YEARS)} years`, tone: 'plain' });
    if (s.loupe > 0.3) {
      // Same decade rung the loupe labels, so the corner and the inset always quote the same number.
      const age = Math.max(10, Math.floor(s.loupeAge / 10 + 1e-6) * 10);
      rows.push({
        label: `Head ahead of feet · age ${Math.round(age)}`,
        value: fmtUs(headAheadS(age)),
        tone: 'warm',
      });
    } else if (s.ink > 0.3) {
      rows.push({ label: 'Entropy', value: 'rises up the block', tone: 'light' });
    }
    return rows;
  },
});
