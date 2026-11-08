// A film stack (HANDOFF §8.11): N translucent frames at evenly spaced times, each showing a procedural image
// f(x, t, y) of the world at that moment. Stacking them is how stage 2 builds the block; slicing them is how the
// Rolling Shutter takes photographs. Frames above `reveal` do not exist yet; frames near `highlight` glow.

import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicNodeMaterial, Color } from 'three/webgpu';
import { abs, attribute, exp, float, max, min, smoothstep, uniform, vec3, vec4 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlockKit, ColorU, FloatU } from './kit.ts';
import type { Bounds } from './glassBlock.ts';
import { PAL } from './palette.ts';

type F = Node<'float'>;
type V3 = Node<'vec3'>;

export interface FilmStack {
  mesh: Mesh;
  /** Frames with t > reveal are hidden (soft edge). */
  reveal: FloatU;
  /** Frames near this time glow brighter (the "current" frame). */
  highlight: FloatU;
  /** Brightness of the image in every frame. */
  imageGain: FloatU;
  /** Brightness of the frame outlines. */
  edgeGain: FloatU;
  opacity: FloatU;
  edgeColour: ColorU;
  /** Times of the frames. */
  times: number[];
  dispose(): void;
}

export function createFilmStack(
  kit: BlockKit,
  b: Bounds,
  o: { frames: number; imageFn: (x: F, t: F, y: F) => V3; tFrom?: number; tTo?: number },
): FilmStack {
  const n = o.frames;
  const t0 = o.tFrom ?? b.t0;
  const t1 = o.tTo ?? b.t1;
  const times: number[] = [];
  const pos: number[] = [];
  const at: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? t0 : t0 + ((t1 - t0) * k) / (n - 1);
    times.push(t);
    const base = k * 4;
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      pos.push(0, 0, 0);
      at.push(u!, v!, t, k);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('aFrame', new Float32BufferAttribute(at, 4));
  geo.setIndex(idx);

  const reveal = uniform(1e9);
  const highlight = uniform(-1e9);
  const imageGain = uniform(1);
  const edgeGain = uniform(1);
  const opacity = uniform(1);
  const edgeColour = uniform(new Color(PAL.edge[0], PAL.edge[1], PAL.edge[2]));

  const A = attribute<'vec4'>('aFrame', 'vec4');
  const x = float(b.x0).add(A.x.mul(b.x1 - b.x0));
  const y = float(b.y0).add(A.y.mul(b.y1 - b.y0));
  const t = A.z;
  const sp = vec3(x, t, y);
  const exists = float(1).sub(smoothstep(reveal.sub(0.02), reveal.add(0.02), t));
  const near = exp(t.sub(highlight).div(max(float(0.001), float((t1 - t0) / Math.max(1, n - 1)).mul(0.7))).abs().pow(2).negate());
  const ex = min(abs(A.x), abs(float(1).sub(A.x))).mul(b.x1 - b.x0);
  const ey = min(abs(A.y), abs(float(1).sub(A.y))).mul(b.y1 - b.y0);
  const edge = exp(min(ex, ey).div(0.012).abs().pow(2).negate());
  const img = o.imageFn(x, t, y).mul(imageGain).mul(float(0.55).add(near.mul(1.2)));
  const col = img.add(edgeColour.mul(edge.mul(edgeGain).mul(float(0.25).add(near.mul(1.2)))));
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  mat.positionNode = kit.toView(sp);
  mat.colorNode = vec4(col.mul(exists).mul(opacity), 1);
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    reveal,
    highlight,
    imageGain,
    edgeGain,
    opacity,
    edgeColour,
    times,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

/** A soft dot of colour c at (cx, cy) with radius r, for building image functions. */
export function dot(x: F, y: F, cx: F | number, cy: F | number, r: number, c: V3): V3 {
  const dx = x.sub(cx);
  const dy = y.sub(cy);
  return c.mul(exp(dx.mul(dx).add(dy.mul(dy)).div(r * r).negate()));
}
