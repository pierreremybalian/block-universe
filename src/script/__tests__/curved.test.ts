import { describe, expect, it } from 'vitest';
import { COMB, FALL, FALL_R0, FALL_T0, curvedState, fallRAt, readoutsFor } from '../curved.ts';
import { efConeEdges } from '../../relativity/gravity.ts';

describe('curved script', () => {
  it('the raindrop falls monotonically to the singularity in finite time', () => {
    expect(FALL[0]!.r).toBe(FALL_R0);
    expect(FALL.at(-1)!.r).toBe(0);
    for (let i = 1; i < FALL.length; i++) {
      expect(FALL[i]!.r).toBeLessThan(FALL[i - 1]!.r);
      expect(FALL[i]!.t).toBeGreaterThan(FALL[i - 1]!.t);
    }
    // Proper time from r₀ to 0 for a raindrop: (2/3) r₀^{3/2} (units of r_s/c).
    expect(FALL.at(-1)!.tau).toBeCloseTo((2 / 3) * FALL_R0 ** 1.5, 2);
    expect(fallRAt(FALL_T0 - 1)).toBe(FALL_R0);
    expect(fallRAt(FALL.at(-1)!.t + 1)).toBe(0);
  });
  it('the skewed cone ellipse matches the Eddington–Finkelstein edges', () => {
    // Future light per unit t̃: centre −S/(1+S), radial semi-axis 1/(1+S).
    for (const r of [5, 2, 1, 0.6, 0.3]) {
      const S = 1 / r;
      const outward = -S / (1 + S) + 1 / (1 + S);
      const inward = -S / (1 + S) - 1 / (1 + S);
      expect(outward).toBeCloseTo(efConeEdges(r).outward, 12);
      expect(inward).toBeCloseTo(efConeEdges(r).inward, 12);
    }
  });
  it('the comb is ordered by its physics', () => {
    const by = Object.fromEntries(COMB.map((c) => [c.id, c.usPerDay]));
    expect(by.iss).toBeLessThan(0);
    expect(by.gps).toBeGreaterThan(38);
    expect(by.geo).toBeGreaterThan(by.gps!);
  });
  it('Earth hands over to the black hole', () => {
    expect(curvedState(0.3).earth).toBe(1);
    expect(curvedState(0.7).earth).toBe(0);
    expect(curvedState(0.7).hole).toBe(1);
  });
  it('readouts never fail across the stage', () => {
    for (let k = 0; k <= 100; k++) expect(() => readoutsFor(k / 100)).not.toThrow();
  });
});
