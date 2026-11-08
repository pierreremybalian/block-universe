import { describe, expect, it } from 'vitest';
import { FLOW_END, FLOW_START, clockLabel, flowState } from '../flow.ts';
import { FRAME_DT, LOWER_FRAMES, LOWER_TOP, UPPER_FRAMES, UPPER_FROM, framesKept, stackState } from '../stack.ts';
import { WORLD } from '../../shared/world.ts';

describe('flow script', () => {
  it('rises from FLOW_START to FLOW_END', () => {
    expect(flowState(0).now).toBeCloseTo(FLOW_START, 12);
    expect(flowState(1).now).toBeCloseTo(FLOW_END, 12);
    for (let k = 1; k <= 100; k++) expect(flowState(k / 100).now).toBeGreaterThanOrEqual(flowState((k - 1) / 100).now);
  });
  it('labels clock times', () => {
    expect(clockLabel(0)).toBe('12:00');
    expect(clockLabel(-1.5)).toBe('10:30');
    expect(clockLabel(-0.6)).toBe('11:24');
  });
});

describe('stack script', () => {
  it('continues where flow left the now', () => expect(stackState(0).now).toBeCloseTo(FLOW_END, 12));
  it('frames tile the block evenly', () => {
    expect(LOWER_TOP).toBeLessThanOrEqual(FLOW_END + 1e-9);
    expect(UPPER_FROM - LOWER_TOP).toBeCloseTo(FRAME_DT, 12);
    expect(UPPER_FROM + (UPPER_FRAMES - 1) * FRAME_DT).toBeCloseTo(WORLD.t1, 9);
    expect(LOWER_FRAMES + UPPER_FRAMES).toBe(25);
  });
  it('keeps more frames as the sheet rises', () => {
    let last = -1;
    for (let k = 0; k <= 60; k++) {
      const n = framesKept(k / 100);
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
    expect(framesKept(0.58)).toBe(25);
  });
});
