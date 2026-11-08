// Stage 1 · Time as we live it (presentism as lived). Pure script shared by the scene and the HUD.
// One unit of time is one hour (the shared world's units). The now rises through the bottom of the block.

import { ramp, track } from '../time/tracks.ts';
import { registerStage, type Readout } from './index.ts';

/** Where the now sheet sits (hours) at the start and end of the stage. Stage 2 continues from FLOW_END. */
export const FLOW_START = -1.7;
export const FLOW_END = -0.6;
/** Clock time shown at t = 0 (minutes after midnight): noon. */
const CLOCK_ZERO_MIN = 12 * 60;

export const flowNow = track(
  [
    [0, FLOW_START],
    [1, FLOW_END],
  ],
  (s) => s,
);

export function flowState(local: number) {
  return {
    now: flowNow(local),
    /** Points appear on the sheet. */
    cast: ramp(local, 0.04, 0.16),
    /** Labels for the past and the future. */
    pastLabel: ramp(local, 0.42, 0.52),
    futureLabel: ramp(local, 0.48, 0.58),
    /** Length of the fading afterimage below the now (hours). */
    afterimage: 0.12 + 0.38 * ramp(local, 0.3, 0.55),
    /** Camera pulls back at the end so the trail reads before stage 2. */
    pull: ramp(local, 0.7, 1),
  };
}

/** "11:12" for a time in hours relative to noon. */
export function clockLabel(tHours: number): string {
  const m = Math.round(CLOCK_ZERO_MIN + tHours * 60);
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
}

export const flow = registerStage('flow', {
  note: 'A picture of how time feels, not of how physics describes it. One unit of height is one hour.',
  readouts(local): Readout[] {
    const s = flowState(local);
    return [{ label: 'Now, everywhere', value: clockLabel(s.now), tone: 'plain' }];
  },
});
