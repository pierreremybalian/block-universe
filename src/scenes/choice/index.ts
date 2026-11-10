// Stage 11 · Already written? (fate and free will in the block). The life from stage 10, paused at 35 under a now.
// Lived from inside (the growing-block filter), the thread above the now is missing and dashed possible futures fan
// out; in the block the thread is all there and the branches fade. The now sweeps the whole life (Weyl's crawling
// awareness). Then the moment becomes a choice: its future light cone grows (what it can affect, lighting the events
// downstream of it), then its past cone (what can be known there). Events outside both are elsewhere.

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL, type RGB } from '../../shared/block/palette.ts';
import { LIFE_T0, LIFE_T1, lifeAt, tOfAge } from '../../script/you.ts';
import {
  BRANCHES,
  CHOICE_P,
  EVENTS,
  T_CHOICE,
  branchAt,
  choice,
  choiceState,
  coneSide,
} from '../../script/choice.ts';
import { LIFE_YEARS } from '../../relativity/units.ts';
import { smooth, track } from '../../time/tracks.ts';

const B: Bounds = { x0: -2.6, x1: 2.6, t0: LIFE_T0, t1: LIFE_T1, y0: -1.3, y1: 1.3 };

type Pose = { az: number; el: number; dist: number; tx: number; tt: number; ty: number };

const params = {
  fov: 34,
  /** Camera keyframes: stage 10's pull-back pose (seamless dissolve), in on the now, wider for the cones, out. */
  poses: [
    [0, { az: 0.62, el: 0.34, dist: 10.6, tx: 0.1, tt: 0, ty: 0 }],
    [0.15, { az: 0.48, el: 0.2, dist: 8.2, tx: -0.55, tt: 0.3, ty: 0.1 }],
    [0.42, { az: 0.4, el: 0.18, dist: 8.0, tx: -0.6, tt: 0.15, ty: 0.1 }],
    [0.58, { az: 0.46, el: 0.2, dist: 8.6, tx: -0.55, tt: 0, ty: 0.05 }],
    [0.7, { az: 0.68, el: 0.24, dist: 9.8, tx: -0.8, tt: -0.2, ty: 0 }],
    [0.88, { az: 0.78, el: 0.22, dist: 9.8, tx: -0.85, tt: -0.35, ty: 0 }],
    [1, { az: 0.74, el: 0.3, dist: 11, tx: -0.75, tt: -0.4, ty: 0 }],
  ] as [number, Pose][],
  life: { width: 0.04, intensity: 1.25 },
  branch: { width: 0.016, intensity: 0.85, dashed: 0.07, samples: 96 },
  /** Cone heights (display units): up to just below age 80, down to just above birth. */
  futureH: LIFE_T1 - T_CHOICE - 0.1,
  pastH: T_CHOICE - LIFE_T0 - 0.05,
  coneOpacity: { future: 0.55, past: 0.8 },
  /** Warm, between the head's gold and A's amber: the past cone holds records (stage 10's memories). */
  pastColour: [1.0, 0.68, 0.32] as RGB,
  /** How far behind the cone's light front an event takes to light up (display units). */
  lightLag: 0.12,
};

