// Our past light cone in flat ΛCDM (Planck 2018, src/physics/cosmology.ts): for light reaching us today, where its
// source was (proper distance) when the light left. The shape is a teardrop: distance grows, peaks near z ≈ 1.6,
// then shrinks back to zero at the Big Bang because the universe was smaller (Davis & Lineweaver 2004).

import { C_M_S, GYR_S, H0_PER_S } from '../physics/constants.ts';
import { E, tAt } from '../physics/cosmology.ts';

const LY_M = C_M_S * 3.15576e7;
/** Hubble distance c/H₀ in Gly. */
export const HUBBLE_DISTANCE_GLY = C_M_S / H0_PER_S / LY_M / 1e9;

export interface LightConeSample {
  a: number;
  z: number;
  /** Cosmic time at emission, Gyr. */
  tGyr: number;
  /** Comoving distance today, Gly. */
  comovingGly: number;
  /** Proper distance at emission, Gly. */
  properGly: number;
}

/** Past light cone sampled uniformly in ln a from a = aMin to 1 (n samples, last is today). */
export function pastLightCone(n = 512, aMin = 1e-4): LightConeSample[] {
  const lnMin = Math.log(aMin);
  const fine = 8 * n;
  const h = -lnMin / fine;
  // Integrand in ln a: dχ = (c/H0) da / (a² E) = (c/H0) dln a / (a E).
  const f = (lna: number) => {
    const a = Math.exp(lna);
    return 1 / (a * E(a));
  };
  // Cumulative trapezoid from a = 1 downward on the fine grid, then sample.
  const chi = new Float64Array(fine + 1); // chi[k] at lna = -k h
  for (let k = 1; k <= fine; k++) chi[k] = chi[k - 1]! + 0.5 * h * (f(-(k - 1) * h) + f(-k * h));
  const out: LightConeSample[] = [];
  for (let i = 0; i < n; i++) {
    const lna = lnMin + (-lnMin * i) / (n - 1);
    const kf = -lna / h;
    const k0 = Math.min(fine - 1, Math.floor(kf));
    const s = kf - k0;
    const c = (chi[k0]! * (1 - s) + chi[k0 + 1]! * s) * HUBBLE_DISTANCE_GLY;
    const a = Math.exp(lna);
    out.push({ a, z: 1 / a - 1, tGyr: tAt(a) / GYR_S, comovingGly: c, properGly: a * c });
  }
  return out;
}

/** The widest point of the teardrop. */
export function lightConeMax(samples = pastLightCone()): LightConeSample {
  return samples.reduce((m, s) => (s.properGly > m.properGly ? s : m));
}
