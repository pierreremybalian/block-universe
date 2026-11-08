// Stage 8 · Two walkers, one galaxy (Rietdijk–Putnam–Penrose). Pure script shared by the scene, the dual clock and
// the Atlas of Elsewhere card.
//
// Display scale: Earth and Andromeda sit DISPLAY_D units apart, so one unit is ANDROMEDA_LY / DISPLAY_D light-years
// across and the same number of years up (c = 1). At walking pace the walkers' now-slices would look perfectly flat
// here, so in the first half their tilt is exaggerated (stated on screen with the factor); the loupe then shows the
// true gap at Andromeda in days. In the second half the speeds are real fractions of c and the tilt is true.

import { ramp, track, windowed } from '../time/tracks.ts';
import { registerStage, type Readout } from './index.ts';
import { nowWidthS, simultaneityShiftS } from '../relativity/simultaneity.ts';
import { ANDROMEDA_LY, C_M_S, DAY_S, LY_M, WALK_M_S, YEAR_S } from '../relativity/units.ts';

/** Earth–Andromeda separation in display units; Earth at −DISPLAY_D/2, Andromeda at +DISPLAY_D/2. */
export const DISPLAY_D = 3;
export const EARTH_X = -DISPLAY_D / 2;
export const ANDROMEDA_X = DISPLAY_D / 2;
export const ANDROMEDA_BOUNDS = { x0: -2.3, x1: 2.3, t0: -3.4, t1: 3.4, y0: -0.9, y1: 0.9 };
/** Years (and light-years) per display unit. */
export const YEARS_PER_UNIT = ANDROMEDA_LY / DISPLAY_D;

/** The walkers' true speed as a fraction of c, and the display tilt used while they walk. */
export const WALK_BETA = WALK_M_S / C_M_S;
export const WALK_DISPLAY_BETA = 0.12;
/** How much the walking tilt is exaggerated on screen. */
export const WALK_EXAGGERATION = WALK_DISPLAY_BETA / WALK_BETA;

/** Gap at Andromeda for one walker, days (≈ 4.26). */
export const WALK_SHIFT_DAYS = simultaneityShiftS(WALK_M_S, ANDROMEDA_LY * LY_M) / DAY_S;
/** Penrose's fleet launch, days after Earth's here-now in Andromeda's frame: between the two walkers' nows. */
export const LAUNCH_DAYS = 1.0;
/** The widest possible now at Andromeda, years (= the light-travel time, 2.5 million). */
export const NOW_WIDTH_YEARS = nowWidthS(ANDROMEDA_LY * LY_M) / YEAR_S;

/** The loupe's own units: one unit is one day (and one light-day). Its view spans ±LOUPE_DAYS. */
export const LOUPE_DAYS = 9;
/** Time magnification of the loupe relative to the main view (main unit in days ÷ loupe unit in days). */
export const LOUPE_FACTOR = (YEARS_PER_UNIT * YEAR_S) / DAY_S;

/** Knife tilt (display β) through the stage: flat, fanning to the exaggerated walk, then up to 0.99c. */
export const fanBeta = track([
  [0.17, 0],
  [0.3, WALK_DISPLAY_BETA],
  [0.64, WALK_DISPLAY_BETA],
  [0.84, 0.99],
]);

export function andromedaState(local: number) {
  const beta = fanBeta(local);
  /** 0 while walking (tilt exaggerated), 1 once speeds are real. */
  const real = ramp(local, 0.62, 0.66);
  return {
    beta,
    real,
    hereNow: ramp(local, 0.08, 0.14),
    knives: ramp(local, 0.12, 0.18),
    walkers: ramp(local, 0.17, 0.24),
    /** "Tilt exaggerated" tag while walking. */
    exaggerated: windowed(local, 0.24, 0.64, 0.03),
    launch: ramp(local, 0.38, 0.44),
    loupe: windowed(local, 0.36, 0.64, 0.04),
    /** The ribbon of possible nows grows with the sweep: half-height in display units (the knives meet Andromeda at ±βD). */
    ribbon: beta * DISPLAY_D * real,
    cone: ramp(local, 0.7, 0.8),
    atlas: ramp(local, 0.82, 0.86),
    pull: ramp(local, 0.88, 1),
  };
}

// ── Atlas of Elsewhere ──────────────────────────────────────────────────────────────────────────────────────

export interface Place {
  id: string;
  name: string;
  distance_ly: number;
  note: string;
  source: { label: string; url: string };
}

const group = (n: number) => Math.round(n).toLocaleString('en-US');
const sig = (x: number, s = 2) => {
  if (x === 0) return '0';
  const p = 10 ** (s - Math.ceil(Math.log10(Math.abs(x))));
  const r = Math.round(x * p) / p;
  return r >= 1000 ? group(r) : String(r);
};

/** Compact duration: 6 ns, 2.3 µs, 630 ms, 8.3 min, 1.1 h, 4.3 days, 4.2 yr, 26,700 yr, 2.5 Myr. */
export function fmtDuration(seconds: number): string {
  const s = Math.abs(seconds);
  if (s < 1e-6) return `${sig(s * 1e9)} ns`;
  if (s < 1e-3) return `${sig(s * 1e6)} µs`;
  if (s < 1) return `${sig(s * 1e3)} ms`;
  if (s < 60) return `${sig(s)} s`;
  if (s < 3600) return `${sig(s / 60)} min`;
  if (s < DAY_S) return `${sig(s / 3600)} h`;
  if (s < YEAR_S) return `${sig(s / DAY_S)} days`;
  const yr = s / YEAR_S;
  if (yr < 1e6) return `${sig(yr, yr < 10 ? 2 : 3)} yr`;
  return `${sig(yr / 1e6)} Myr`;
}

export interface AtlasRow {
  id: string;
  name: string;
  /** ± light-travel time: every moment in this window is "now" for someone passing through here-now. */
  nowWidth: string;
  /** How far a brisk walk shifts your now there. */
  walkShift: string;
  nowWidthS: number;
  walkShiftS: number;
}

export function atlasRows(places: readonly Place[]): AtlasRow[] {
  return places.map((p) => {
    const d = p.distance_ly * LY_M;
    const w = nowWidthS(d);
    const k = simultaneityShiftS(WALK_M_S, d);
    return { id: p.id, name: p.name, nowWidth: `±${fmtDuration(w)}`, walkShift: fmtDuration(k), nowWidthS: w, walkShiftS: k };
  });
}

export const andromeda = registerStage('andromeda', {
  note: `While the two walk, the tilt of their nows is exaggerated about ${Math.round(WALK_EXAGGERATION / 1e6)} million times so you can see it; the loupe and the numbers in the corner are exact.`,
  readouts(local) {
    const s = andromedaState(local);
    const rows: Readout[] = [];
    if (s.real < 0.5) {
      if (s.walkers > 0.5) {
        rows.push({ label: 'Walker →', value: `${WALK_M_S} m/s`, tone: 'a' });
        rows.push({ label: 'Walker ←', value: `${WALK_M_S} m/s`, tone: 'b' });
      }
      if (s.loupe > 0.3) rows.push({ label: 'Their nows at Andromeda', value: `${(2 * WALK_SHIFT_DAYS).toFixed(1)} days apart`, tone: 'both' });
    } else {
      rows.push({ label: 'Speed', value: `${s.beta.toFixed(2)} c`, tone: 'both' });
      rows.push({ label: 'Possible nows at Andromeda', value: `±${((s.beta * NOW_WIDTH_YEARS) / 1e6).toFixed(2)} million yr`, tone: 'light' });
    }
    return rows;
  },
});
