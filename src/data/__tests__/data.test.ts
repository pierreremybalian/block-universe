import { describe, expect, it } from 'vitest';
import experiments from '../../../public/data/experiments.json';
import positions from '../../../public/data/positions.json';
import { experimentsSchema, positionsSchema } from '../schema.ts';
import { STAGES } from '../../time/stages.ts';

describe('data', () => {
  it('experiments.json validates', () => expect(() => experimentsSchema.parse(experiments)).not.toThrow());
  it('positions.json validates', () => expect(() => positionsSchema.parse(positions)).not.toThrow());
  it('ids are unique', () => {
    expect(new Set(experiments.map((e) => e.id)).size).toBe(experiments.length);
    expect(new Set(positions.map((e) => e.id)).size).toBe(positions.length);
  });
  it('experiments reference real stages', () => {
    const ids = new Set(STAGES.map((s) => s.id));
    for (const e of experiments) for (const s of e.stages) expect(ids.has(s)).toBe(true);
  });
  it('every source is https', () => {
    for (const e of [...experiments, ...positions]) expect(e.sources.every((s) => s.url.startsWith('https://'))).toBe(true);
  });
});
