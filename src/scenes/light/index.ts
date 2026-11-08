// Stage 3 · One speed for everyone. A flash at here-now: on each rising "now" its light is a ring; stacked in the
// block the rings trace a cone. The past cone holds everything that could have reached the flash; outside both is
// elsewhere. Two people's past cones overlap: the shared history. Then the block is viewed from moving frames:
// worldlines and the grid shear, the cone keeps its shape (light's speed is the same for everyone).

import { Scene, Vector3, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { OrbitRig, type RigPose } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL, type RGB } from '../../shared/block/palette.ts';
import { BEACONS, PLANET, STAR, WORLD, planetAt } from '../../shared/world.ts';
import { CONE_H, FRIEND, HISTORY, VENN_H, YOU, inPast, light, lightState } from '../../script/light.ts';
import { createNowSheet } from '../flow/sheet.ts';
import { ramp, smooth, track } from '../../time/tracks.ts';

const params = {
  /** Keyframed camera: stage 2's last pose, close on the flash, the Venn, front-on for the boost, calm. */
  camera: {
    az: track([
      [0, 0.78],
      [0.16, 0.52],
      [0.45, 0.42],
      [0.55, 0.22],
      [0.7, 0.06],
      [0.95, 0.06],
      [1, 0.2],
    ]),
    el: track([
      [0, 0.36],
      [0.16, 0.2],
      [0.45, 0.24],
      [0.55, 0.16],
      [0.7, 0.1],
      [0.95, 0.1],
      [1, 0.18],
    ]),
    dist: track([
      [0, 11.2],
      [0.16, 8.6],
      [0.45, 9.4],
      [0.55, 10.4],
      [0.7, 12.6],
      [0.95, 12.6],
      [1, 12],
    ]),
    tt: track([
      [0, 0],
      [0.16, 0.25],
      [0.45, 0],
      [0.55, 0.15],
      [0.7, 0],
    ]),
  },
  sheet: { rx: 8, ry: 6, core: 3.1, grid: 0.5 },
  castIntensity: 0.35,
  historySize: 0.075,
};

