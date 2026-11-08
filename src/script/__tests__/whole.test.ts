import { describe, expect, it } from 'vitest';
import { AGE_GYR, CMB, CONE_MAX, coneAtA, sightingOf, tDisp, xDisp } from '../whole.ts';

describe('whole script', () => {
  it('display maps the age onto the block with light at 45° near us', () => {
    expect(tDisp(0)).toBe(-2);
    expect(tDisp(AGE_GYR)).toBeCloseTo(2, 12);
    expect(xDisp(1) / (tDisp(1) - tDisp(0))).toBeCloseTo(1, 12);
  });
  it('the teardrop is widest at about 5.85 billion light-years', () => {
    expect(CONE_MAX.properGly).toBeGreaterThan(5.75);
    expect(CONE_MAX.properGly).toBeLessThan(5.95);
  });
  it('the CMB set off about 41 million light-years away; that matter is now about 45 billion', () => {
    expect(CMB.properGly * 1000).toBeGreaterThan(38);
    expect(CMB.properGly * 1000).toBeLessThan(45);
    expect(CMB.nowGly).toBeGreaterThan(44);
    expect(CMB.nowGly).toBeLessThan(46.5);
  });
  it('a galaxy is seen where its comoving distance meets the cone', () => {
    for (const chi of [2, 6, 12]) {
      const s = sightingOf(chi)!;
      expect(coneAtA(s.a).comovingGly).toBeCloseTo(chi, 2);
      expect(s.properGly).toBeCloseTo(s.a * chi, 12);
    }
    expect(sightingOf(100)).toBeNull();
  });
});
