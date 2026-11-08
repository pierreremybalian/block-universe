import { describe, expect, it } from 'vitest';
import { LIFE_T0, LIFE_T1, ageOfT, headAheadS, loupeOffset, tOfAge, youState } from '../you.ts';

describe('you script', () => {
  it('maps ages to the block and back', () => {
    expect(tOfAge(0)).toBe(LIFE_T0);
    expect(tOfAge(80)).toBe(LIFE_T1);
    for (const a of [0, 13, 47.5, 80]) expect(ageOfT(tOfAge(a))).toBeCloseTo(a, 12);
  });
  it('head is ahead of feet by about 0.47 µs at 80, growing linearly', () => {
    expect(headAheadS(80) * 1e6).toBeGreaterThan(0.45);
    expect(headAheadS(80) * 1e6).toBeLessThan(0.49);
    expect(headAheadS(40) / headAheadS(80)).toBeCloseTo(0.5, 12);
  });
  it('the loupe offset at 80 is visible but stays inside the block', () => {
    expect(loupeOffset(80)).toBeGreaterThan(0.4);
    expect(loupeOffset(80)).toBeLessThan(1.2);
  });
  it('reveal and scan move forward only', () => {
    let r = -1;
    let sc = -10;
    for (let k = 0; k <= 200; k++) {
      const s = youState(k / 200);
      expect(s.reveal).toBeGreaterThanOrEqual(r);
      expect(s.scan).toBeGreaterThanOrEqual(sc);
      r = s.reveal;
      sc = s.scan;
    }
  });
});
