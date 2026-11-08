// Stage 9 · Everything, all at once (HANDOFF §9 Simultaneity Fan, §10.9).
// In the shared world block, the now-slices of every observer passing through here-now (−0.99c … +0.99c) sweep out
// a fan: the bow-tie outside the light cone. Each lamp the fan touches is "now" for someone and stays lit. Then one
// chain link: someone at lamp 5 moving at the right speed has A's own future in their now. Repeat from every event
// and nothing is left out: the whole block lights, and the camera pulls back to see it as one object.

import { Color, Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL, type RGB } from '../../shared/block/palette.ts';
import { BEACONS, PLANET, STAR, WORLD, beacon, planetAt } from '../../shared/world.ts';
import { CHAIN_LAMP, FAN_BLADES, FAN_MAX, FUTURE, chainBeta, eternal, eternalState } from '../../script/eternal.ts';

const params = {
  camera: { az: 0.2, el: 0.17, dist: 11.6, fov: 34 },
  chainCamera: { az: 0.42, el: 0.24, dist: 11.8 },
  pullCamera: { az: 1.1, el: 0.46, dist: 19 },
  /** Framing: the block a little right of centre, clear of the captions. */
  offset: { tx: -0.6, tt: -0.2 },
  /** In the pull-back, the block sits up and to the right, clear of the captions. */
  pullOffset: { tx: -2.2, tt: -0.9 },
  fanColour: [0.78, 0.74, 1.0] as RGB,
  fanOpacity: 0.12,
  sweepColour: PAL.both,
  litColour: [1.0, 0.86, 0.55] as RGB,
  tick: 0.5,
  chainHalf: 0.9,
};

