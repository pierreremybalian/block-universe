// Gravitational and kinematic clock rates (weak field, first order in Φ/c² and v²/c²), and the light cones of a
// Schwarzschild black hole in ingoing Eddington–Finkelstein coordinates. SI unless noted.

import {
  C2,
  DAY_S,
  EVEREST_M,
  GEO_ORBIT_RADIUS_M,
  GM_EARTH,
  GPS_ORBIT_RADIUS_M,
  G_STANDARD,
  ISS_ALTITUDE_M,
  OMEGA_EARTH,
  R_EARTH_M,
  YEAR_S,
} from './units.ts';

/** Speed of a circular orbit of radius r around Earth, m/s. */
export function circularSpeed(rM: number, gm = GM_EARTH): number {
  return Math.sqrt(gm / rM);
}

/**
 * Fractional rate of a clock at radius r moving at inertial speed v, relative to a clock at radius r₀ moving at v₀
 * (Earth-centred inertial frame): Δf/f = GM/c² (1/r₀ − 1/r) − (v² − v₀²) / 2c².
 */
export function relativeRate(rM: number, vMs: number, r0M = R_EARTH_M, v0Ms = OMEGA_EARTH * R_EARTH_M, gm = GM_EARTH): number {
  return (gm / C2) * (1 / r0M - 1 / rM) - (vMs * vMs - v0Ms * v0Ms) / (2 * C2);
}

export interface RateBudget {
  /** Gravitational part (positive: higher clocks run fast). */
  gr: number;
  /** Speed part (negative: moving clocks run slow). */
  sr: number;
  net: number;
}

/** Split of a clock's rate vs a sea-level clock on the rotating equator, fractional. */
export function rateBudget(rM: number, vMs: number): RateBudget {
  const v0 = OMEGA_EARTH * R_EARTH_M;
  const gr = (GM_EARTH / C2) * (1 / R_EARTH_M - 1 / rM);
  const sr = -(vMs * vMs - v0 * v0) / (2 * C2);
  return { gr, sr, net: gr + sr };
}

/** GPS satellite clock vs a ground clock, microseconds per day. */
export function gpsBudgetUsPerDay(): RateBudget {
  const b = rateBudget(GPS_ORBIT_RADIUS_M, circularSpeed(GPS_ORBIT_RADIUS_M));
  const k = DAY_S * 1e6;
  return { gr: b.gr * k, sr: b.sr * k, net: b.net * k };
}

export interface CombTooth {
  id: 'ground' | 'everest' | 'iss' | 'gps' | 'geo';
  label: string;
  /** Distance from Earth's centre, m. */
  rM: number;
  altitudeKm: number;
  /** Fractional rate vs sea level. */
  rate: number;
  /** Microseconds gained (+) or lost (−) per day vs sea level. */
  usPerDay: number;
}

/** The Altitude Comb: sea level, Everest, ISS, GPS, geostationary. Surface points co-rotate with Earth. */
export function altitudeComb(): CombTooth[] {
  const rows: [CombTooth['id'], string, number, number][] = [
    ['ground', 'Sea level', R_EARTH_M, OMEGA_EARTH * R_EARTH_M],
    ['everest', 'Everest summit', R_EARTH_M + EVEREST_M, OMEGA_EARTH * (R_EARTH_M + EVEREST_M)],
    ['iss', 'Space station', R_EARTH_M + ISS_ALTITUDE_M, circularSpeed(R_EARTH_M + ISS_ALTITUDE_M)],
    ['gps', 'GPS satellite', GPS_ORBIT_RADIUS_M, circularSpeed(GPS_ORBIT_RADIUS_M)],
    ['geo', 'Geostationary', GEO_ORBIT_RADIUS_M, OMEGA_EARTH * GEO_ORBIT_RADIUS_M],
  ];
  return rows.map(([id, label, rM, v]) => {
    const rate = relativeRate(rM, v);
    return { id, label, rM, altitudeKm: (rM - R_EARTH_M) / 1e3, rate, usPerDay: rate * DAY_S * 1e6 };
  });
}

/** Fractional rate gained by raising a clock h metres near the surface: g h / c². */
export function heightRate(hM: number, g = G_STANDARD): number {
  return (g * hM) / C2;
}

/** Seconds by which your head out-ages your feet over a life. */
export function headFeetDriftS(heightM: number, years: number): number {
  return heightRate(heightM) * years * YEAR_S;
}

/**
 * Light-cone edges at radius r (units of the Schwarzschild radius) in ingoing Eddington–Finkelstein coordinates with
 * t̃ = v − r, so ingoing light moves at dr/dt̃ = −1 everywhere. The outgoing edge moves at (r − 1)/(r + 1): +1 far
 * away, 0 at the horizon (light trying to leave stands still), negative inside (every future points inward).
 */
export function efConeEdges(rOverRs: number): { inward: number; outward: number } {
  return { inward: -1, outward: (rOverRs - 1) / (rOverRs + 1) };
}
