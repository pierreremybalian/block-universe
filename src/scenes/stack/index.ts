// Stage 2 · Stack the moments. The now keeps rising from where stage 1 left it, but this time every moment is kept
// as a film frame. The frames pile up (up is later), the ones stage 1 let fade come back, and threads appear where
// things last. Then the frames merge into a solid block and the threads become worldlines: the shared block of
// stage 6, seen for the first time.

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import { cos, exp, float, sin, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createFilmStack, dot } from '../../shared/block/filmStack.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { BEACONS, PLANET, STAR, WORLD, planetAt } from '../../shared/world.ts';
import { FRAME_DT, LOWER_FRAMES, LOWER_TOP, UPPER_FRAMES, UPPER_FROM, stack, stackState } from '../../script/stack.ts';
import { createNowSheet } from '../flow/sheet.ts';
import { smooth } from '../../time/tracks.ts';

type F = Node<'float'>;

const params = {
  /** Where stage 1 leaves the camera (its pull-back pose), so the dissolve is seamless. */
  startCamera: { az: 0.55, el: 0.2, dist: 9.6, tt: -1.1 },
  /** The full block, the same pose stage 6 opens with. */
  blockCamera: { az: 0.62, el: 0.3, dist: 10.2, tt: 0 },
  pullCamera: { az: 0.78, el: 0.36, dist: 11.2, tt: 0 },
  sheet: { rx: 8, ry: 6, core: 3.1, grid: 0.5 },
  frameGain: 1.1,
  lampFlash: 3.2,
  tick: 0.5,
};

const span = WORLD.t1 - WORLD.t0;

/** The world at time t as a picture: star, planet, lamps (flashing at their moment) and you. */
function worldImage(x: F, t: F, y: F) {
  const a = t.div(PLANET.period).mul(2).add(PLANET.phase).mul(Math.PI);
  let img = dot(x, y, STAR.x, STAR.y, 0.11, vec3(...PAL.sun).mul(1.4));
  img = img.add(dot(x, y, cos(a).mul(PLANET.r).add(STAR.x), sin(a).mul(PLANET.r).add(STAR.y), 0.07, vec3(...PAL.earth).mul(1.5)));
  img = img.add(dot(x, y, 0, 0, 0.075, vec3(...PAL.a).mul(1.5)));
  for (const b of BEACONS) {
    const flash = exp(t.sub(b.t).div(FRAME_DT * 0.6).pow(2).negate()).mul(params.lampFlash);
    img = img.add(dot(x, y, b.x, b.y, 0.055, vec3(...PAL.cool).mul(float(0.5).add(flash))));
  }
  return img;
}

