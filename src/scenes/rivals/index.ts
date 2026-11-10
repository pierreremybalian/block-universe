// Stage 13 · Is it true? — the Quadtych (HANDOFF §9, §10.12). The same shared block (src/shared/world.ts) is drawn
// four times, and only one thing differs between the panels: what each view of time says exists. Presentism keeps
// only the slice; the growing block keeps the slice and everything below; the moving spotlight keeps everything
// and lights one slice; the block universe keeps everything and lights none. The now climbs at the same pace in
// all four. Later, the one structure all four agree on appears: the light cone at A's here-now (Stein 1968).

import {
  AdditiveBlending,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  type RenderTarget,
  type WebGPURenderer,
} from 'three/webgpu';
import { exp, float, min, uniform, uv, vec3, vec4 } from 'three/tsl';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { renderInPanel, renderPanels } from '../../shared/block/panels.ts';
import { LabelSet, type Panel } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { BEACONS, CAUSAL, PLANET, STAR, WORLD, beacon, planetAt } from '../../shared/world.ts';
void PLANET;
import { VIEWS, rivals, rivalsState } from '../../script/rivals.ts';
import { smooth } from '../../time/tracks.ts';

const params = {
  camera: { az: 0.6, el: 0.3, dist: 10.4, distStrip: 15.2, fov: 32, tt: 0.7, ttStrip: 0.35 },
  tick: 0.5,
  /** Region of the screen the four panels fill (fractions, top-left origin); the caption sits to the left. */
  /** Wide screens: four panels side by side across the top; the caption sits below. */
  regionWide: { x: 0.03, y: 0.15, w: 0.94, h: 0.44 },
  /** Tall screens: a 2 × 2 grid above the caption. */
  regionTall: { x: 0.02, y: 0.12, w: 0.96, h: 0.5 },
  gap: 0.012,
  presentWidth: 0.11,
  knifeWidth: 0.07,
};

/** A thin frame around a panel (no shade), drawn after the panel's content. */
function createOutline() {
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const aspect = uniform(1);
  const glow = uniform(0.4);
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const p = uv().sub(0.5).mul(2);
  const d = min(aspect.sub(p.x.abs().mul(aspect)), float(1).sub(p.y.abs()));
  const line = exp(d.mul(220).abs().pow(2).negate());
  mat.colorNode = vec4(vec3(0.62, 0.68, 0.9).mul(line).mul(glow), 1);
  const quad = new Mesh(new PlaneGeometry(2, 2), mat);
  scene.add(quad);
  return {
    scene,
    camera,
    aspect,
    glow,
    dispose() {
      quad.geometry.dispose();
      mat.dispose();
    },
  };
}

