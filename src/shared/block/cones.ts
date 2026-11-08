// Light cones as engraved glass (HANDOFF §8.6): rulings (light rays) and rings (where a flash has reached), violet.
// Positions pass through the view transform; a boost maps the cone onto itself, so they visibly do not change.
// `grow` reveals the future cone up to a height (a flash spreading), with a bright rim at the light front.

import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicNodeMaterial, Vector3, Color } from 'three/webgpu';
import { abs, attribute, exp, float, fract, fwidth, max, smoothstep, step, uniform, vec3, vec4, cos, sin } from 'three/tsl';
import type { BlockKit, FloatU, Vec3U, ColorU } from './kit.ts';
import { PAL, type RGB } from './palette.ts';

export interface LightCone {
  mesh: Mesh;
  apex: Vec3U;
  /** Height of the cone (both halves) in display units. */
  height: FloatU;
  /** 0–1 of height shown for the future and past halves. */
  future: FloatU;
  past: FloatU;
  opacity: FloatU;
  colour: ColorU;
  dispose(): void;
}

export function createLightCone(kit: BlockKit, o: { rings?: number; rulings?: number; colour?: RGB; segments?: number } = {}): LightCone {
  const segT = o.segments ?? 96;
  const segS = 48;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= segS; j++) {
    const s = -1 + (2 * j) / segS;
    for (let i = 0; i <= segT; i++) {
      pos.push(0, 0, 0);
      uvs.push(i / segT, s);
    }
  }
  for (let j = 0; j < segS; j++)
    for (let i = 0; i < segT; i++) {
      const a = j * (segT + 1) + i;
      const b = a + segT + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aUV', new Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);

  const apex = uniform(new Vector3());
  const height = uniform(1);
  const future = uniform(1);
  const past = uniform(1);
  const opacity = uniform(1);
  const cc = o.colour ?? PAL.light;
  const colour = uniform(new Color(cc[0], cc[1], cc[2]));
  const a = attribute<'vec2'>('aUV', 'vec2');
  const th = a.x.mul(Math.PI * 2);
  const s = a.y;
  const r = abs(s).mul(height);
  const sp = apex.add(vec3(cos(th).mul(r), s.mul(height), sin(th).mul(r)));

  const nR = o.rulings ?? 16;
  const ruling = abs(fract(a.x.mul(nR).add(0.5)).sub(0.5));
  const rulingL = float(1).sub(smoothstep(float(0), fwidth(a.x.mul(nR)).mul(1.2), ruling));
  const ringsN = o.rings ?? 6;
  const rv = abs(s).mul(ringsN);
  const ring = abs(fract(rv.add(0.5)).sub(0.5));
  const ringL = float(1).sub(smoothstep(float(0), fwidth(rv).mul(1.2), ring));
  const lim = step(s, future.add(1e-4)).mul(step(past.negate().sub(1e-4), s));
  const front = max(exp(s.sub(future).div(0.012).abs().pow(2).negate()).mul(step(future, 0.999)), exp(s.add(past).div(0.012).abs().pow(2).negate()).mul(step(past, 0.999)));
  const endFade = float(1).sub(smoothstep(0.75, 1.0, abs(s)));
  const tipFade = smoothstep(0.0, 0.08, abs(s));
  const rulingFade = smoothstep(0.08, 0.45, abs(s));
  const lum = float(0.035).add(rulingL.mul(0.14).mul(rulingFade)).add(ringL.mul(0.1)).mul(endFade).add(front.mul(1.6)).mul(tipFade);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  mat.positionNode = kit.toView(sp);
  mat.colorNode = vec4(colour.mul(lum).mul(lim).mul(opacity), 1);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    apex,
    height,
    future,
    past,
    opacity,
    colour,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

