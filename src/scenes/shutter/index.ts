// Stage 7 · A now is a rolling shutter (HANDOFF §9 Rolling Shutter, §10.7).
// A rotor's history stacked into the block as a film stack: its blades sweep out a twisted volume. A flat knife
// (A's now) and a tilted knife (B's now) cut it; each knife's face shows the "photograph" of its slice. Then both
// photographs are laid flat side by side: same rotor, same block, but B's blades bend.

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
import { atan, exp, float, fract, length, max, min, sin, smoothstep, uniform, uv, vec2, vec3, vec4, abs } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit } from '../../shared/block/kit.ts';
import { createGlassBlock } from '../../shared/block/glassBlock.ts';
import { createRibbons, sampleWorldline } from '../../shared/block/ribbons.ts';
import { createKnife } from '../../shared/block/knife.ts';
import { createFilmStack } from '../../shared/block/filmStack.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { createPanelFrame, renderInPanel } from '../../shared/block/panels.ts';
import { LabelSet, type Panel } from '../../shared/block/labels.ts';
import { PAL } from '../../shared/block/palette.ts';
import { ROTOR, SHUTTER_BOUNDS as B, shutter, shutterState } from '../../script/shutter.ts';
import { smooth } from '../../time/tracks.ts';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

const params = {
  camera: { az: 0.55, el: 0.34, dist: 9.4, fov: 34 },
  /** While the photographs are up, the block moves left to make room. */
  photoCamera: { az: 0.42, el: 0.3, dist: 13.4, tx: 3.5, tt: -0.75 },
  pullCamera: { az: 0.8, el: 0.42, dist: 10.6 },
  /** Frames in the film stack per quality detail unit. */
  frames: 34,
  stackGain: 0.42,
  bladeColour: [1.0, 0.9, 0.78] as const,
  tipColour: [1.0, 0.36, 0.3] as const,
  lightColours: [PAL.green, [1.0, 0.45, 0.85] as const] as const,
  /** Photograph panel height as a fraction of the screen; gap between panels. */
  photoH: 0.44,
  photoGap: 0.022,
  photoTop: 0.24,
};

/** The rotor at time t, as seen at (x, y): three tapered blades (one with a red tip), a hub, two orbiting lights. */
function rotorImage(x: F, t: F, y: F): V3 {
  const r = length(vec2(x, y));
  const phi = atan(y, x);
  const a = phi.sub(t.mul(ROTOR.omega)).mul(ROTOR.blades / (2 * Math.PI));
  const f = fract(a.add(0.5)).sub(0.5);
  const ang = abs(f).mul((2 * Math.PI) / ROTOR.blades);
  const perp = r.mul(sin(min(ang, float(1.5))));
  const width = float(0.085).sub(r.mul(0.032));
  const along = smoothstep(0.1, 0.22, r).mul(float(1).sub(smoothstep(ROTOR.r - 0.05, ROTOR.r, r)));
  // Crisp body with a soft glow around it.
  const body = float(1).sub(smoothstep(width.mul(0.55), width, perp));
  const glow = exp(perp.div(width.mul(2.2)).pow(2).negate()).mul(0.22);
  const blade = body.add(glow).mul(along);
  // The blade whose index is 0 gets a red tip, so rotation reads in every photograph.
  const k = a.add(0.5).floor();
  const isFirst = float(1).sub(smoothstep(0.1, 0.4, abs(fract(k.div(ROTOR.blades)))));
  const tip = smoothstep(ROTOR.r * 0.62, ROTOR.r * 0.78, r).mul(isFirst);
  const bc = params.bladeColour;
  const tc = params.tipColour;
  let col: V3 = vec3(bc[0], bc[1], bc[2]).mul(blade.mul(float(1).sub(tip)))
    .add(vec3(tc[0], tc[1], tc[2]).mul(blade.mul(tip).mul(1.4)));
  col = col.add(vec3(1.0, 0.85, 0.6).mul(float(1).sub(smoothstep(0.07, 0.1, r)).mul(1.1)));
  for (let i = 0; i < ROTOR.lights; i++) {
    const th = t.mul(ROTOR.orbitOmega).add((i * 2 * Math.PI) / ROTOR.lights);
    const dx = x.sub(th.cos().mul(ROTOR.orbitR));
    const dy = y.sub(th.sin().mul(ROTOR.orbitR));
    const c = params.lightColours[i]!;
    const d2 = dx.mul(dx).add(dy.mul(dy));
    col = col.add(vec3(c[0], c[1], c[2]).mul(float(1).sub(smoothstep(0.0036, 0.0064, d2)).mul(1.5).add(exp(d2.div(0.03).negate()).mul(0.35))));
  }
  return col;
}

