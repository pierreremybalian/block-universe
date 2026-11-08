// Stage 1 · Time as we live it (presentism as lived). A single luminous "now" rises through darkness carrying the
// cast of the shared world: you (A), a star and its planet, the lamps. Behind it the past fades; above it there is
// nothing at all. The world's worldlines are drawn, but only the sliver at and just below the now exists.

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createRibbons, sampleWorldline, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { BEACONS, PLANET, STAR, WORLD, planetAt } from '../../shared/world.ts';
import { flow, flowState } from '../../script/flow.ts';
import { createNowSheet } from './sheet.ts';

const params = {
  camera: { az: 0.42, el: 0.11, dist: 7.2, fov: 34 },
  pullCamera: { az: 0.55, el: 0.2, dist: 9.6 },
  /** Camera target sits a little below the now so the trail reads. */
  targetBelow: 0.3,
  sheet: { rx: 8, ry: 6, core: 3.1, grid: 0.5 },
  lampIntensity: 0.55,
  /** Width of a lamp's flash in hours. */
  flashWidth: 0.06,
};

const span = WORLD.t1 - WORLD.t0;
const along = (t: number) => (t - WORLD.t0) / span;

export default function flowScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let ribbons: ReturnType<typeof createRibbons>;
  let events: ReturnType<typeof createEvents>;
  let sheet: ReturnType<typeof createNowSheet>;
  let nPaths = 0;

  const labels = new LabelSet([
    { id: 'now', text: 'now', tone: 'plain', side: 'left', size: 'sm' },
    { id: 'you', text: 'you', tone: 'a', side: 'above' },
    { id: 'star', text: 'a star', tone: 'mute', side: 'above', size: 'sm' },
    { id: 'planet', text: 'its planet', tone: 'mute', side: 'below', size: 'sm' },
    { id: 'past', text: 'the past · fading', tone: 'mute', side: 'left', size: 'sm' },
    { id: 'future', text: 'the future · nothing yet', tone: 'mute', side: 'left', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  // Event indices: 0 = you, 1 = star, 2 = planet, 3… = lamps.
  const EV = { you: 0, star: 1, planet: 2, lamps: 3 };

  const self: BlockScene = {
    id: 'flow',
    status: 'metaphor',
    statusNote: flow.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      sheet = createNowSheet(kit, { ...params.sheet, colour: PAL.both });
      scene.add(sheet.mesh);
      disposers.push(sheet.dispose);

      const paths: PathSpec[] = [
        { points: sampleWorldline(() => [0, 0], WORLD.t0, WORLD.t1, 2), colour: PAL.a, width: 0.035, intensity: 1.2 },
        { points: sampleWorldline(() => [STAR.x, STAR.y], WORLD.t0, WORLD.t1, 2), colour: STAR.colour, width: 0.05, intensity: 0.9 },
        { points: sampleWorldline(planetAt, WORLD.t0, WORLD.t1, 260), colour: PLANET.colour, width: 0.03, intensity: 0.9 },
        ...BEACONS.map((b) => ({
          points: sampleWorldline(() => [b.x, b.y], WORLD.t0, WORLD.t1, 2),
          colour: PAL.cool,
          width: 0.02,
          intensity: 0.45,
        })),
      ];
      nPaths = paths.length;
      ribbons = createRibbons(kit, paths);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      events = createEvents(
        kit,
        [
          { p: [0, 0, 0], colour: PAL.a, size: 0.17, intensity: 1.3 },
          { p: [STAR.x, 0, STAR.y], colour: STAR.colour, size: 0.3, intensity: 1.4 },
          { p: [0, 0, 0], colour: PLANET.colour, size: 0.13, intensity: 1.2 },
          ...BEACONS.map((b) => ({ p: [b.x, 0, b.y] as const, colour: PAL.line, size: 0.1, intensity: params.lampIntensity })),
        ],
        ctx.globals.uElapsed,
        { pulse: 0.05 },
      );
      scene.add(events.object);
      disposers.push(events.dispose);

      // The existence filter draws the afterimage: everything fades with distance from the now.
      kit.exist.present.value = 1;
      kit.exist.growing.value = 0;
      kit.knives[0].width.value = 0.05;
      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      const s = flowState(local);
      const now = s.now;
      sheet.now.value = now;
      kit.setKnife(0, 0, now, 0.4, PAL.both);
      kit.exist.presentWidth.value = s.afterimage;
      // Worldlines exist only up to the now (the hard edge) and fade below it (the afterimage).
      for (let i = 0; i < nPaths; i++) ribbons.set(i, along(now), s.cast);

      events.setPos(EV.you, 0, now, 0);
      events.setPos(EV.star, STAR.x, now, STAR.y);
      const [px, py] = planetAt(now);
      events.setPos(EV.planet, px, now, py);
      BEACONS.forEach((b, i) => {
        events.setPos(EV.lamps + i, b.x, now, b.y);
        const f = Math.exp(-(((now - b.t) / params.flashWidth) ** 2));
        events.setIntensity(EV.lamps + i, (params.lampIntensity + 4 * f) * s.cast);
        events.setSize(EV.lamps + i, 0.1 + 0.22 * f);
      });
      events.setIntensity(EV.you, 1.3 * s.cast);
      events.setIntensity(EV.star, 1.4 * s.cast);
      events.setIntensity(EV.planet, 1.2 * s.cast);
      events.commit();

      const c = params.camera;
      const pc = params.pullCamera;
      const k = s.pull;
      rig.apply(
        {
          az: c.az + (pc.az - c.az) * k,
          el: c.el + (pc.el - c.el) * k,
          dist: c.dist + (pc.dist - c.dist) * k,
          tx: 0,
          tt: now - params.targetBelow - 0.2 * k,
          ty: 0,
        },
        elapsed,
      );

      const place = (i: number, x: number, t: number, y: number, o: number) => {
        kit.viewCPU(x, t, y, tmp);
        labels.place(i, tmp.x, tmp.y, tmp.z, rig.camera, o);
      };
      place(L.now!, -2.6, now, 1.2, s.cast);
      place(L.you!, 0, now + 0.06, 0, s.cast);
      place(L.star!, STAR.x, now + 0.12, STAR.y, s.cast * 0.9);
      place(L.planet!, px, now - 0.05, py, s.cast * 0.9 * (1 - s.pastLabel));
      place(L.past!, 2.75, now - 0.5, -1.45, s.pastLabel);
      place(L.future!, 2.75, now + 0.55, -1.45, s.futureLabel);
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
  return self;
}
