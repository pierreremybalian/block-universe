# Block Universe — Engineering Handoff

> **Read this whole file before writing code.** It is the source of truth for scope, architecture, contracts, physics, stages and build order. Infrastructure is inherited from Cosmic History (`../universe`, live at cosmic-history.balian.dev); its spec and decisions are kept for reference in `ref/` (git-ignored). If something here conflicts with your instincts, follow this file and flag it. If something is ambiguous, pick the simplest option that keeps the contracts intact, log it in `DECISIONS.md`, and keep going.

---

## 1. What we're building

A guided, scroll-driven, full-screen 3D explanation of the **block universe**: the view that past, present and future are equally real, and that "now" is a perspective, not a property of the world.

- **Scroll is the argument, not the clock.** Thirteen stages move the reader from "time flows" to "all times exist", then ask honestly whether that is true.
- **Comparison is the medium.** The subject is time, so every stage compares timelines: two observers' "nows", two clocks, two photographs of the same block, four philosophies of the same block. §9 defines a library of *comparison instruments* that the stages share.
- **One shared block.** A single seeded set of worldlines and events (`src/shared/world.ts`) is the throughline (Cosmic History's primordial field played this role). What the reader stacks in stage 2 is what gets sliced in stage 6 and seen whole in stage 9.
- **Physics drives visuals.** Every tilt, tick spacing and offset comes from `src/relativity/` (pure, unit-tested TypeScript). No physical value is hand-typed in a shader or in copy.
- **Honesty is a feature.** Every stage declares a *status* (§13) and a one-sentence scale note naming any exaggeration.

### Presentation (decided up front; Cosmic History's owner feedback)
Guided walkthrough, not an explorer: **no rail, no dropdown, no slider, no quality picker.** One caption on screen at a time (intro card per stage, then beats). A 2 px progress line with stage ticks, `06 / 13 · Whose now? · established` top left, and a **dual clock** top right (§10.3). Longer text, "How we know" and sources live in a "Stage by stage" appendix of `<details>` after the journey. Keyboard ↑/↓/Page keys step one caption at a time.

### Non-goals
No backend, accounts, CMS or audio. No VR. No interactive sandbox (decided: scroll-only, consistent with Cosmic History).

---

## 2. Stack

Inherited unchanged: Astro 7 (static), TypeScript strict, three.js r186 `WebGPURenderer` with TSL shaders and automatic WebGL2 fallback, nanostores, Lenis + custom driver, Vitest, ESLint + Prettier, pnpm, Tailwind v4 tokens, fontsource fonts, Playwright for screenshots/stills, wrangler for deploy (Workers static assets, `block-universe.balian.dev`). Versions are pinned to Cosmic History's lockfile. No new dependency without a line in `DECISIONS.md`.

---

## 3. Architecture

```
scroll ─▶ ScrollDriver ─▶ $progress (0–1)
                              │
                              ▼
                   stages.progressToStage()        (src/time/stages.ts)
                              │
                              ▼
          { stage, local }  ─▶  script.<stage>(local) → StageState   (src/script/, pure)
                │                       │                     │
                ▼                       ▼                     ▼
           Narration              Renderer loop             HUD
         (one caption)     scene.update(local, state)   dual clock, lanes,
                            → render(target)             atlas (HTML/SVG)
```

### Principles
1. **One source of truth.** `$progress → (stage, local) → StageState`. Everything visible is a function of `StageState` (plus wall-clock `elapsed` for idle motion). Scenes and HUD call the *same* pure script, so a number on screen and the geometry it describes cannot disagree.
2. **One GPU context**, created once (`transition:persist`). Scenes come and go inside it.
3. **Scenes are isolated** (`src/scenes/<id>/`) and share only `src/shared/` and global uniforms.
4. **Render-to-target + composite** with dissolve / zoom / stretch transitions (inherited Compositor).
5. **Relativity is CPU-side TypeScript** and unit-tested. Shaders receive β, offsets and scale factors as uniforms.
6. **No allocation in the frame loop.**
7. **Text never goes in the canvas.** Labels anchored to 3D points are HTML, positioned each frame by the scene's `LabelSet` (§8.9).

---

## 4. Project structure

```
src/
  relativity/      units, lorentz, simultaneity, properTime, invariants, gravity, lightcone (+ __tests__)
  physics/         cosmology.ts, constants.ts, interp.ts (inherited; used by relativity/lightcone and stage 13)
  time/            stages.ts (stage table, progress ↔ stage), tracks.ts (keyframe tracks), format.ts
  script/          one pure module per stage: (local) → StageState, plus readouts for the HUD
  state/store.ts   $progress, $stage, $quality, $reducedMotion, $sceneInfo …
  scroll/driver.ts
  story/           Narration (one caption at a time), schedule.ts
  hud/             dual clock + instrument cards (Reshuffle lane, Atlas of Elsewhere, Altitude comb table, scale bar)
  render/          renderer, SceneManager, Compositor (+ transitions), quality, assets, globals
  shared/
    world.ts       the shared block: worldlines + events (seeded)
    block/         view (boost + loupe), reality (slices, existence filter), ribbons, events, knife, cones, bowl,
                   glassBlock, filmStack, labels, panels, camera rig
  scenes/<id>/     index.ts (+ shaders.ts)
  content/stages/<id>.mdx
public/data/       experiments.json, positions.json, places.json (+ generated JSON Schemas)
```

---

## 5. Core contracts

```ts
// src/scenes/types.ts
export type Status = 'measured' | 'established' | 'argument' | 'open' | 'metaphor';

export interface BlockScene {
  id: string;
  status: Status;
  statusNote: string;        // one sentence: what is exaggerated / what kind of claim this is
  init(ctx: RenderContext): Promise<void>;
  update(local: number, dt: number, elapsed: number): void;   // reads its stage script itself
  render(target: RenderTarget): void;                        // may render several panels (§8.10)
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
  labels?: LabelSet;                                          // HTML labels anchored to 3D points
}

// src/time/stages.ts
export interface Stage { id; sceneId; scrollWeight; transitionIn: 'dissolve'|'zoom'|'stretch'; transitionSpan }
export function progressToStage(p): { stage; index; local };
export function stageToProgress(index, local): number;

// src/time/tracks.ts — keyframes with eased interpolation; pure; used by every script
export function track(keys: [local: number, value: number][], ease?): (local: number) => number;
```

Units: the relativity module is SI (seconds, metres) with helpers for natural units (c = 1). Scenes work in display units with c = 1 (light cones at 45°); each scene states its display scale (e.g. 1 unit = 1 year and 1 light-year).

---

## 6. Relativity core (`src/relativity/`)

| Module | Contents |
|---|---|
| `units.ts` | c, light-year (Julian), day, year; G, GM⊕, R⊕, GM☉, g; muon lifetime; distances (Proxima, Andromeda …) |
| `lorentz.ts` | γ(β), rapidity, β from rapidity, velocity addition, boost of (t, x) and of a 3-vector in display layout (x, t, y), interval, classification |
| `simultaneity.ts` | slice through an event for speed β (`t = t₀ + β(x − x₀)`), `simultaneityShift(v, d) = v d / c²`, `nowWidth(d) = d / c` |
| `properTime.ts` | proper time of piecewise-straight worldlines, twin trip, dilated lifetime |
| `invariants.ts` | proper-time hyperboloid, its point for speed β, tangent slope, order of two events in a frame, flip speed |
| `gravity.ts` | weak-field clock rates (height, orbit), GPS budget, altitude comb, head-vs-feet; Eddington–Finkelstein light-cone edges |
| `lightcone.ts` | our past light cone in flat ΛCDM: proper distance at emission vs cosmic time (uses `physics/cosmology.ts`) |

### 6.1 Tests (must pass before any scene work)

| Check | Target |
|---|---|
| γ(0.8) | 5/3 (1e-12) |
| 0.8c ⊕ 0.8c | 0.97561c |
| Interval invariance | random boosts, 1e-9 relative |
| Twins to Proxima at 0.8c | Earth 10.62 yr, traveler 6.37 yr |
| Muon storage ring (Bailey 1977) | γ = 29.327 → 64.43 µs (measured 64.419 ± 0.058) |
| GPS budget | SR −7.2, GR +45.7, net +38.5 µs/day (± 0.3) |
| Andromeda walker | 1.4 m/s over 2.5 Mly → 4.3 ± 0.1 days; `nowWidth` → 2.5 Myr |
| Tangency | the now-plane of a traveler is tangent to the hyperboloid at their bead (slope = β) |
| Causal order | timelike pairs never flip for any |β| < 1; spacelike pairs flip at β = Δt/Δx |
| Chou et al. 2010 | gh/c² at 33 cm = 3.6 × 10⁻¹⁷ |
| Head vs feet | 1.7 m over 80 yr ≈ 0.47 µs |
| Eddington–Finkelstein | outgoing edge vertical (dr/dt̃ = 0) at r = r_s, inward inside, → 1 far away |
| Past light cone | max proper distance 5.7–5.9 Gly near z ≈ 1.6 |

---

## 7. Stages and time mapping (`src/time/`)

Each stage owns a scroll span (`scrollWeight` × 80 svh). `local` ∈ [0, 1] within it. `progressToStage` / `stageToProgress` invert each other (tested); stage boundaries are continuous (the script at `local = 1` of a stage hands off to `local = 0` of the next through the compositor's transition span, 12%).

| # | id | Title | Status | Weight | In |
|---|---|---|---|---|---|
| 1 | flow | Time as we live it | metaphor | 5 | dissolve |
| 2 | stack | Stack the moments | established | 6 | dissolve |
| 3 | light | One speed for everyone | measured | 6 | dissolve |
| 4 | clocks | Moving clocks run slow | measured | 8 | zoom |
| 5 | ages | The bowl of equal ages | established | 6 | dissolve |
| 6 | whose | Whose now? | established | 8 | stretch |
| 7 | shutter | A now is a rolling shutter | metaphor | 6 | dissolve |
| 8 | andromeda | Two walkers, one galaxy | argument | 9 | zoom |
| 9 | eternal | Everything, all at once | argument | 6 | dissolve |
| 10 | you | Your worldline | measured | 7 | zoom |
| 11 | curved | The block bends | measured | 8 | dissolve |
| 12 | rivals | Is it true? | open | 8 | dissolve |
| 13 | whole | The block of everything | measured | 6 | stretch |

---

## 8. Shared block library (`src/shared/block/`)

All block geometry is stored in **spacetime coordinates in display layout**: `vec3(x, t, y)` (world Y is time, up is future). Every material passes positions through the shared view transform, so one uniform change re-frames the whole block.

8.1 **view.ts** — `ViewUniforms { beta, focus, stretch }`; TSL `toView(p)`: Lorentz boost in (t, x) by β, then the loupe's anisotropic scale about `focus`. CPU mirror `toViewCPU` for labels.
8.2 **reality.ts** — up to two *knives* (now-slices): `{ beta, c, colour, strength }` with plane `t = βx + c`. `sliceGlow(p)` lights anything near a knife, thickness constant in the knife's own time (γ(t − βx − c)). The *existence filter* `{ present, growing }` fades everything off the slice (presentism) or above it (growing block). Every block material calls both.
8.3 **ribbons.ts** — worldlines as camera-facing ribbons with a hot core and soft halo; per-vertex proper time τ drives **tick beads** (one per tick interval); per-path uniforms: reveal, intensity, tick interval. Boost-correct (the ribbon is built from the boosted centre and tangent).
8.4 **events.ts** — instanced glowing points with per-instance colour/size, slice-lit, idle pulse.
8.5 **knife.ts** — a now-slice as a glass sheet clipped to the block: tinted body, luminous edges where it meets the block's faces, fine hatching; amber for A, cyan for B.
8.6 **cones.ts** — future/past light cones as engraved glass (rulings + rims), violet; invariant under boosts by construction (and visibly so).
8.7 **bowl.ts** — nested proper-time hyperboloids with contour lines.
8.8 **glassBlock.ts** — the block itself: bright edges, faint faces with a coordinate grid in A's frame (shears visibly in B's frame).
8.9 **labels.ts** — `LabelSet`: labels `{ text, tone, anchor (spacetime) }`; projected per frame (CPU, no allocation) to screen; the engine writes them to an HTML layer with opacity weighted by transition mix.
8.10 **panels.ts** — render one scene into 1, 2 (diptych) or 4 (quadtych) viewports of its target, updating view/reality uniforms between panels; also the loupe inset.
8.11 **filmStack.ts** — a stack of translucent frames of a procedural 2D animation f(x, y, t); a knife through it shows the "photograph" of that slice.
8.12 **rig.ts** — orbit camera driven by script tracks (azimuth, elevation, distance, target), eased, with slow idle drift.

Visual language: near-black with a faint indigo floor glow; luminous filaments; **amber = observer A, cyan = observer B, white = both agree, violet = light**; status colours from §13. Slow cinematic camera, no snapping, one legible idea per beat.

---

## 9. Comparison instruments

| Instrument | Where | What it shows |
|---|---|---|
| **Two Knives** | 6, 8, 9 | Two now-slices through the same glass block; events lit amber (A's now), cyan (B's), white (both). The knives agree only along one line through the shared here-and-now. |
| **The Reshuffle** (HUD) | 6 | Event chips on a lane ordered by "when" in the current frame. As β changes, spacelike chips swap; causally chained pairs never flip. |
| **Clock Ladder** | 4, 10, 11 | Two worldlines with yearly tick beads; rungs join equal clock readings and shear as paths separate. |
| **The Spool** | 4 | Each worldline's proper time drawn as a thread length at the reunion: the straight path is the longest. |
| **Bowl of Equal Ages** | 5 | Nested hyperboloids of equal proper time from one event; travelers as beads; each traveler's now-plane is tangent to the bowl at their bead. |
| **Ribbon of Possible Nows** | 8 | On Andromeda's worldline, the segment any passer-through of here-now could call "now": ±4.3 days at walking pace, ±2.5 Myr in the limit. |
| **Atlas of Elsewhere** (HUD) | 8 | Moon … Virgo with each one's now-width ±d/c. |
| **The Loupe** | 4, 8, 10 | Picture-in-picture magnifier with an explicit scale factor. |
| **Rolling Shutter** | 7 | A rotor's history as a film stack; two knives give two photographs; B's blades bend. |
| **Simultaneity Fan** | 9 | All now-slices through one event for −0.99c … +0.99c, sweeping the "elsewhere" bow-tie. |
| **Shared-History Venn** | 3, 10 | Two past light cones; the overlap is what both can know. |
| **Altitude Comb** | 11 | Clocks at sea level, Everest, ISS, GPS, geostationary: rates from `gravity.ts`. |
| **Tipping Cones** | 11 | Light cones tilt toward a black hole; inside the horizon every future points at the singularity. |
| **Diptych / Quadtych** | 6, 12 | Same block in two frames side by side; four philosophies side by side. |

---

## 10. Stages (beats and technique)

Display units are c = 1. Each scene declares its scale in its status note.

1. **flow · metaphor** — A single luminous "now" sheet rises through darkness carrying the Sun, Earth, Moon and a walker as points; behind it an afterimage fades ("the past is gone"); above it, nothing ("the future isn't there yet"). Presentism as lived.
2. **stack · established** — Freeze the sheet each moment and stack the frames: the afterimage stops fading, frames pile into a block, and the points become worldlines (Sun a vertical line, Earth a helix, Moon a helix around it). The block from `world.ts` appears for the first time. Note: orbit radii and periods are not to scale.
3. **light · measured** — A flash on the sheet expands as a circle; in the block, a cone. Future/past cones; everything outside is "elsewhere". Two people's past cones overlap (Venn): the lens is their shared history. Then the frame is boosted: worldlines shear, cones don't move (Michelson–Morley).
4. **clocks · measured** — Twins: home worldline straight up; traveler to Proxima and back at 0.8c. Yearly tick beads; Clock Ladder rungs shear; at reunion 6.37 vs 10.62 years (the Spool). HUD: muon ring (64 µs vs 2.2 µs), GPS (−7.2 µs/day from speed).
5. **ages · established** — Travelers fan out from one event at many speeds; nested bowls of 1, 2, 3 … years; beads where each crosses. Then two travelers' now-planes appear as tangent planes to the bowl at their beads.
6. **whose · established** — The shared block; Two Knives (A at rest, B at 0.5c) light different events; HUD Reshuffle lane re-sorts events; then the Diptych: the same block in A's frame and in B's.
7. **shutter · metaphor** — A rotor (and orbiting lights) as a film stack; A's knife and B's knife; their two photographs side by side: B's blades bend. Note: the speed is exaggerated so the bend is visible; the geometry is exact.
8. **andromeda · argument** — Earth on the left, Andromeda's worldline 2.5 Mly away. Two walkers pass in the street; their knives fan out across the gap; at Andromeda they meet the galaxy's history days apart (Loupe ×10¹⁴, scale bar). A fleet-launch event sits between them. Then the Ribbon: at any speed, ±2.5 million years. HUD: Atlas of Elsewhere.
9. **eternal · argument** — The Fan sweeps through every possible now; each lights a different set of events until everything has been "now" for someone; the block lights uniformly. Camera pulls back: the block as an object. Rietdijk–Putnam conclusion stated as an argument, not a result.
10. **you · measured** — A life as a worldline from birth to death with yearly beads; head and feet as two worldlines that drift 0.47 µs apart over 80 years (Loupe). The arrow of time as an entropy gradient in the block (an ink drop spreading upward), and why memories point to the past.
11. **curved · measured** — Altitude Comb around Earth's world-tube (rates exaggerated, stated; values exact in the HUD). Then the Tipping Cones down to a black hole's horizon and inside.
12. **rivals · open** — Quadtych: presentism (only the slice exists), growing block (below the slice), moving spotlight (all, with a privileged light), block (all, no privilege). Captions: Stein 1968 (the light cone is the only invariant "now"), quantum indeterminacy, Ellis's crystallising block, free will. What physics settles and what it doesn't.
13. **whole · measured** — Pull out to cosmic scale: our past light cone's teardrop from today back to the Big Bang in proper distance (computed from Planck 2018 ΛCDM), galaxies' worldlines spreading apart, the last-scattering ring. End card linking to Cosmic History.

---

## 11. Scroll & narration
Inherited: Lenis + driver, `VH_PER_WEIGHT = 80`, keyboard stops at captions, `captionSchedule` (min dwell 32 svh), one caption at a time, screen-reader text in the DOM, polite stage announcements, hero card, credits appendix.

### 10.3 Dual clock (HUD, top right)
Always shows the comparison the stage is making, computed from the stage script: e.g. `Home 10.6 yr · Traveler 6.4 yr`, `Your now on Andromeda: +4.3 days`, `GPS clock: +38.5 µs/day`. Instrument cards (Reshuffle, Atlas, comb table, loupe scale bar) appear where the stage asks.

---

## 12. Content
`src/content/stages/<id>.mdx`: `id, title, kicker, summary, beats[{local, text}], howWeKnow, sources[]`. Plain, short, one idea per beat. Present the block universe on its own terms; the rivals stage is fair to presentism and the growing block.

---

## 13. Status & honesty rules

| Status | Meaning |
|---|---|
| measured | Shown effect has been directly measured. |
| established | Follows from tested relativity; not in dispute among physicists. |
| argument | A philosophical inference from the physics; premises stated. |
| open | Contested; no consensus. |
| metaphor | A visual device; says nothing literal. |

1. Every stage declares status + note; the HUD shows the chip.
2. No physical value hand-typed in a shader or in copy: numbers come from `src/relativity/`.
3. Every exaggeration (speeds, distances, rates, sizes) is stated in the note; loupe factors are shown on screen.
4. Philosophical claims are attributed (who argued it, where) and never presented as experimental results.

---

## 14. Data
`public/data/experiments.json` (Michelson–Morley 1887, Ives–Stilwell 1938, Rossi–Hall 1941, Pound–Rebka 1959, Hafele–Keating 1971, Bailey et al. 1977, Chou et al. 2010, GPS), `positions.json` (McTaggart 1908, Broad 1923, Rietdijk 1966, Putnam 1967, Stein 1968, Penrose 1989, Ellis 2006 …), `places.json` (Atlas distances with sources). zod schemas → generated JSON Schema; drift test.

---

## 15. Quality gates
`pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build` pass. `/dev/scenes` harness (scrub, FPS, leak ×50). `scripts/shoot.ts` screenshots per stage on WebGPU and WebGL2. 60 fps medium on a laptop, ≥ 30 fps low on a phone. Lighthouse a11y ≥ 90. Reduced motion holds one frame per stage; no-GPU shows stills.

## 16. Build phases
1. Relativity, stages/tracks, data, tests. 2. Skeleton (page, narration, HUD, driver, placeholder). 3. Shared block library + panels + labels + dev harness. 4. Anchor stages `whose`, `andromeda`. 5. `flow`, `stack`, `light`, `clocks`, `ages`. 6. `shutter`, `eternal`, `you`, `rivals`. 7. `curved`, `whole`. 8. Polish: copy, sources, stills, a11y, performance, SEO/OG. Deploy only when the owner says so.

## 17. Conventions
Inherited (strict TS, units in names, typed `params` at the top of each scene, TSL only, shared nodes in `src/shared/`, commit per logical step).
