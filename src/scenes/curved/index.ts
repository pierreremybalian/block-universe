// Stage 12 · The block bends (HANDOFF §10.11). Part one: one day around Earth. The planet's history is a tube whose
// spin turns its meridians into helices; five clocks (sea level, Everest, space station, GPS, geostationary) bead
// their own hours, and the rung joining "24 hours" on each clock slants (the Altitude Comb; rates exaggerated, the
// HUD shows the real ones). Part two: a black hole. Light cones along a line toward it tip inward, exactly as in
// ingoing Eddington–Finkelstein coordinates; at the horizon outward light stands still; inside, every future ends at
// the singularity. A falling observer crosses in.

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents, type EventSpec } from '../../shared/block/events.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL, type RGB } from '../../shared/block/palette.ts';
import {
  COMB,
  CONE_RADII,
  DAY_UNITS,
  FALL,
  FAR_CONE_R,
  fallRAt,
  RATE_EXAGGERATION,
  RS,
  curved,
  curvedState,
  displayRadius,
  periodUnits,
} from '../../script/curved.ts';
import { R_EARTH_M } from '../../relativity/units.ts';
import { smooth } from '../../time/tracks.ts';
import { createSkewCones, createTube } from './shapes.ts';
import { createKnife } from '../../shared/block/knife.ts';

const T0 = -2;
const T1 = 2.35;
const EB: Bounds = { x0: -2.8, x1: 2.8, t0: T0, t1: T1, y0: -2.8, y1: 2.8 };
const HB: Bounds = { x0: -1.6, x1: 4.3, t0: -2, t1: 2, y0: -1.6, y1: 1.6 };

const params = {
  earthCamera: { az: 0.55, el: 0.22, dist: 10.4, tx: 0, tt: 0.1, ty: 0, fov: 34 },
  combCamera: { az: 0.75, el: 0.3, dist: 9.6, tx: 0.2, tt: 0.5, ty: 0 },
  holeCamera: { az: 0.22, el: 0.16, dist: 8.6, tx: 1.35, tt: 0.05, ty: 0 },
  fallCamera: { az: 0.32, el: 0.18, dist: 7.9, tx: 1.05, tt: 0.3, ty: 0 },
  /** Hours per bead on every clock. */
  beadHours: 3,
  clockColour: { ground: PAL.cool, everest: PAL.moon, iss: PAL.a, gps: PAL.b, geo: PAL.green } as Record<
    string,
    RGB
  >,
  clockPhase: { ground: -0.15, everest: 0.4, iss: 1.9, gps: 4.1, geo: 2.5 } as Record<string, number>,
  earthColour: [0.32, 0.58, 1.0] as RGB,
  horizonColour: [1.0, 0.42, 0.3] as RGB,
  coneH: 0.3,
  rayStarts: [1.55, 1.18, 1.0, 0.82, 0.5] as readonly number[],
  infallTau: 0.5,
};

/** Display radius and angle of a clock at coordinate time t (display units). */
function clockPos(id: string, rM: number, t: number): [number, number] {
  const r = displayRadius(rM / R_EARTH_M) + (id === 'everest' ? 0.05 : 0);
  const a = (params.clockPhase[id] ?? 0) + (2 * Math.PI * (t - T0)) / periodUnits(id, rM);
  return [r * Math.cos(a), r * Math.sin(a)];
}

/** Coordinate time at which a clock reads `hours` since T0 (rates exaggerated on screen). */
function tAtReading(rate: number, hours: number): number {
  return T0 + ((hours / 24) * DAY_UNITS) / (1 + RATE_EXAGGERATION * rate);
}