export default function rivalsScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  const outline = createOutline();
  const disposers: (() => void)[] = [outline.dispose];
  const tmp = new Vector3();
  let state = rivalsState(0);
  let strip = true;
  const panels: Panel[] = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, w: 0.5, h: 0.5 }));

  const labels = new LabelSet([
    ...VIEWS.map((v) => ({ id: `t-${v.id}`, text: v.title, tone: 'plain' as const, side: 'right' as const })),
    ...VIEWS.map((v) => ({ id: `l-${v.id}`, text: v.line, tone: 'mute' as const, side: 'right' as const })),
    { id: 'now', text: 'now', tone: 'a', side: 'left', size: 'sm' },
    {
      id: 'cone',
      text: 'The light cone at A’s here-now: the same in all four',
      tone: 'light',
      side: 'center',
      size: 'sm',
    },
  ]);

  let ribbons: ReturnType<typeof createRibbons>;
  let events: ReturnType<typeof createEvents>;
  let knife: ReturnType<typeof createKnife>;
  let cone: ReturnType<typeof createLightCone>;
  let glass: ReturnType<typeof createGlassBlock>;

  const self: BlockScene = {
    id: 'rivals',
    status: 'open',
    statusNote: rivals.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      glass = createGlassBlock(kit, WORLD, { grid: 1 });
      glass.add(scene);
      disposers.push(glass.dispose);
      ribbons = createRibbons(kit, [
        {
          points: [
            [0, WORLD.t0, 0],
            [0, WORLD.t1, 0],
          ],
          colour: PAL.a,
          width: 0.045,
          tick: params.tick,
          intensity: 1.3,
        },
        {
          points: [
            [STAR.x, WORLD.t0, STAR.y],
            [STAR.x, WORLD.t1, STAR.y],
          ],
          colour: PAL.moon,
          width: 0.04,
          intensity: 0.45,
        },
        {
          points: sampleWorldline(planetAt, WORLD.t0, WORLD.t1, 260),
          colour: PLANET.colour,
          width: 0.026,
          intensity: 0.7,
        },
        ...BEACONS.map((b) => ({
          points: [
            [b.x, WORLD.t0, b.y],
            [b.x, WORLD.t1, b.y],
          ],
          colour: PAL.cool,
          width: 0.022,
          tick: params.tick,
          intensity: 0.38,
        })),
        ...CAUSAL.map((c) => {
          const a = beacon(c.from);
          const b = beacon(c.to);
          return {
            points: [
              [a.x, a.t, a.y],
              [b.x, b.t, b.y],
            ],
            colour: c.kind === 'light' ? PAL.light : PAL.line,
            width: 0.024,
            intensity: c.kind === 'light' ? 1.4 : 0.8,
            dashed: c.kind === 'messenger' ? 0.12 : 0,
            spacelike: true,
            sliceResponse: 0,
          };
        }),
      ]);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);
      events = createEvents(
        kit,
        BEACONS.map((b) => ({ p: [b.x, b.t, b.y] as const, colour: b.colour, size: 0.2, intensity: 1.2 })),
        ctx.globals.uElapsed,
      );
      scene.add(events.object);
      disposers.push(events.dispose);
      knife = createKnife(kit, WORLD, { colour: PAL.a, grid: 1 });
      scene.add(knife.mesh);
      disposers.push(knife.dispose);
      cone = createLightCone(kit, { rings: 4 });
      cone.height.value = 1.5;
      scene.add(cone.mesh);
      disposers.push(cone.dispose);
      kit.knives[0].width.value = params.knifeWidth;
      kit.exist.presentWidth.value = params.presentWidth;
      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = rivalsState(local);
      const s = state;
      knife.set(0, s.now, 1);
      cone.apex.value.set(0, s.now, 0);
      cone.opacity.value = s.cone;
      const c = params.camera;
      rig.apply(
        {
          az: c.az,
          el: c.el,
          dist: strip ? c.distStrip : c.dist,
          tx: 0,
          tt: strip ? c.ttStrip : c.tt,
          ty: 0,
        },
        elapsed,
      );
      placeLabels();
    },

    render(target: RenderTarget) {
      const s = state;
      renderPanels(
        renderer,
        target,
        scene,
        rig.camera,
        panels,
        (i) => {
          // Reset, then apply this panel's reading of the same block.
          let present = 0;
          let growing = 0;
          let strength = 1;
          let sheet = 1;
          let dim = 1;
          if (i === 0) present = smooth(s.presentism);
          if (i === 1) growing = smooth(s.growing);
          if (i === 2) {
            strength = 1 + 1.6 * smooth(s.spotlight);
            dim = 1 - 0.5 * smooth(s.spotlight);
          }
          if (i === 3) {
            strength = 1 - smooth(s.block);
            sheet = 1 - smooth(s.block);
          }
          kit.exist.present.value = present;
          kit.exist.growing.value = growing;
          kit.setKnife(0, 0, s.now, strength, PAL.a);
          knife.opacity.value = sheet;
          ribbons.opacity.value = dim;
          events.opacity.value = dim;
        },
        (i, p) => {
          const W = target.width;
          const H = target.height;
          outline.aspect.value = (p.w * W) / Math.max(1, p.h * H);
          outline.glow.value = s.focus === i ? 0.95 : 0.35;
          renderInPanel(renderer, target, outline.scene, outline.camera, p);
        },
      );
      kit.exist.present.value = 0;
      kit.exist.growing.value = 0;
    },

    resize(w, h) {
      rig.resize(w, h);
      const wide = w / h >= 1.1;
      strip = wide;
      const r = wide ? params.regionWide : params.regionTall;
      const cols = wide ? 4 : 2;
      const rows = wide ? 1 : 2;
      const g = params.gap;
      const pw = (r.w - g * (cols - 1)) / cols;
      const ph = (r.h - g * (rows - 1)) / rows;
      panels.forEach((p, i) => {
        p.x = r.x + (i % cols) * (pw + g);
        p.y = r.y + Math.floor(i / cols) * (ph + g);
        p.w = pw;
        p.h = ph;
      });
    },

    dispose() {
      for (const d of disposers) d();
    },
  };

  function placeLabels() {
    const s = state;
    VIEWS.forEach((v, i) => {
      const p = panels[i]!;
      const on = s.focus === -1 || s.focus === i ? 1 : 0.5;
      const lit = [s.presentism, s.growing, s.spotlight, s.block][i]!;
      labels.placeScreen(labels.index(`t-${v.id}`), p.x + 0.012, p.y + 0.038, on);
      labels.placeScreen(labels.index(`l-${v.id}`), p.x + 0.012, p.y + 0.072, on * smooth(lit));
    });
    // "now" and the cone, in the first panel (camera aspect matches every panel).
    const cam = rig.camera;
    const p0 = panels[0]!;
    const a0 = cam.aspect;
    cam.aspect = (p0.w * window.innerWidth) / Math.max(1, p0.h * window.innerHeight);
    cam.updateProjectionMatrix();
    kit.viewCPU(WORLD.x1, s.now, WORLD.y0, tmp);
    labels.place(labels.index('now'), tmp.x, tmp.y, tmp.z, cam, 1 - s.cone, p0);
    const p3 = panels[3]!;
    labels.placeScreen(labels.index('cone'), (p0.x + p3.x + p3.w) / 2, p3.y + p3.h + 0.04, s.cone);
    cam.aspect = a0;
    cam.updateProjectionMatrix();
  }

  return self;
}
