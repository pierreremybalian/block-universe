# Block Universe

A scroll-driven, full-screen 3D explanation of the block universe: the view that past, present and future are equally real and that "now" is a perspective. Thirteen stages build the argument from tested relativity (light cones, time dilation, the relativity of simultaneity), then give the rival views a fair hearing. Every tilt, tick and offset is computed in the browser; every stage says how sure we are.

```
pnpm install
pnpm dev          # http://localhost:4350
pnpm test         # relativity, stages and tracks, caption schedule, stage scripts
pnpm build        # static site in dist/
```

- Spec: `HANDOFF.md`. Decisions: `DECISIONS.md`. Scene authoring: `SCENES.md`.
- Relativity: `src/relativity/` (Lorentz, simultaneity, proper time, invariants, weak-field gravity, Eddington–Finkelstein cones, our past light cone), unit-tested.
- Stages and scripts: `src/time/stages.ts`, `src/script/<stage>.ts`.
- Rendering: `src/render/` (inherited from Cosmic History), block library in `src/shared/block/`, scenes in `src/scenes/`.

Companion piece: [Cosmic History](https://cosmic-history.balian.dev). Live: https://block-universe.balian.dev. Deploy: `pnpm deploy` (builds, then `wrangler deploy` to Workers static assets on the Cloudflare account that owns `balian.dev`; the custom domain is attached by `wrangler.toml`; put `CLOUDFLARE_ACCOUNT_ID=<id>` in a gitignored `.env` first).
