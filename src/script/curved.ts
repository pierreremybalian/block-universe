// Stage 11 · The block bends. Clocks around Earth (the Altitude Comb), then light cones tipping toward a black hole
// in ingoing Eddington–Finkelstein coordinates. Pure script shared by the scene and the HUD.

import { ramp, track, windowed } from '../time/tracks.ts';
import { altitudeComb, efConeEdges } from '../relativity/gravity.ts';
import { DAY_S } from '../relativity/units.ts';
import { registerStage, type Readout } from './index.ts';

/** Earth part. Display: t spans one day over 4 units (one unit = 6 hours). */
export const DAY_UNITS = 4;
export const HOUR_UNITS = DAY_UNITS / 24;
/** Clock rates on screen are exaggerated by this factor (shown on screen). */
export const RATE_EXAGGERATION = 2e8;
/** Display radius of Earth and the compression of orbit radii (log scale). */
export const EARTH_R = 0.46;
export const ORBIT_K = 0.92;
export const displayRadius = (rOverREarth: number) => EARTH_R + ORBIT_K * Math.log(rOverREarth);

export const COMB = altitudeComb();

/** Orbital period in display units of a clock (surface clocks and geostationary co-rotate: one sidereal day). */
export function periodUnits(id: string, rM: number): number {
  if (id === 'ground' || id === 'everest' || id === 'geo') return (86_164.1 / DAY_S) * DAY_UNITS;
  const T = 2 * Math.PI * Math.sqrt((rM * rM * rM) / 3.986004418e14);
  return (T / DAY_S) * DAY_UNITS;
}

/** Black hole part. Display: the Schwarzschild radius is RS display units; time t̃ in the same scale (c = 1). */
export const RS = 0.85;
/** Radii (in units of r_s) of the falling observer's light cones, from outside to inside the horizon. */
export const CONE_RADII = [2.6, 1.85, 1.35, 1.0, 0.68, 0.38] as const;
/** A reference cone far from the hole. */
export const FAR_CONE_R = 4.0;

/** The infalling observer (falls from rest at infinity: a "raindrop"), in units of r_s and r_s/c. */
export const FALL_R0 = 2.8;
export const FALL_T0 = -2.3;

/** dt̃/dr for a raindrop at radius r (units r_s), ingoing EF coordinates. */
function dtdr(r: number): number {
  const s = 1 / r;
  const rs = Math.sqrt(s);
  return -(1 / (1 + rs) + rs) / rs;
}

/** The raindrop's path: samples of (r, t̃, τ) from FALL_R0 to the singularity, units of r_s and r_s/c. */
export function fallPath(n = 220): { r: number; t: number; tau: number }[] {
  const out: { r: number; t: number; tau: number }[] = [];
  let t = FALL_T0;
  let tau = 0;
  out.push({ r: FALL_R0, t, tau });
  for (let i = 1; i < n; i++) {
    const r0 = FALL_R0 * (1 - (i - 1) / (n - 1));
    const r1 = FALL_R0 * (1 - i / (n - 1));
    const rm = Math.max(1e-4, (r0 + r1) / 2);
    const dr = r1 - r0;
    t += dtdr(rm) * dr;
    tau += -dr * Math.sqrt(rm); // dτ = −dr / √(r_s/r)
    out.push({ r: r1, t, tau });
  }
  return out;
}

export const FALL = fallPath();

/** r (units of r_s) of the raindrop at coordinate time t̃ (r_s/c units). */
export function fallRAt(t: number): number {
  if (t <= FALL[0]!.t) return FALL[0]!.r;
  for (let i = 1; i < FALL.length; i++) {
    const a = FALL[i - 1]!;
    const b = FALL[i]!;
    if (t <= b.t) return a.r + ((b.r - a.r) * (t - a.t)) / (b.t - a.t);
  }
  return 0;
}

export function curvedState(local: number) {
  return {
    /** Earth part. */
    earth: 1 - ramp(local, 0.5, 0.58),
    clocks: ramp(local, 0.08, 0.2),
    comb: windowed(local, 0.16, 0.52, 0.04),
    rungs: ramp(local, 0.26, 0.36),
    /** Black hole part. */
    hole: ramp(local, 0.54, 0.62),
    rays: ramp(local, 0.6, 0.7),
    /** Coordinate time reached by the falling observer, r_s/c units (its light cones appear as it passes). */
    fallT: track([
      [0.71, FALL[0]!.t],
      [0.95, FALL.at(-1)!.t + 0.15],
    ])(local),
    fall: ramp(local, 0.68, 0.72),
    pull: ramp(local, 0.92, 1),
  };
}

const fmt = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v) < 1 ? Math.abs(v).toFixed(2) : Math.abs(v).toFixed(1)} µs/day`;

export const curved = registerStage('curved', {
  note: 'Clock rates on screen are exaggerated 200 million times and orbit radii are compressed; the corner shows the real rates. Near the black hole, every cone’s tilt is exact (in Eddington–Finkelstein coordinates).',
  readouts: (local) => readoutsFor(local),
});

export function readoutsFor(local: number): Readout[] {
  const s = curvedState(local);
  if (s.earth > 0.5) {
    if (s.clocks < 0.3) return [];
    const by = Object.fromEntries(COMB.map((c) => [c.id, c.usPerDay]));
    return [
      { label: 'GPS vs sea level', value: fmt(by.gps!), tone: 'b' },
      { label: 'Space station', value: fmt(by.iss!), tone: 'a' },
    ];
  }
  if (s.fall < 0.5) return [{ label: 'Horizon', value: 'r = rₛ', tone: 'light' }];
  const r = fallRAt(s.fallT);
  const out = efConeEdges(Math.max(r, 1e-3)).outward;
  const fate =
    r > 1.0005
      ? 'can still escape'
      : r > 0.9995
        ? 'frozen at the horizon'
        : r > 0.02
          ? 'falls inward'
          : 'singularity';
  return [
    { label: 'Falling observer', value: r > 0.02 ? `r = ${r.toFixed(2)} rₛ` : 'r = 0', tone: 'a' },
    { label: 'Light aimed outward', value: fate, tone: out > 0 ? 'light' : 'warm' },
  ];
}
