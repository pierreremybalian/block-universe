import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHUTTER_BETA, bendDegrees, realPropellerBendDegrees, shutter, shutterState } from '../shutter.ts';
import { sci } from '../../time/format.ts';

const copy = readFileSync(new URL('../../content/stages/shutter.mdx', import.meta.url), 'utf8');

describe('shutter script', () => {
  it('B’s photograph bends visibly; a real propeller does not', () => {
    expect(bendDegrees(SHUTTER_BETA)).toBeGreaterThan(60);
    expect(bendDegrees(SHUTTER_BETA)).toBeLessThan(150);
    expect(bendDegrees(0)).toBe(0);
    expect(realPropellerBendDegrees()).toBeLessThan(1e-10);
  });
  it('the stack builds before the knives arrive and the photographs come after', () => {
    expect(shutterState(0.31).reveal).toBeGreaterThan(1.9);
    expect(shutterState(0.2).knifeA).toBe(0);
    expect(shutterState(0.75).photos).toBe(1);
    expect(shutterState(0.75).beta).toBeCloseTo(SHUTTER_BETA, 10);
  });
  it('copy quotes the computed real-propeller bend', () => {
    expect(copy).toContain(`${sci(realPropellerBendDegrees(), 1)} degrees`);
  });
  it('readouts never throw', () => {
    for (let k = 0; k <= 100; k++) expect(() => shutter.readouts(k / 100)).not.toThrow();
  });
});
