// Stage 13 · The block of everything. Our past light cone in flat ΛCDM (Planck 2018): from today back to the Big
// Bang it is a teardrop in proper distance. Galaxy worldlines spread apart with expansion; each one is seen where it
// crosses the cone. Pure script shared by the scene and the HUD.

import { ramp, track } from '../time/tracks.ts';
import { lightConeMax, pastLightCone, type LightConeSample } from '../relativity/lightcone.ts';
import { AGE_SECONDS, aAt, tAt } from '../physics/cosmology.ts';
import { GYR_S, Z_LAST_SCATTERING } from '../physics/constants.ts';
import { registerStage, type Readout } from './index.ts';

export const AGE_GYR = AGE_SECONDS / GYR_S;
/** Display: cosmic time 0 → today maps to t = −2 → +2; proper distance in the same scale (light at 45° here). */
export const UNIT_GYR = AGE_GYR / 4;
export const tDisp = (tGyr: number) => -2 + tGyr / UNIT_GYR;
export const xDisp = (gly: number) => gly / UNIT_GYR;

export const CONE: LightConeSample[] = pastLightCone(720, 1e-4);
export const CONE_MAX = lightConeMax(CONE);

/** Light-cone sample at scale factor a (log-interpolated). */
export function coneAtA(a: number): { properGly: number; comovingGly: number; tGyr: number } {
  const la = Math.log(a);
  for (let i = 1; i < CONE.length; i++) {
    const p = CONE[i - 1]!;
    const q = CONE[i]!;
    const lp = Math.log(p.a);
    const lq = Math.log(q.a);
    if (la <= lq) {
      const s = (la - lp) / (lq - lp);
      const comovingGly = p.comovingGly + (q.comovingGly - p.comovingGly) * s;
      return { comovingGly, properGly: a * comovingGly, tGyr: tAt(a) / GYR_S };
    }
  }
  return { comovingGly: 0, properGly: 0, tGyr: AGE_GYR };
}

/** Where the cosmic microwave background we see today was emitted from. */
export const CMB = (() => {
  const a = 1 / (1 + Z_LAST_SCATTERING);
  const c = coneAtA(a);
  return { a, ...c, nowGly: c.comovingGly };
})();

/** Where a galaxy at comoving distance χ (Gly) crosses our past light cone: what we see of it today. */
export function sightingOf(chiGly: number): { a: number; tGyr: number; properGly: number } | null {
  if (chiGly >= CONE[0]!.comovingGly) return null;
  // comovingGly decreases with a; find where it equals χ.
  for (let i = 1; i < CONE.length; i++) {
    const p = CONE[i - 1]!;
    const q = CONE[i]!;
    if (p.comovingGly >= chiGly && q.comovingGly <= chiGly) {
      const s = (p.comovingGly - chiGly) / (p.comovingGly - q.comovingGly);
      const a = Math.exp(Math.log(p.a) + (Math.log(q.a) - Math.log(p.a)) * s);
      return { a, tGyr: tAt(a) / GYR_S, properGly: a * chiGly };
    }
  }
  return { a: 1, tGyr: AGE_GYR, properGly: chiGly };
}

/** Scale factor at cosmic time t (Gyr). */
export const aAtGyr = (tGyr: number) => aAt(Math.max(1e-3, tGyr) * GYR_S);

export function wholeState(local: number) {
  return {
    /** Our worldline (the Milky Way) is there from the start. */
    us: ramp(local, 0.02, 0.1),
    /** The cone is drawn from today back toward the Big Bang: fraction of the age covered. */
    reveal: track([
      [0.1, 0],
      [0.36, 1],
    ])(local),
    galaxies: ramp(local, 0.38, 0.5),
    sightings: ramp(local, 0.47, 0.57),
    cmb: ramp(local, 0.58, 0.66),
    pull: ramp(local, 0.7, 1),
  };
}

const gly = (v: number) =>
  v >= 1 ? `${v.toFixed(v >= 10 ? 0 : 2)} billion ly` : `${Math.round(v * 1000)} million ly`;

export const whole = registerStage('whole', {
  note: 'The cone’s shape is computed from Planck 2018 cosmology (distances as they were when the light left). Galaxies are illustrative, and space is shown in two dimensions.',
  readouts(local): Readout[] {
    const s = wholeState(local);
    if (s.reveal <= 0) return [];
    if (s.cmb > 0.4)
      return [
        { label: 'CMB light set off from', value: gly(CMB.properGly), tone: 'light' },
        { label: 'That matter is now', value: gly(CMB.nowGly), tone: 'warm' },
      ];
    if (s.reveal < 1) {
      const tGyr = AGE_GYR * (1 - s.reveal);
      const c = coneAtA(aAtGyr(tGyr));
      return [
        {
          label: 'Light we see from',
          value: `${(AGE_GYR - tGyr).toFixed(1)} billion years ago`,
          tone: 'plain',
        },
        { label: 'It set off from', value: gly(c.properGly), tone: 'light' },
      ];
    }
    return [
      { label: 'Widest point of our cone', value: gly(CONE_MAX.properGly), tone: 'light' },
      {
        label: 'Light from then',
        value: `${(AGE_GYR - CONE_MAX.tGyr).toFixed(1)} billion years old`,
        tone: 'plain',
      },
    ];
  },
});