export default function curvedScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.earthCamera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let state = curvedState(0);

  const labels = new LabelSet([
    { id: 'earth', text: 'Earth, over one day', tone: 'plain', side: 'right', size: 'sm' },
    ...COMB.map((c) => ({
      id: c.id,
      text: c.label,
      tone: 'plain' as const,
      side: (c.id === 'gps' || c.id === 'ground' ? 'left' : 'right') as 'left' | 'right',
      size: 'sm' as const,
    })),
    { id: 'rung', text: 'Sea-level clock reads 24 hours', tone: 'warm', side: 'right', size: 'sm' },
    { id: 'factor', text: 'Clock rates × 200 million', tone: 'mute', side: 'center', size: 'sm' },
    { id: 'horizon', text: 'Horizon', tone: 'warm', side: 'left', size: 'sm' },
    { id: 'sing', text: 'Singularity, r = 0', tone: 'warm', side: 'left', size: 'sm' },
    { id: 'far', text: 'Far away: upright', tone: 'light', side: 'above', size: 'sm' },
    { id: 'edge', text: 'Horizon: outward light stands still', tone: 'light', side: 'right', size: 'sm' },
    { id: 'inside', text: 'Inside: every future points inward', tone: 'light', side: 'left', size: 'sm' },
    { id: 'faller', text: 'Falling observer', tone: 'a', side: 'right', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  // Earth group.
  let earthGlass: ReturnType<typeof createGlassBlock>;
  let earthTube: ReturnType<typeof createTube>;
  let clocks: ReturnType<typeof createRibbons>;
  let beads: ReturnType<typeof createEvents>;
  let stems: ReturnType<typeof createRibbons>;
  let finish: ReturnType<typeof createKnife>;
  const beadCounts: number[] = [];
  const topPos: [number, number, number][] = [];
  // Hole group.
  let holeGlass: ReturnType<typeof createGlassBlock>;
  let horizon: ReturnType<typeof createTube>;
  let hole: ReturnType<typeof createRibbons>;
  let cones: ReturnType<typeof createSkewCones>;
  let faller: ReturnType<typeof createEvents>;
  let fallBeads: { t: number; p: [number, number, number] }[] = [];
  let coneTs: number[] = [];
  const RAY0 = 2; // index of the first light ray in `hole`
  const FALLER = 1;

  const self: BlockScene = {
    id: 'curved',
    status: 'measured',
    statusNote: curved.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;

      // ── Earth ──────────────────────────────────────────────────────────────
      earthGlass = createGlassBlock(kit, EB, { grid: 1, gridT: DAY_UNITS / 4 });
      earthGlass.add(scene);
      disposers.push(earthGlass.dispose);
      earthTube = createTube(kit, {
        r: displayRadius(1) - 0.02,
        t0: T0,
        t1: T1,
        colour: params.earthColour,
        ringEvery: DAY_UNITS / 4,
        meridians: 12,
        period: periodUnits('ground', R_EARTH_M),
        fill: 0.05,
        rim: 0.6,
      });
      scene.add(earthTube.mesh);
      disposers.push(earthTube.dispose);

      const paths: PathSpec[] = COMB.map((c) => {
        const n = c.id === 'iss' ? 900 : 260;
        const pts: number[][] = [];
        for (let i = 0; i < n; i++) {
          const t = T0 + ((T1 - T0) * i) / (n - 1);
          const [x, y] = clockPos(c.id, c.rM, t);
          pts.push([x, t, y]);
        }
        return {
          points: pts,
          colour: params.clockColour[c.id]!,
          width: c.id === 'iss' ? 0.014 : 0.024,
          intensity: c.id === 'iss' ? 0.7 : 1.0,
        };
      });
      clocks = createRibbons(kit, paths);
      scene.add(clocks.mesh);
      disposers.push(clocks.dispose);

      // Beads every 3 hours of each clock's own reading.
      const beadSpecs: EventSpec[] = [];
      COMB.forEach((c) => {
        let k = 0;
        for (let h = 0; ; h += params.beadHours) {
          const t = tAtReading(c.rate, h);
          if (t > T1 + 1e-6) break;
          const [x, y] = clockPos(c.id, c.rM, t);
          beadSpecs.push({ p: [x, t, y], colour: params.clockColour[c.id]!, size: 0.08, intensity: 1.2 });
          k++;
        }
        beadCounts.push(k);
        const t24 = tAtReading(c.rate, 24);
        const [x, y] = clockPos(c.id, c.rM, t24);
        topPos.push([x, t24, y]);
      });
      // The 24-hour marks, larger.
      topPos.forEach((p, i) =>
        beadSpecs.push({ p, colour: params.clockColour[COMB[i]!.id]!, size: 0.15, intensity: 1.6 }),
      );
      beads = createEvents(kit, beadSpecs, ctx.globals.uElapsed, { pulse: 0.04 });
      scene.add(beads.object);
      disposers.push(beads.dispose);

      // The comb: a finish line where the sea-level clock reads 24 hours, and a tooth from each clock's own 24-hour
      // mark to it (below: that clock got there first; above: it got there later).
      const tFinish = tAtReading(0, 24);
      stems = createRibbons(
        kit,
        topPos.map((p, i) => ({
          points: [
            [p[0], p[1], p[2]],
            [p[0], tFinish, p[2]],
          ],
          colour: params.clockColour[COMB[i]!.id]!,
          width: 0.022,
          intensity: 1.3,
          spacelike: true,
          sliceResponse: 0,
        })),
      );
      scene.add(stems.mesh);
      disposers.push(stems.dispose);
      finish = createKnife(kit, EB, { colour: PAL.bowl, grid: 1 });
      finish.set(0, tFinish, 0);
      scene.add(finish.mesh);
      disposers.push(finish.dispose);

      // ── Black hole (r_s = RS display units; t̃ in the same scale) ───────────
      holeGlass = createGlassBlock(kit, HB, { grid: RS, gridT: 1 });
      holeGlass.add(scene);
      disposers.push(holeGlass.dispose);
      horizon = createTube(kit, {
        r: RS,
        t0: HB.t0,
        t1: HB.t1,
        colour: params.horizonColour,
        ringEvery: 0.5,
        fill: 0.012,
        rim: 0.32,
      });
      scene.add(horizon.mesh);
      disposers.push(horizon.dispose);

      const raySpecs: PathSpec[] = params.rayStarts.map((r0) => {
        // Outgoing light: dr/dt̃ = (r − 1)/(r + 1) in units of r_s; stops at the singularity.
        const pts: number[][] = [];
        let r = r0;
        const dt = 0.01;
        for (let t = HB.t0 / RS; t <= HB.t1 / RS + 1e-9; t += dt) {
          pts.push([r * RS, t * RS, 0]);
          if (r <= 0) break;
          r = Math.max(0, r + ((r - 1) / (r + 1)) * dt);
          if (r * RS > HB.x1) break;
        }
        while (pts.length < 2) pts.push([...pts[0]!]);
        return { points: pts, colour: PAL.light, width: 0.016, intensity: 1.1 };
      });
      const fallPts = FALL.map((f) => [f.r * RS, f.t * RS, 0]);
      hole = createRibbons(kit, [
        {
          points: [
            [0, HB.t0, 0],
            [0, HB.t1, 0],
          ],
          colour: [1.0, 0.36, 0.28],
          width: 0.05,
          intensity: 1.6,
        },
        { points: fallPts, colour: PAL.a, width: 0.03, intensity: 1.3 },
        ...raySpecs,
      ]);
      scene.add(hole.mesh);
      disposers.push(hole.dispose);

      // The observer's own light cones at points along the fall, plus one far away for reference (first).
      const coneTAt = (r: number) => (FALL.find((f) => f.r <= r) ?? FALL.at(-1)!).t * RS;
      coneTs = [0.1, ...CONE_RADII.map(coneTAt)];
      cones = createSkewCones(
        kit,
        [
          { r: FAR_CONE_R, x: FAR_CONE_R * RS, t: 0.1 },
          ...CONE_RADII.map((r, i) => ({ r, x: r * RS, t: coneTs[i + 1]! })),
        ],
        params.coneH,
        PAL.light,
      );
      scene.add(cones.mesh);
      disposers.push(cones.dispose);

      // Proper-time beads on the falling observer.
      fallBeads = [];
      for (let k = 1, i = 0; i < FALL.length; i++) {
        if (FALL[i]!.tau >= k * params.infallTau) {
          fallBeads.push({ t: FALL[i]!.t * RS, p: [FALL[i]!.r * RS, FALL[i]!.t * RS, 0] });
          k++;
        }
      }
      faller = createEvents(
        kit,
        [
          { p: [FALL[0]!.r * RS, FALL[0]!.t * RS, 0], colour: PAL.a, size: 0.16, intensity: 1.6 },
          ...fallBeads.map((b) => ({ p: b.p, colour: PAL.a, size: 0.08, intensity: 1.2 })),
        ],
        ctx.globals.uElapsed,
      );
      scene.add(faller.object);
      disposers.push(faller.dispose);

      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = curvedState(local);
      const s = state;
      const e = smooth(s.earth);
      const h = smooth(s.hole);
      // Earth group.
      earthGlass.opacity.value = e;
      earthGlass.edges.opacity.value = e;
      earthTube.opacity.value = e;
      clocks.opacity.value = e;
      COMB.forEach((_, i) => clocks.set(i, s.clocks, 1));
      beads.opacity.value = e * s.clocks;
      stems.opacity.value = e;
      // Unrevealed paths get zero intensity (the ribbon's writing head would otherwise glow at their start).
      COMB.forEach((_, i) => stems.set(i, s.rungs, s.rungs > 1e-3 ? 1 : 0));
      finish.opacity.value = e * s.rungs * 0.7;
      kit.setKnife(0, 0, tAtReading(0, 24), e * s.rungs * 0.8, PAL.bowl);
      // Hole group.
      holeGlass.opacity.value = h;
      holeGlass.edges.opacity.value = h;
      horizon.opacity.value = h;
      hole.opacity.value = h;
      hole.set(0, 1, 1);
      params.rayStarts.forEach((_, i) => hole.set(RAY0 + i, s.rays, s.rays > 1e-3 ? 1 : 0));
      cones.opacity.value = h;
      // The far cone appears with the fall; each of the observer's cones as the observer reaches it.
      const tNow = s.fallT * RS;
      let shown = s.fall;
      for (let i = 1; i < coneTs.length; i++)
        shown += Math.min(1, Math.max(0, (tNow - coneTs[i]! + 0.05) / 0.15));
      cones.shown.value = shown;
      // The falling observer, drawn up to the current coordinate time.
      let idx = 0;
      while (idx < FALL.length - 1 && FALL[idx + 1]!.t <= s.fallT) idx++;
      const along = idx / (FALL.length - 1);
      hole.set(FALLER, s.fall > 0 ? along : 0, s.fall > 1e-3 ? 1 : 0);
      const head = FALL[idx]!;
      faller.setPos(0, head.r * RS, head.t * RS, 0);
      faller.setIntensity(0, s.fall * 1.6);
      fallBeads.forEach((b, i) => faller.setIntensity(i + 1, b.t <= head.t * RS + 1e-6 ? 1.2 * s.fall : 0));
      faller.commit();
      faller.opacity.value = h;

      // Camera: Earth → comb → black hole → follow the fall.
      const ec = params.earthCamera;
      const cc = params.combCamera;
      const hc = params.holeCamera;
      const fc = params.fallCamera;
      const kc = smooth(s.rungs) * e;
      const kf = smooth(s.fall);
      const mix = (key: 'az' | 'el' | 'dist' | 'tx' | 'tt' | 'ty') => {
        const earth = ec[key] + (cc[key] - ec[key]) * kc;
        const holeV = hc[key] + (fc[key] - hc[key]) * kf;
        return earth + (holeV - earth) * h;
      };
      rig.apply(
        { az: mix('az'), el: mix('el'), dist: mix('dist'), tx: mix('tx'), tt: mix('tt'), ty: mix('ty') },
        elapsed,
      );
      placeLabels(fallRAt(s.fallT));
    },

    render(target: RenderTarget) {
      renderer.setRenderTarget(target);
      renderer.render(scene, rig.camera);
    },

    resize(w, h) {
      rig.resize(w, h);
    },

    dispose() {
      for (const d of disposers) d();
    },
  };

  function placeLabels(rFall: number) {
    const s = state;
    const cam = rig.camera;
    const e = smooth(s.earth);
    const h = smooth(s.hole);
    const place = (i: number, x: number, t: number, y: number, o: number) => {
      kit.viewCPU(x, t, y, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, cam, o);
    };
    const r0 = displayRadius(1);
    place(L.earth!, r0 * 0.7, T0 + 0.05, -r0 * 0.7, e * (1 - s.clocks * 0.6));
    // Each clock is named at its own 24-hour mark.
    COMB.forEach((c, i) => {
      const p = topPos[i]!;
      place(L[c.id]!, p[0], p[1], p[2], e * s.clocks);
    });
    place(L.rung!, EB.x1, tAtReading(0, 24), EB.y1, e * s.rungs);
    labels.placeScreen(L.factor!, 0.5, 0.93, e * s.clocks);
    // Hole.
    place(L.horizon!, -RS, HB.t1 - 0.25, 0, h);
    place(L.sing!, 0, HB.t0 + 0.2, 0, h);
    const ch = params.coneH + 0.04;
    const shownCone = (i: number) => Math.min(1, Math.max(0, (s.fallT * RS - coneTs[i]! + 0.05) / 0.15));
    place(L.far!, FAR_CONE_R * RS, coneTs[0]! + ch, 0, h * s.fall);
    const iH = 1 + CONE_RADII.indexOf(1.0);
    place(L.edge!, RS, coneTs[iH]! + ch, 0, h * shownCone(iH));
    const iIn = CONE_RADII.length;
    place(L.inside!, CONE_RADII[iIn - 1]! * RS, coneTs[iIn]! - ch, 0, h * shownCone(iIn));
    place(
      L.faller!,
      rFall * RS,
      Math.min(s.fallT, FALL.at(-1)!.t) * RS,
      0,
      h * s.fall * (rFall > 0.02 ? 1 : 0.4),
    );
  }

  return self;
}
