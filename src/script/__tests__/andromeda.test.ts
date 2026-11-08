import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import places from '../../../public/data/places.json';
import {
  ANDROMEDA_X,
  DISPLAY_D,
  EARTH_X,
  LAUNCH_DAYS,
  LOUPE_DAYS,
  NOW_WIDTH_YEARS,
  WALK_EXAGGERATION,
  WALK_SHIFT_DAYS,
  andromeda,
  andromedaState,
  atlasRows,
  fmtDuration,
} from '../andromeda.ts';
import { ANDROMEDA_LY, PROXIMA_LY } from '../../relativity/units.ts';

const placeSchema = z.array(
  z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(2),
    distance_ly: z.number().positive(),
    note: z.string().min(5),
    source: z.object({ label: z.string().min(2), url: z.url() }),
  }),
);
const copy = readFileSync(new URL('../../content/stages/andromeda.mdx', import.meta.url), 'utf8');

describe('andromeda script', () => {
  it('walkers’ nows are 4.3 days apart each way at Andromeda', () => {
    expect(WALK_SHIFT_DAYS).toBeGreaterThan(4.2);
    expect(WALK_SHIFT_DAYS).toBeLessThan(4.35);
    expect(LOUPE_DAYS).toBeGreaterThan(WALK_SHIFT_DAYS);
    expect(Math.abs(LAUNCH_DAYS)).toBeLessThan(WALK_SHIFT_DAYS);
  });
  it('the ribbon reaches the light cone at 0.99c', () => {
    expect(ANDROMEDA_X - EARTH_X).toBe(DISPLAY_D);
    const s = andromedaState(0.9);
    expect(s.beta).toBeCloseTo(0.99, 6);
    expect(s.ribbon).toBeCloseTo(0.99 * DISPLAY_D, 6);
    expect(NOW_WIDTH_YEARS).toBeCloseTo(ANDROMEDA_LY, -2);
  });
  it('states the exaggeration factor in its note', () => {
    expect(WALK_EXAGGERATION).toBeGreaterThan(1e7);
    expect(andromeda.note).toContain(`${Math.round(WALK_EXAGGERATION / 1e6)} million`);
  });
  it('readouts never throw and switch to real speeds', () => {
    for (let k = 0; k <= 100; k++) expect(() => andromeda.readouts(k / 100)).not.toThrow();
    expect(andromeda.readouts(0.5).some((r) => r.value.includes('days apart'))).toBe(true);
    expect(andromeda.readouts(0.9).some((r) => r.value.includes('million yr'))).toBe(true);
  });
  it('copy numbers match the physics', () => {
    expect(copy).toContain(`${WALK_SHIFT_DAYS.toFixed(1)} days ahead`);
    expect(copy).toContain(`${(2 * WALK_SHIFT_DAYS).toFixed(1)} days`);
    expect(copy).toContain(`${ANDROMEDA_LY / 1e6} million light-years`);
    expect(copy).toContain(`${(NOW_WIDTH_YEARS / 1e6).toFixed(1)} million years either way`);
  });
});

describe('places.json (Atlas of Elsewhere)', () => {
  it('validates, has unique ids and https sources', () => {
    expect(() => placeSchema.parse(places)).not.toThrow();
    expect(new Set(places.map((p) => p.id)).size).toBe(places.length);
    for (const p of places) expect(p.source.url.startsWith('https://')).toBe(true);
  });
  it('agrees with the constants the physics uses', () => {
    expect(places.find((p) => p.id === 'andromeda')!.distance_ly).toBe(ANDROMEDA_LY);
    expect(places.find((p) => p.id === 'proxima')!.distance_ly).toBe(PROXIMA_LY);
  });
  it('rows are ordered by distance with sensible values', () => {
    const rows = atlasRows(places);
    for (let i = 1; i < rows.length; i++) expect(rows[i]!.nowWidthS).toBeGreaterThan(rows[i - 1]!.nowWidthS);
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.moon!.nowWidth).toBe('±1.3 s');
    expect(by.sun!.nowWidth).toBe('±8.3 min');
    expect(by.andromeda!.walkShift).toBe('4.3 days');
    expect(by.andromeda!.nowWidth).toBe('±2.5 Myr');
  });
  it('formats durations compactly', () => {
    expect(fmtDuration(6e-9)).toBe('6 ns');
    expect(fmtDuration(2.33e-6)).toBe('2.3 µs');
    expect(fmtDuration(3930)).toBe('1.1 h');
  });
});
