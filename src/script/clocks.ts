// Stage 4 · Moving clocks run slow (time dilation). Pure script shared by the scene, the narration and the HUD.
// The twins: one stays home, one flies to Proxima Centauri and back at 0.8c (instant turnaround). Display units
// are years and light-years scaled by S (c = 1 either way).

import { ramp, track, windowed, linear } from '../time/tracks.ts';
import { twinTrip, dilatedLifetime } from '../relativity/properTime.ts';
import { gamma } from '../relativity/lorentz.ts';
import { gpsBudgetUsPerDay } from '../relativity/gravity.ts';
import { CERN_MUON_GAMMA, CERN_MUON_LIFETIME_MEASURED_S, MUON_LIFETIME_S, PROXIMA_LY } from '../relativity/units.ts';
import { registerStage, type Readout } from './index.ts';

export const TRAVEL_BETA = 0.8;
export const TRIP = twinTrip(PROXIMA_LY, TRAVEL_BETA);
/** Display units per year (and per light-year). */
export const S = 0.38;
/** Coordinate time of the turnaround, years. */
export const TURN_YEARS = TRIP.homeYears / 2;
/** Traveler's age at the turnaround, years. */
export const TURN_AGE = TRIP.travelerYears / 2;

/** Traveler position (light-years) at home time t (years). */
export function travelerX(tYears: number): number {
  const t = Math.min(Math.max(tYears, 0), TRIP.homeYears);
  return t <= TURN_YEARS ? TRAVEL_BETA * t : PROXIMA_LY - TRAVEL_BETA * (t - TURN_YEARS);
}

/** Traveler's age (years) at home time t (years): constant speed on both legs, so τ = t / γ. */
export function travelerAge(tYears: number): number {
  return Math.min(Math.max(tYears, 0), TRIP.homeYears) / gamma(TRAVEL_BETA);
}

/** Where (home time t, x in light-years) the traveler turns `age` years old. */
export function travelerAtAge(age: number): { t: number; x: number } {
  const t = age * gamma(TRAVEL_BETA);
  return { t, x: travelerX(t) };
}

/** Measured examples (data, not computed): Hafele & Keating 1972, Science 177, 166–170. Nanoseconds. */
export const HAFELE_KEATING = {
  east: { measured: -59, err: 10, predicted: -40, predErr: 23 },
  west: { measured: 273, err: 7, predicted: 275, predErr: 21 },
};

export const MUON = {
  restUs: MUON_LIFETIME_S * 1e6,
  gamma: CERN_MUON_GAMMA,
  predictedUs: dilatedLifetime(MUON_LIFETIME_S, CERN_MUON_GAMMA) * 1e6,
  measuredUs: CERN_MUON_LIFETIME_MEASURED_S * 1e6,
};

export const GPS = gpsBudgetUsPerDay();

/** Home time (years) drawn so far: the journey climbs the block. */
const journey = track(
  [
    [0.12, 0],
    [0.5, TRIP.homeYears],
  ],
  (s) => linear(s) * 0.15 + 0.85 * (s * s * (3 - 2 * s)),
);

export function clocksState(local: number) {
  return {
    /** Home time revealed, years. */
    tYears: journey(local),
    /** Proxima and the home line fade in. */
    intro: ramp(local, 0.0, 0.1),
    /** Ladder rungs show while the journey runs and through the reunion. */
    ladder: windowed(local, 0.14, 0.7, 0.04, 0.06),
    /** The reunion comparison. */
    reunion: windowed(local, 0.49, 0.99, 0.03, 0.04),
    /** The Spool: the traveler's bent path unwinds into a straight thread next to home's. */
    spool: ramp(local, 0.6, 0.74),
    /** Measured examples (HUD card). */
    measured: windowed(local, 0.8, 1.01, 0.04, 0.001),
    /** Camera eases back a little at the end. */
    settle: ramp(local, 0.78, 1),
  };
}

const yr = (v: number) => `${v.toFixed(1)} yr`;

export const clocks = registerStage('clocks', {
  note: 'Times and distances are to scale (years and light-years) and every age is computed; the turnaround is instant, which real rockets cannot do, but it does not change the result.',
  readouts(local) {
    const s = clocksState(local);
    const rows: Readout[] = [];
    if (local < 0.06) return rows;
    const t = s.tYears;
    rows.push({ label: 'Home twin', value: yr(t), tone: 'a' });
    rows.push({ label: 'Traveler · 0.8 c', value: yr(travelerAge(t)), tone: 'b' });
    if (t > 0.05) rows.push({ label: 'Gap', value: yr(t - travelerAge(t)), tone: 'both' });
    return rows;
  },
});
