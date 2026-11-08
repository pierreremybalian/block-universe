import { describe, expect, it } from 'vitest';
import { TRIP, TURN_YEARS, clocks, clocksState, travelerAge, travelerAtAge, travelerX } from '../clocks.ts';
import { PROXIMA_LY } from '../../relativity/units.ts';
import { properTimeOfPath } from '../../relativity/properTime.ts';

describe('clocks script', () => {
  it('the traveler reaches Proxima at the turnaround and comes home', () => {
    expect(travelerX(0)).toBe(0);
    expect(travelerX(TURN_YEARS)).toBeCloseTo(PROXIMA_LY, 10);
    expect(travelerX(TRIP.homeYears)).toBeCloseTo(0, 10);
  });
  it('ages agree with the proper time of the path', () => {
    const path = [
      [0, 0],
      [TURN_YEARS, PROXIMA_LY],
      [TRIP.homeYears, 0],
    ];
    expect(travelerAge(TRIP.homeYears)).toBeCloseTo(properTimeOfPath(path), 10);
    expect(travelerAge(TRIP.homeYears)).toBeCloseTo(6.37, 2);
  });
  it('ladder rung ends sit on the traveler path', () => {
    for (let k = 1; k <= 6; k++) {
      const e = travelerAtAge(k);
      expect(travelerX(e.t)).toBeCloseTo(e.x, 10);
      expect(travelerAge(e.t)).toBeCloseTo(k, 10);
    }
  });
  it('the journey climbs monotonically and the readouts end on the reunion', () => {
    let last = -1;
    for (let i = 0; i <= 200; i++) {
      const t = clocksState(i / 200).tYears;
      expect(t).toBeGreaterThanOrEqual(last - 1e-12);
      last = t;
    }
    const rows = clocks.readouts(0.9);
    expect(rows.map((r) => r.value)).toEqual(['10.6 yr', '6.4 yr', '4.2 yr']);
  });
});
