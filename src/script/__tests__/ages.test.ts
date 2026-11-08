import { describe, expect, it } from 'vitest';
import { A_INDEX, B_BETA, B_INDEX, KNIFE_TAU, TAUS, TRAVELERS, ages, beadOf, tangentIntercept } from '../ages.ts';
import { bowlSlope, bowlT } from '../../relativity/invariants.ts';
import { boostXTY } from '../../relativity/lorentz.ts';
import { sliceT } from '../../relativity/simultaneity.ts';

describe('ages script', () => {
  it('A is at rest and B moves at 0.6c along +x', () => {
    expect(TRAVELERS[A_INDEX]!.beta).toBe(0);
    expect(TRAVELERS[B_INDEX]!.beta).toBe(B_BETA);
    expect(TRAVELERS[B_INDEX]!.dir).toBe(0);
  });
  it('every bead lies on its bowl, in any direction', () => {
    for (const tr of TRAVELERS)
      for (const tau of TAUS) {
        const [x, t, y] = beadOf(tr, tau);
        expect(bowlT(tau, x, y)).toBeCloseTo(t, 10);
      }
  });
  it('the knives are tangent to the bowl at the beads', () => {
    for (const i of [A_INDEX, B_INDEX]) {
      const tr = TRAVELERS[i]!;
      const [x, t] = beadOf(tr, KNIFE_TAU);
      const c = tangentIntercept(tr.beta, KNIFE_TAU);
      expect(tr.beta * x + c).toBeCloseTo(t, 10);
      expect(bowlSlope(KNIFE_TAU, x)).toBeCloseTo(tr.beta, 10);
      for (const dx of [-0.5, 0.5]) expect(sliceT(tr.beta, t, x, x + dx)).toBeLessThan(bowlT(KNIFE_TAU, x + dx));
    }
  });
  it('a boost to B’s frame keeps every bead on its bowl and puts B at the bottom', () => {
    const o = [0, 0, 0];
    for (const tr of TRAVELERS)
      for (const tau of TAUS) {
        const [x, t, y] = beadOf(tr, tau);
        boostXTY(x, t, y, B_BETA, o);
        expect(bowlT(tau, o[0]!, o[2]!)).toBeCloseTo(o[1]!, 9);
      }
    const [x, t, y] = beadOf(TRAVELERS[B_INDEX]!, KNIFE_TAU);
    boostXTY(x, t, y, B_BETA, o);
    expect(o[0]).toBeCloseTo(0, 10);
    expect(o[1]).toBeCloseTo(KNIFE_TAU, 10);
  });
  it('has readouts through the stage', () => {
    expect(ages.readouts(0.2).length).toBeGreaterThan(0);
    expect(ages.readouts(0.95).at(-1)!.value).toBe('B’s frame');
  });
});