export default function shutterScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.camera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let state = shutterState(0);

  const labels = new LabelSet([
    { id: 'rotor', text: 'a rotor’s history', tone: 'mute', side: 'right', size: 'sm' },
    { id: 'nowA', text: 'A’s now', tone: 'a', side: 'left', size: 'sm' },
    { id: 'nowB', text: 'B’s now', tone: 'b', side: 'right', size: 'sm' },
    { id: 'photoA', text: 'A’s photograph', tone: 'a', side: 'center', size: 'sm' },
    { id: 'photoB', text: 'B’s photograph', tone: 'b', side: 'center', size: 'sm' },
  ]);
  const L = {
    rotor: labels.index('rotor'),
    nowA: labels.index('nowA'),
    nowB: labels.index('nowB'),
    photoA: labels.index('photoA'),
    photoB: labels.index('photoB'),
  };

  let stack: ReturnType<typeof createFilmStack>;
  let knifeA: ReturnType<typeof createKnife>;
  let knifeB: ReturnType<typeof createKnife>;
  let ribbons: ReturnType<typeof createRibbons>;

  // Flat photographs: two quads in their own scene, drawn into panels.
  const photoScene = new Scene();
  const photoCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uPhotoT = uniform(0);
  const uPhotoBeta = uniform(0);
  const uPhotoGain = uniform(1);
  const photoGeo = new PlaneGeometry(2, 2);
  // Additive over the panel frame's dark backdrop, so the frame's outline stays visible.
  const photoMat = new MeshBasicNodeMaterial({ depthTest: false, depthWrite: false, transparent: true, blending: AdditiveBlending });
  const p = uv().sub(0.5).mul(2);
  const half = (B.x1 - B.x0) / 2;
  const px = p.x.mul(half);
  const py = p.y.mul(half);
  const tPhoto = uPhotoBeta.mul(px).add(uPhotoT);
  const vign = float(1).sub(smoothstep(0.82, 1.0, max(abs(p.x), abs(p.y))).mul(0.4));
  photoMat.colorNode = vec4(rotorImage(px, tPhoto, py).mul(uPhotoGain).mul(vign), 1);
  const photoQuad = new Mesh(photoGeo, photoMat);
  photoScene.add(photoQuad);
  const frameA = createPanelFrame([1.0, 0.62, 0.3]);
  const frameB = createPanelFrame([0.35, 0.8, 1.0]);
  const panelA: Panel = { x: 0, y: 0, w: 0, h: 0 };
  const panelB: Panel = { x: 0, y: 0, w: 0, h: 0 };
  let aspect = 16 / 9;

  const self: BlockScene = {
    id: 'shutter',
    status: 'metaphor',
    statusNote: shutter.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      const glass = createGlassBlock(kit, B, { grid: 0.55, edgeIntensity: 0.5 });
      glass.gridOpacity.value = 0.45;
      glass.add(scene);
      disposers.push(glass.dispose);

      stack = createFilmStack(kit, B, {
        frames: Math.max(16, Math.round(params.frames * ctx.quality.detail)),
        imageFn: rotorImage,
      });
      stack.edgeGain.value = 0.35;
      scene.add(stack.mesh);
      disposers.push(stack.dispose);

      // The axle and the two lights' threads through the block.
      ribbons = createRibbons(kit, [
        { points: [[0, B.t0, 0], [0, B.t1, 0]], colour: [1, 0.85, 0.6], width: 0.025, intensity: 0.55 },
        ...Array.from({ length: ROTOR.lights }, (_, i) => ({
          points: sampleWorldline(
            (t) => {
              const th = t * ROTOR.orbitOmega + (i * 2 * Math.PI) / ROTOR.lights;
              return [Math.cos(th) * ROTOR.orbitR, Math.sin(th) * ROTOR.orbitR] as const;
            },
            B.t0,
            B.t1,
            180,
          ),
          colour: params.lightColours[i]!,
          width: 0.018,
          intensity: 0.5,
        })),
      ]);
      scene.add(ribbons.mesh);
      disposers.push(ribbons.dispose);

      knifeA = createKnife(kit, B, { colour: PAL.a, imageFn: rotorImage, grid: 0 });
      knifeB = createKnife(kit, B, { colour: PAL.b, imageFn: rotorImage, grid: 0 });
      scene.add(knifeA.mesh, knifeB.mesh);
      disposers.push(knifeA.dispose, knifeB.dispose);
      kit.knives[0].width.value = 0.05;
      kit.knives[1].width.value = 0.05;

      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = shutterState(local);
      const s = state;
      stack.reveal.value = s.reveal;
      stack.highlight.value = s.knifeA > 0.01 ? -1e9 : s.reveal;
      stack.imageGain.value = params.stackGain * s.stackGain;
      knifeA.set(0, s.c, s.knifeA * 0.8);
      knifeB.set(s.beta, s.c, s.knifeB * 0.8);
      knifeA.image.value = s.image * s.knifeA * 1.4;
      knifeB.image.value = s.image * s.knifeB * 1.4;
      kit.setKnife(0, 0, s.c, s.knifeA * 0.6, PAL.a);
      kit.setKnife(1, s.beta, s.c, s.knifeB * 0.6, PAL.b);
      ribbons.set(0, 1, 1);
      for (let i = 1; i <= ROTOR.lights; i++) ribbons.set(i, Math.min(1, Math.max(0, (s.reveal - B.t0) / (B.t1 - B.t0))), 1);

      const c = params.camera;
      const ph = params.photoCamera;
      const pc = params.pullCamera;
      const k = smooth(s.photos);
      rig.apply(
        {
          az: c.az + (ph.az - c.az) * k + (pc.az - c.az) * s.pull,
          el: c.el + (ph.el - c.el) * k + (pc.el - c.el) * s.pull,
          dist: c.dist + (ph.dist - c.dist) * k + (pc.dist - c.dist) * s.pull,
          tx: ph.tx * k,
          tt: ph.tt * k,
          ty: 0,
        },
        elapsed,
      );

      // Photograph panels: two squares side by side on the right.
      const h = params.photoH;
      const w = h / aspect;
      const right = 0.965;
      panelB.x = right - w;
      panelA.x = panelB.x - params.photoGap / aspect - w;
      panelA.y = panelB.y = params.photoTop;
      panelA.w = panelB.w = w;
      panelA.h = panelB.h = h;

      kit.setBeta(0);
      const place = (i: number, x: number, t: number, y: number, o: number) => {
        kit.viewCPU(x, t, y, tmp);
        labels.place(i, tmp.x, tmp.y, tmp.z, rig.camera, o);
      };
      place(L.rotor, B.x1, B.t1 - 0.25, B.y0, Math.max(0, 1 - s.knifeA) * Math.min(1, (s.reveal - B.t0) / 1.5) * (1 - k));
      place(L.nowA, B.x0, s.c, B.y1, s.knifeA * (1 - k));
      place(L.nowB, B.x1, s.beta * B.x1 + s.c, B.y1, s.knifeB * (1 - k));
      labels.placeScreen(L.photoA, panelA.x + w / 2, panelA.y - 0.035, k);
      labels.placeScreen(L.photoB, panelB.x + w / 2, panelB.y - 0.035, k);
    },

    render(target: RenderTarget) {
      kit.setBeta(0);
      renderer.setRenderTarget(target);
      renderer.render(scene, rig.camera);
      const k = smooth(state.photos);
      if (k < 0.002) return;
      uPhotoGain.value = k * 1.15;
      uPhotoT.value = state.c;
      for (const [panel, frame, beta] of [
        [panelA, frameA, 0],
        [panelB, frameB, state.beta],
      ] as const) {
        frame.opacity.value = k;
        frame.aspect.value = 1;
        renderInPanel(renderer, target, frame.scene, frame.camera, panel);
        uPhotoBeta.value = beta;
        renderInPanel(renderer, target, photoScene, photoCam, panel);
      }
    },

    resize(w, h) {
      rig.resize(w, h);
      aspect = w / Math.max(1, h);
    },

    dispose() {
      for (const d of disposers) d();
      photoGeo.dispose();
      photoMat.dispose();
      frameA.dispose();
      frameB.dispose();
    },
  };
  return self;
}
