# Decisions

Non-obvious choices, deviations from HANDOFF.md, and why. Newest at the bottom of each section.

## Stack and tooling

- **Inherited from Cosmic History** (`../universe`, DECISIONS there): Astro 7.4.2, three 0.186.1 (WebGPURenderer + TSL, WebGL2 fallback), nanostores, Lenis, Tailwind v4 tokens, fontsource fonts, Vitest, Playwright, wrangler. Same lockfile, so the same pinned versions; no new runtime dependencies. Rendering core (`src/render/`), scroll driver, caption schedule, narration and build scripts were copied and adapted, not rewritten.
- **Dev port** 4350 (Cosmic History uses 4340).
- **Auto-discovery**: scenes (`src/scenes/<id>/index.ts`), stage scripts (`src/script/<id>.ts`) and HUD cards (`src/hud/cards/*.astro`) are found with `import.meta.glob`, so stages can be built in parallel without editing shared registries.

## Presentation

- **Decided up front** (Cosmic History owner feedback): a guided walkthrough with one caption at a time, no rail, no sliders, no quality picker. Quality is automatic.
- **Status replaces accuracy**: measured / established / argument / open / metaphor, because the subject mixes experiments, consequences of theory and philosophy. The intro card shows the stage's status and a one-sentence note (from its script, rendered statically so it is also in the HTML).
- **Dual clock** replaces the cosmic clock in the top-right: each stage script publishes the comparison it is making (readouts), computed from the same function the scene uses.
- **Transitions**: no `stretch` (it smeared thin lines into streaks); stage 6 dissolves in, stage 13 zooms out to cosmic scale. Labels do not follow a transition's distortion, so the outgoing set clears in the first 40% of the blend and the incoming set arrives in the second half.
- **Labels are HTML** anchored to 3D points (`LabelSet` → `LabelLayer`), faded with the transition mix, so the canvas never carries text.
- **Appendix** adds "What has been measured" (experiments.json) and "Who argued what" (positions.json) to Cosmic History's stage-by-stage notes.

## Relativity

- **GPS budget**: spherical Earth, ground clock on the rotating equator, circular orbit at 26,561.75 km → GR +45.65, SR −7.11, net +38.54 µs/day. Ashby's figure (38.6) also includes Earth's oblateness through the geoid potential; the difference is 0.04 µs/day.
- **Altitude comb**: rates relative to sea level on the rotating equator; surface points co-rotate, orbits are circular. ISS at 420 km is −24.4 µs/day (speed wins), GEO +46.6.
- **Andromeda** at 2.5 Mly (rounded from Li et al. 2021, 761 ± 11 kpc ≈ 2.48 Mly). The walker shift v d / c² is exact for the slice through here-now in Andromeda's rest frame (no γ): 4.26 days at 1.4 m/s.
- **Past light cone**: trapezoid integral of the comoving distance in ln a (8 × n points) with Planck 2018 ΛCDM from Cosmic History's `cosmology.ts`; maximum proper distance 5.85 Gly at z = 1.60 (t = 4.0 Gyr); comoving horizon 46.0 Gly.
- **Eddington–Finkelstein cones** use t̃ = v − r so ingoing light is always at 45°; the outgoing edge moves at (r − r_s)/(r + r_s).

## Rendering

- **Spacetime layout** `vec3(x, t, y)`: world Y is time. One `BlockKit` per scene holds the view (boost along x, then the loupe's anisotropic scale) and the reality uniforms (two knives, existence filter). Every block material calls `kit.toView`, `kit.sliceGlow` and `kit.existence`, so a single uniform change re-frames or re-slices the whole block.
- **Worldlines are camera-facing ribbons** built from the *viewed* centre and tangent (correct under boosts and the loupe), with tick beads from per-vertex proper time and per-path reveal/intensity in a uniform array read in the vertex stage. Attributes are packed into 6 vertex buffers (WebGPU allows 8; the first version used 10 and failed pipeline creation).
- **`positionLocal` gotcha**: once `positionNode` is set, `positionLocal` in the fragment stage is the *transformed* position. Fragment math that needs the original coordinates uses `attribute('position')`. (Tilted knives were being clipped to half their size.)
- **Panels** (diptych, quadtych, loupe inset): `target.viewport` / `target.scissor` with `setScissorTest(true)`, one full clear, `autoClear = false` and `clearDepth()` per panel. The loupe draws a dark framed backdrop into its panel first.
- **Post**: bloom toned down from Cosmic History (strength 0.6, radius 0.35, threshold 0.85): thin bright lines over a large area produced a grey haze with the old settings.
