// Stage 5 · The bowl of equal ages (HANDOFF §9, §10.5).
// Travelers leave one event at many speeds and in many directions. Beads mark where each has aged 1, 2 and 3 years;
// joining equal beads gives nested bowls (hyperboloids). Two travelers' now-planes are drawn as knives tangent to the
// 2-year bowl at their beads. Then the view is re-drawn in B's frame: the bowls map onto themselves, the knives swap.

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents, type EventSpec } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { createBowls } from '../../shared/block/bowl.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { bowlT } from '../../relativity/invariants.ts';
import { track } from '../../time/tracks.ts';
import {
  A_BETA,
  A_INDEX,
  B_BETA,
  B_INDEX,
  KNIFE_TAU,
  TAUS,
  TRAVELERS,
  ages,
  agesState,
  beadOf,
  tangentIntercept,
} from '../../script/ages.ts';

const T_MAX = 4.2;
const R = 3.7;

const params = {
  bounds: { x0: -R, x1: R, t0: -0.15, t1: T_MAX, y0: -R, y1: R } as Bounds,
  camera: { az: 0.5, el: 0.3, dist: 12.6, tx: 0, tt: 1.75, ty: 0, fov: 34 },
  /** Camera keys by local: swing to the −x side and rise so the tangent patches face us. */
  camKeys: {
    az: [
      [0.54, 0.5],
      [0.7, -0.38],
      [0.8, -0.4],
      [0.95, 0.4],
      [1, 0.44],
    ],
    el: [
      [0.54, 0.3],
      [0.7, 0.42],
      [0.9, 0.36],
      [1, 0.32],
    ],
    dist: [
      [0.54, 12.6],
      [0.7, 11.6],
      [0.88, 12.4],
      [1, 13],
    ],
  } as Record<string, [number, number][]>,
  bowlRadius: 3.55,
  /** World units the view is nudged so content sits right of centre. */
  screenShift: 0.75,
  /** Narrow (portrait) screens: centred, further back, content lifted above the captions. */
  portrait: { distScale: 1.6, ttLift: -0.5 },
  fanIntensity: 0.38,
  knifeOpacity: 0.85,
  /** Half-size of the tangent patches (display units). */
  patchHalf: 1.55,
  beadSize: 0.12,
  /** Where bowl labels sit (distance from the axis, on the −x side). */
  labelR: 2.7,
};

