// Bowls of equal ages (HANDOFF §8.7): the hyperboloid t = √(τ² + x² + y²) of every event that is proper time τ
// after an origin event, whatever path at constant speed led there. Radial rulings are the travelers' worldlines,
// rings are circles of equal coordinate time. A boost maps each bowl onto itself.

import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicNodeMaterial, Vector3, Color } from 'three/webgpu';
import { abs, attribute, cos, exp, float, fract, fwidth, sin, smoothstep, sqrt, step, uniform, vec3, vec4 } from 'three/tsl';
import type { BlockKit } from './kit.ts';
import { PAL, type RGB } from './palette.ts';

export interface Bowls {
  mesh: Mesh;
  origin: ReturnType<typeof uniform<Vector3>>;
  /** Number of bowls shown (fractional fades the last one in). */
  shown: ReturnType<typeof uniform<number>>;
  opacity: ReturnType<typeof uniform<number>>;
  /** Clip above this coordinate time (relative to the origin). */
  tMax: ReturnType<typeof uniform<number>>;
  dispose(): void;
}

/** taus: proper times of the bowls; rMax: radial extent (display units). */
export function createBowls(kit: BlockKit, taus: readonly number[], rMax: number, o: { colour?: RGB } = {}): Bowls {
  const segT = 96;
  const segR = 40;
  const pos: number[] = [];
  const attr: number[] = [];
  const idx: number[] = [];
  let base = 0;
  taus.forEach((tau, k) => {
    for (let j = 0; j <= segR; j++) {
      // Denser near the bottom of the bowl.
      const rr = rMax * Math.pow(j / segR, 1.4);
      for (let i = 0; i <= segT; i++) {
        pos.push(0, 0, 0);
        attr.push(i / segT, rr, tau, k);
      }
    }
    for (let j = 0; j < segR; j++)
      for (let i = 0; i < segT; i++) {
        const a = base + j * (segT + 1) + i;
        const b = a + segT + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    base += (segR + 1) * (segT + 1);
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aBowl', new Float32BufferAttribute(attr, 4));
  geo.setIndex(idx);

  const origin = uniform(new Vector3());
  const shown = uniform(taus.length);
  const opacity = uniform(1);
  const tMax = uniform(1e9);
  const cc = o.colour ?? PAL.bowl;
  const colour = uniform(new Color(cc[0], cc[1], cc[2]));
  const A = attribute<'vec4'>('aBowl', 'vec4');
  const th = A.x.mul(Math.PI * 2);
  const r = A.y;
  const tau = A.z;
  const tRel = sqrt(tau.mul(tau).add(r.mul(r)));
  const sp = origin.add(vec3(cos(th).mul(r), tRel, sin(th).mul(r)));

  const nR = 32;
  const ruling = abs(fract(A.x.mul(nR).add(0.5)).sub(0.5));
  const rulingL = float(1).sub(smoothstep(float(0), fwidth(A.x.mul(nR)).mul(1.2), ruling));
  const ringV = tRel.mul(2);
  const ring = abs(fract(ringV.add(0.5)).sub(0.5));
  const ringL = float(1).sub(smoothstep(float(0), fwidth(ringV).mul(1.2), ring));
  const vis = smoothstep(A.w, A.w.add(1), shown);
  const clip = step(tRel, tMax);
  const lip = exp(tMax.sub(tRel).div(0.02).pow(2).negate()).mul(0.8);
  const rimFade = float(1).sub(smoothstep(rMax * 0.75, rMax, r));
  const bottom = exp(r.div(0.06).pow(2).negate()).mul(0.6);
  const lum = float(0.04).add(rulingL.mul(0.1)).add(ringL.mul(0.07)).add(bottom).mul(rimFade).add(lip);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  mat.positionNode = kit.toView(sp);
  mat.colorNode = vec4(colour.mul(lum).mul(vis).mul(clip).mul(opacity), 1);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    origin,
    shown,
    opacity,
    tMax,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