export default function choiceScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let state = choiceState(0);
  let aspect = 16 / 9;

  const keys = (k: keyof Pose) => track(params.poses.map(([l, p]) => [l, p[k]] as const));
  const cam = { az: keys('az'), el: keys('el'), dist: keys('dist'), tx: keys('tx'), tt: keys('tt'), ty: keys('ty') };

  const decades = Array.from({ length: LIFE_YEARS / 10 + 1 }, (_, k) => k * 10);
  const sides = EVENTS.map(coneSide);
  const firstFuture = sides.indexOf('future');
  const elsewhereAt = sides.indexOf('elsewhere');

  const labels = new LabelSet([
    { id: 'born', text: 'Born', tone: 'plain', side: 'left', size: 'sm' },
    { id: 'old', text: 'Age 80', tone: 'plain', side: 'left', size: 'sm' },
    { id: 'now', text: 'Now · age 35', tone: 'a', side: 'right', size: 'sm' },
    { id: 'futures', text: 'Possible futures, as lived', tone: 'warm', side: 'above', size: 'sm' },
    { id: 'one', text: 'One thread, all of it there', tone: 'both', side: 'right', size: 'sm' },
    { id: 'aware', text: 'Awareness, crawling upward', tone: 'a', side: 'right', size: 'sm' },
    { id: 'choice', text: 'A choice', tone: 'both', side: 'right', size: 'sm' },
    { id: 'down', text: 'Downstream of it', tone: 'light', side: 'right', size: 'sm' },
    { id: 'change', text: 'Can change · can’t know', tone: 'light', side: 'left', size: 'sm' },
    { id: 'know', text: 'Can know · can’t change', tone: 'warm', side: 'left', size: 'sm' },
    { id: 'elsewhere', text: 'Elsewhere · neither', tone: 'mute', side: 'right', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  let life: ReturnType<typeof createRibbons>;
  let branches: ReturnType<typeof createRibbons>;
  let beads: ReturnType<typeof createEvents>;
  let now: ReturnType<typeof createEvents>;
  let events: ReturnType<typeof createEvents>;
  let knife: ReturnType<typeof createKnife>;
  let futureCone: ReturnType<typeof createLightCone>;
  let pastCone: ReturnType<typeof createLightCone>;
  const futuresTop: [number, number, number] = [0, LIFE_T1 - 0.2, 0];

  const at = (t: number): [number, number, number] => {
    const [x, y] = lifeAt(t);
    return [x, t, y];
  };

  const self: BlockScene = {
    id: 'choice',
    status: 'argument',
    statusNote: choice.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      const glass = createGlassBlock(kit, B, { grid: 0.5 });
      glass.add(scene);
      disposers.push(glass.dispose);

      // 0: the life; 1: its future above the now, as an overlay that glows while "tomorrow is as fixed as yesterday".
      const lifePts = sampleWorldline(lifeAt, LIFE_T0, LIFE_T1, 240);
      const aheadPts = sampleWorldline(lifeAt, T_CHOICE, LIFE_T1, 120);
      life = createRibbons(kit, [
        { points: lifePts, colour: PAL.line, width: params.life.width, intensity: params.life.intensity },
        { points: aheadPts, colour: PAL.both, width: params.life.width * 1.6, intensity: 1, sliceResponse: 0 },
      ]);
      scene.add(life.mesh);
      disposers.push(life.dispose);

      // Possible futures, drawn dashed and outside the existence filter, so they show while the real future is hidden.
      const n = params.branch.samples;
      const paths: PathSpec[] = [];
      for (let k = 0; k < BRANCHES; k++) {
        const pts: number[][] = [];
        for (let i = 0; i < n; i++) {
          const t = T_CHOICE + ((LIFE_T1 - T_CHOICE) * i) / (n - 1);
          const [x, y] = branchAt(k, t);
          pts.push([x, t, y]);
        }
        futuresTop[0] += pts.at(-1)![0]! / BRANCHES;
        futuresTop[2] += pts.at(-1)![2]! / BRANCHES;
        paths.push({
          points: pts,
          colour: PAL.bowl,
          width: params.branch.width,
          intensity: params.branch.intensity,
          dashed: params.branch.dashed,
          sliceResponse: 0,
          existResponse: 0,
        });
      }
      branches = createRibbons(kit, paths);
      scene.add(branches.mesh);
      disposers.push(branches.dispose);

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

      now = createEvents(kit, [{ p: CHOICE_P, colour: PAL.both, size: 0.2, intensity: 1 }], ctx.globals.uElapsed);
      scene.add(now.object);
      disposers.push(now.dispose);

      events = createEvents(
        kit,
        EVENTS.map((p, i) => ({
          p: [p[0]!, p[1]!, p[2]!] as const,
          colour: sides[i] === 'future' ? PAL.light : sides[i] === 'past' ? params.pastColour : PAL.cool,
          size: 0.1,
          intensity: 0,
        })),
        ctx.globals.uElapsed,
      );
      scene.add(events.object);
      disposers.push(events.dispose);

      knife = createKnife(kit, B, { colour: PAL.a, grid: 0.5 });
      scene.add(knife.mesh);
      disposers.push(knife.dispose);
      kit.knives[0].width.value = 0.05;

      futureCone = createLightCone(kit, { rings: 5 });
      futureCone.apex.value.set(CHOICE_P[0], CHOICE_P[1], CHOICE_P[2]);
      futureCone.height.value = params.futureH;
      futureCone.past.value = 0;
      futureCone.future.value = 0;
      futureCone.opacity.value = 0;
      scene.add(futureCone.mesh);
      disposers.push(futureCone.dispose);

      pastCone = createLightCone(kit, { rings: 5, colour: params.pastColour });
      pastCone.apex.value.set(CHOICE_P[0], CHOICE_P[1], CHOICE_P[2]);
      pastCone.height.value = params.pastH;
      pastCone.future.value = 0;
      pastCone.past.value = 0;
      pastCone.opacity.value = 0;
      scene.add(pastCone.mesh);
      disposers.push(pastCone.dispose);

      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = choiceState(local);
      const s = state;

      // Lived view: the growing-block filter at the now hides the thread above it.
      kit.exist.growing.value = s.lived;
      kit.setKnife(0, 0, s.knifeT, s.knife);
      // The now dims while the cones grow, so they read through it.
      knife.set(0, s.knifeT, s.knife * 0.85 * (1 - 0.45 * s.future));

      life.set(0, 1, 1);
      life.set(1, 1, s.fixed * 0.9);
      for (let k = 0; k < BRANCHES; k++) {
        const on = s.branches > 1e-3 ? 1 - smooth(s.collapse) : 0;
        branches.set(k, s.branches, on * (k === 0 ? 1.15 : 1));
      }

      now.setIntensity(0, s.knife * (1 - s.scan) * 1 + s.choice * 1.4);
      now.commit();

      // Events light up as each cone's front reaches them; those elsewhere stay dim.
      const reachF = s.future * params.futureH;
      const reachP = s.past * params.pastH;
      for (let i = 0; i < EVENTS.length; i++) {
        const dt = EVENTS[i]![1]! - T_CHOICE;
        const side = sides[i];
        const lit =
          side === 'future'
            ? Math.min(1, Math.max(0, (reachF - dt) / params.lightLag))
            : side === 'past'
              ? Math.min(1, Math.max(0, (reachP + dt) / params.lightLag))
              : 0;
        events.setIntensity(i, s.choice * (0.3 + 1.3 * lit));
      }
      events.commit();
      // Hidden until the choice (knives would otherwise light them as the now sweeps past).
      events.opacity.value = smooth(s.choice);

      futureCone.future.value = s.future;
      futureCone.opacity.value = Math.min(1, s.future * 4) * params.coneOpacity.future;
      pastCone.past.value = s.past;
      pastCone.opacity.value = Math.min(1, s.past * 4) * params.coneOpacity.past;

      // Tall screens crop the sides: pull back and keep the life off the left edge (as stage 10 does).
      const tall = aspect < 1.1 ? 1 : 0;
      rig.apply(
        {
          az: cam.az(local),
          el: cam.el(local),
          dist: cam.dist(local) + tall * 2.4,
          tx: cam.tx(local) - tall * 0.35,
          tt: cam.tt(local),
          ty: cam.ty(local),
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
      rig.resize(w, h);
      aspect = w / h;
    },

    dispose() {
      for (const d of disposers) d();
    },
  };

  function placeLabels() {
    const s = state;
    const c = rig.camera;
    const place = (i: number, x: number, t: number, y: number, o: number) => {
      kit.viewCPU(x, t, y, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, c, o);
    };
    const quiet = 1 - s.pull * 0.6;
    const [px, pt, py] = CHOICE_P;
    const birth = at(LIFE_T0);
    const old = at(LIFE_T1);
    place(L.born!, birth[0], birth[1], birth[2], 0.8 * (1 - s.scan) * quiet);
    place(L.old!, old[0], old[1], old[2], 0.8 * (1 - s.lived) * (1 - s.scan) * quiet);
    place(L.now!, px, pt, py, s.knife * (1 - s.scan) * (1 - s.choice));
    place(L.futures!, futuresTop[0], futuresTop[1], futuresTop[2], s.branches * Math.max(0, 1 - s.collapse * 2.5));
    const later = at(tOfAge(62));
    place(L.one!, later[0], later[1], later[2], s.fixed);
    const k = at(s.knifeT);
    place(L.aware!, k[0], k[1], k[2], s.scan);
    place(L.choice!, px, pt, py, s.choice * quiet);
    const d = EVENTS[firstFuture]!;
    place(L.down!, d[0]!, d[1]!, d[2]!, s.future * (1 - s.zones));
    place(L.change!, px, pt + 1.25, py, s.zones * quiet);
    place(L.know!, px, pt - 1.1, py, s.zones * quiet);
    const e = EVENTS[elsewhereAt]!;
    // Tall screens crop the right of the block, where elsewhere is: no label there.
    place(L.elsewhere!, e[0]!, e[1]!, e[2]!, aspect < 1.1 ? 0 : s.zones * quiet);
  }

  return self;
}