export default function agesScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  // The bowls and the light cone are invariant sets under boosts, so they are drawn straight in view space with a
  // kit that is never boosted: they stay perfectly still while worldlines, beads and knives move along them.
  const still = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();

  const labels = new LabelSet([
    { id: 'origin', text: 'one event', tone: 'both', side: 'right', size: 'sm' },
    { id: 'light', text: 'light', tone: 'light', side: 'right', size: 'sm' },
    ...TAUS.map((t) => ({ id: `bowl${t}`, text: `aged ${t} year${t === 1 ? '' : 's'}`, tone: 'warm' as const, side: 'left' as const, size: 'sm' as const })),
    { id: 'A', text: 'A · at rest', tone: 'a', side: 'above' },
    { id: 'B', text: `B · ${B_BETA.toFixed(1)} c`, tone: 'b', side: 'above' },
    { id: 'nowA', text: 'A’s now', tone: 'a', side: 'left', size: 'sm' },
    { id: 'nowB', text: 'B’s now', tone: 'b', side: 'right', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  // Bead specs: one per (traveler, τ) that fits in the block.
  const beads: { tr: number; tau: number; p: [number, number, number] }[] = [];
  TRAVELERS.forEach((tr, i) => {
    for (const tau of TAUS) {
      const p = beadOf(tr, tau);
      if (p[1] <= T_MAX) beads.push({ tr: i, tau, p });
    }
  });

  let ribbons: ReturnType<typeof createRibbons>;
  let events: ReturnType<typeof createEvents>;
  let bowls: ReturnType<typeof createBowls>;
  let knifeA: ReturnType<typeof createKnife>;
  let knifeB: ReturnType<typeof createKnife>;
  let cone: ReturnType<typeof createLightCone>;
  let glass: ReturnType<typeof createGlassBlock>;
  let state = agesState(0);
  let aspect = 16 / 9;
  const camAz = track(params.camKeys.az!);
  const camEl = track(params.camKeys.el!);
  const camDist = track(params.camKeys.dist!);

  const cA = tangentIntercept(A_BETA, KNIFE_TAU);
  const cB = tangentIntercept(B_BETA, KNIFE_TAU);

  const self: BlockScene = {
    id: 'ages',
    status: 'established',
    statusNote: ages.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      const B = params.bounds;
      glass = createGlassBlock(kit, B, { grid: 1 });
      glass.gridOpacity.value = 0.35;
      glass.opacity.value = 0.7;
      glass.add(scene);
      disposers.push(glass.dispose);

      const paths: PathSpec[] = TRAVELERS.map((tr, i) => {
        const x = tr.beta * T_MAX;
        const colour = i === A_INDEX ? PAL.a : i === B_INDEX ? PAL.b : PAL.line;
        return {
          points: [
            [0, 0, 0],
            [x * Math.cos(tr.dir), T_MAX, x * Math.sin(tr.dir)],
          ],
          colour,
          width: i === A_INDEX || i === B_INDEX ? 0.034 : 0.022,
          tick: 1,
          intensity: i === A_INDEX || i === B_INDEX ? 1.0 : params.fanIntensity,
        };
      });
      ribbons = createRibbons(kit, paths);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      const specs: EventSpec[] = [
        { p: [0, 0, 0], colour: PAL.both, size: 0.16, intensity: 1.2 },
        ...beads.map((b) => ({ p: b.p, colour: PAL.bowl, size: params.beadSize, intensity: 0 })),
      ];
      events = createEvents(kit, specs, ctx.globals.uElapsed, { pulse: 0.05 });
      scene.add(events.object);
      disposers.push(events.dispose);

      bowls = createBowls(still, TAUS, params.bowlRadius);
      bowls.tMax.value = T_MAX;
      bowls.shown.value = 0;
      scene.add(bowls.mesh);
      disposers.push(bowls.dispose);

      cone = createLightCone(still, { rings: 4, rulings: 16 });
      cone.height.value = T_MAX;
      cone.past.value = 0;
      cone.opacity.value = 0;
      scene.add(cone.mesh);
      disposers.push(cone.dispose);

      // Tangent patches: each knife is clipped to a square centred on its bead.
      const patch = (beta: number): Bounds => {
        const p = beadOf(TRAVELERS[beta === A_BETA ? A_INDEX : B_INDEX]!, KNIFE_TAU);
        const h = params.patchHalf;
        return { x0: p[0] - h, x1: p[0] + h, y0: p[2] - h, y1: p[2] + h, t0: B.t0, t1: B.t1 };
      };
      knifeA = createKnife(kit, patch(A_BETA), { colour: PAL.a, grid: 0.5 });
      knifeB = createKnife(kit, patch(B_BETA), { colour: PAL.b, grid: 0.5 });
      knifeA.set(A_BETA, cA, 0);
      knifeB.set(B_BETA, cB, 0);
      scene.add(knifeA.mesh, knifeB.mesh);
      disposers.push(knifeA.dispose, knifeB.dispose);
      kit.knives[0].width.value = 0.05;
      kit.knives[1].width.value = 0.05;

      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = agesState(local);
      const s = state;
      TRAVELERS.forEach((_, i) => {
        const hero = i === A_INDEX || i === B_INDEX;
        ribbons.set(i, Math.max(0.0005, s.fan), hero ? 1 + 0.4 * s.pick : 1 - 0.45 * s.pick, 0, hero ? s.pick * 0.6 : 0);
      });
      events.setIntensity(0, 1.2);
      beads.forEach((b, k) => {
        const on = Math.min(1, Math.max(0, s.beads - (b.tau - 1)));
        const hero = (b.tr === A_INDEX || b.tr === B_INDEX) && b.tau === KNIFE_TAU;
        events.setIntensity(k + 1, on * (hero ? 1.2 + 0.8 * s.pick : 1 - 0.4 * s.pick));
        events.setSize(k + 1, params.beadSize * (hero ? 1 + 0.5 * s.pick : 1));
      });
      events.commit();
      bowls.shown.value = s.bowls;
      bowls.opacity.value = 0.62;
      cone.opacity.value = s.cone * 0.5;
      const boosted = s.boost / B_BETA;
      glass.opacity.value = 0.7 * (1 - 0.8 * boosted);
      glass.edges.opacity.value = 1 - 0.82 * boosted;
      knifeA.set(A_BETA, cA, s.knifeA * params.knifeOpacity);
      knifeB.set(B_BETA, cB, s.knifeB * params.knifeOpacity);
      // Knives light nothing here: the patches are local, the planes they belong to are not.
      kit.setKnife(0, A_BETA, cA, 0);
      kit.setKnife(1, B_BETA, cB, 0);
      kit.setBeta(s.boost);

      // Shift the target along the camera's left so the bowl sits right of centre, clear of the captions.
      const c = params.camera;
      const az = camAz(local);
      const narrow = Math.min(1, Math.max(0, (1.2 - aspect) / 0.6));
      const k = params.screenShift * (1 - narrow);
      const pt = params.portrait;
      rig.apply(
        {
          az,
          el: camEl(local),
          dist: camDist(local) * (1 + (pt.distScale - 1) * narrow),
          tx: c.tx - k * Math.cos(az),
          tt: c.tt + pt.ttLift * narrow,
          ty: c.ty + k * Math.sin(az),
        },
        elapsed,
      );
      placeLabels();
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

  function placeLabels() {
    const s = state;
    const cam = rig.camera;
    const place = (i: number, x: number, t: number, y: number, o: number) => {
      kit.viewCPU(x, t, y, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, cam, o);
    };
    const placeStill = (i: number, x: number, t: number, y: number, o: number) => {
      labels.place(i, x, t, y, cam, o);
    };
    place(L.origin!, 0, 0, 0, 1 - s.pick * 0.6);
    placeStill(L.light!, -T_MAX * 0.72, T_MAX * 0.72, 0, s.cone * (1 - s.pick));
    TAUS.forEach((tau) => {
      const r = params.labelR;
      placeStill(L[`bowl${tau}`]!, -r, bowlT(tau, r), 0, Math.min(1, Math.max(0, s.bowls - (tau - 1))) * (1 - s.pick));
    });
    const tA = TRAVELERS[A_INDEX]!;
    const tB = TRAVELERS[B_INDEX]!;
    const a3 = beadOf(tA, 3);
    const b3 = beadOf(tB, 3);
    place(L.A!, a3[0], a3[1], a3[2], s.pick);
    place(L.B!, b3[0], b3[1], b3[2], s.pick);
    const h = params.patchHalf;
    const pa = beadOf(tA, KNIFE_TAU);
    const pb = beadOf(tB, KNIFE_TAU);
    place(L.nowA!, pa[0] - h, A_BETA * (pa[0] - h) + cA, pa[2] + h, s.knifeA);
    place(L.nowB!, pb[0] + h, B_BETA * (pb[0] + h) + cB, pb[2] + h, s.knifeB);
  }

  return self;
}
