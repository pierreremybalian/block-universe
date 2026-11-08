// Stage 8 · Two walkers, one galaxy (HANDOFF §9 Two Knives, Loupe, Ribbon of Possible Nows; §10.8).
// Earth's worldline on the left, Andromeda's 2.5 million light-years to the right. Two people pass at here-now,
// walking opposite ways; their now-slices fan out across the gap (tilt exaggerated, stated) and meet Andromeda's
// history at different moments. A loupe at Andromeda shows the true gap in days, with Penrose's fleet launch between
// them. Then speeds go up to 0.99c: the knives sweep a ±2.5-million-year ribbon of Andromeda's history, bounded by
// here-now's light cone.

import { PerspectiveCamera, Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { createPanelFrame, renderInPanel } from '../../shared/block/panels.ts';
import { LabelSet, type Panel } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { smooth } from '../../time/tracks.ts';
import { sci } from '../../time/format.ts';
import {
  ANDROMEDA_BOUNDS as B,
  ANDROMEDA_X,
  DISPLAY_D,
  EARTH_X,
  LAUNCH_DAYS,
  LOUPE_DAYS,
  LOUPE_FACTOR,
  WALK_EXAGGERATION,
  WALK_SHIFT_DAYS,
  andromeda,
  andromedaState,
} from '../../script/andromeda.ts';

const params = {
  camera: { az: 0.3, el: 0.16, dist: 16.6, fov: 34 },
  /** Framing offset: block right of centre and raised, clear of the captions. */
  offset: { tx: -0.9, tt: -0.45 },
  /** While the loupe is open the block moves left to make room. */
  loupeCamera: { az: 0.38, el: 0.14, dist: 17.2, tx: 2.4 },
  pullCamera: { az: 0.55, el: 0.3, dist: 17.6 },
  /** Ticks every 0.6 display units = 0.5 million years. */
  tick: 0.6,
  walkerHalf: 0.9,
  ribbonSamples: 121,
  /** Loupe panel (fractions of the screen) and its camera. */
  loupePanel: { x: 0.66, y: 0.24, w: 0.29, h: 0.56 } as Panel,
  loupeCamera3: { az: 0.32, el: 0.1, dist: 30, fov: 40 },
  /** Portrait screens (aspect < 1): the block above, the loupe below it across the width, the Atlas card on top
   *  in the last part (it sits at the top on phones), all clear of the captions (bottom ~30%). */
  portrait: {
    camera: { az: 0.3, el: 0.16, dist: 22, tx: 0, tt: -1.1 },
    loupeCamera: { az: 0.38, el: 0.14, dist: 23, tx: 0, tt: -3.9 },
    atlasCamera: { az: 0.55, el: 0.3, dist: 33, tx: 0, tt: 1.6 },
    loupePanel: { x: 0.06, y: 0.475, w: 0.88, h: 0.21 } as Panel,
  },
};

/** Loupe world: one unit is one day (and one light-day). */
const LB: Bounds = { x0: -3.4, x1: 3.4, t0: -LOUPE_DAYS, t1: LOUPE_DAYS, y0: -1.2, y1: 1.2 };

export default function andromedaScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let state = andromedaState(0);

  // Loupe scene (its own kit and camera, in days).
  const lScene = new Scene();
  const lKit = createKit();
  const lCam = new PerspectiveCamera(params.loupeCamera3.fov, 0.5, 0.1, 400);
  const lFrame = createPanelFrame([0.86, 0.72, 1.0]);

  const walkA = [
    [EARTH_X, -params.walkerHalf, 0],
    [EARTH_X, params.walkerHalf, 0],
  ];
  const walkB = [
    [EARTH_X, -params.walkerHalf, 0],
    [EARTH_X, params.walkerHalf, 0],
  ];

  const labels = new LabelSet([
    { id: 'earth', text: 'Earth', tone: 'plain', side: 'above' },
    { id: 'andromeda', text: 'Andromeda', tone: 'plain', side: 'above' },
    { id: 'earthP', text: 'Earth', tone: 'plain', side: 'left' },
    { id: 'andromedaP', text: 'Andromeda', tone: 'plain', side: 'right' },
    { id: 'dist', text: '2.5 million light-years', tone: 'mute', side: 'above', size: 'sm' },
    { id: 'here', text: 'here-now', tone: 'both', side: 'left', size: 'sm' },
    { id: 'walkA', text: 'walking toward', tone: 'a', side: 'left', size: 'sm' },
    { id: 'walkB', text: 'walking away', tone: 'b', side: 'left', size: 'sm' },
    { id: 'exag', text: `tilt exaggerated ×${sci(WALK_EXAGGERATION, 2)}`, tone: 'mute', side: 'below', size: 'sm' },
    { id: 'ribbon', text: '±2.5 million years of Andromeda', tone: 'light', side: 'left', size: 'sm' },
    { id: 'ribbonP', text: '±2.5 million years', tone: 'light', side: 'above', size: 'sm' },
    { id: 'cone', text: 'light cone', tone: 'light', side: 'right', size: 'sm' },
    { id: 'lTitle', text: `Loupe at Andromeda · time ×${sci(LOUPE_FACTOR, 1)}`, tone: 'mute', side: 'center', size: 'sm' },
    { id: 'lA', text: `+${WALK_SHIFT_DAYS.toFixed(1)} days`, tone: 'a', side: 'right', size: 'sm' },
    { id: 'lB', text: `−${WALK_SHIFT_DAYS.toFixed(1)} days`, tone: 'b', side: 'right', size: 'sm' },
    { id: 'lLaunch', text: 'the fleet launches', tone: 'event', side: 'left', size: 'sm' },
    { id: 'lBead', text: 'one bead per day', tone: 'mute', side: 'center', size: 'sm' },
    { id: 'focus', text: 'loupe ▸', tone: 'mute', side: 'right', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  let ribbons: ReturnType<typeof createRibbons>;
  let events: ReturnType<typeof createEvents>;
  let knifeA: ReturnType<typeof createKnife>;
  let knifeB: ReturnType<typeof createKnife>;
  let cone: ReturnType<typeof createLightCone>;
  let lKnifeA: ReturnType<typeof createKnife>;
  let lKnifeB: ReturnType<typeof createKnife>;
  let lEvents: ReturnType<typeof createEvents>;
  const P = { earth: 0, andromeda: 1, walkA: 2, walkB: 3, ribbon: 4, dist: 5 };
  const E = { here: 0, crossA: 1, crossB: 2, launch: 3, focus: 4 };

  const self: BlockScene = {
    id: 'andromeda',
    status: 'argument',
    statusNote: andromeda.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      const glass = createGlassBlock(kit, B, { grid: 0.6, edgeIntensity: 0.55 });
      glass.gridOpacity.value = 0.55;
      glass.add(scene);
      disposers.push(glass.dispose);

      const n = params.ribbonSamples;
      ribbons = createRibbons(kit, [
        { points: [[EARTH_X, B.t0, 0], [EARTH_X, B.t1, 0]], colour: PAL.earth, width: 0.035, tick: params.tick, intensity: 1.1 },
        { points: [[ANDROMEDA_X, B.t0, 0], [ANDROMEDA_X, B.t1, 0]], colour: PAL.andromeda, width: 0.04, tick: params.tick, intensity: 1.1 },
        { points: walkA, colour: PAL.a, width: 0.03, intensity: 1.4, sliceResponse: 0 },
        { points: walkB, colour: PAL.b, width: 0.03, intensity: 1.4, sliceResponse: 0 },
        {
          points: sampleWorldline(() => [ANDROMEDA_X, 0], -DISPLAY_D, DISPLAY_D, n),
          colour: [0.5, 0.32, 1.0],
          width: 0.15,
          intensity: 0.95,
          sliceResponse: 0,
        },
        {
          points: [[EARTH_X, B.t0 + 0.02, B.y1], [ANDROMEDA_X, B.t0 + 0.02, B.y1]],
          colour: PAL.cool,
          width: 0.014,
          intensity: 0.7,
          dashed: 0.12,
          spacelike: true,
          sliceResponse: 0,
        },
      ]);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      events = createEvents(
        kit,
        [
          { p: [EARTH_X, 0, 0], colour: PAL.both, size: 0.17, intensity: 1.2 },
          { p: [ANDROMEDA_X, 0, 0], colour: PAL.a, size: 0.15, intensity: 1.4 },
          { p: [ANDROMEDA_X, 0, 0], colour: PAL.b, size: 0.15, intensity: 1.4 },
          { p: [ANDROMEDA_X, 0.08, 0], colour: [1.0, 0.82, 0.5], size: 0.12, intensity: 1.3 },
          { p: [ANDROMEDA_X, 0, 0], colour: [0.86, 0.72, 1.0], size: 0.7, intensity: 0.3 },
        ],
        ctx.globals.uElapsed,
      );
      scene.add(events.object);
      disposers.push(events.dispose);

      knifeA = createKnife(kit, B, { colour: PAL.a, grid: 0.6 });
      knifeB = createKnife(kit, B, { colour: PAL.b, grid: 0.6 });
      scene.add(knifeA.mesh, knifeB.mesh);
      disposers.push(knifeA.dispose, knifeB.dispose);
      kit.knives[0].width.value = 0.07;
      kit.knives[1].width.value = 0.07;

      cone = createLightCone(kit, { rings: 6 });
      cone.apex.value.set(EARTH_X, 0, 0);
      cone.height.value = DISPLAY_D;
      scene.add(cone.mesh);
      disposers.push(cone.dispose);

      // ── Loupe world (days) ──
      const lGlass = createGlassBlock(lKit, LB, { grid: 1, edgeIntensity: 0.35 });
      lGlass.gridOpacity.value = 0.35;
      lGlass.add(lScene);
      disposers.push(lGlass.dispose);
      const lRibbons = createRibbons(lKit, [
        { points: [[0, LB.t0, 0], [0, LB.t1, 0]], colour: PAL.andromeda, width: 0.13, tick: 1, intensity: 1.2 },
      ]);
      lScene.add(lRibbons.mesh);
      disposers.push(lRibbons.dispose);
      lKnifeA = createKnife(lKit, LB, { colour: PAL.a, grid: 1 });
      lKnifeB = createKnife(lKit, LB, { colour: PAL.b, grid: 1 });
      lKnifeA.set(0, WALK_SHIFT_DAYS, 0.9);
      lKnifeB.set(0, -WALK_SHIFT_DAYS, 0.9);
      lScene.add(lKnifeA.mesh, lKnifeB.mesh);
      disposers.push(lKnifeA.dispose, lKnifeB.dispose);
      lKit.setKnife(0, 0, WALK_SHIFT_DAYS, 1, PAL.a);
      lKit.setKnife(1, 0, -WALK_SHIFT_DAYS, 1, PAL.b);
      lKit.knives[0].width.value = 0.2;
      lKit.knives[1].width.value = 0.2;
      lEvents = createEvents(
        lKit,
        [
          { p: [0, WALK_SHIFT_DAYS, 0], colour: PAL.a, size: 0.55, intensity: 1.2 },
          { p: [0, -WALK_SHIFT_DAYS, 0], colour: PAL.b, size: 0.55, intensity: 1.2 },
          { p: [0, LAUNCH_DAYS, 0], colour: [1.0, 0.82, 0.5], size: 1.0, intensity: 2.2 },
        ],
        ctx.globals.uElapsed,
        { pulse: 0.15 },
      );
      lScene.add(lEvents.object);
      disposers.push(lEvents.dispose);

      await renderer.compileAsync(scene, rig.camera);
      await renderer.compileAsync(lScene, lCam);
    },

    update(local, _dt, elapsed) {
      state = andromedaState(local);
      const s = state;
      const beta = s.beta;
      const cA = -beta * EARTH_X;
      const cB = beta * EARTH_X;
      const on = s.knives;

      // Walkers' worldlines lean by the same display tilt as their knives (slope 1/β).
      const h = params.walkerHalf;
      walkA[0]![0] = EARTH_X - beta * h;
      walkA[1]![0] = EARTH_X + beta * h;
      walkB[0]![0] = EARTH_X + beta * h;
      walkB[1]![0] = EARTH_X - beta * h;
      ribbons.update(P.walkA, walkA);
      ribbons.update(P.walkB, walkB);
      ribbons.set(P.walkA, 1, s.walkers);
      ribbons.set(P.walkB, 1, s.walkers);
      ribbons.set(P.earth, 1, 1);
      // Andromeda's worldline dims as the ribbon of possible nows takes over.
      ribbons.set(P.andromeda, 1, 1 - 0.65 * s.real);
      ribbons.set(P.dist, 1, 1 - s.real * 0.6);
      // Ribbon of possible nows: the stretch of Andromeda's history between the two knives.
      const half = s.ribbon / (2 * DISPLAY_D);
      ribbons.set(P.ribbon, s.ribbon > 0.001 ? 0.5 + half : 0, 1, 0.5 - half);

      knifeA.set(beta, cA, on * 0.85);
      knifeB.set(-beta, cB, on * 0.85);
      kit.setKnife(0, beta, cA, on, PAL.a);
      kit.setKnife(1, -beta, cB, on, PAL.b);
      cone.opacity.value = s.cone * 0.7;

      const tCross = beta * DISPLAY_D;
      events.setPos(E.crossA, ANDROMEDA_X, tCross, 0);
      events.setPos(E.crossB, ANDROMEDA_X, -tCross, 0);
      events.setIntensity(E.here, 1.2 * s.hereNow);
      events.setIntensity(E.crossA, 1.4 * s.walkers);
      events.setIntensity(E.crossB, 1.4 * s.walkers);
      events.setIntensity(E.launch, 1.3 * s.launch * (1 - s.real));
      events.setIntensity(E.focus, 0.3 * s.loupe);
      events.commit();

      // Camera: base → loupe (k) → end (pull on landscape; the Atlas framing on portrait).
      const portrait = aspect < 1;
      const pp = params.portrait;
      const o = params.offset;
      const c = portrait ? pp.camera : { ...params.camera, tx: o.tx, tt: o.tt };
      const lc = portrait ? pp.loupeCamera : { ...params.loupeCamera, tx: o.tx + params.loupeCamera.tx, tt: o.tt };
      const pc = portrait ? pp.atlasCamera : { ...params.pullCamera, tx: o.tx, tt: o.tt };
      const k = smooth(s.loupe);
      const f = portrait ? smooth(Math.min(1, Math.max(0, (local - 0.78) / 0.1))) : s.pull;
      rig.apply(
        {
          az: c.az + (lc.az - c.az) * k + (pc.az - c.az) * f,
          el: c.el + (lc.el - c.el) * k + (pc.el - c.el) * f,
          dist: c.dist + (lc.dist - c.dist) * k + (pc.dist - c.dist) * f,
          tx: c.tx + (lc.tx - c.tx) * k + (pc.tx - c.tx) * f,
          tt: c.tt + (lc.tt - c.tt) * k + (pc.tt - c.tt) * f,
          ty: 0,
        },
        elapsed,
      );
      loupePanel = portrait ? pp.loupePanel : params.loupePanel;

      // Loupe camera: a still, front-on view of ±LOUPE_DAYS around Andromeda's worldline.
      const l3 = params.loupeCamera3;
      const az = l3.az + Math.sin(elapsed * 0.05) * 0.04;
      lCam.position.set(l3.dist * Math.cos(l3.el) * Math.sin(az), l3.dist * Math.sin(l3.el), l3.dist * Math.cos(l3.el) * Math.cos(az));
      lCam.lookAt(0, 0, 0);

      // Labels (main view).
      kit.setBeta(0);
      const place = (i: number, x: number, t: number, y: number, o: number) => {
        kit.viewCPU(x, t, y, tmp);
        labels.place(i, tmp.x, tmp.y, tmp.z, rig.camera, o);
      };
      // Names: above the worldlines on landscape; beside them, lower down, on portrait (the top is the HUD's).
      place(L.earth!, EARTH_X, B.t1, 0, portrait ? 0 : 1);
      place(L.andromeda!, ANDROMEDA_X, B.t1, 0, portrait ? 0 : 1);
      place(L.earthP!, EARTH_X, 1.9, 0, portrait ? 1 : 0);
      place(L.andromedaP!, ANDROMEDA_X, 1.9, 0, portrait ? 1 : 0);
      place(L.dist!, 0, B.t0 + 0.02, B.y1, (1 - s.real) * (portrait ? 1 - k : 1));
      place(L.here!, EARTH_X, 0, 0, s.hereNow * (1 - s.real * 0.7));
      place(L.walkA!, walkA[1]![0]!, walkA[1]![1]!, 0, s.walkers * (1 - s.real));
      place(L.walkB!, walkB[0]![0]!, walkB[0]![1]!, 0, s.walkers * (1 - s.real));
      // Below the cyan knife, right of Earth (the walkers' tags are on Earth's left).
      place(L.exag!, -0.25, -beta * (-0.25 - EARTH_X) - 0.7, B.y0, s.exaggerated);
      place(L.focus!, ANDROMEDA_X + 0.2, portrait ? -1.6 : -0.95, 0, s.loupe);
      const ribbonO = s.real * Math.min(1, s.ribbon);
      place(L.ribbon!, ANDROMEDA_X - 0.12, Math.min(1.4, tCross * 0.5), 0, portrait ? 0 : ribbonO);
      place(L.ribbonP!, ANDROMEDA_X, tCross + 0.15, 0, portrait ? ribbonO : 0);
      place(L.cone!, EARTH_X - 0.6, -2.0, B.y1, s.cone);

      // Labels (loupe), in the loupe panel with the loupe camera.
      const lp = loupePanel;
      const a0 = lCam.aspect;
      lCam.aspect = aspect * (lp.w / lp.h);
      lCam.updateProjectionMatrix();
      const lo = s.loupe;
      const lplace = (i: number, x: number, t: number, o: number) => {
        lKit.viewCPU(x, t, 0, tmp);
        labels.place(i, tmp.x, tmp.y, tmp.z, lCam, o, lp);
      };
      lplace(L.lA!, LB.x1 + 0.3, WALK_SHIFT_DAYS, lo);
      lplace(L.lB!, LB.x1 + 0.3, -WALK_SHIFT_DAYS, lo);
      lplace(L.lLaunch!, -1.0, LAUNCH_DAYS, lo * s.launch);
      labels.placeScreen(L.lTitle!, lp.x + lp.w / 2, portrait ? lp.y + 0.016 : lp.y - 0.03, lo);
      labels.placeScreen(L.lBead!, lp.x + lp.w / 2, portrait ? lp.y + lp.h - 0.02 : lp.y + lp.h + 0.03, lo);
      lCam.aspect = a0;
      void lCam;
    },

    render(target: RenderTarget) {
      kit.setBeta(0);
      renderer.setRenderTarget(target);
      renderer.render(scene, rig.camera);
      const k = smooth(state.loupe);
      if (k < 0.002) return;
      const lp = loupePanel;
      lFrame.opacity.value = k;
      lFrame.aspect.value = (lp.w * target.width) / Math.max(1, lp.h * target.height);
      // Two passes of the 90% backdrop: the main block behind the inset (portrait) is fully hidden.
      renderInPanel(renderer, target, lFrame.scene, lFrame.camera, lp);
      renderInPanel(renderer, target, lFrame.scene, lFrame.camera, lp);
      lCam.aspect = (lp.w * target.width) / Math.max(1, lp.h * target.height);
      lCam.updateProjectionMatrix();
      renderer.setRenderTarget(target);
      renderer.clearDepth();
      renderInPanel(renderer, target, lScene, lCam, lp);
    },

    resize(w, h) {
      rig.resize(w, h);
      aspect = w / Math.max(1, h);
    },

    dispose() {
      for (const d of disposers) d();
      lFrame.dispose();
    },
  };
  let aspect = 16 / 9;
  let loupePanel: Panel = params.loupePanel;
  return self;
}
