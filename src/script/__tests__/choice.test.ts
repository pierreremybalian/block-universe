import { describe, expect, it } from 'vitest';
import {
  ANDROMEDA_REACH_YEARS,
  BRANCHES,
  CHOICE_P,
  EVENTS,
  T_CHOICE,
  branchAt,
  choice,
  choiceState,
  coneSide,
} from '../choice.ts';
import { LIFE_T1, lifeAt, tOfAge } from '../you.ts';
import { ANDROMEDA_LY } from '../../relativity/units.ts';

describe('choice script', () => {
  it('pauses the life at 35', () => {
    expect(T_CHOICE).toBe(tOfAge(35));
    const [x, y] = lifeAt(T_CHOICE);
    expect(CHOICE_P).toEqual([x, T_CHOICE, y]);
  });
  it('branch 0 is the life that happens; every branch starts at the choice', () => {
    for (let k = 0; k <= 50; k++) {
      const t = T_CHOICE + ((LIFE_T1 - T_CHOICE) * k) / 50;
      expect(branchAt(0, t)).toEqual(lifeAt(t));
    }
    for (let b = 0; b < BRANCHES; b++) {
      const [x, y] = branchAt(b, T_CHOICE);
      expect(x).toBeCloseTo(CHOICE_P[0], 12);
      expect(y).toBeCloseTo(CHOICE_P[2], 12);
    }
  });
  it('every branch is timelike (slower than light)', () => {
    const n = 400;
    for (let b = 0; b < BRANCHES; b++)
      for (let k = 0; k < n; k++) {
        const t0 = T_CHOICE + ((LIFE_T1 - T_CHOICE) * k) / n;
        const t1 = T_CHOICE + ((LIFE_T1 - T_CHOICE) * (k + 1)) / n;
        const p = branchAt(b, t0);
        const q = branchAt(b, t1);
        expect(Math.hypot(q[0] - p[0], q[1] - p[1]) / (t1 - t0)).toBeLessThan(1);
      }
  });
  it('the branches actually spread apart', () => {
    for (let b = 1; b < BRANCHES; b++) {
      const [x, y] = branchAt(b, LIFE_T1);
      const [x0, y0] = lifeAt(LIFE_T1);
      expect(Math.hypot(x - x0, y - y0)).toBeGreaterThan(0.3);
    }
  });
  it('classifies events by the choice’s light cone, with some of each', () => {
    expect(coneSide([CHOICE_P[0], T_CHOICE + 1, CHOICE_P[2]])).toBe('future');
    expect(coneSide([CHOICE_P[0], T_CHOICE - 1, CHOICE_P[2]])).toBe('past');
    expect(coneSide([CHOICE_P[0] + 2, T_CHOICE + 1, CHOICE_P[2]])).toBe('elsewhere');
    const sides = EVENTS.map(coneSide);
    for (const s of ['future', 'past', 'elsewhere'] as const) expect(sides.filter((v) => v === s).length).toBeGreaterThanOrEqual(2);
  });
  it('a choice here reaches Andromeda no sooner than light does', () => {
    expect(ANDROMEDA_REACH_YEARS).toBeCloseTo(ANDROMEDA_LY, 6);
    const rows = choice.readouts(0.68);
    expect(rows.some((r) => r.value === '2.5 million years')).toBe(true);
  });
  it('the cones grow forward only, future first', () => {
    let f = -1;
    let p = -1;
    for (let k = 0; k <= 200; k++) {
      const s = choiceState(k / 200);
      expect(s.future).toBeGreaterThanOrEqual(f);
      expect(s.past).toBeGreaterThanOrEqual(p);
      if (s.past > 0) expect(s.future).toBe(1);
      f = s.future;
      p = s.past;
    }
  });
  it('the growing-block filter is off at both ends (continuity with stages 10 and 12)', () => {
    expect(choiceState(0).lived).toBe(0);
    expect(choiceState(0.2).lived).toBe(1);
    expect(choiceState(1).lived).toBe(0);
  });
  it('the now sits at 35 whenever the sheet is not sweeping', () => {
    for (const l of [0.1, 0.3, 0.44, 0.6, 0.8, 1]) expect(choiceState(l).knifeT).toBeCloseTo(T_CHOICE, 12);
  });
  it('has a readout in every beat after the opening', () => {
    for (const l of [0.06, 0.16, 0.27, 0.37, 0.5, 0.6, 0.68, 0.8, 0.95]) expect(choice.readouts(l).length).toBeGreaterThan(0);
  });
});
