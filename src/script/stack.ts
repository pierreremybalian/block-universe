// Stage 2 · Stack the moments. Pure script shared by the scene and the HUD.

import { ramp, track } from '../time/tracks.ts';
import { WORLD } from '../shared/world.ts';
import { FLOW_END } from './flow.ts';
import { registerStage, type Readout } from './index.ts';

/** Frame spacing (hours): 24 frames across the 4-hour block. */
export const FRAME_DT = (WORLD.t1 - WORLD.t0) / 24;
/** Frames below the point where stage 1 left the now (kept later, "the ones we let go"). */
export const LOWER_FRAMES = Math.round((FLOW_END - WORLD.t0) / FRAME_DT) + 1;
/** Time of the last lower frame and first upper frame. */
export const LOWER_TOP = WORLD.t0 + (LOWER_FRAMES - 1) * FRAME_DT;
export const UPPER_FROM = LOWER_TOP + FRAME_DT;
export const UPPER_FRAMES = Math.round((WORLD.t1 - UPPER_FROM) / FRAME_DT) + 1;

const sheet = track([
  [0.06, FLOW_END],
  [0.52, WORLD.t1],
]);

export function stackState(local: number) {
  const now = sheet(local);
  return {
    now,
    /** Sheet visibility (it leaves once the block is full). */
    sheetOn: 1 - ramp(local, 0.5, 0.6),
    /** Frames below where stage 1 left the now fade back in. */
    lower: ramp(local, 0.2, 0.34),
    /** Frames as a whole: fade out as they merge into a solid block. */
    frames: 1 - ramp(local, 0.6, 0.74),
    /** Worldlines: faint threads while stacking, full once the frames merge. */
    threads: 0.18 + 0.27 * ramp(local, 0.38, 0.5) + 0.55 * ramp(local, 0.6, 0.74),
    /** Fraction of each worldline drawn (follows the sheet). */
    reveal: (now - WORLD.t0) / (WORLD.t1 - WORLD.t0),
    glass: ramp(local, 0.62, 0.78),
    /** A's worldline highlighted ("you have one too"). */
    you: ramp(local, 0.78, 0.86),
    camera: ramp(local, 0.08, 0.7),
    pull: ramp(local, 0.86, 1),
  };
}

/** Frames kept so far (both stacks), for the dual clock. */
export function framesKept(local: number): number {
  const s = stackState(local);
  const upper = s.now < UPPER_FROM - 1e-9 ? 0 : Math.min(UPPER_FRAMES, Math.floor((s.now - UPPER_FROM) / FRAME_DT + 1e-6) + 1);
  const lower = s.lower > 0.5 ? LOWER_FRAMES : 0;
  return upper + lower;
}

export const stack = registerStage('stack', {
  note: 'Relativity’s standard picture of spacetime. The star and planet are schematic: a real orbit takes months or years, so its helix would be far taller.',
  readouts(local): Readout[] {
    const s = stackState(local);
    if (s.frames > 0.5) return [{ label: 'Moments kept', value: String(framesKept(local)), tone: 'plain' }];
    return [
      { label: 'Space', value: '6 × 3 light-hours', tone: 'mute' },
      { label: 'Time', value: `${WORLD.t1 - WORLD.t0} hours`, tone: 'plain' },
    ];
  },
});
