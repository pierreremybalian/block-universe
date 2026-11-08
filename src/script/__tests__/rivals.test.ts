import { describe, expect, it } from 'vitest';
import { VIEWS, rivalsState } from '../rivals.ts';
import { WORLD } from '../../shared/world.ts';

describe('rivals script', () => {
  it('has the four views in order', () => {
    expect(VIEWS.map((v) => v.id)).toEqual(['presentism', 'growing', 'spotlight', 'block']);
  });
  it('the now climbs steadily inside the block', () => {
    let last = -Infinity;
    for (let k = 0; k <= 100; k++) {
      const s = rivalsState(k / 100);
      expect(s.now).toBeGreaterThanOrEqual(last);
      expect(s.now).toBeGreaterThan(WORLD.t0);
      expect(s.now).toBeLessThan(WORLD.t1);
      last = s.now;
    }
  });
  it('each reading switches on in turn', () => {
    const at = (l: number) => rivalsState(l);
    expect(at(0.1).presentism).toBe(0);
    expect(at(0.26).presentism).toBe(1);
    expect(at(0.26).growing).toBe(0);
    expect(at(0.6).block).toBe(1);
  });
});
