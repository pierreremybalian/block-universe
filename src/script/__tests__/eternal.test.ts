import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHAIN_LAMP, FUTURE, chainBeta, eternal, eternalState, nowSpeed } from '../eternal.ts';
import { BEACONS, beacon } from '../../shared/world.ts';
import { intervalSq, separation } from '../../relativity/lorentz.ts';
import { dtInFrame } from '../../relativity/invariants.ts';

const copy = readFileSync(new URL('../../content/stages/eternal.mdx', import.meta.url), 'utf8');
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

describe('eternal script', () => {
  it('every lamp is outside here-now’s light cone', () => {
    for (const b of BEACONS) expect(separation({ t: 0, x: 0, y: 0 }, b)).toBe('spacelike');
  });
  it('the fan reaches every lamp an x-boost can reach, and lamp 7 is not one of them', () => {
    const end = eternalState(0.5);
    const reachable = BEACONS.filter((b) => nowSpeed(b) !== null).length;
    expect(end.litCount).toBe(reachable);
    expect(nowSpeed(beacon(7))).toBeNull();
    // A lit lamp really is simultaneous with here-now for its observer.
    for (const b of BEACONS) {
      const v = nowSpeed(b);
      if (v !== null) expect(Math.abs(dtInFrame({ t: 0, x: 0 }, b, v))).toBeLessThan(1e-12);
    }
  });
  it('lamps light monotonically as the fan sweeps', () => {
    let last = 0;
    for (let k = 0; k <= 50; k++) {
      const n = eternalState(0.1 + (0.36 * k) / 50).litCount;
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });
  it('the chain link reaches A’s future, which is inside the light cone', () => {
    expect(intervalSq({ t: 0, x: 0, y: 0 }, FUTURE)).toBeGreaterThan(0);
    const b = beacon(CHAIN_LAMP);
    const v = chainBeta();
    expect(Math.abs(v)).toBeLessThan(1);
    expect(Math.abs(dtInFrame(b, FUTURE, v))).toBeLessThan(1e-12);
  });
  it('copy matches the count of lamps the fan reaches', () => {
    const n = BEACONS.filter((b) => nowSpeed(b) !== null).length;
    const cap = words[n]![0]!.toUpperCase() + words[n]!.slice(1);
    expect(copy).toContain(`${cap} of the ${words[BEACONS.length]} lamps`);
  });
  it('readouts never throw', () => {
    for (let k = 0; k <= 100; k++) expect(() => eternal.readouts(k / 100)).not.toThrow();
    expect(eternal.readouts(0.95).find((r) => r.label === 'Privileged now')?.value).toBe('none');
  });
});