export default function eternalScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let state = eternalState(0);
  const lamp = beacon(CHAIN_LAMP);
  const cBeta = chainBeta();
  const chainPts = [
    [lamp.x - cBeta * params.chainHalf, lamp.t - params.chainHalf, lamp.y],
    [lamp.x + cBeta * params.chainHalf, lamp.t + params.chainHalf, lamp.y],
  ];
  const fanBetas = Array.from({ length: FAN_BLADES }, (_, k) => -FAN_MAX + (2 * FAN_MAX * k) / (FAN_BLADES - 1));

  const labels = new LabelSet([
    { id: 'A', text: 'A', tone: 'a', side: 'above' },
    { id: 'here', text: 'here-now', tone: 'both', side: 'right', size: 'sm' },
    { id: 'cone', text: 'light cone', tone: 'light', side: 'right', size: 'sm' },
    { id: 'elseL', text: 'now for someone', tone: 'warm', side: 'center', size: 'sm' },
    { id: 'elseR', text: 'now for someone', tone: 'warm', side: 'center', size: 'sm' },
    { id: 'future', text: 'A’s future', tone: 'warm', side: 'right', size: 'sm' },
    { id: 'chain', text: `someone at lamp ${CHAIN_LAMP}`, tone: 'b', side: 'right', size: 'sm' },
    { id: 'all', text: 'no privileged now', tone: 'both', side: 'center', size: 'sm' },
    ...BEACONS.map((b) => ({ id: `b${b.n}`, text: String(b.n), tone: 'event' as const, side: 'right' as const, size: 'sm' as const })),
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  let ribbons: ReturnType<typeof createRibbons>;
  let events: ReturnType<typeof createEvents>;
  let glass: ReturnType<typeof createGlassBlock>;
  let sweep: ReturnType<typeof createKnife>;
  let chainKnife: ReturnType<typeof createKnife>;
  let cone: ReturnType<typeof createLightCone>;
  const blades: ReturnType<typeof createKnife>[] = [];
  const nPaths = { value: 0 };
  const E = { here: 0, future: 1, lamps: 2 };
  const P = { A: 0, chain: 1 };
  const glassTint0 = new Color(PAL.edge[0], PAL.edge[1], PAL.edge[2]);
  const glassTint1 = new Color(1.0, 0.9, 0.75);

  const self: BlockScene = {
    id: 'eternal',
    status: 'argument',
    statusNote: eternal.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      glass = createGlassBlock(kit, WORLD, { grid: 1 });
      glass.add(scene);
      disposers.push(glass.dispose);

      const stations = BEACONS.map((b) => ({
        points: [
          [b.x, WORLD.t0, b.y],
          [b.x, WORLD.t1, b.y],
        ],
        colour: PAL.cool,
        width: 0.02,
        tick: params.tick,
        intensity: 0.32,
      }));
      const paths = [
        { points: [[0, WORLD.t0, 0], [0, WORLD.t1, 0]], colour: PAL.a, width: 0.04, tick: params.tick, intensity: 1.2 },
        { points: chainPts.map((p) => [...p]), colour: PAL.b, width: 0.032, tick: params.tick, intensity: 1.3, sliceResponse: 0 },
        { points: [[STAR.x, WORLD.t0, STAR.y], [STAR.x, WORLD.t1, STAR.y]], colour: STAR.colour, width: 0.05, intensity: 0.7 },
        { points: sampleWorldline(planetAt, WORLD.t0, WORLD.t1, 260), colour: PLANET.colour, width: 0.022, intensity: 0.55 },
        ...stations,
      ];
      nPaths.value = paths.length;
      ribbons = createRibbons(kit, paths);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      events = createEvents(
        kit,
        [
          { p: [0, 0, 0], colour: PAL.both, size: 0.15, intensity: 1.15 },
          { p: [FUTURE.x, FUTURE.t, FUTURE.y], colour: params.litColour, size: 0.16, intensity: 0 },
          ...BEACONS.map((b) => ({ p: [b.x, b.t, b.y] as const, colour: b.colour, size: 0.15, intensity: 0.9 })),
        ],
        ctx.globals.uElapsed,
      );
      scene.add(events.object);
      disposers.push(events.dispose);

      for (const b of fanBetas) {
        const k = createKnife(kit, WORLD, { colour: params.fanColour, grid: 0 });
        k.set(b, 0, 0);
        blades.push(k);
        scene.add(k.mesh);
        disposers.push(k.dispose);
      }
      sweep = createKnife(kit, WORLD, { colour: params.sweepColour, grid: 1 });
      chainKnife = createKnife(kit, WORLD, { colour: PAL.b, grid: 1 });
      scene.add(sweep.mesh, chainKnife.mesh);
      disposers.push(sweep.dispose, chainKnife.dispose);
      kit.knives[0].width.value = 0.06;
      kit.knives[1].width.value = 0.06;

      cone = createLightCone(kit, { rings: 4 });
      cone.height.value = WORLD.t1;
      scene.add(cone.mesh);
      disposers.push(cone.dispose);

      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = eternalState(local);
      const s = state;
      const fade = s.fanFade;

      // The fan: blades appear as the sweep passes them; the sweeping knife lights what it cuts.
      blades.forEach((k, i) => {
        const passed = local >= 0.12 && s.beta >= fanBetas[i]! - 1e-9 ? 1 : 0;
        k.set(fanBetas[i]!, 0, passed * s.fanOn * params.fanOpacity * fade);
      });
      sweep.set(s.beta, 0, s.knife * 0.85);
      kit.setKnife(0, s.beta, 0, s.knife, params.sweepColour);
      const cc = lamp.t - cBeta * lamp.x;
      chainKnife.set(cBeta, cc, s.chainKnife * 0.85);
      kit.setKnife(1, cBeta, cc, s.chainKnife, PAL.b);
      cone.opacity.value = 0.42 * (1 - 0.7 * s.all);

      // Lamps that have been someone's now stay lit; in the end every event is.
      BEACONS.forEach((b, i) => {
        const on = Math.max(s.lit[i]!, s.all);
        events.setColour(E.lamps + i, on > 0 ? params.litColour : b.colour);
        events.setIntensity(E.lamps + i, 0.9 + 1.1 * on);
        events.setSize(E.lamps + i, 0.15 + 0.05 * on);
      });
      events.setIntensity(E.future, 1.8 * Math.max(s.future, s.all));
      events.commit();

      ribbons.set(P.chain, 1, s.chain * fade);
      for (let i = 0; i < nPaths.value; i++) {
        if (i === P.chain) continue;
        ribbons.set(i, 1, 1, 0, 0.9 * s.all);
      }
      glass.tint.value.copy(glassTint0).lerp(glassTint1, s.all * 0.8);
      // The whole block as one object: faces stay dark glass, edges and every worldline glow.
      glass.opacity.value = 1 - 0.35 * s.all;
      for (let i = 0; i < 6; i++) glass.edges.set(i, 1, 1 + 1.4 * s.all);

      const c = params.camera;
      const ch = params.chainCamera;
      const pc = params.pullCamera;
      const kc = s.chain * (1 - s.pull);
      rig.apply(
        {
          az: c.az + (ch.az - c.az) * kc + (pc.az - c.az) * s.pull,
          el: c.el + (ch.el - c.el) * kc + (pc.el - c.el) * s.pull,
          dist: c.dist + (ch.dist - c.dist) * kc + (pc.dist - c.dist) * s.pull,
          tx: params.offset.tx + (params.pullOffset.tx - params.offset.tx) * s.pull,
          tt: params.offset.tt + (params.pullOffset.tt - params.offset.tt) * s.pull,
          ty: 0,
        },
        elapsed,
      );

      kit.setBeta(0);
      const place = (i: number, x: number, t: number, y: number, o: number) => {
        kit.viewCPU(x, t, y, tmp);
        labels.place(i, tmp.x, tmp.y, tmp.z, rig.camera, o);
      };
      const quiet = 1 - s.pull;
      place(L.A!, 0, WORLD.t1, 0, quiet);
      place(L.here!, 0, 0, 0, quiet * (1 - s.all));
      place(L.cone!, 1.5, 1.5, 0, 0.8 * (1 - s.all) * quiet);
      place(L.elseL!, -2.55, -0.55, WORLD.y1, s.regions);
      place(L.elseR!, 2.55, 0.55, WORLD.y1, s.regions);
      place(L.future!, FUTURE.x, FUTURE.t, FUTURE.y, s.future * (1 - s.all));
      place(L.chain!, chainPts[1]![0]!, chainPts[1]![1]!, chainPts[1]![2]!, s.chain * fade);
      place(L.all!, 0, WORLD.t1 + 0.7, 0, s.pull);
      BEACONS.forEach((b) => place(L[`b${b.n}`]!, b.x, b.t, b.y, 0.8 * quiet * (1 - s.all * 0.5)));
    },

    render(target: RenderTarget) {
      kit.setBeta(0);
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
