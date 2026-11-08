# Scene authoring guide

How to build a stage scene for Block Universe. Read `HANDOFF.md` §3, §5, §8–10, §13 first. The reference implementation is `src/scenes/whose/index.ts` with its script `src/script/whose.ts`.

## Files

- `src/script/<id>.ts` — pure (no DOM, no three). Tracks of `local` built with `track` / `ramp` / `windowed` (`src/time/tracks.ts`), a `<id>State(local)` function, and `registerStage(id, { note, readouts, dividers? })`. Numbers come from `src/relativity/`. Tests in `src/script/__tests__/<id>.test.ts`.
- `src/scenes/<id>/index.ts` — default-exports a factory returning a `BlockScene`; typed `params` at the top. Auto-registered.
- `src/content/stages/<id>.mdx` — title, kicker, summary, beats (`local` aligned with the visual), howWeKnow, sources, appendix body.
- `src/hud/cards/<id>*.astro` — optional instrument card (SVG/HTML); use `onStage` / `showCard` from `src/hud/card.ts`.

## Lifecycle

`init(ctx)` builds everything and ends with `await renderer.compileAsync(scene, camera)`. `update(local, dt, elapsed)` reads the script, writes uniforms (no allocation), places labels. `render(target)` draws (one view, or panels via `renderPanels`, plus `loupe.render`). `dispose()` frees everything created; the leak test must pass.

## The block library (`src/shared/block/`)

| Module | Use |
|---|---|
| `kit.ts` | `createKit()`: `setBeta` (view frame), `setKnife(i, β, c, strength, colour)` (what knives light), `exist.present/growing` (presentism / growing block), `setLoupe`, `viewCPU` for labels. |
| `ribbons.ts` | `createRibbons(kit, paths)`: worldlines with tick beads (`tick`), dashed guides (`dashed`, `spacelike`), `set(i, reveal, intensity, from, highlight)`, `update(i, points)`. `sampleWorldline`, `tickPoints`. |
| `events.ts` | Glowing points; per-instance position/colour/size/intensity with `commit()`. |
| `knife.ts` | A now-slice sheet `t = βx + c` clipped to the block, optional `imageFn` photograph. |
| `cones.ts` | Light cone with `apex`, `height`, `future` / `past` growth and a bright light front. |
| `bowl.ts` | Nested proper-time hyperboloids. |
| `glassBlock.ts` | The block: faint faces with a grid in A's frame, bright edges. |
| `filmStack.ts` | Frames of a procedural image at evenly spaced times; `reveal`, `highlight`. |
| `loupe.ts` | Picture-in-picture magnifier. Always label the factor. |
| `panels.ts` | `renderPanels` (diptych/quadtych), `renderInPanel`, `createPanelFrame`. |
| `labels.ts` | `LabelSet` (place with `kit.viewCPU` + camera, `placeScreen`), tones a / b / both / light / warm / plain / mute / event. |
| `rig.ts` | `OrbitRig.apply({ az, el, dist, tx, tt, ty }, elapsed)` with idle drift. |
| `palette.ts` | Amber A, cyan B, white both, violet light, and the rest. |

The shared cast lives in `src/shared/world.ts` (`WORLD` bounds, lamps/beacons, causal pairs, star and planet). Use it wherever the stage is "the block", so the same block recurs.

## Gotchas

- Use `attribute('position')`, not `positionLocal`, for fragment-side math when `positionNode` is set.
- WebGPU allows 8 vertex buffers per pipeline; pack attributes.
- `vertexStage(uniformArray.element(i))` for per-path lookups (keeps dynamic indexing in the vertex shader).
- Never use reversed `smoothstep` edges; `pow` of a negative base is NaN.
- Additive blending with `depthWrite: false` for everything luminous; keep backgrounds black and highlights 1–6 (bloom threshold 0.85).
- The first 12% of a stage blends with the previous scene: start calm, end on a calm frame.

## Self-test loop

`node scripts/shoot.ts --scene <id> --locals 0.05,0.3,0.6,0.95 --outdir scratch/shots/<id>` and Read the PNGs; full page with narration and HUD: `node scripts/shoot.ts --stage <id> --at 0.3,0.7 --wait 3500`; `--webgl` for the fallback backend; `--leak` for the ×50 load/unload test.
