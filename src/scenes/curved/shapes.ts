// Local geometry for the curved stage: world-tubes (Earth, the horizon) and light cones skewed by a black hole.

import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicNodeMaterial,
} from 'three/webgpu';
import {
  abs,
  atan,
  attribute,
  cameraPosition,
  exp,
  float,
  fract,
  fwidth,
  normalize,
  positionWorld,
  smoothstep,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import type { BlockKit } from '../../shared/block/kit.ts';
import type { RGB } from '../../shared/block/palette.ts';

/**
 * A vertical world-tube of radius r from t0 to t1 around (cx, cy). Rings every `ringEvery` in t; `meridians` lines
 * that turn once every `period` (a spinning body's meridians become helices); a soft rim where the view grazes it.
 */
export function createTube(
  kit: BlockKit,
  o: {
    r: number;
    t0: number;
    t1: number;
    colour: RGB;
    ringEvery?: number;
    meridians?: number;
    period?: number;
    fill?: number;
    rim?: number;
  },
) {
  const segA = 128;
  const segT = 64;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= segT; j++) {
    const t = o.t0 + ((o.t1 - o.t0) * j) / segT;
    for (let i = 0; i <= segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      pos.push(o.r * Math.cos(a), t, o.r * Math.sin(a));
    }
  }
  for (let j = 0; j < segT; j++)
    for (let i = 0; i < segA; i++) {
      const a = j * (segA + 1) + i;
      const b = a + segA + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const opacity = uniform(1);
  const colour = uniform(new Color(o.colour[0], o.colour[1], o.colour[2]));
  const P = attribute<'vec3'>('position', 'vec3');
  const th = atan(P.z, P.x);
  const t = P.y;
  const nM = o.meridians ?? 0;
  const turns = o.period ? t.div(o.period) : float(0);
  const mv = th
    .div(Math.PI * 2)
    .sub(turns)
    .mul(Math.max(1, nM));
  const mer = nM
    ? float(1).sub(smoothstep(float(0), fwidth(mv).mul(1.3), abs(fract(mv.add(0.5)).sub(0.5))))
    : float(0);
  const rv = t.div(o.ringEvery ?? 1e9);
  const ring = o.ringEvery
    ? float(1).sub(smoothstep(float(0), fwidth(rv).mul(1.3), abs(fract(rv.add(0.5)).sub(0.5))))
    : float(0);
  const n = normalize(vec3(P.x, 0, P.z));
  const v = normalize(cameraPosition.sub(positionWorld));
  const graze = float(1).sub(abs(n.dot(v)));
  const rim = graze.pow(3).mul(o.rim ?? 0.5);
  const lum = float(o.fill ?? 0.03)
    .add(mer.mul(0.16))
    .add(ring.mul(0.08))
    .add(rim);
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  mat.positionNode = kit.toView(vec3(P.x, P.y, P.z));
  mat.colorNode = vec4(colour.mul(lum).mul(opacity), 1);
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

/**
 * Local light cones near a black hole in ingoing Eddington–Finkelstein coordinates (r_s = 1, c = 1). Per unit of t̃,
 * future light reaches the ellipse (1 + S)(u_r + S/(1 + S))² + u_t² = 1/(1 + S), S = r_s / r: centre −S/(1 + S),
 * radial semi-axis 1/(1 + S), tangential 1/√(1 + S). The past half is the mirror image (centre +S/(1 + S)).
 * Far away it is the upright cone; at the horizon its outward edge is vertical; inside, all of it points inward.
 * cones: apex positions (x = r·scale along +x, t, y = 0) with their r in units of r_s.
 */
export function createSkewCones(
  kit: BlockKit,
  cones: readonly { r: number; x: number; t: number }[],
  h: number,
  colour: RGB,
) {
  const segA = 64;
  const segS = 20;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let base = 0;
  cones.forEach((c, k) => {
    const S = 1 / c.r;
    for (let j = 0; j <= segS * 2; j++) {
      const s = -1 + j / segS; // −1 … 1 (past … future)
      const dir = s >= 0 ? 1 : -1;
      const m = Math.abs(s);
      for (let i = 0; i <= segA; i++) {
        const a = (i / segA) * Math.PI * 2;
        const ur = -dir * (S / (1 + S)) + Math.cos(a) / (1 + S);
        const ut = Math.sin(a) / Math.sqrt(1 + S);
        pos.push(c.x + m * h * ur, c.t + s * h, m * h * ut);
        uv.push(i / segA, s, k, 0);
      }
    }
    for (let j = 0; j < segS * 2; j++)
      for (let i = 0; i < segA; i++) {
        const a = base + j * (segA + 1) + i;
        const b = a + segA + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    base += (segS * 2 + 1) * (segA + 1);
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aCone', new Float32BufferAttribute(uv, 4));
  geo.setIndex(idx);
  const opacity = uniform(1);
  /** Cones with index < shown are visible (fractional fades the next one in). */
  const shown = uniform(cones.length);
  const col = uniform(new Color(colour[0], colour[1], colour[2]));
  const P = attribute<'vec3'>('position', 'vec3');
  const A = attribute<'vec4'>('aCone', 'vec4');
  const s = A.y;
  const nR = 12;
  const rv = A.x.mul(nR);
  const ruling = float(1).sub(smoothstep(float(0), fwidth(rv).mul(1.2), abs(fract(rv.add(0.5)).sub(0.5))));
  const rim = exp(abs(s).sub(1).div(0.05).pow(2).negate());
  const tip = smoothstep(0.0, 0.12, abs(s));
  const future = smoothstep(-0.02, 0.02, s).mul(0.6).add(0.4);
  const vis = smoothstep(A.z, A.z.add(1), shown);
  const lum = float(0.07)
    .add(ruling.mul(0.22).mul(smoothstep(0.1, 0.5, abs(s))))
    .add(rim.mul(0.9))
    .mul(tip)
    .mul(future);
  const mat = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  mat.positionNode = kit.toView(P);
  mat.colorNode = vec4(col.mul(lum).mul(vis).mul(opacity), 1);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    opacity,
    shown,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