export default function lightScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(34);
  const kit = createKit();
  // The flash's cone has its apex at here-now, which every boost leaves fixed, and a boost maps a light cone onto
  // itself. Drawing it with an unboosted kit keeps its (arbitrary) top and bottom cut level, so the invariance reads.
  const coneKit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  const pose: RigPose = { az: 0, el: 0, dist: 10, tx: 0, tt: 0, ty: 0 };
  let ribbons: ReturnType<typeof createRibbons>;
  let flashEv: ReturnType<typeof createEvents>;
  let history: ReturnType<typeof createEvents>;
  let sheet: ReturnType<typeof createNowSheet>;
  let cone: ReturnType<typeof createLightCone>;
  let coneYou: ReturnType<typeof createLightCone>;
  let coneFriend: ReturnType<typeof createLightCone>;
  let glass: ReturnType<typeof createGlassBlock>;
  let nPaths = 0;
  const member = HISTORY.map((e) => ({ you: inPast(YOU, e), friend: inPast(FRIEND, e) }));

  const labels = new LabelSet([
    { id: 'flash', text: 'a flash · here-now', tone: 'both', side: 'right', size: 'sm' },
    { id: 'front', text: 'its light, spreading', tone: 'light', side: 'right', size: 'sm' },
    { id: 'future', text: 'future cone', tone: 'light', side: 'right', size: 'sm' },
    { id: 'past', text: 'past cone', tone: 'light', side: 'right', size: 'sm' },
    { id: 'elseL', text: 'elsewhere', tone: 'mute', side: 'center', size: 'sm' },
    { id: 'elseR', text: 'elsewhere', tone: 'mute', side: 'center', size: 'sm' },
    { id: 'you', text: 'you', tone: 'a', side: 'above' },
    { id: 'friend', text: 'a friend', tone: 'light', side: 'above' },
    { id: 'shared', text: 'shared history', tone: 'both', side: 'below', size: 'sm' },
    { id: 'same', text: 'the same cone in every frame', tone: 'light', side: 'right', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;

  const self: BlockScene = {
    id: 'light',
    status: 'measured',
    statusNote: light.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      glass = createGlassBlock(kit, WORLD, { grid: 1 });
      glass.add(scene);
      disposers.push(glass.dispose);

      const paths: PathSpec[] = [
        { points: sampleWorldline(() => [0, 0], WORLD.t0, WORLD.t1, 2), colour: PAL.a, width: 0.035, tick: 0.5, intensity: 1 },
        { points: sampleWorldline(() => [STAR.x, STAR.y], WORLD.t0, WORLD.t1, 2), colour: STAR.colour, width: 0.04, intensity: 0.8 },
        { points: sampleWorldline(planetAt, WORLD.t0, WORLD.t1, 260), colour: PLANET.colour, width: 0.024, intensity: 0.8 },
        ...BEACONS.map((b) => ({
          points: sampleWorldline(() => [b.x, b.y], WORLD.t0, WORLD.t1, 2),
          colour: PAL.cool,
          width: 0.018,
          tick: 0.5,
          intensity: 0.5,
        })),
      ];
      nPaths = paths.length;
      ribbons = createRibbons(kit, paths);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      sheet = createNowSheet(kit, { ...params.sheet, colour: PAL.both });
      scene.add(sheet.mesh);
      disposers.push(sheet.dispose);

      cone = createLightCone(coneKit, { rings: 5, rulings: 16 });
      cone.height.value = CONE_H;
      scene.add(cone.mesh);
      disposers.push(cone.dispose);

      const mkVenn = (apex: readonly [number, number, number], colour: RGB) => {
        const c = createLightCone(kit, { rings: 6, rulings: 20, colour });
        c.apex.value.set(apex[0], apex[1], apex[2]);
        c.height.value = VENN_H;
        c.future.value = 0;
        scene.add(c.mesh);
        disposers.push(c.dispose);
        return c;
      };
      coneYou = mkVenn(YOU, PAL.a);
      coneFriend = mkVenn(FRIEND, PAL.light);

      history = createEvents(
        kit,
        HISTORY.map((e) => ({ p: [e.x, e.t, e.y] as const, colour: PAL.cool, size: params.historySize, intensity: 0 })),
        ctx.globals.uElapsed,
        { pulse: 0.12 },
      );
      member.forEach((m, i) => history.setColour(i, m.you && m.friend ? PAL.both : m.you ? PAL.a : m.friend ? PAL.light : PAL.cool));
      history.commit();
      scene.add(history.object);
      disposers.push(history.dispose);

      flashEv = createEvents(kit, [{ p: [0, 0, 0], colour: PAL.both, size: 0.2, intensity: 1 }], ctx.globals.uElapsed);
      scene.add(flashEv.object);
      disposers.push(flashEv.dispose);
      kit.knives[0].width.value = 0.05;
      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      const s = lightState(local);
      kit.setBeta(s.beta);
      sheet.now.value = s.now;
      sheet.opacity.value = s.sheetOn;
      kit.setKnife(0, 0, s.now, 0.4 * s.sheetOn, PAL.both);

      cone.future.value = s.future;
      cone.past.value = s.past;
      cone.opacity.value = s.coneOn;
      const vennGrow = ramp(local, 0.53, 0.6);
      coneYou.past.value = vennGrow;
      coneFriend.past.value = vennGrow;
      coneYou.opacity.value = s.venn;
      coneFriend.opacity.value = s.venn;

      const castDim = params.castIntensity + (1 - params.castIntensity) * (1 - ramp(local, 0.08, 0.16)) + 0.4 * ramp(local, 0.68, 0.74);
      for (let i = 0; i < nPaths; i++) ribbons.set(i, 1, castDim * (1 - 0.6 * s.venn));
      glass.opacity.value = 1 - 0.4 * s.venn;

      const showFlash = local > 0.11 ? 1 : 0;
      flashEv.setIntensity(0, showFlash * (0.9 + 5 * s.flash));
      flashEv.setSize(0, 0.14 + 0.3 * s.flash);
      flashEv.commit();
      member.forEach((m, i) => {
        const w = m.you && m.friend ? 1.8 : m.you || m.friend ? 0.7 : 0.15;
        history.setIntensity(i, w * s.venn);
      });
      history.commit();

      pose.az = params.camera.az(local);
      pose.el = params.camera.el(local);
      pose.dist = params.camera.dist(local);
      pose.tt = params.camera.tt(local);
      rig.apply(pose, elapsed);

      const place = (i: number, x: number, t: number, y: number, o: number) => {
        kit.viewCPU(x, t, y, tmp);
        labels.place(i, tmp.x, tmp.y, tmp.z, rig.camera, o);
      };
      const intro = ramp(local, 0.12, 0.16) * (1 - ramp(local, 0.3, 0.34));
      place(L.flash!, 0.08, 0, 0, intro);
      const r = Math.max(0, Math.min(CONE_H, s.now));
      place(L.front!, r * 0.72, Math.max(0, s.now), r * 0.69, ramp(local, 0.2, 0.24) * s.sheetOn * (1 - ramp(local, 0.34, 0.36)));
      const zones = s.zones;
      place(L.future!, 1.25, 1.35, 0, zones);
      place(L.past!, 1.25, -1.35, 0, zones);
      place(L.elseL!, -2.3, 0, 0, zones);
      place(L.elseR!, 2.3, 0, 0, zones);
      const v = ramp(local, 0.55, 0.58) * s.venn;
      place(L.you!, YOU[0], YOU[1] + 0.05, YOU[2], v);
      place(L.friend!, FRIEND[0], FRIEND[1] + 0.05, FRIEND[2], v);
      place(L.shared!, 0.15, -0.55, 0.15, ramp(local, 0.59, 0.62) * s.venn);
      place(L.same!, CONE_H * 0.98, CONE_H * 0.8, 0, s.boostLabel * smooth(Math.min(1, Math.abs(s.beta) / 0.3 + 0.0)));
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
