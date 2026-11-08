// The block itself (HANDOFF §8.8): faint glass faces with a coordinate grid drawn in A's frame (it shears visibly
// when the block is viewed in another frame), and bright edges.

import { AdditiveBlending, BoxGeometry, DoubleSide, Mesh, MeshBasicNodeMaterial, Color } from 'three/webgpu';
import { abs, exp, float, fract, fwidth, max, min, attribute, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlockKit, FloatU, ColorU } from './kit.ts';
import { createRibbons, type Ribbons } from './ribbons.ts';
import { PAL, type RGB } from './palette.ts';

export interface Bounds {
  x0: number;
  x1: number;
  t0: number;
  t1: number;
  y0: number;
  y1: number;
}

export interface GlassBlock {
  faces: Mesh;
  edges: Ribbons;
  opacity: FloatU;
  gridOpacity: FloatU;
  tint: ColorU;
  add(to: { add(...o: Mesh[]): unknown }): void;
  dispose(): void;
}

export function createGlassBlock(kit: BlockKit, b: Bounds, o: { grid?: number; gridT?: number; tint?: RGB; edgeIntensity?: number } = {}): GlassBlock {
  const geo = new BoxGeometry(1, 1, 1, 1, 1, 1);
  const opacity = uniform(1);
  const gridOpacity = uniform(1);
  const tc = o.tint ?? PAL.edge;
  const tint = uniform(new Color(tc[0], tc[1], tc[2]));
  // Raw attribute: positionLocal would be the transformed position in the fragment stage once positionNode is set.
  const P0 = attribute<'vec3'>('position', 'vec3');
  const x = float(b.x0).add(P0.x.add(0.5).mul(b.x1 - b.x0));
  const t = float(b.t0).add(P0.y.add(0.5).mul(b.t1 - b.t0));
  const y = float(b.y0).add(P0.z.add(0.5).mul(b.y1 - b.y0));
  const sp = vec3(x, t, y);
  const gx = o.grid ?? 1;
  const gt = o.gridT ?? gx;
  const line = (v: Node<'float'>, s: number) => {
    const f = abs(fract(v.div(s).add(0.5)).sub(0.5));
    return float(1).sub(smoothstep(float(0), fwidth(v.div(s)).mul(1.1), f));
  };
  const grid = max(max(line(x, gx), line(t, gt)), line(y, gx)).mul(gridOpacity);
  // Soft glow toward the faces' edges.
  const ex = min(x.sub(b.x0).abs(), x.sub(b.x1).abs());
  const et = min(t.sub(b.t0).abs(), t.sub(b.t1).abs());
  const ey = min(y.sub(b.y0).abs(), y.sub(b.y1).abs());
  const nearEdge = min(min(max(ex, et), max(ex, ey)), max(et, ey));
  const soft = exp(nearEdge.div(0.16).pow(2).negate());
  const exist = kit.existence(sp).mul(0.6).add(0.4);
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  mat.positionNode = kit.toView(sp);
  mat.colorNode = vec4(tint.mul(float(0.005).add(grid.mul(0.02)).add(soft.mul(0.02))).mul(opacity).mul(exist), 1);
  const faces = new Mesh(geo, mat);
  faces.frustumCulled = false;

  const { x0, x1, t0, t1, y0, y1 } = b;
  const corners = (tt: number) => [
    [x0, tt, y0],
    [x1, tt, y0],
    [x1, tt, y1],
    [x0, tt, y1],
    [x0, tt, y0],
  ];
  const ec = tc;
  const w = 0.012;
  const paths = [
    { points: corners(t0), colour: ec, width: w, spacelike: true, intensity: o.edgeIntensity ?? 0.7, existResponse: 0 },
    { points: corners(t1), colour: ec, width: w, spacelike: true, intensity: o.edgeIntensity ?? 0.7, existResponse: 0 },
    ...[
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [x0, y1],
    ].map(([xx, yy]) => ({
      points: [
        [xx!, t0, yy!],
        [xx!, t1, yy!],
      ],
      colour: ec,
      width: w,
      spacelike: true,
      intensity: o.edgeIntensity ?? 0.7,
      existResponse: 0,
      sliceResponse: 1,
    })),
  ];
  const edges = createRibbons(kit, paths);
  return {
    faces,
    edges,
    opacity,
    gridOpacity,
    tint,
    add(to) {
      to.add(faces, edges.mesh);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      edges.dispose();
    },
  };
}
