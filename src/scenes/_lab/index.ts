// Lab scene: exercises every block primitive (dev only). Not part of the journey.

import { Scene, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline } from '../../shared/block/ribbons.ts';
import { createEvents } from '../../shared/block/events.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createLightCone } from '../../shared/block/cones.ts';
import { createBowls } from '../../shared/block/bowl.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { renderPanels } from '../../shared/block/panels.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { Vector3 } from 'three/webgpu';

export default function lab(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig();
  const kit = createKit();
  const B: Bounds = { x0: -2, x1: 2, t0: -1.5, t1: 1.5, y0: -1.2, y1: 1.2 };
  const disposers: (() => void)[] = [];
  let local = 0;
  const labels = new LabelSet([
    { id: 'earth', text: 'Earth', tone: 'plain' },
    { id: 'a', text: 'A’s now', tone: 'a', size: 'sm' },
    { id: 'b', text: 'B’s now', tone: 'b', size: 'sm' },
  ]);
  const tmp = new Vector3();
  let split = false;

  const self: BlockScene = {
    id: '_lab',
    status: 'established',
    statusNote: 'Lab scene.',
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      split = new URLSearchParams(location.search).get('split') === '1';
      const glass = createGlassBlock(kit, B, { grid: 0.5 });
      glass.add(scene);
      disposers.push(glass.dispose);
      const ribbons = createRibbons(kit, [
        { points: sampleWorldline(() => [0, 0], B.t0, B.t1, 2), colour: PAL.sun, width: 0.05, tick: 0.25, intensity: 1.2 },
        { points: sampleWorldline((t) => [0.8 * Math.cos(t * 4), 0.8 * Math.sin(t * 4)], B.t0, B.t1, 400), colour: PAL.earth, width: 0.035, tick: 0.25 },
        { points: sampleWorldline((t) => [1.6 + 0.0 * t, -0.4], B.t0, B.t1, 2), colour: PAL.andromeda, width: 0.04, tick: 0.25 },
        { points: sampleWorldline((t) => [0.5 * t, 0.6], B.t0, B.t1, 2), colour: PAL.line, width: 0.03, tick: 0.25 },
      ]);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);
      const ev = createEvents(
        kit,
        [
          { p: [0, 0, 0], colour: PAL.both, size: 0.14, intensity: 1.5 },
          { p: [1.6, 0.4, -0.4], colour: PAL.andromeda, size: 0.12 },
          { p: [-1.2, -0.3, 0.4], colour: PAL.line, size: 0.1 },
        ],
        ctx.globals.uElapsed,
      );
      scene.add(ev.object);
      disposers.push(ev.dispose);
      const kA = createKnife(kit, B, { colour: PAL.a, grid: 0.5 });
      const kB = createKnife(kit, B, { colour: PAL.b, grid: 0.5 });
      kA.set(0, 0);
      kB.set(0.45, 0);
      scene.add(kA.mesh, kB.mesh);
      disposers.push(kA.dispose, kB.dispose);
      kit.setKnife(0, 0, 0, 1, PAL.a);
      kit.setKnife(1, 0.45, 0, 1, PAL.b);
      const cone = createLightCone(kit);
      cone.apex.value.set(-1.2, -0.3, 0.4);
      cone.height.value = 1.1;
      scene.add(cone.mesh);
      disposers.push(cone.dispose);
      const bowls = createBowls(kit, [0.5, 1.0], 1.2);
      bowls.origin.value.set(0, -1.5, 0);
      bowls.tMax.value = 3;
      bowls.opacity.value = 0.6;
      scene.add(bowls.mesh);
      disposers.push(bowls.dispose);
      await renderer.compileAsync(scene, rig.camera);
    },
    update(l, _dt, elapsed) {
      local = l;
      kit.setBeta(split ? 0 : (l - 0.5) * 1.2);
      rig.apply({ az: 0.6 + l * 0.6, el: 0.32, dist: 7.5, tx: 0, tt: 0, ty: 0 }, elapsed);
      labels.place(0, ...kit.viewCPU(0.8, 1.2, 0, tmp).toArray(), rig.camera, 1);
      labels.place(1, ...kit.viewCPU(-2, 0, -1.2, tmp).toArray(), rig.camera, 1);
      labels.place(2, ...kit.viewCPU(2, 0.9, 1.2, tmp).toArray(), rig.camera, 1);
    },
    render(target: RenderTarget) {
      if (!split) {
        renderer.setRenderTarget(target);
        renderer.render(scene, rig.camera);
        return;
      }
      renderPanels(
        renderer,
        target,
        scene,
        rig.camera,
        [
          { x: 0, y: 0, w: 0.5, h: 1 },
          { x: 0.5, y: 0, w: 0.5, h: 1 },
        ],
        (i) => kit.setBeta(i === 0 ? 0 : 0.45 + 0 * local),
      );
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
