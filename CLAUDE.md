# Block Universe

Scroll-driven 3D explanation of the block universe (eternalism): 13 stages from "time flows" to "all times exist", then the rivals. Astro 7, vanilla TypeScript islands, three.js r186 WebGPU renderer with TSL shaders (automatic WebGL2 fallback), nanostores, Lenis. Static output on Cloudflare Workers static assets at https://block-universe.balian.dev (`pnpm deploy`). Infrastructure inherited from Cosmic History (`../universe`). `HANDOFF.md` is the spec; `DECISIONS.md` logs deviations; `SCENES.md` is the scene authoring guide.

## Dev
- `pnpm dev` (port 4350). Scene harness: `/dev/scenes/?scene=<id>&local=0.5` (slider, FPS, GPU memory, load/unload ×50 leak test). `_lab` exercises every block primitive (`&mode=film|loupe`, `&split=1`).
- `pnpm test`, `pnpm check` and `pnpm lint` must pass before anything is done. `pnpm build` also writes `dist/_headers`.
- Screenshots: `node scripts/shoot.ts --scene <id> --locals 0.1,0.5,0.9 --outdir scratch/shots` (`--webgl`, `--leak`); full page inside a stage: `node scripts/shoot.ts --stage <id> --at 0.3,0.7` (`--width 390 --height 844` for phones). Stills and the OG image: `pnpm stills` (needs a running dev or preview server). Relative scene cost: `node scripts/fps.ts`.

## Rules
- `src/relativity/`, `src/physics/`, `src/time/` and `src/script/` are pure TypeScript: no DOM, no three. Node runs them directly.
- One source of truth: `$progress` → `(stage, local)` → the stage script (`src/script/<id>.ts`). Scenes, the dual clock and HUD cards read the same script, so numbers and geometry cannot disagree.
- No physical value is hand-typed in a shader or copy: compute it in `src/relativity/` and pass a uniform.
- Spacetime points are `vec3(x, t, y)` (world Y is time). Every block material goes through `kit.toView` (boost + loupe) and `kit.sliceGlow` / `kit.existence`. With `positionNode` set, use `attribute('position')`, not `positionLocal`, in fragment-side math. Max 8 vertex buffers per material on WebGPU.
- Scenes are isolated (`src/scenes/<id>/`, auto-registered), share only `src/shared/`. Typed `params` at the top; dispose everything you create.
- Every stage declares a status (measured / established / argument / open / metaphor) and a one-sentence note naming any exaggeration. Loupe factors are always labelled on screen.
- Text never goes in the canvas: use `LabelSet` (HTML labels anchored to 3D points) or a HUD card (`src/hud/cards/*.astro`, auto-included).
- No allocation in the frame loop. No new dependencies without a line in DECISIONS.md. Tokens only from `src/styles/global.css`; observer colours mirrored in `src/shared/block/palette.ts`.
