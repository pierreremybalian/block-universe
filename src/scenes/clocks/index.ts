// Stage 4 · Moving clocks run slow — the twins, the Clock Ladder and the Spool (HANDOFF §9, §10.4).
// Home stays on Earth; the traveler flies to Proxima Centauri and back at 0.8c. Both worldlines carry a bead for
// every year their own clock ticks. Rungs join equal ages and lean further as the paths separate. At the reunion the
// traveler's bent path unwinds into a straight thread beside home's: in spacetime the straight path is the longest.

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL, type RGB } from '../../shared/block/palette.ts';
import { PROXIMA_LY } from '../../relativity/units.ts';
import { S, TRIP, TURN_YEARS, clocks, clocksState, travelerAge, travelerAtAge, travelerX } from '../../script/clocks.ts';
import { smoother } from '../../time/tracks.ts';

const HOME_T = TRIP.homeYears * S;
const smooth01 = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};
const PROX_X = PROXIMA_LY * S;
const AGES = Math.floor(TRIP.travelerYears);
const THREAD_N = 64;

const params = {
  bounds: { x0: -0.55, x1: PROX_X + 0.45, t0: -0.18, t1: HOME_T + 0.24, y0: -0.5, y1: 0.5 } as Bounds,
  camera: { az: 0.42, el: 0.16, dist: 8.3, tx: -0.45, tt: 2.2, ty: 0, fov: 34 },
  settleCamera: { az: 0.2, el: 0.1, dist: 8.8, tx: -0.5, tt: 2.15 },
  /** Narrow (portrait) screens: centre the block and step back so it fits the width. */
  portrait: { tx: 0.8, distScale: 1.28, ttLift: -0.3 },
  /** The unwound thread sits just right of the home line. */
  threadX: 0.17,
  rungColour: PAL.bowl as RGB,
  proxima: [1.0, 0.42, 0.3] as RGB,
  lineWidth: 0.034,
};

