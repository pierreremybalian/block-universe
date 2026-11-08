// The "now" sheet used by stages 1–3: a wide, softly luminous plane at t = now that fades into darkness at its edges,
// with a faint grid of its own space. Not clipped to the block (in stage 1 there is no block yet).

import { AdditiveBlending, Color, DoubleSide, Mesh, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { abs, attribute, exp, float, fract, fwidth, max, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlockKit } from '../../shared/block/kit.ts';
import type { RGB } from '../../shared/block/palette.ts';

export interface SheetOptions {
  /** Half extent in x and y (display units). */
  rx: number;
  ry: number;
  /** Radius of the bright core before it fades. */
  core: number;
  colour: RGB;
  grid?: number;
  cx?: number;
  cy?: number;
}

export function createNowSheet(kit: BlockKit, o: SheetOptions) {
  const geo = new PlaneGeometry(1, 1, 1, 1);
  const now = uniform(0);
  const opacity = uniform(1);
  const colour = uniform(new Color(o.colour[0], o.colour[1], o.colour[2]));
  const P0 = attribute<'vec3'>('position', 'vec3');
  const x = float(o.cx ?? 0).add(P0.x.mul(o.rx * 2));
  const y = float(o.cy ?? 0).add(P0.y.mul(o.ry * 2));
  const sp = vec3(x, now, y);
  const dx = x.sub(o.cx ?? 0);
  const dy = y.sub(o.cy ?? 0);
  const r2 = dx.mul(dx).add(dy.mul(dy));
  const fall = exp(r2.div(o.core * o.core).negate());
  const g = o.grid ?? 0.5;
  const line = (v: Node<'float'>) => {
    const f = abs(fract(v.div(g).add(0.5)).sub(0.5));
    return float(1).sub(smoothstep(float(0), fwidth(v.div(g)).mul(1.2), f));
  };
  const grid = max(line(x), line(y));
  const lum = fall.mul(float(0.035).add(grid.mul(fall).mul(0.085))).add(exp(r2.div(o.core * o.core * 0.06).negate()).mul(0.035));
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  mat.positionNode = kit.toView(sp);
  mat.colorNode = vec4(colour.mul(lum).mul(opacity), 1);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    now,
    opacity,
    colour,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
