// Stage 9 · Everything, all at once (the Rietdijk–Putnam argument for the block universe). Pure script shared by
// the scene and the dual clock. The shared world block (src/shared/world.ts): A at rest at here-now, seven lamps.
//
// 1. The Simultaneity Fan: observers passing through here-now at every speed from −0.99c to +0.99c (along x) each
//    have a now-slice t = βx. Sweeping β lights every lamp whose flash is "now" for one of them (β = t/x).
// 2. A chain: a lamp lit that way is real (premise). Someone at lamp 5 moving at the right speed has A's own future
//    event F in their now, so F is real too. That is how the argument reaches the future.
// 3. Repeat from every event, in every direction: nothing in the block is left out.

import { ramp, track, windowed } from '../time/tracks.ts';
import { registerStage, type Readout } from './index.ts';
import { BEACONS, beacon } from '../shared/world.ts';

/** A's future event, on A's worldline (hours). */
export const FUTURE = { x: 0, t: 1.6, y: 0 };
/** The chain link: the lamp whose observer reaches A's future, and that observer's speed. */
export const CHAIN_LAMP = 5;
export function chainBeta(): number {
  const b = beacon(CHAIN_LAMP);
  return (b.t - FUTURE.t) / (b.x - FUTURE.x);
}

export const FAN_MAX = 0.99;
/** Number of glass blades left behind by the fan. */
export const FAN_BLADES = 9;

export const sweepBeta = track(
  [
    [0.12, -FAN_MAX],
    [0.44, FAN_MAX],
  ],
  (s) => s * s * (3 - 2 * s),
);

/** The speed (along x) at which an event is simultaneous with here-now, or null if no x-boost reaches it. */
export function nowSpeed(e: { x: number; t: number }): number | null {
  if (Math.abs(e.x) < 1e-9) return null;
  const b = e.t / e.x;
  return Math.abs(b) < FAN_MAX ? b : null;
}

export function eternalState(local: number) {
  const beta = sweepBeta(local);
  const sweeping = local > 0.12 && local < 0.44;
  const fanOn = ramp(local, 0.08, 0.13);
  /** Lamps already "now" for someone (the sweep has passed their speed). */
  const lit: number[] = BEACONS.map((b) => {
    const v = nowSpeed(b);
    return v !== null && local >= 0.12 && beta >= v - 1e-9 ? 1 : 0;
  });
  const chain = ramp(local, 0.52, 0.58);
  const future = ramp(local, 0.58, 0.62);
  const all = ramp(local, 0.7, 0.8);
  return {
    beta,
    sweeping,
    fanOn,
    /** The bright sweeping knife. */
    knife: windowed(local, 0.1, 0.48, 0.03),
    lit,
    litCount: lit.reduce((a, b) => a + b, 0),
    /** Labels for the two regions once the fan has swept. */
    regions: windowed(local, 0.42, 0.72, 0.04),
    chain,
    chainKnife: windowed(local, 0.52, 0.76, 0.04),
    future,
    /** Every event lit; the fan and knives fade. */
    all,
    fanFade: 1 - ramp(local, 0.72, 0.82),
    pull: ramp(local, 0.82, 1),
  };
}

export const eternal = registerStage('eternal', {
  note: 'Every tilt is exact. The conclusion rests on two premises you can reject: whatever is now for a real observer is real, and what is real for someone real is real for you.',
  readouts(local) {
    const s = eternalState(local);
    const rows: Readout[] = [];
    if (s.all > 0.5) {
      rows.push({ label: 'Events left out', value: 'none', tone: 'both' });
      rows.push({ label: 'Privileged now', value: 'none', tone: 'plain' });
      return rows;
    }
    if (s.fanOn > 0.5 && s.chain < 0.5) {
      const arrow = s.beta > 0.005 ? ' →' : s.beta < -0.005 ? ' ←' : '';
      rows.push({ label: 'Passing here-now at', value: `${Math.abs(s.beta).toFixed(2)} c${arrow}`, tone: 'both' });
    }
    if (s.chain >= 0.5) rows.push({ label: `Someone at lamp ${CHAIN_LAMP}`, value: `${Math.abs(chainBeta()).toFixed(2)} c ←`, tone: 'b' });
    if (s.fanOn > 0.5) rows.push({ label: 'Lamps that are someone’s now', value: `${s.litCount} of ${BEACONS.length}`, tone: 'warm' });
    if (s.future > 0.5) rows.push({ label: 'A’s future', value: 'someone’s now', tone: 'warm' });
    return rows;
  },
});