export default function clocksScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();

  const labels = new LabelSet([
    { id: 'earth', text: 'Earth', tone: 'plain', side: 'left' },
    { id: 'proxima', text: 'Proxima Centauri', tone: 'plain', side: 'above' },
    { id: 'dist', text: `${PROXIMA_LY.toFixed(1)} light-years`, tone: 'mute', side: 'below', size: 'sm' },
    { id: 'home', text: 'Home twin', tone: 'a', side: 'left' },
    { id: 'trav', text: 'Traveler · 0.8 c', tone: 'b', side: 'right' },
    { id: 'turn', text: 'Turnaround', tone: 'mute', side: 'right', size: 'sm' },
    { id: 'reunion', text: 'Reunion', tone: 'both', side: 'right', size: 'sm' },
    { id: 'beads', text: 'one bead = one year on that clock', tone: 'warm', side: 'right', size: 'sm' },
    { id: 'homeLen', text: `${TRIP.homeYears.toFixed(1)} years`, tone: 'a', side: 'left' },
    { id: 'travLen', text: `${TRIP.travelerYears.toFixed(1)} years`, tone: 'b', side: 'right' },
    { id: 'straight', text: 'straight path: longest time', tone: 'both', side: 'right', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  // Path indices.
  const P = { home: 0, trav: 1, prox: 2, dist: 3, rung0: 4, thread: 4 + AGES };
  const travPath = [
    [0, 0, 0],
    [PROX_X, TURN_YEARS * S, 0],
    [0, HOME_T, 0],
  ];
  // The thread: the traveler's path sampled evenly in home time, and its unwound (vertical) form.
  const threadFrom: number[][] = [];
  const threadTo: number[][] = [];
  const thread: number[][] = [];
  for (let i = 0; i < THREAD_N; i++) {
    const tY = (TRIP.homeYears * i) / (THREAD_N - 1);
    threadFrom.push([travelerX(tY) * S, tY * S, 0]);
    threadTo.push([params.threadX, travelerAge(tY) * S, 0]);
    thread.push([0, 0, 0]);
  }
  const rungEnds = Array.from({ length: AGES }, (_, i) => {
    const k = i + 1;
    const e = travelerAtAge(k);
    return { k, tTrav: e.t, x: e.x * S, t: e.t * S };
  });

  let ribbons: ReturnType<typeof createRibbons>;
  let events: ReturnType<typeof createEvents>;
  let state = clocksState(0);
  let aspect = 16 / 9;

  const self: BlockScene = {
    id: 'clocks',
    status: 'measured',
    statusNote: clocks.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      const B = params.bounds;
      const glass = createGlassBlock(kit, B, { grid: S, gridT: S });
      glass.gridOpacity.value = 0.55;
      glass.add(scene);
      disposers.push(glass.dispose);

      const paths: PathSpec[] = [
        { points: [[0, 0, 0], [0, HOME_T, 0]], colour: PAL.a, width: params.lineWidth, tick: S, intensity: 1.25 },
        { points: travPath, colour: PAL.b, width: params.lineWidth, tick: S, intensity: 1.25 },
        { points: [[PROX_X, B.t0, 0], [PROX_X, B.t1, 0]], colour: params.proxima, width: 0.026, intensity: 0.55 },
        { points: [[0, -0.06, 0], [PROX_X, -0.06, 0]], colour: PAL.cool, width: 0.012, intensity: 0.5, dashed: 0.08, spacelike: true },
        ...rungEnds.map((r) => ({
          points: [
            [0, r.k * S, 0],
            [r.x, r.t, 0],
          ],
          colour: params.rungColour,
          width: 0.014,
          intensity: 0.9,
          dashed: 0.07,
          spacelike: true,
        })),
        { points: threadFrom.map((p) => [...p]), colour: PAL.b, width: params.lineWidth, tick: S, intensity: 1.3 },
      ];
      ribbons = createRibbons(kit, paths);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      events = createEvents(
        kit,
        [
          { p: [0, 0, 0], colour: PAL.both, size: 0.12, intensity: 1.1 },
          { p: [PROX_X, TURN_YEARS * S, 0], colour: PAL.b, size: 0.11, intensity: 1.0 },
          { p: [0, HOME_T, 0], colour: PAL.both, size: 0.14, intensity: 1.3 },
        ],
        ctx.globals.uElapsed,
      );
      scene.add(events.object);
      disposers.push(events.dispose);
      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = clocksState(local);
      const s = state;
      const tY = s.tYears;
      const f = Math.min(1, tY / TRIP.homeYears);
      const sp = smoother(s.spool);

      ribbons.set(P.home, Math.max(0.0005, f), 1);
      // The bent original fades as its copy unwinds, so there is only one bright V on screen.
      const unwound = smooth01(sp / 0.3);
      ribbons.set(P.trav, Math.max(0.0005, f), 1 - 0.78 * unwound);
      ribbons.set(P.prox, 1, s.intro);
      ribbons.set(P.dist, 1, s.intro * (1 - s.reunion * 0.6));
      for (let i = 0; i < AGES; i++) {
        const r = rungEnds[i]!;
        const appear = Math.min(1, Math.max(0, (tY - r.tTrav) / 0.35));
        ribbons.set(P.rung0 + i, 1, appear * s.ladder * (1 - smooth01(sp / 0.35)));
      }
      // The Spool: interpolate the traveler's path into a straight vertical thread of its own proper time.
      for (let i = 0; i < THREAD_N; i++) {
        const a = threadFrom[i]!;
        const b = threadTo[i]!;
        const p = thread[i]!;
        p[0] = a[0]! + (b[0]! - a[0]!) * sp;
        p[1] = a[1]! + (b[1]! - a[1]!) * sp;
        p[2] = 0;
      }
      ribbons.update(P.thread, thread);
      ribbons.set(P.thread, 1, s.spool > 0.001 ? Math.min(1, s.spool * 6) : 0);

      events.setIntensity(0, s.intro * 1.1);
      events.setIntensity(1, tY >= TURN_YEARS ? 1.0 : 0);
      events.setIntensity(2, tY >= TRIP.homeYears - 0.01 ? 1.3 : 0);
      events.commit();

      const c = params.camera;
      const e = params.settleCamera;
      const k = s.settle;
      // 0 on wide screens, 1 on phones in portrait.
      const narrow = Math.min(1, Math.max(0, (1.2 - aspect) / 0.6));
      const pt = params.portrait;
      const tx = c.tx + (e.tx - c.tx) * k;
      const tt = c.tt + (e.tt - c.tt) * k;
      rig.apply(
        {
          az: c.az + (e.az - c.az) * k,
          el: c.el + (e.el - c.el) * k,
          dist: (c.dist + (e.dist - c.dist) * k) * (1 + (pt.distScale - 1) * narrow),
          tx: tx + (pt.tx - tx) * narrow,
          tt: tt + pt.ttLift * narrow,
          ty: 0,
        },
        elapsed,
      );
      placeLabels(tY, sp);
    },

    render(target: RenderTarget) {
      renderer.setRenderTarget(target);
      renderer.render(scene, rig.camera);
    },

    resize(w, h) {
      aspect = w / Math.max(1, h);
      rig.resize(w, h);
    },

    dispose() {
      for (const d of disposers) d();
    },
  };

  function placeLabels(tY: number, sp: number) {
    const s = state;
    const cam = rig.camera;
    const place = (i: number, x: number, t: number, y: number, o: number) => {
      kit.viewCPU(x, t, y, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, cam, o);
    };
    const journey = tY > 0.02 && tY < TRIP.homeYears - 0.02 ? 1 : 0;
    place(L.earth!, 0, 0, 0, s.intro * (1 - sp));
    place(L.proxima!, PROX_X, params.bounds.t1, 0, s.intro);
    place(L.dist!, PROX_X / 2, -0.06, 0, s.intro * (1 - s.reunion));
    place(L.home!, 0, tY * S, 0, journey);
    place(L.trav!, travelerX(tY) * S, tY * S, 0, journey);
    place(L.turn!, PROX_X, TURN_YEARS * S, 0, tY >= TURN_YEARS ? s.ladder : 0);
    place(L.reunion!, 0, HOME_T, 0, tY >= TRIP.homeYears - 0.01 ? 1 - smooth01(sp / 0.15) : 0);
    // Point at the traveler's second bead while the ladder is being built.
    const b2 = rungEnds[1]!;
    place(L.beads!, b2.x, b2.t, 0, tY > rungEnds[2]!.tTrav && tY < TRIP.homeYears * 0.92 ? s.ladder : 0);
    // The Spool's two labelled lengths, once the thread has mostly unwound (rungs are gone by then).
    const late = smooth01((sp - 0.55) / 0.3);
    place(L.homeLen!, 0, HOME_T, 0, late);
    place(L.travLen!, params.threadX, TRIP.travelerYears * S, 0, late);
    // Under the traveler's length; on phones the caption carries it instead (no room beside the block).
    place(L.straight!, params.threadX, TRIP.travelerYears * S - 0.22, 0, aspect < 0.9 ? 0 : late * (1 - s.measured));
  }

  return self;
}
