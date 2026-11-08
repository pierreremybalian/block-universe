import { describe, expect, it } from 'vitest';
import { addVelocities, boost, boostXTY, gamma, intervalSq, separation } from '../lorentz.ts';
import { nowWidthS, simultaneityShiftS, sliceT } from '../simultaneity.ts';
import { dilatedLifetime, properTimeOfPath, twinTrip } from '../properTime.ts';
import { bowlPoint, bowlSlope, bowlT, dtInFrame, flipSpeed, orderInFrame } from '../invariants.ts';
import { altitudeComb, efConeEdges, gpsBudgetUsPerDay, headFeetDriftS, heightRate } from '../gravity.ts';
import { lightConeMax, pastLightCone } from '../lightcone.ts';
import {
  ANDROMEDA_LY,
  CERN_MUON_GAMMA,
  CERN_MUON_LIFETIME_ERR_S,
  CERN_MUON_LIFETIME_MEASURED_S,
  DAY_S,
  HEAD_FEET_M,
  LIFE_YEARS,
  LY_M,
  MUON_LIFETIME_S,
  PROXIMA_LY,
  WALK_M_S,
  YEAR_S,
} from '../units.ts';
import { mulberry32 } from '../../shared/math.ts';

describe('Lorentz', () => {
  it('γ(0.8) = 5/3', () => expect(gamma(0.8)).toBeCloseTo(5 / 3, 12));
  it('velocity addition stays below c', () => {
    expect(addVelocities(0.8, 0.8)).toBeCloseTo(0.975609756, 8);
    expect(addVelocities(0.999, 0.999)).toBeLessThan(1);
  });
  it('the interval is invariant under random boosts', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const a = { t: r() * 10 - 5, x: r() * 10 - 5 };
      const b = { t: r() * 10 - 5, x: r() * 10 - 5 };
      const beta = r() * 1.98 - 0.99;
      const s0 = intervalSq(a, b);
      const s1 = intervalSq(boost(a, beta), boost(b, beta));
      expect(Math.abs(s1 - s0)).toBeLessThan(1e-9 * Math.max(1, Math.abs(s0)));
    }
  });
  it('boostXTY matches boost and leaves light-cone generators on the cone', () => {
    const o = [0, 0, 0];
    boostXTY(1, 1, 0, 0.6, o);
    expect(o[0]).toBeCloseTo(o[1]!, 12); // x = t stays x = t
    const e = boost({ t: 2, x: 1 }, 0.3);
    boostXTY(1, 2, 0, 0.3, o);
    expect(o[0]).toBeCloseTo(e.x, 12);
    expect(o[1]).toBeCloseTo(e.t, 12);
  });
  it('classifies separations', () => {
    expect(separation({ t: 0, x: 0 }, { t: 2, x: 1 })).toBe('timelike');
    expect(separation({ t: 0, x: 0 }, { t: 1, x: 2 })).toBe('spacelike');
    expect(separation({ t: 0, x: 0 }, { t: 3, x: 3 })).toBe('lightlike');
  });
});

describe('Clocks', () => {
  it('twins to Proxima at 0.8c', () => {
    const trip = twinTrip(PROXIMA_LY, 0.8);
    expect(trip.homeYears).toBeCloseTo(10.62, 2);
    expect(trip.travelerYears).toBeCloseTo(6.37, 2);
    const path = [
      [0, 0],
      [trip.homeYears / 2, PROXIMA_LY],
      [trip.homeYears, 0],
    ];
    expect(properTimeOfPath(path)).toBeCloseTo(trip.travelerYears, 10);
  });
  it('CERN muon storage ring (Bailey et al. 1977)', () => {
    const tau = dilatedLifetime(MUON_LIFETIME_S, CERN_MUON_GAMMA);
    expect(tau * 1e6).toBeCloseTo(64.43, 2);
    expect(Math.abs(tau - CERN_MUON_LIFETIME_MEASURED_S)).toBeLessThan(2 * CERN_MUON_LIFETIME_ERR_S);
  });
  it('GPS budget', () => {
    const b = gpsBudgetUsPerDay();
    expect(b.sr).toBeCloseTo(-7.1, 1);
    expect(b.gr).toBeCloseTo(45.7, 1);
    expect(Math.abs(b.net - 38.5)).toBeLessThan(0.2);
  });
  it('altitude comb is ordered and sea level is zero', () => {
    const c = altitudeComb();
    expect(c[0]!.usPerDay).toBe(0);
    const by = Object.fromEntries(c.map((r) => [r.id, r.usPerDay]));
    expect(by.everest).toBeGreaterThan(0.07);
    expect(by.everest).toBeLessThan(0.1);
    expect(by.iss).toBeLessThan(-20); // speed wins in low orbit
    expect(by.gps).toBeCloseTo(gpsBudgetUsPerDay().net, 6);
    expect(by.geo).toBeGreaterThan(by.gps!);
  });
  it('Chou et al. 2010: 33 cm of height', () => expect(heightRate(0.33)).toBeCloseTo(3.6e-17, 18));
  it('head vs feet over a life', () => {
    const s = headFeetDriftS(HEAD_FEET_M, LIFE_YEARS);
    expect(s * 1e6).toBeGreaterThan(0.45);
    expect(s * 1e6).toBeLessThan(0.49);
  });
});

