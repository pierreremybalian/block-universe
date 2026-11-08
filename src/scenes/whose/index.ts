// Stage 6 · Whose now? — Two Knives, the Diptych and the Reshuffle (HANDOFF §9, §10.6).
// A is at rest at the centre of the shared block; B passes through the same here-now at speed β. Each slices the
// block into "nows" at its own angle; lamps that flash in A's now are not in B's. Then the block is shown side by
// side in A's frame and in B's frame: the knives swap roles, light cones do not move.

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { renderPanels } from '../../shared/block/panels.ts';
import { LabelSet, type Panel } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { BEACONS, CAUSAL, PLANET, STAR, WORLD, beacon, planetAt } from '../../shared/world.ts';
import { whose, whoseState } from '../../script/whose.ts';
import { smooth } from '../../time/tracks.ts';

const params = {
  camera: { az: 0.62, el: 0.3, dist: 10.2, fov: 34 },
  /** Camera in the diptych (each panel is half as wide). */
  splitCamera: { az: 0.14, el: 0.16, dist: 13.6 },
  pullCamera: { az: 0.9, el: 0.42, dist: 12.5 },
  tick: 0.5,
  knifeWidth: 0.06,
  stationIntensity: 0.32,
  beaconSize: 0.16,
};

export default function whoseScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  const bPts = [
    [0, WORLD.t0, 0],
    [0, WORLD.t1, 0],
  ];
  let state = whoseState(0);
  let elapsedNow = 0;

  const labels = new LabelSet([
    { id: 'A', text: 'A', tone: 'a', side: 'above' },
    { id: 'B', text: 'B', tone: 'b', side: 'above' },
    { id: 'here', text: 'here-now', tone: 'both', side: 'right', size: 'sm' },
    { id: 'nowA', text: 'A’s now', tone: 'a', side: 'left', size: 'sm' },
    { id: 'nowB', text: 'B’s now', tone: 'b', side: 'right', size: 'sm' },
    { id: 'frameA', text: 'In A’s frame', tone: 'a', side: 'center', size: 'sm' },
    { id: 'frameB', text: 'In B’s frame', tone: 'b', side: 'center', size: 'sm' },
    ...BEACONS.map((b) => ({ id: `b${b.n}`, text: String(b.n), tone: 'event' as const, side: 'right' as const, size: 'sm' as const })),
  ]);
  const L = {
    A: labels.index('A'),
    B: labels.index('B'),
    here: labels.index('here'),
    nowA: labels.index('nowA'),
    nowB: labels.index('nowB'),
    frameA: labels.index('frameA'),
    frameB: labels.index('frameB'),
  };

  let ribbons: ReturnType<typeof createRibbons>;
  let knifeA: ReturnType<typeof createKnife>;
  let knifeB: ReturnType<typeof createKnife>;
  let cone: ReturnType<typeof createLightCone>;
  const PATH = { A: 0, B: 1 };

  const panelsSingle: Panel[] = [{ x: 0, y: 0, w: 1, h: 1 }];
  const panelsSplit: Panel[] = [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ];

  const self: BlockScene = {
    id: 'whose',
    status: 'established',
    statusNote: whose.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      const glass = createGlassBlock(kit, WORLD, { grid: 1 });
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
        intensity: params.stationIntensity,
      }));
      const causal = CAUSAL.map((c) => {
        const a = beacon(c.from);
        const b = beacon(c.to);
        return {
          points: [
            [a.x, a.t, a.y],
            [b.x, b.t, b.y],
          ],
          colour: c.kind === 'light' ? PAL.light : PAL.line,
          width: 0.022,
          intensity: c.kind === 'light' ? 1.4 : 0.8,
          dashed: c.kind === 'messenger' ? 0.12 : 0,
          spacelike: true,
          sliceResponse: 0,
        };
      });
      ribbons = createRibbons(kit, [
        { points: bPts.map((p) => [...p]), colour: PAL.a, width: 0.04, tick: params.tick, intensity: 1.3 },
        { points: bPts.map((p) => [...p]), colour: PAL.b, width: 0.04, tick: params.tick, intensity: 1.3 },
        { points: [[STAR.x, WORLD.t0, STAR.y], [STAR.x, WORLD.t1, STAR.y]], colour: STAR.colour, width: 0.05, intensity: 0.7 },
        { points: sampleWorldline(planetAt, WORLD.t0, WORLD.t1, 260), colour: PLANET.colour, width: 0.022, intensity: 0.55 },
        ...stations,
        ...causal,
      ]);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      const ev = createEvents(
        kit,
        [
          { p: [0, 0, 0], colour: PAL.both, size: 0.15, intensity: 1.15 },
          ...BEACONS.map((b) => ({ p: [b.x, b.t, b.y] as const, colour: b.colour, size: params.beaconSize, intensity: 1.1 })),
        ],
        ctx.globals.uElapsed,
      );
      scene.add(ev.object);
      disposers.push(ev.dispose);

      knifeA = createKnife(kit, WORLD, { colour: PAL.a, grid: 1 });
      knifeB = createKnife(kit, WORLD, { colour: PAL.b, grid: 1 });
      scene.add(knifeA.mesh, knifeB.mesh);
      disposers.push(knifeA.dispose, knifeB.dispose);
      kit.knives[0].width.value = params.knifeWidth;
      kit.knives[1].width.value = params.knifeWidth;

      cone = createLightCone(kit, { rings: 4 });
      cone.height.value = 1.5;
      cone.opacity.value = 0;
      scene.add(cone.mesh);
      disposers.push(cone.dispose);

      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      elapsedNow = elapsed;
      state = whoseState(local);
      const s = state;
      // B's worldline swings with its speed.
      bPts[0]![0] = s.beta * WORLD.t0;
      bPts[1]![0] = s.beta * WORLD.t1;
      ribbons.update(PATH.B, bPts);
      ribbons.set(PATH.A, 1, 1);
      ribbons.set(PATH.B, 1, s.bLine, 0, 0);
      knifeA.set(0, s.knifeA, s.knifeAOn);
      knifeB.set(s.beta, 0, s.knifeBOn);
      kit.setKnife(0, 0, s.knifeA, s.knifeAOn);
      kit.setKnife(1, s.beta, 0, s.knifeBOn);
      cone.opacity.value = 0.25 + 0.75 * s.split;

      // Camera: one view, then the diptych (wider), then a calm pull back.
      const c = params.camera;
      const sp = params.splitCamera;
      const pc = params.pullCamera;
      const k = smooth(s.split);
      rig.apply(
        {
          az: c.az + (sp.az - c.az) * k + (pc.az - c.az) * s.pull,
          el: c.el + (sp.el - c.el) * k + (pc.el - c.el) * s.pull,
          dist: c.dist + (sp.dist - c.dist) * k + (pc.dist - c.dist) * s.pull,
          tx: 0,
          tt: 0,
          ty: 0,
        },
        elapsed,
      );
      updatePanels(k);
    },

    render(target: RenderTarget) {
      const k = smooth(state.split);
      if (k < 0.002) {
        kit.setBeta(0);
        renderer.setRenderTarget(target);
        renderer.render(scene, rig.camera);
        return;
      }
      renderPanels(renderer, target, scene, rig.camera, panelsSplit, (i) => kit.setBeta(i === 0 ? 0 : state.beta * k));
      kit.setBeta(0);
    },

    resize(w, h) {
      rig.resize(w, h);
    },

    dispose() {
      for (const d of disposers) d();
    },
  };

  /** Panel geometry for the split amount, and labels placed in the panel they belong to. */
  function updatePanels(k: number) {
    const s = state;
    const split = k > 0.002;
    const left = split ? panelsSplit[0]! : panelsSingle[0]!;
    // Place labels using A's view (left panel / full screen).
    const cam = rig.camera;
    const aspect0 = cam.aspect;
    if (split) {
      cam.aspect = aspect0 / 2;
      cam.updateProjectionMatrix();
    }
    kit.setBeta(0);
    const place = (i: number, x: number, t: number, y: number, o: number, panel: Panel) => {
      kit.viewCPU(x, t, y, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, cam, o, panel);
    };
    place(L.A, 0, WORLD.t1, 0, 1, left);
    place(L.here, 0, 0, 0, 1 - s.reshuffle * 0.5, left);
    place(L.nowA, WORLD.x0, s.knifeA, WORLD.y1, s.knifeAOn * (1 - k), left);
    place(L.B, s.beta * WORLD.t1, WORLD.t1, 0, s.bLine * (split ? 0 : 1), left);
    place(L.nowB, WORLD.x1, s.beta * WORLD.x1, WORLD.y1, s.knifeBOn * (split ? 0 : 1), left);
    BEACONS.forEach((b) => place(labels.index(`b${b.n}`), b.x, b.t, b.y, 0.85, left));
    labels.placeScreen(L.frameA, 0.25, 0.12, k);
    labels.placeScreen(L.frameB, 0.75, 0.12, k);
    if (split) {
      // B and B's now, drawn in B's frame on the right.
      kit.setBeta(s.beta * k);
      const right = panelsSplit[1]!;
      place(L.B, s.beta * WORLD.t1, WORLD.t1, 0, s.bLine, right);
      place(L.nowB, WORLD.x1, s.beta * WORLD.x1, WORLD.y1, s.knifeBOn, right);
      kit.setBeta(0);
      cam.aspect = aspect0;
      cam.updateProjectionMatrix();
    }
    void elapsedNow;
  }

  return self;
}
