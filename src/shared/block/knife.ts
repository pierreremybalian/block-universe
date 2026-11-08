// A now-slice as a glass sheet clipped to the block (HANDOFF §8.5). The plane is t = βx + c over the block's x–y
// extent; fragments outside the block's time range are discarded. Body tint, luminous edges where it meets the
// block's faces, a faint grid of the knife's own space, and an optional "photograph": a procedural image f(x, y, t)
// evaluated on the plane (the Rolling Shutter).

import { AdditiveBlending, DoubleSide, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Color } from 'three/webgpu';
import { Discard, Fn, If, abs, exp, float, fract, fwidth, min, positionLocal, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlockKit } from './kit.ts';
import type { Bounds } from './glassBlock.ts';
import type { RGB } from './palette.ts';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

export interface KnifeSheet {
  mesh: Mesh;
  beta: ReturnType<typeof uniform<number>>;
  c: ReturnType<typeof uniform<number>>;
  opacity: ReturnType<typeof uniform<number>>;
  colour: ReturnType<typeof uniform<Color>>;
  /** 0–1: how much of the procedural image shows. */
  image: ReturnType<typeof uniform<number>>;
  set(beta: number, c: number, opacity?: number): void;
  dispose(): void;
}

export interface KnifeOptions {
  colour: RGB;
  /** Procedural image on the plane: spacetime (x, t, y) → linear colour. */
  imageFn?: (x: F, t: F, y: F) => V3;
  /** Grid spacing in display units (0 = none). */
  grid?: number;
  /** Extra margin beyond the block (display units) before clipping. */
  margin?: number;
}

export function createKnife(kit: BlockKit, b: Bounds, o: KnifeOptions): KnifeSheet {
  const geo = new PlaneGeometry(1, 1, 1, 1);
  const beta = uniform(0);
  const c = uniform(0);
  const opacity = uniform(1);
  const image = uniform(0);
  const colour = uniform(new Color(o.colour[0], o.colour[1], o.colour[2]));
  const m = o.margin ?? 0;

  // PlaneGeometry spans [-0.5, 0.5] in local x/y. Map to the block's x and (spatial) y, and lift to t = βx + c.
  const u = positionLocal.x.add(0.5);
  const w = positionLocal.y.add(0.5);
  const x = float(b.x0 - m).add(u.mul(b.x1 - b.x0 + 2 * m));
  const y = float(b.y0 - m).add(w.mul(b.y1 - b.y0 + 2 * m));
  const t = beta.mul(x).add(c);
  const sp = vec3(x, t, y);

  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  mat.positionNode = kit.toView(sp);
  mat.colorNode = Fn(() => {
    const tt = t.toVar();
    If(tt.lessThan(b.t0 - 0.002).or(tt.greaterThan(b.t1 + 0.002)), () => {
      Discard();
    });
    const dEdge = min(min(x.sub(b.x0 - m).abs(), x.sub(b.x1 + m).abs()), min(y.sub(b.y0 - m).abs(), y.sub(b.y1 + m).abs()));
    const dT = min(tt.sub(b.t0).abs(), tt.sub(b.t1).abs());
    const d = min(dEdge, dT);
    const edge = exp(d.div(0.012).pow(2).negate()).mul(1.4).add(exp(d.div(0.08).pow(2).negate()).mul(0.25));
    let gridL: F = float(0);
    if (o.grid) {
      const gx = abs(fract(x.div(o.grid).add(0.5)).sub(0.5));
      const gy = abs(fract(y.div(o.grid).add(0.5)).sub(0.5));
      const fx = fwidth(x.div(o.grid));
      const fy = fwidth(y.div(o.grid));
      gridL = float(1).sub(smoothstep(float(0), fx.mul(1.2), gx)).max(float(1).sub(smoothstep(float(0), fy.mul(1.2), gy))).mul(0.12);
    }
    const body = float(0.05).add(gridL);
    let col: V3 = colour.mul(body.add(edge));
    if (o.imageFn) col = col.add(o.imageFn(x, tt, y).mul(image));
    return vec4(col.mul(opacity), 1);
  })();
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    beta,
    c,
    opacity,
    colour,
    image,
    set(bt, cc, op) {
      beta.value = bt;
      c.value = cc;
      if (op !== undefined) opacity.value = op;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
