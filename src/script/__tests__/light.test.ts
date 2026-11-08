import { describe, expect, it } from 'vitest';
import { FRIEND, HISTORY, YOU, inPast, lightState, vennCounts } from '../light.ts';

describe('light script', () => {
  it('the flash happens when the sheet crosses here-now', () => {
    let best = 0;
    let at = 0;
    for (let k = 0; k <= 1000; k++) {
      const f = lightState(k / 1000).flash;
      if (f > best) {
        best = f;
        at = k / 1000;
      }
    }
    expect(best).toBeGreaterThan(0.95);
    expect(Math.abs(lightState(at).now)).toBeLessThan(0.02);
  });
  it('past cones are causal regions', () => {
    expect(inPast(YOU, { x: YOU[0], t: YOU[1] - 1, y: YOU[2] })).toBe(true);
    expect(inPast(YOU, { x: YOU[0] + 1.01, t: YOU[1] - 1, y: YOU[2] })).toBe(false);
    expect(inPast(YOU, { x: YOU[0], t: YOU[1] + 0.1, y: YOU[2] })).toBe(false);
  });
  it('shared history is the intersection and is not empty', () => {
    const c = vennCounts();
    expect(c.both).toBeGreaterThan(5);
    expect(c.both).toBeLessThan(Math.min(c.you, c.friend));
    expect(HISTORY.filter((e) => inPast(YOU, e) && inPast(FRIEND, e)).length).toBe(c.both);
  });
  it('ends the boost in the rest frame', () => expect(lightState(1).beta).toBe(0));
});
