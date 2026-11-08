// Stage 10 · Your worldline (HANDOFF §10.10). A life is a thread through the block from birth to age 80, beaded by
// decade. Head and feet are two threads; their clocks drift apart by 0.47 µs over a life (higher clocks run fast):
// the inset is a loupe that magnifies time gaps 10¹⁵× and shows the Clock Ladder going out of square. Then the arrow
// of time as a shape: an ink drop's history spreads upward through the block, and memories reach only downward.

import { PerspectiveCamera, Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { createPanelFrame, renderInPanel } from '../../shared/block/panels.ts';
import { LabelSet, type Panel } from '../../shared/block/labels.ts';
import { PAL, type RGB } from '../../shared/block/palette.ts';
import { mulberry32, gaussian } from '../../shared/math.ts';
import {
  LIFE_T0,
  LIFE_T1,
  ageOfT,
  headAheadS,
  lifeAt,
  loupeOffset,
  tOfAge,
  you,
  youState,
} from '../../script/you.ts';
import { LIFE_YEARS } from '../../relativity/units.ts';
import { smooth } from '../../time/tracks.ts';

const B: Bounds = { x0: -2.6, x1: 2.6, t0: LIFE_T0, t1: LIFE_T1, y0: -1.3, y1: 1.3 };

const params = {
  camera: { az: 0.42, el: 0.18, dist: 7.6, tx: -0.7, tt: 0, ty: 0, fov: 34 },
  loupeCamera: { az: 0.3, el: 0.1, dist: 7.2, tx: 0.55, tt: 0.05, ty: 0 },
  inkCamera: { az: 0.78, el: 0.16, dist: 8.4, tx: 0.45, tt: 0.15, ty: 0 },
  pullCamera: { az: 0.62, el: 0.34, dist: 10.6, tx: 0.1, tt: 0, ty: 0 },
  headFeetGap: 0.045,
  ink: { x: 1.35, y: -0.15, tDrop: -1.55, particles: 72, samples: 64 },
  inkColour: [0.3, 0.46, 1.0] as RGB,
  memoryColour: [1.0, 0.82, 0.55] as RGB,
  memories: [
    [80, 5],
    [80, 31],
    [60, 12],
    [60, 41],
    [40, 22],
    [27, 6],
  ] as const,
  /** Inset: head and feet threads drawn this far apart (not to scale). */
  insetGap: 0.5,
};

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

export default function youScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const insetScene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const insetCam = new PerspectiveCamera(28, 0.6, 0.1, 100);
  const kit = createKit();
  const insetKit = createKit();
  const frame = createPanelFrame([0.95, 0.85, 0.65]);
  const disposers: (() => void)[] = [frame.dispose];
  const tmp = new Vector3();
  let state = youState(0);
  let inset: Panel = { x: 0.6, y: 0.16, w: 0.32, h: 0.64 };
  let aspect = 16 / 9;
  let lastAgeShown = -1;

  const decades = Array.from({ length: LIFE_YEARS / 10 + 1 }, (_, k) => k * 10);
  const labels = new LabelSet([
    { id: 'born', text: 'Born', tone: 'plain', side: 'left', size: 'sm' },
    { id: 'old', text: 'Age 80', tone: 'plain', side: 'left', size: 'sm' },
    { id: 'head', text: 'Head', tone: 'warm', side: 'right', size: 'sm' },
    { id: 'feet', text: 'Feet', tone: 'b', side: 'right', size: 'sm' },
    { id: 'ink', text: 'A drop of ink, released', tone: 'b', side: 'right', size: 'sm' },
    { id: 'inkTop', text: 'Spread out: high entropy', tone: 'mute', side: 'right', size: 'sm' },
    { id: 'now', text: 'A now', tone: 'a', side: 'right', size: 'sm' },
    { id: 'iFactor', text: 'Loupe · time gaps × 10¹⁵', tone: 'plain', side: 'center', size: 'sm' },
    { id: 'iHead', text: 'Head', tone: 'warm', side: 'above', size: 'sm' },
    { id: 'iFeet', text: 'Feet', tone: 'b', side: 'above', size: 'sm' },
    { id: 'iGap', text: '', tone: 'warm', side: 'right', size: 'md' },
    ...decades.slice(1, -1).map((a) => ({
      id: `d${a}`,
      text: String(a),
      tone: 'mute' as const,
      side: 'left' as const,
      size: 'sm' as const,
    })),
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  let life: ReturnType<typeof createRibbons>;
  let beads: ReturnType<typeof createEvents>;
  let ink: ReturnType<typeof createRibbons>;
  let inkDrop: ReturnType<typeof createEvents>;
  let memories: ReturnType<typeof createRibbons>;
  let knife: ReturnType<typeof createKnife>;
  let glass: ReturnType<typeof createGlassBlock>;
  let insetLines: ReturnType<typeof createRibbons>;
  let insetBeads: ReturnType<typeof createEvents>;
  const inkTops: number[][] = [];

  const at = (t: number): [number, number, number] => {
    const [x, y] = lifeAt(t);
    return [x, t, y];
  };

  const self: BlockScene = {
    id: 'you',
    status: 'measured',
    statusNote: you.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      glass = createGlassBlock(kit, B, { grid: 0.5 });
      glass.add(scene);
      disposers.push(glass.dispose);

      // 0: the life; 1: head; 2: feet (the life splits into two threads).
      const lifePts = sampleWorldline(lifeAt, LIFE_T0, LIFE_T1, 240);
      const shift = (dy: number) => lifePts.map((p) => [p[0]!, p[1]!, p[2]! + dy]);
      life = createRibbons(kit, [
        { points: lifePts, colour: PAL.line, width: 0.04, intensity: 1.25 },
        { points: shift(params.headFeetGap), colour: PAL.bowl, width: 0.026, intensity: 1.1 },
        { points: shift(-params.headFeetGap), colour: PAL.b, width: 0.026, intensity: 1.0 },
      ]);
      scene.add(life.mesh);
      disposers.push(life.dispose);

      beads = createEvents(
        kit,
        decades.map((a) => ({
          p: at(tOfAge(a)),
          colour: a === 0 ? PAL.both : PAL.line,
          size: a === 0 || a === LIFE_YEARS ? 0.17 : 0.11,
          intensity: 1.2,
        })),
        ctx.globals.uElapsed,
      );
      scene.add(beads.object);
      disposers.push(beads.dispose);

      // The ink drop: particles diffuse outward (spread ∝ √t) along gently wandering paths.
      const rnd = mulberry32(11);
      const { x: cx, y: cy, tDrop, particles, samples } = params.ink;
      const inkPaths: PathSpec[] = [];
      for (let i = 0; i < particles; i++) {
        const phi = rnd() * Math.PI * 2;
        const rho = Math.min(1.5, Math.abs(gaussian(rnd))) * 0.85 + 0.06;
        const w1 = rnd() * 6.28;
        const w2 = 1.2 + rnd() * 1.6;
        const pts: number[][] = [];
        for (let k = 0; k < samples; k++) {
          const t = tDrop + ((LIFE_T1 - tDrop) * k) / (samples - 1);
          const sigma = 0.03 + 0.8 * Math.sqrt(Math.max(0, (t - tDrop) / (LIFE_T1 - tDrop)));
          const a = phi + 0.35 * Math.sin(w2 * t + w1) * Math.min(1, sigma * 2);
          pts.push([cx + sigma * rho * Math.cos(a), t, cy + sigma * rho * Math.sin(a) * 0.8]);
        }
        inkTops.push(pts.at(-1)!);
        const hue = rnd();
        const c: RGB = [
          params.inkColour[0] + hue * 0.2,
          params.inkColour[1] + hue * 0.15,
          params.inkColour[2],
        ];
        inkPaths.push({ points: pts, colour: c, width: 0.011, intensity: 0.38, sliceResponse: 0.6 });
      }
      ink = createRibbons(kit, inkPaths);
      scene.add(ink.mesh);
      disposers.push(ink.dispose);
      inkDrop = createEvents(
        kit,
        [{ p: [cx, tDrop, cy], colour: params.inkColour, size: 0.2, intensity: 1.6 }],
        ctx.globals.uElapsed,
      );
      scene.add(inkDrop.object);
      disposers.push(inkDrop.dispose);

      // Memories: arcs from later moments of the life down to earlier ones (records point to the past).
      const memPaths: PathSpec[] = params.memories.map(([later, earlier]) => {
        const a = at(tOfAge(later));
        const b = at(tOfAge(earlier));
        // Arcs bow out to one side (away from the ink), wider for older memories.
        const bulge = 0.12 + (0.55 * (later - earlier)) / LIFE_YEARS;
        const pts: number[][] = [];
        for (let k = 0; k <= 40; k++) {
          const s = k / 40;
          const w = Math.sin(Math.PI * s);
          pts.push([
            lerp(a[0], b[0], s) - bulge * w,
            lerp(a[1], b[1], s),
            lerp(a[2], b[2], s) - bulge * 0.25 * w,
          ]);
        }
        return {
          points: pts,
          colour: params.memoryColour,
          width: 0.012,
          intensity: 0.6,
          spacelike: true,
          sliceResponse: 1,
        };
      });
      memories = createRibbons(kit, memPaths);
      scene.add(memories.mesh);
      disposers.push(memories.dispose);

      knife = createKnife(kit, B, { colour: PAL.a, grid: 0.5 });
      scene.add(knife.mesh);
      disposers.push(knife.dispose);
      kit.knives[0].width.value = 0.05;

      // Inset (the loupe): feet on the left, head on the right; rung k joins the moments each clock reads k decades.
      // The head reads each birthday a little earlier; the gap is magnified 10¹⁵ times.
      const g = params.insetGap;
      const rungPaths: PathSpec[] = decades.slice(1).map((a) => ({
        points: [
          [-g, tOfAge(a), 0],
          [g, tOfAge(a) - loupeOffset(a), 0],
        ],
        colour: PAL.bowl,
        width: 0.016,
        intensity: 0.9,
        spacelike: true,
      }));
      insetLines = createRibbons(insetKit, [
        {
          points: [
            [-g, LIFE_T0, 0],
            [-g, LIFE_T1, 0],
          ],
          colour: PAL.b,
          width: 0.03,
          intensity: 1.1,
        },
        {
          points: [
            [g, LIFE_T0, 0],
            [g, LIFE_T1, 0],
          ],
          colour: PAL.bowl,
          width: 0.03,
          intensity: 1.1,
        },
        {
          points: [
            [-g, LIFE_T1, 0],
            [g, LIFE_T1, 0],
          ],
          colour: PAL.edge,
          width: 0.01,
          intensity: 0.7,
          spacelike: true,
          dashed: 0.06,
        },
        ...rungPaths,
      ]);
      insetScene.add(insetLines.mesh);
      disposers.push(insetLines.dispose);
      insetBeads = createEvents(
        insetKit,
        decades.flatMap((a) => [
          { p: [-g, tOfAge(a), 0] as const, colour: PAL.b, size: 0.1, intensity: 1.2 },
          { p: [g, tOfAge(a) - loupeOffset(a), 0] as const, colour: PAL.bowl, size: 0.1, intensity: 1.2 },
        ]),
        ctx.globals.uElapsed,
        { pulse: 0.04 },
      );
      insetScene.add(insetBeads.object);
      disposers.push(insetBeads.dispose);
      insetCam.position.set(0, 0, 10.5);
      insetCam.lookAt(0, 0, 0);

      await renderer.compileAsync(scene, rig.camera);
      await renderer.compileAsync(insetScene, insetCam);
    },

    update(local, _dt, elapsed) {
      state = youState(local);
      const s = state;
      const sp = smooth(s.split);
      // Life: drawn from birth; splits into head and feet.
      life.set(0, s.reveal, 1 - sp * 0.85);
      life.set(1, 1, sp);
      life.set(2, 1, sp);
      const ageNow = s.reveal * LIFE_YEARS;
      decades.forEach((a, i) => beads.setIntensity(i, a <= ageNow + 0.5 ? 1.2 : 0));
      beads.commit();
      // Ink: drawn bottom-up as its history appears.
      // Unrevealed paths get zero intensity (the ribbon's writing head would otherwise glow at their start).
      for (let i = 0; i < params.ink.particles; i++) ink.set(i, s.ink, s.ink > 1e-3 ? 1 : 0);
      inkDrop.opacity.value = smooth(Math.min(1, s.ink * 4));
      params.memories.forEach((_, i) =>
        memories.set(
          i,
          Math.min(1, Math.max(0, s.memories * 1.6 - i * 0.07)),
          s.memories * 1.6 - i * 0.07 > 1e-3 ? 1 : 0,
        ),
      );
      knife.set(0, s.scan, s.scanOn * 0.9);
      kit.setKnife(0, 0, s.scan, s.scanOn);

      // Inset rungs appear decade by decade.
      decades
        .slice(1)
        .forEach((a, i) =>
          insetLines.set(3 + i, a <= s.loupeAge + 0.01 ? 1 : 0, a <= s.loupeAge + 0.01 ? 1 : 0),
        );
      decades.forEach((a, i) => {
        const on = a <= s.loupeAge + 0.01 ? 1.2 : 0.25;
        insetBeads.setIntensity(i * 2, on);
        insetBeads.setIntensity(i * 2 + 1, on);
      });
      insetBeads.commit();
      insetLines.opacity.value = s.loupe;
      insetBeads.opacity.value = s.loupe;

      // Camera: whole life → toward the inset → toward the ink → pull back.
      const c = params.camera;
      const lc = params.loupeCamera;
      const ic = params.inkCamera;
      const pc = params.pullCamera;
      const f = smooth(s.focus);
      const k = smooth(s.inkFocus);
      const p = smooth(s.pull);
      const mix = (key: 'az' | 'el' | 'dist' | 'tx' | 'tt' | 'ty') =>
        c[key] + (lc[key] - c[key]) * f + (ic[key] - c[key]) * k + (pc[key] - c[key]) * p;
      // Tall screens crop the sides: pull back and keep the life off the left edge.
      const tall = aspect < 1.1 ? 1 : 0;
      rig.apply(
        {
          az: mix('az'),
          el: mix('el'),
          dist: mix('dist') + tall * 2.4,
          tx: mix('tx') - tall * 0.35,
          tt: mix('tt'),
          ty: mix('ty'),
        },
        elapsed,
      );
      placeLabels();
    },

    render(target: RenderTarget) {
      renderer.setRenderTarget(target);
      renderer.render(scene, rig.camera);
      if (state.loupe > 0.002) {
        const W = target.width;
        const H = target.height;
        frame.opacity.value = state.loupe;
        frame.aspect.value = (inset.w * W) / Math.max(1, inset.h * H);
        renderInPanel(renderer, target, frame.scene, frame.camera, inset);
        insetCam.aspect = frame.aspect.value;
        insetCam.updateProjectionMatrix();
        renderer.clearDepth();
        renderInPanel(renderer, target, insetScene, insetCam, inset);
      }
    },

    resize(w, h) {
      rig.resize(w, h);
      aspect = w / h;
      inset = aspect >= 1.1 ? { x: 0.62, y: 0.17, w: 0.3, h: 0.62 } : { x: 0.5, y: 0.13, w: 0.46, h: 0.42 };
    },

    dispose() {
      for (const d of disposers) d();
    },
  };

  function placeLabels() {
    const s = state;
    const cam = rig.camera;
    const place = (i: number, p: readonly number[], o: number) => {
      kit.viewCPU(p[0]!, p[1]!, p[2]!, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, cam, o);
    };
    const quiet = 1 - Math.max(s.focus, s.inkFocus) * 0.7;
    place(L.born!, at(LIFE_T0), Math.min(1, s.reveal * 8));
    place(L.old!, at(LIFE_T1), s.reveal > 0.97 ? quiet : 0);
    decades
      .slice(1, -1)
      .forEach((a) =>
        place(
          L[`d${a}`]!,
          at(tOfAge(a)),
          (ageOfT(LIFE_T0 + s.reveal * 4) >= a ? 0.7 : 0) * (1 - s.split) * quiet,
        ),
      );
    const mid = at(0.6);
    place(L.head!, [mid[0], mid[1], mid[2] + params.headFeetGap], s.split * s.focus);
    place(L.feet!, [mid[0], mid[1] - 0.25, mid[2] - params.headFeetGap], s.split * s.focus);
    place(L.ink!, [params.ink.x, params.ink.tDrop, params.ink.y], Math.min(1, s.ink * 3) * (1 - s.pull));
    place(
      L.inkTop!,
      [params.ink.x + 1.0, LIFE_T1 - 0.1, params.ink.y],
      s.ink > 0.9 ? (1 - s.pull) * s.inkFocus : 0,
    );
    place(L.now!, [B.x1, s.scan, B.y1], s.scanOn);
    // Inset labels.
    const o = s.loupe;
    const g = params.insetGap;
    const pin = (i: number, x: number, t: number, op: number) => {
      insetKit.viewCPU(x, t, 0, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, insetCam, op, inset);
    };
    if (o > 0.002) {
      insetCam.aspect = (inset.w * aspect) / inset.h;
      insetCam.updateProjectionMatrix();
    }
    labels.placeScreen(L.iFactor!, inset.x + inset.w / 2, inset.y + inset.h + 0.03, o);
    pin(L.iFeet!, -g, LIFE_T1 + 0.05, o);
    pin(L.iHead!, g, LIFE_T1 + 0.05, o);
    const ageShown = Math.floor(s.loupeAge / 10 + 1e-6) * 10;
    if (ageShown >= 10) {
      if (ageShown !== lastAgeShown) {
        lastAgeShown = ageShown;
        labels.setText(
          L.iGap!,
          `age ${ageShown}: head ahead by ${(headAheadS(ageShown) * 1e6).toFixed(2)} µs`,
        );
      }
      // Wide screens: beside the rung. Tall screens: under the inset (no room to the right).
      if (aspect >= 1.1) pin(L.iGap!, g, tOfAge(ageShown) - loupeOffset(ageShown), o);
      else labels.placeScreen(L.iGap!, inset.x, inset.y + inset.h + 0.065, o);
    } else labels.hide(L.iGap!);
  }

  return self;
}
