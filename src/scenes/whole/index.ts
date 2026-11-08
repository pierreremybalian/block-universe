// Stage 13 · The block of everything (HANDOFF §10.13). Cosmic time runs up from the Big Bang to today; distance is
// proper distance, in the same scale, so light near us still travels at 45°. Our past light cone, computed from
// Planck 2018 ΛCDM, is a teardrop: it widens to 5.85 billion light-years and narrows back to the Big Bang because
// space was smaller then. Galaxy worldlines spread apart with expansion; each is seen where it crosses the cone.

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
  Scene,
  Vector3,
  type RenderTarget,
  type WebGPURenderer,
} from 'three/webgpu';
import { abs, attribute, exp, float, fract, fwidth, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { BlockScene, RenderContext } from '../types.ts';
import { createKit, type BlockKit } from '../../shared/block/kit.ts';
import { createGlassBlock, type Bounds } from '../../shared/block/glassBlock.ts';
import { createRibbons, type PathSpec } from '../../shared/block/ribbons.ts';
import { createEvents, type EventSpec } from '../../shared/block/events.ts';
import { OrbitRig } from '../../shared/block/rig.ts';
import { LabelSet } from '../../shared/block/labels.ts';
import { PAL, type RGB } from '../../shared/block/palette.ts';
import { mulberry32 } from '../../shared/math.ts';
import {
  AGE_GYR,
  CMB,
  CONE,
  CONE_MAX,
  aAtGyr,
  sightingOf,
  tDisp,
  whole,
  wholeState,
  xDisp,
} from '../../script/whole.ts';
import { smooth } from '../../time/tracks.ts';

const B: Bounds = { x0: -3.3, x1: 3.3, t0: -2, t1: 2.02, y0: -3.3, y1: 3.3 };

const params = {
  startCamera: { az: 0.55, el: 0.36, dist: 6.6, tx: 0, tt: 0.95, ty: 0, fov: 34 },
  revealCamera: { az: 0.7, el: 0.24, dist: 8.2, tx: 0, tt: 0.1, ty: 0 },
  wideCamera: { az: 1.05, el: 0.17, dist: 10.6, tx: 0, tt: 0.15, ty: 0 },
  galaxies: 34,
  /** Comoving distances of the galaxies (Gly). */
  chiMin: 1.4,
  chiMax: 11.5,
  coneColour: PAL.light,
  galaxyColour: [0.82, 0.86, 1.0] as RGB,
  cmbColour: [1.0, 0.55, 0.32] as RGB,
  /** Rings on the cone every this many Gyr of cosmic time. */
  ringGyr: 1,
};

/** Our past light cone as a surface of revolution; `reveal` (display t) hides what is below it, with a lit front. */
function createTeardrop(kit: BlockKit) {
  const segA = 128;
  const n = CONE.length;
  const pos: number[] = [];
  const at: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j < n; j++) {
    const c = CONE[j]!;
    const r = xDisp(c.properGly);
    const t = tDisp(c.tGyr);
    for (let i = 0; i <= segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      pos.push(r * Math.cos(a), t, r * Math.sin(a));
      at.push(i / segA, c.tGyr, 0, 0);
    }
  }
  for (let j = 0; j < n - 1; j++)
    for (let i = 0; i < segA; i++) {
      const a = j * (segA + 1) + i;
      const b = a + segA + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aCone', new Float32BufferAttribute(at, 4));
  geo.setIndex(idx);
  const reveal = uniform(10);
  const opacity = uniform(1);
  const colour = uniform(new Color(params.coneColour[0], params.coneColour[1], params.coneColour[2]));
  const P = attribute<'vec3'>('position', 'vec3');
  const A = attribute<'vec4'>('aCone', 'vec4');
  const rv = A.x.mul(24);
  const ruling = float(1).sub(smoothstep(float(0), fwidth(rv).mul(1.2), abs(fract(rv.add(0.5)).sub(0.5))));
  const gv = A.y.div(params.ringGyr);
  const ring = float(1).sub(smoothstep(float(0), fwidth(gv).mul(1.2), abs(fract(gv.add(0.5)).sub(0.5))));
  const t = P.y;
  const shown = smoothstep(reveal.sub(0.02), reveal.add(0.02), t);
  const front = exp(t.sub(reveal).div(0.03).abs().pow(2).negate()).mul(smoothstep(-1.98, -1.9, reveal));
  const lum = float(0.035).add(ruling.mul(0.12)).add(ring.mul(0.09)).mul(shown).add(front.mul(1.4));
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  mat.positionNode = kit.toView(P);
  mat.colorNode = vec4(colour.mul(lum).mul(opacity), 1);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    reveal,
    opacity,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** The hot early universe up to last scattering: a soft radial glow on the floor of the block, brightest at the Big Bang. */
function createFloor(kit: BlockKit, t: number, half: number, colour: RGB) {
  const geo = new BufferGeometry();
  geo.setAttribute(
    'position',
    new Float32BufferAttribute([-half, t, -half, half, t, -half, half, t, half, -half, t, half], 3),
  );
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  const opacity = uniform(1);
  const P = attribute<'vec3'>('position', 'vec3');
  const r2 = P.x.mul(P.x).add(P.z.mul(P.z));
  const glow = exp(r2.div(0.35).negate())
    .mul(0.5)
    .add(exp(r2.div(4.5).negate()).mul(0.06));
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  mat.positionNode = kit.toView(P);
  mat.colorNode = vec4(vec3(colour[0], colour[1], colour[2]).mul(glow).mul(opacity), 1);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    opacity,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

export default function wholeScene(): BlockScene {
  let renderer: WebGPURenderer;
  const scene = new Scene();
  const rig = new OrbitRig(params.startCamera.fov);
  const kit = createKit();
  const disposers: (() => void)[] = [];
  const tmp = new Vector3();
  let state = wholeState(0);

  const labels = new LabelSet([
    { id: 'here', text: 'Here and now', tone: 'plain', side: 'right' },
    { id: 'us', text: 'Our galaxy', tone: 'warm', side: 'right', size: 'sm' },
    { id: 'cone', text: 'Our past light cone', tone: 'light', side: 'right', size: 'sm' },
    { id: 'widest', text: '', tone: 'light', side: 'right', size: 'sm' },
    { id: 'bang', text: 'Big Bang', tone: 'warm', side: 'right', size: 'sm' },
    { id: 'seen', text: 'What we see of a galaxy today', tone: 'plain', side: 'right', size: 'sm' },
    { id: 'cmb', text: 'Last scattering: the CMB', tone: 'warm', side: 'right', size: 'sm' },
    { id: 'galaxies', text: 'Galaxies drifting apart', tone: 'mute', side: 'right', size: 'sm' },
  ]);
  const L = Object.fromEntries(labels.specs.map((s, i) => [s.id, i])) as Record<string, number>;
  labels.setText(L.widest!, `Widest: ${CONE_MAX.properGly.toFixed(2)} billion light-years`);

  let cone: ReturnType<typeof createTeardrop>;
  let lines: ReturnType<typeof createRibbons>;
  let sightings: ReturnType<typeof createEvents>;
  let marks: ReturnType<typeof createEvents>;
  let floor: ReturnType<typeof createFloor>;
  let glass: ReturnType<typeof createGlassBlock>;
  const seenAt: [number, number, number][] = [];
  const galaxyTop: [number, number, number][] = [];
  let showcase = 0;

  const self: BlockScene = {
    id: 'whole',
    status: 'measured',
    statusNote: whole.note,
    labels,
    async init(ctx: RenderContext) {
      renderer = ctx.renderer;
      glass = createGlassBlock(kit, B, { grid: 1, gridT: 1 / 3.45 });
      glass.gridOpacity.value = 0.35;
      glass.add(scene);
      disposers.push(glass.dispose);

      cone = createTeardrop(kit);
      scene.add(cone.mesh);
      disposers.push(cone.dispose);

      // Galaxies: fixed comoving positions; proper distance a(t)·χ. All meet at the Big Bang.
      const rnd = mulberry32(5);
      const paths: PathSpec[] = [
        {
          points: [
            [0, B.t0, 0],
            [0, tDisp(AGE_GYR), 0],
          ],
          colour: PAL.bowl,
          width: 0.04,
          intensity: 1.4,
        },
      ];
      const sightSpecs: EventSpec[] = [];
      for (let g = 0; g < params.galaxies; g++) {
        const chi = params.chiMin + (params.chiMax - params.chiMin) * Math.sqrt(rnd());
        const phi = rnd() * Math.PI * 2;
        const pts: number[][] = [];
        const N = 90;
        for (let k = 0; k < N; k++) {
          // Denser sampling near the Big Bang, where the paths curve most.
          const tGyr = 0.002 + (AGE_GYR - 0.002) * Math.pow(k / (N - 1), 1.8);
          const d = xDisp(aAtGyr(tGyr) * chi);
          pts.push([d * Math.cos(phi), tDisp(tGyr), d * Math.sin(phi)]);
        }
        galaxyTop.push(pts.at(-1)! as [number, number, number]);
        paths.push({ points: pts, colour: params.galaxyColour, width: 0.012, intensity: 0.42 });
        const s = sightingOf(chi);
        if (s) {
          const d = xDisp(s.properGly);
          const p: [number, number, number] = [d * Math.cos(phi), tDisp(s.tGyr), d * Math.sin(phi)];
          seenAt.push(p);
          sightSpecs.push({ p, colour: PAL.both, size: 0.1, intensity: 1.5 });
        }
      }
      lines = createRibbons(kit, paths);
      scene.add(lines.mesh);
      disposers.push(lines.dispose);
      sightings = createEvents(kit, sightSpecs, ctx.globals.uElapsed);
      scene.add(sightings.object);
      disposers.push(sightings.dispose);
      // Pick a sighting on the near side for its label.
      showcase = seenAt.reduce(
        (best, p, i) => (p[0] + p[2] > seenAt[best]![0] + seenAt[best]![2] ? i : best),
        0,
      );

      // Here-now and the CMB ring (tiny: the cone meets last scattering 41 million light-years away).
      const rCmb = xDisp(CMB.properGly);
      const tCmb = tDisp(CMB.tGyr);
      marks = createEvents(
        kit,
        [
          { p: [0, tDisp(AGE_GYR), 0], colour: PAL.both, size: 0.2, intensity: 1.7 },
          ...Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return {
              p: [rCmb * Math.cos(a), tCmb, rCmb * Math.sin(a)] as const,
              colour: params.cmbColour,
              size: 0.05,
              intensity: 1.4,
            };
          }),
        ],
        ctx.globals.uElapsed,
      );
      scene.add(marks.object);
      disposers.push(marks.dispose);

      // The floor: the hot early universe up to last scattering, a glowing sheet at the bottom of the block.
      floor = createFloor(kit, tCmb + 0.004, B.x1, params.cmbColour);
      scene.add(floor.mesh);
      disposers.push(floor.dispose);

      await renderer.compileAsync(scene, rig.camera);
    },

    update(local, _dt, elapsed) {
      state = wholeState(local);
      const s = state;
      // The cone is drawn from today downward.
      const revealT = tDisp(AGE_GYR * (1 - s.reveal));
      cone.reveal.value = s.reveal > 0 ? revealT : 10;
      cone.opacity.value = 1;
      lines.set(0, 1, s.us);
      for (let g = 1; g <= params.galaxies; g++) lines.set(g, 1, smooth(s.galaxies));
      sightings.opacity.value = smooth(s.sightings);
      marks.setIntensity(0, 1.7 * s.us);
      for (let i = 1; i <= 24; i++) marks.setIntensity(i, 1.4 * s.cmb);
      marks.commit();
      floor.opacity.value = 0.35 + 0.65 * s.cmb;
      glass.opacity.value = 0.6 + 0.4 * s.pull;

      const a = params.startCamera;
      const b = params.revealCamera;
      const c = params.wideCamera;
      const kr = smooth(Math.min(1, s.reveal * 1.2));
      const kw = smooth(s.pull);
      const mix = (key: 'az' | 'el' | 'dist' | 'tx' | 'tt' | 'ty') => {
        const ab = a[key] + (b[key] - a[key]) * kr;
        return ab + (c[key] - ab) * kw;
      };
      rig.apply(
        { az: mix('az'), el: mix('el'), dist: mix('dist'), tx: mix('tx'), tt: mix('tt'), ty: mix('ty') },
        elapsed,
      );
      placeLabels(revealT);
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

  function placeLabels(revealT: number) {
    const s = state;
    const cam = rig.camera;
    const place = (i: number, x: number, t: number, y: number, o: number) => {
      kit.viewCPU(x, t, y, tmp);
      labels.place(i, tmp.x, tmp.y, tmp.z, cam, o);
    };
    const top = tDisp(AGE_GYR);
    place(L.here!, 0, top, 0, s.us * (1 - s.pull * 0.4));
    place(L.us!, 0, top - 1.2, 0, s.us * (1 - s.reveal) * (1 - s.galaxies));
    const rFront = xDisp(
      CONE.reduce((best, c) =>
        Math.abs(tDisp(c.tGyr) - revealT) < Math.abs(tDisp(best.tGyr) - revealT) ? c : best,
      ).properGly,
    );
    place(L.cone!, rFront * 0.72, revealT, rFront * 0.72, s.reveal > 0.02 && s.reveal < 0.98 ? 1 : 0);
    const wr = xDisp(CONE_MAX.properGly);
    const wt = tDisp(CONE_MAX.tGyr);
    place(
      L.widest!,
      wr * 0.72,
      wt,
      wr * 0.72,
      s.reveal > 0.75 ? Math.min(1, (s.reveal - 0.75) * 6) * (1 - s.galaxies) : 0,
    );
    place(L.bang!, 0.25, B.t0, 0.25, s.reveal > 0.97 ? 1 - s.cmb : 0);
    const sc = seenAt[showcase];
    if (sc) place(L.seen!, sc[0], sc[1], sc[2], s.sightings * (1 - s.cmb));
    const gt = galaxyTop[3];
    if (gt) place(L.galaxies!, gt[0], gt[1], gt[2], s.galaxies * (1 - s.sightings));
    place(L.cmb!, 0.05, tDisp(CMB.tGyr), 0.05, s.cmb * (1 - s.pull * 0.6));
  }

  return self;
}
