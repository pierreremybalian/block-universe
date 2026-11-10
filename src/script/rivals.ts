// Stage 13 · Is it true? The same shared block read four ways (the Quadtych): presentism, the growing block, the
// moving spotlight and the block universe. Pure script shared by the scene and the HUD.

import { ramp, track, windowed } from '../time/tracks.ts';
import { WORLD } from '../shared/world.ts';
import { registerStage, type Readout } from './index.ts';

export const VIEWS = [
  { id: 'presentism', title: 'Presentism', line: 'only the present exists' },
  { id: 'growing', title: 'Growing block', line: 'the past and present exist' },
  { id: 'spotlight', title: 'Moving spotlight', line: 'all exists; one now is lit' },
  { id: 'block', title: 'Block universe', line: 'all exists; no now is special' },
] as const;

export function rivalsState(local: number) {
  return {
    /** Each panel's reading switches on in turn (the four start identical). */
    presentism: ramp(local, 0.16, 0.24),
    growing: ramp(local, 0.27, 0.35),
    spotlight: ramp(local, 0.38, 0.46),
    block: ramp(local, 0.49, 0.55),
    /** The now moves up the block at a steady pace (the same in all four). */
    now: track(
      [
        [0.1, WORLD.t0 + 0.35],
        [0.98, WORLD.t1 - 0.35],
      ],
      (s) => s,
    )(local),
    /** The one thing all four agree on: the light cone at A's here-now (Stein 1968). */
    cone: windowed(local, 0.6, 0.84, 0.05),
    /** Which panel the caption is about (−1 = all). */
    focus: local < 0.16 ? -1 : local < 0.27 ? 0 : local < 0.38 ? 1 : local < 0.49 ? 2 : local < 0.6 ? 3 : -1,
    pull: ramp(local, 0.9, 1),
  };
}

export const rivals = registerStage('rivals', {
  note: 'The four panels show the same computed block; they differ only in what each view says exists. No experiment so far distinguishes them.',
  readouts(local): Readout[] {
    if (local < 0.14) return [];
    return [
      { label: 'Ruled out by relativity', value: 'one universal now', tone: 'both' },
      { label: 'Not settled', value: 'whether the future exists', tone: 'warm' },
    ];
  },
});
