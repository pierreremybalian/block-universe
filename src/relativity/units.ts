// Units and measured constants. Every number the site shows traces back to this file or src/physics/constants.ts.
// SI throughout (seconds, metres). Natural-unit helpers (c = 1) live in lorentz.ts.

import { C_M_S, YEAR_S } from '../physics/constants.ts';

export { C_M_S, YEAR_S };
export const C2 = C_M_S * C_M_S;
export const DAY_S = 86_400;
/** Light-year (Julian year), m. */
export const LY_M = C_M_S * YEAR_S;
export const KPC_M = 3.085677581491367e19;

/** Newtonian constant of gravitation (CODATA 2018). */
export const G_SI = 6.6743e-11;
/** Earth: geocentric gravitational constant (IERS/WGS 84), equatorial radius (WGS 84), standard gravity, rotation. */
export const GM_EARTH = 3.986004418e14;
export const R_EARTH_M = 6.378137e6;
export const G_STANDARD = 9.80665;
export const OMEGA_EARTH = 7.2921150e-5;
/** Sun: heliocentric gravitational constant (IAU 2015). */
export const GM_SUN = 1.32712440018e20;

/** Muon mean lifetime at rest (PDG), s. */
export const MUON_LIFETIME_S = 2.1969811e-6;
/** CERN muon storage ring (Bailey et al. 1977): Lorentz factor and measured lifetime of μ⁺, s. */
export const CERN_MUON_GAMMA = 29.327;
export const CERN_MUON_LIFETIME_MEASURED_S = 64.419e-6;
export const CERN_MUON_LIFETIME_ERR_S = 0.058e-6;

/** GPS orbit semi-major axis, m (IS-GPS-200 nominal 26,559.7 km; 26,561.75 km is the commonly used mean). */
export const GPS_ORBIT_RADIUS_M = 2.656175e7;
/** ISS: mean orbital altitude ≈ 420 km. */
export const ISS_ALTITUDE_M = 4.2e5;
/** Geostationary orbit radius, m. */
export const GEO_ORBIT_RADIUS_M = 4.2164e7;
/** Mount Everest summit, m (2020 survey). */
export const EVEREST_M = 8848.86;

/** Distances (light-years). Sources in public/data/places.json. */
export const PROXIMA_LY = 4.2465;
/** Andromeda (M31): 761 ± 11 kpc (Li et al. 2021) ≈ 2.48 Mly; we use the rounded 2.5 Mly everywhere. */
export const ANDROMEDA_LY = 2.5e6;
/** A brisk walk, m/s. */
export const WALK_M_S = 1.4;
/** Average human height used for head-vs-feet, m. */
export const HEAD_FEET_M = 1.7;
/** A long life, years. */
export const LIFE_YEARS = 80;
