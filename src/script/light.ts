// Stage 3 · One speed for everyone (light cones, shared history, boost invariance). Pure script.

import { ramp, track, windowed } from '../time/tracks.ts';
import { WORLD } from '../shared/world.ts';
import { mulberry32 } from '../shared/math.ts';
import { C_M_S } from '../relativity/units.ts';
import { registerStage, type Readout } from './index.ts';

/** Height of the flash's cones (hours / light-hours). */
export const CONE_H = 1.9;
/** Two people at the same moment, some distance apart: apexes of their past cones (x, t, y). */
export const YOU = [-0.75, 1.25, 0] as const;
export const FRIEND = [1.05, 1.25, 0.35] as const;
export const VENN_H = 2.4;

const sheet = track([
  [0.1, -0.35],
  [0.4, CONE_H],
]);

export const viewBeta = track([
  [0.68, 0],
  [0.75, 0.45],
  [0.8, 0.45],
  [0.87, -0.45],
  [0.91, -0.45],
  [0.97, 0],
]);

export function lightState(local: number) {
  const now = sheet(local);
  return {
    now,
    sheetOn: ramp(local, 0.08, 0.12) * (1 - ramp(local, 0.38, 0.44)),
    /** The flash itself (bright as the sheet crosses here-now). */
    flash: Math.max(0, 1 - Math.abs(now) / 0.25) * ramp(local, 0.1, 0.12),
    future: Math.max(0, Math.min(1, now / CONE_H)),
    past: ramp(local, 0.43, 0.52),
    coneOn: 1 - 0.65 * windowed(local, 0.52, 0.7, 0.04),
    zones: windowed(local, 0.46, 0.56, 0.02),
    venn: windowed(local, 0.53, 0.7, 0.03),
    beta: viewBeta(local),
    boostLabel: windowed(local, 0.7, 0.95, 0.02),
    pull: ramp(local, 0.9, 1),
  };
}

export interface HistoryEvent {
  x: number;
  t: number;
  y: number;
}

/** A cloud of past events (seeded), for the shared-history Venn. */
export const HISTORY: readonly HistoryEvent[] = (() => {
  const r = mulberry32(1887);
  const out: HistoryEvent[] = [];
  while (out.length < 240) {
    const e = {
      x: WORLD.x0 + 0.15 + r() * (WORLD.x1 - WORLD.x0 - 0.3),
      t: WORLD.t0 + 0.12 + r() * 3.0,
      y: WORLD.y0 + 0.15 + r() * (WORLD.y1 - WORLD.y0 - 0.3),
    };
    out.push(e);
  }
  return out;
})();

/** Could e have affected an observer at apex p? (e inside or on p's past light cone.) */
export function inPast(p: readonly [number, number, number], e: HistoryEvent): boolean {
  const dt = p[1] - e.t;
  if (dt < 0) return false;
  const dx = e.x - p[0];
  const dy = e.y - p[2];
  return dt * dt >= dx * dx + dy * dy;
}

export function vennCounts() {
  let you = 0;
  let friend = 0;
  let both = 0;
  for (const e of HISTORY) {
    const a = inPast(YOU, e);
    const b = inPast(FRIEND, e);
    if (a) you++;
    if (b) friend++;
    if (a && b) both++;
  }
  return { you, friend, both };
}
const COUNTS = vennCounts();

export const light = registerStage('light', {
  note: 'Cones are drawn at their true 45° slope: one hour up, one light-hour out. Light’s speed is measured to be the same for every observer.',
  readouts(local): Readout[] {
    const s = lightState(local);
    if (s.venn > 0.5)
      return [
        { label: 'Could reach you', value: `${COUNTS.you} events`, tone: 'a' },
        { label: 'Could reach your friend', value: `${COUNTS.friend} events`, tone: 'light' },
        { label: 'Shared history', value: `${COUNTS.both} events`, tone: 'both' },
      ];
    if (local >= 0.68)
      return [
        { label: 'Viewing frame', value: `${Math.abs(s.beta).toFixed(2)} c`, tone: 'b' },
        { label: 'Speed of light', value: `${Math.round(C_M_S / 1000).toLocaleString('en-US')} km/s`, tone: 'light' },
      ];
    if (s.now > 0 || local > 0.4)
      return [{ label: 'Flash’s light has spread', value: `${Math.min(CONE_H, Math.max(0, s.now)).toFixed(2)} light-hours`, tone: 'light' }];
    return [{ label: 'Speed of light', value: `${Math.round(C_M_S / 1000).toLocaleString('en-US')} km/s`, tone: 'light' }];
  },
});
