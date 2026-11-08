// Stage 7 · A now is a rolling shutter. Pure script shared by the scene and the HUD.
// A rotor's history is a twisted stack in the block. A flat slice (A's now) photographs straight blades; a tilted
// slice (B's now) catches each part of the rotor at a different moment, so the blades bend, like a phone camera
// that reads its sensor line by line. Display units: c = 1. The rotor's speed is wildly exaggerated; the slicing
// geometry is exact.

import { ramp, track, windowed } from '../time/tracks.ts';
import { registerStage, type Readout } from './index.ts';
import { simultaneityShiftS } from '../relativity/simultaneity.ts';
import { WALK_M_S } from '../relativity/units.ts';
import { sci } from '../time/format.ts';

/** Rotor geometry (display units). */
export const ROTOR = {
  /** Blade radius. */
  r: 1.25,
  blades: 3,
  /** Angular speed, radians per unit time. */
  omega: (2 * Math.PI) / 2.8,
  /** Two lights orbiting outside the blades, the other way round. */
  orbitR: 1.45,
  orbitOmega: -(2 * Math.PI) / 3.6,
  lights: 2,
};

export const SHUTTER_BOUNDS = { x0: -1.65, x1: 1.65, t0: -2, t1: 2, y0: -1.65, y1: 1.65 };

/** B's speed (fraction of c). */
export const SHUTTER_BETA = 0.32;

/** Bend of a blade tip-to-tip across the rotor seen in B's photograph, degrees: ω β (2R). */
export function bendDegrees(beta: number): number {
  return ((ROTOR.omega * Math.abs(beta) * 2 * ROTOR.r) * 180) / Math.PI;
}

/** The same bend for a real 1 m-radius propeller at 2,400 rpm photographed by someone walking past, degrees. */
export function realPropellerBendDegrees(): number {
  const omega = (2400 * 2 * Math.PI) / 60;
  return (omega * simultaneityShiftS(WALK_M_S, 2) * 180) / Math.PI;
}

export const shutterBeta = track([
  [0.43, 0],
  [0.53, SHUTTER_BETA],
]);

export function shutterState(local: number) {
  return {
    /** Frames exist up to this time (the stack builds upward). */
    reveal: track([
      [0.04, SHUTTER_BOUNDS.t0 + 0.02],
      [0.3, SHUTTER_BOUNDS.t1 + 0.05],
    ])(local),
    /** Frames glow weaker once the knives arrive, so the photographs read. */
    stackGain: 1 - 0.7 * ramp(local, 0.32, 0.4),
    knifeA: ramp(local, 0.32, 0.38),
    knifeB: ramp(local, 0.42, 0.46),
    beta: shutterBeta(local),
    /** Height of both slices: still, then drifting up so the photographs play like film. */
    c: track([
      [0.6, 0],
      [0.86, 1.0],
    ])(local),
    /** Image on the knives' faces. */
    image: ramp(local, 0.34, 0.4),
    /** The two photographs side by side. */
    photos: windowed(local, 0.58, 0.93, 0.05),
    pull: ramp(local, 0.88, 1),
  };
}

export const shutter = registerStage('shutter', {
  note: 'The rotor spins absurdly fast, about once per light-crossing of its own width, so the bend is visible; the way each slice cuts the stack is exact.',
  readouts(local) {
    const s = shutterState(local);
    const rows: Readout[] = [];
    // Three rows at most, so the dual clock never reaches the photographs below it.
    if (s.knifeA > 0.5 && s.photos < 0.5) rows.push({ label: 'A', value: 'at rest', tone: 'a' });
    if (s.knifeB > 0.5) {
      rows.push({ label: 'B', value: `${Math.abs(s.beta).toFixed(2)} c`, tone: 'b' });
      rows.push({ label: 'Blade bend in B’s photo', value: `${Math.round(bendDegrees(s.beta))} degrees`, tone: 'both' });
    }
    if (s.photos > 0.5) {
      rows.push({ label: 'Real propeller bend, walking past', value: `${sci(realPropellerBendDegrees(), 1)} degrees`, tone: 'mute' });
    }
    return rows;
  },
});
