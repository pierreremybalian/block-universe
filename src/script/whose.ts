// Stage 6 · Whose now? (relativity of simultaneity). Pure script shared by the scene and the HUD.

import { ramp, track, windowed } from '../time/tracks.ts';
import { BEACONS, WORLD } from '../shared/world.ts';
import { registerStage, type Readout } from './index.ts';
import { dtInFrame } from '../relativity/invariants.ts';

export const B_SPEED = 0.5;

/** B's speed through the stage: appears at rest with A, tilts to 0.5c, then sweeps both ways (the Reshuffle). */
export const betaB = track([
  [0.4, 0],
  [0.47, B_SPEED],
  [0.52, B_SPEED],
  [0.57, -0.6],
  [0.62, 0.65],
  [0.66, B_SPEED],
]);

export function whoseState(local: number) {
  return {
    /** A's knife sweeps up to here-now. */
    knifeA: track([
      [0.1, WORLD.t0],
      [0.24, 0],
    ])(local),
    knifeAOn: ramp(local, 0.08, 0.12),
    bLine: ramp(local, 0.3, 0.38),
    knifeBOn: ramp(local, 0.36, 0.4),
    beta: betaB(local),
    reshuffle: windowed(local, 0.46, 0.7, 0.03),
    /** 0 = one view in A's frame, 1 = diptych with B's frame on the right. */
    split: windowed(local, 0.68, 0.9, 0.05),
    pull: ramp(local, 0.88, 1),
  };
}

/** Order of the beacons by time in a frame (indices into BEACONS), for the Reshuffle lanes. */
export function frameTimes(beta: number): number[] {
  return BEACONS.map((b) => dtInFrame({ t: 0, x: 0 }, b, beta));
}

export const whose = registerStage('whose', {
  dividers: (local) => ({ v: whoseState(local).split, h: 0 }),
  note: 'Speeds are real fractions of light speed and every tilt is computed; the block spans six light-hours of space and four hours of time.',
  readouts(local) {
    const s = whoseState(local);
    const rows: Readout[] = [{ label: 'A', value: 'at rest', tone: 'a' }];
    if (s.bLine > 0.5) {
      const b = Math.abs(s.beta);
      rows.push({ label: 'B', value: `${b.toFixed(2)} c ${s.beta < -0.005 ? '←' : s.beta > 0.005 ? '→' : ''}`.trim(), tone: 'b' as const });
      const gapH = b * WORLD.x1;
      rows.push({ label: 'Gap 3 light-hours out', value: `${gapH.toFixed(1)} h`, tone: 'both' as const });
    }
    return rows;
  },
});