export default function stackScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(34);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let ribbons: ReturnType<typeof createRibbons>;
  let events: ReturnType<typeof createEvents>;
  let sheet: ReturnType<typeof createNowSheet>;
  let upper: ReturnType<typeof createFilmStack>;
  let lower: ReturnType<typeof createFilmStack>;
  let glass: ReturnType<typeof createGlassBlock>;
  let nPaths = 0;
  const PATH_A = 0;

  const labels = new LabelSet([
    { id: 'now', text: 'now', tone: 'plain', side: 'right', size: 'sm' },
    { id: 'frame', text: 'one moment, kept', tone: 'mute', side: 'left', size: 'sm' },
    { id: 'time', text: 'later ↑', tone: 'mute', side: 'left', size: 'sm' },
    { id: 'planet', text: 'the planet’s worldline', tone: 'mute', side: 'left', size: 'sm' },
    { id: 'lamp', text: 'a lamp, standing still', tone: 'mute', side: 'right', size: 'sm' },
    { id: 'you', text: 'your worldline', tone: 'a', side: 'right' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  const self: BlockScene = {
    id: 'stack',
    status: 'established',
    statusNote: stack.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      glass = createGlassBlock(kit, WORLD, { grid: 1 });
      glass.add(scene);
      disposers.push(glass.dispose);

      lower = createFilmStack(kit, WORLD, { frames: LOWER_FRAMES, imageFn: worldImage, tFrom: WORLD.t0, tTo: LOWER_TOP });
      upper = createFilmStack(kit, WORLD, { frames: UPPER_FRAMES, imageFn: worldImage, tFrom: UPPER_FROM, tTo: WORLD.t1 });
      for (const fs of [lower, upper]) {
        fs.imageGain.value = params.frameGain;
        scene.add(fs.mesh);
        disposers.push(fs.dispose);
      }

      const paths: PathSpec[] = [
        { points: sampleWorldline(() => [0, 0], WORLD.t0, WORLD.t1, 2), colour: PAL.a, width: 0.04, tick: params.tick, intensity: 1.3 },
        { points: sampleWorldline(() => [STAR.x, STAR.y], WORLD.t0, WORLD.t1, 2), colour: STAR.colour, width: 0.05, intensity: 0.8 },
        { points: sampleWorldline(planetAt, WORLD.t0, WORLD.t1, 260), colour: PLANET.colour, width: 0.03, intensity: 0.9 },
        ...BEACONS.map((b) => ({
          points: sampleWorldline(() => [b.x, b.y], WORLD.t0, WORLD.t1, 2),
          colour: PAL.cool,
          width: 0.02,
          tick: params.tick,
          intensity: 0.45,
        })),
      ];
      nPaths = paths.length;
      ribbons = createRibbons(kit, paths);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      events = createEvents(
        kit,
        BEACONS.map((b) => ({ p: [b.x, b.t, b.y] as const, colour: b.colour, size: 0.15, intensity: 1.1 })),
        ctx.globals.uElapsed,
      );
      scene.add(events.object);
      disposers.push(events.dispose);

      sheet = createNowSheet(kit, { ...params.sheet, colour: PAL.both });
      scene.add(sheet.mesh);
      disposers.push(sheet.dispose);
      kit.knives[0].width.value = 0.05;
      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      const s = stackState(local);
      sheet.now.value = s.now;
      sheet.opacity.value = s.sheetOn;
      kit.setKnife(0, 0, s.now, 0.45 * s.sheetOn, PAL.both);

      upper.reveal.value = s.now + 0.001;
      upper.highlight.value = s.sheetOn > 0.01 ? s.now : -1e9;
      upper.opacity.value = s.frames;
      lower.opacity.value = s.frames * s.lower;
      lower.highlight.value = -1e9;

      for (let i = 0; i < nPaths; i++) ribbons.set(i, s.reveal, s.threads, 0, i === PATH_A ? 0.5 * s.you : 0);
      BEACONS.forEach((b, i) => events.setIntensity(i, b.t <= s.now ? 1.1 * (0.3 + 0.7 * (1 - s.frames)) : 0));
      events.commit();
      glass.opacity.value = s.glass;
      glass.edges.opacity.value = s.glass;

      const a = params.startCamera;
      const b = params.blockCamera;
      const c = params.pullCamera;
      const k = smooth(s.camera);
      const lerp = (x: number, y: number, z: number) => x + (y - x) * k + (z - y) * s.pull;
      rig.apply(
        { az: lerp(a.az, b.az, c.az), el: lerp(a.el, b.el, c.el), dist: lerp(a.dist, b.dist, c.dist), tx: 0, tt: lerp(a.tt, b.tt, c.tt), ty: 0 },
        elapsed,
      );

      const place = (i: number, x: number, t: number, y: number, o: number) => {
        kit.viewCPU(x, t, y, tmp);
        labels.place(i, tmp.x, tmp.y, tmp.z, rig.camera, o);
      };
      place(L.now!, WORLD.x1, s.now, WORLD.y1, s.sheetOn);
      const fIdx = Math.max(0, Math.min(UPPER_FRAMES - 1, Math.floor((s.now - UPPER_FROM) / FRAME_DT) - 2));
      const tFrame = UPPER_FROM + fIdx * FRAME_DT;
      place(L.frame!, WORLD.x0, tFrame, WORLD.y1, s.frames * (1 - smooth(Math.min(1, Math.max(0, (local - 0.4) / 0.08)))) * (s.now > UPPER_FROM + 2 * FRAME_DT ? 1 : 0));
      place(L.time!, WORLD.x0, WORLD.t1 - 0.2, WORLD.y0, s.glass);
      const tl = Math.min(s.now, WORLD.t1) - 0.35;
      const [px, py] = planetAt(tl);
      const threadsOn = Math.max(0, Math.min(1, (local - 0.4) / 0.06)) * (1 - s.you);
      place(L.planet!, px, tl, py, threadsOn);
      const lamp = BEACONS[4]!;
      place(L.lamp!, lamp.x, Math.min(s.now, WORLD.t1) - 0.3, lamp.y, threadsOn);
      place(L.you!, 0, 1.35, 0, s.you);
      void span;
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