describe('Simultaneity', () => {
  it('Andromeda walker shifts the distant now by about 4.3 days', () => {
    const d = simultaneityShiftS(WALK_M_S, ANDROMEDA_LY * LY_M) / DAY_S;
    expect(d).toBeGreaterThan(4.2);
    expect(d).toBeLessThan(4.4);
  });
  it('now-width at Andromeda is 2.5 million years', () => {
    expect(nowWidthS(ANDROMEDA_LY * LY_M) / YEAR_S).toBeCloseTo(2.5e6, -3);
  });
  it('a traveler’s now-slice is tangent to the bowl at their bead', () => {
    for (const beta of [-0.9, -0.4, 0.1, 0.5, 0.85]) {
      for (const tau of [0.5, 1, 3]) {
        const p = bowlPoint(tau, beta);
        expect(bowlT(tau, p.x)).toBeCloseTo(p.t, 10); // on the bowl
        expect(bowlSlope(tau, p.x)).toBeCloseTo(beta, 10); // tangent slope = now-slice slope
        // A point on the slice a little to the side lies below the bowl (tangent from below), never above.
        for (const dx of [-0.3, 0.3]) expect(sliceT(beta, p.t, p.x, p.x + dx)).toBeLessThan(bowlT(tau, p.x + dx));
      }
    }
  });
  it('causal order never flips; spacelike order does', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 300; i++) {
      const a = { t: 0, x: 0 };
      const dx = r() * 4 - 2;
      const tl = { t: Math.abs(dx) + 0.01 + r() * 2, x: dx };
      for (const beta of [-0.999, -0.5, 0, 0.5, 0.999]) expect(orderInFrame(a, tl, beta)).toBe(1);
      const sl = { t: (r() * 2 - 1) * Math.abs(dx) * 0.95, x: dx };
      const f = flipSpeed(a, sl);
      if (f === null || Math.abs(sl.t) < 1e-3) continue;
      expect(Math.abs(dtInFrame(a, sl, f))).toBeLessThan(1e-9);
      expect(orderInFrame(a, sl, f + Math.sign(dx) * 0.04 * (1 - Math.abs(f)))).toBe(-orderInFrame(a, sl, f - Math.sign(dx) * 0.04 * (1 - Math.abs(f))));
    }
  });
});

describe('Curved spacetime', () => {
  it('Eddington–Finkelstein cone edges', () => {
    expect(efConeEdges(1).outward).toBe(0);
    expect(efConeEdges(0.5).outward).toBeLessThan(0);
    expect(efConeEdges(1e6).outward).toBeCloseTo(1, 5);
    expect(efConeEdges(3).inward).toBe(-1);
  });
  it('our past light cone is a teardrop peaking near z ≈ 1.6 at ≈ 5.8 Gly', () => {
    const s = pastLightCone();
    const m = lightConeMax(s);
    expect(m.properGly).toBeGreaterThan(5.7);
    expect(m.properGly).toBeLessThan(5.9);
    expect(m.z).toBeGreaterThan(1.4);
    expect(m.z).toBeLessThan(1.8);
    expect(s.at(-1)!.properGly).toBeCloseTo(0, 6);
    expect(s[0]!.properGly).toBeLessThan(0.1);
    // Comoving horizon ≈ 46 Gly
    expect(s[0]!.comovingGly).toBeGreaterThan(44);
  });
});
