# Orbloom — Game Design Document

> A living cosmic organism that grows over time, mutates through random events, and survives meditative attention.

---

## 1. Vision & Pillars

**Vision**: an atmospheric "cosmic life" simulator where the player tends an evolving celestial entity that becomes uniquely theirs through accumulated events, never through chosen menus.

### Design Pillars
1. **Feeling > features** — atmosphere wins every tradeoff.
2. **Discovery, not choice** — the player never picks upgrades; the planet's identity emerges from the events that happen *to* it.
3. **Infinite without grind** — growth is logarithmic, satisfying without demanding.
4. **Premium minimalism** — no inventory, no menus, no quests. The world IS the game.
5. **The organism is the interface** (2.0) — progress is read from its body, not from numbers.

### Core fantasy (2.0)
*Watch an unknown cosmic lifeform grow, mutate, and eventually become a unique living world.* The reward is witnessing change.

---

## 2. Core Loop

```
OBSERVE → INTERACT → ABSORB ENERGY → ORGANISM RESPONDS → GROWTH ACCUMULATES
   ↑                                                              ↓
REPEAT ← DISCOVER THE RESULT ← NEW STRUCTURE ← MUTATION ← COSMIC EVENT
```

The player **never has a menu choice**. Their actions are: tap, drag, zoom — or simply watch. Everything else happens to them.

- **Tap on the body**: the membrane dents and a ripple ring travels across the skin; light splashes off and is re-absorbed. The note played depends on where you touched (low on the underside, high on top).
- **Tap in space**: light is released and spirals into the organism, landing on the facing side with a smaller ripple.
- **Rapid tapping** is softly limited: after ~4 taps in 2.5 s each tap feeds less (`1 / (1 + 0.35·(n−4))`), with smaller bursts and quieter notes. Feedback never stops; only the reward tapers.
- **Watching** is a valid playstyle (see §7b Passive behaviours).

---

## 3. Identity System

Each Orb has a persistent identity derived from a UUID stored in `localStorage`. Optionally a custom display name set by the player.

| Property | Source | Effect |
|---|---|---|
| `userId` | UUID (localStorage) | Database primary key |
| `name` (procedural) | UUID bytes [0,1,2] → PREFIX/SUFFIX | Default display name |
| `customName` | User-entered (optional) | Overrides procedural name |
| `quadrant` | UUID bytes [10,11] | Spatial sector label e.g. `α-7`, `δ-3` |
| `genome.hueDeep/Glow/Vein` | UUID bytes [3,4,5] | Color palette in HSL |
| `genome.pulseRate` | UUID byte [6] | Breath rhythm modulator |
| `genome.veinDensity` | UUID byte [7] | Surface vein concentration |
| `genome.noiseType` | UUID byte [8] | Surface displacement noise family (0-5) |
| `genome.baseForm` | UUID byte [9] | Base body geometry (0-5) |
| `genome.veinNoiseType` | UUID byte [12] | Internal vein pattern noise family (0-5) |

**Outcome**: Two Orbs are visually and acoustically unique even before any events occur.

---

## 4. Growth Model

```
mass(t+dt) = mass(t) + growthRate * dt
growthRate = 0.0035 + energy * 0.00015
evolution  = log2(1 + mass)
visualScale = 1 + 1.6 * tanh(evolution / 7)   // capped at ~2.6x
```

- Growth is **monotonic** (never decreases).
- Visual scale **asymptotes** so the Orb never fills the screen.
- Offline progression awards mass at `0.012 * (1 + log2(1+mass)*0.05)` per second, capped at 12 hours of away time.

---

## 5. Stages — evolution changes the silhouette (2.0)

Stage IDs and thresholds are unchanged (save-compatible). Each milestone now adds **new anatomy**; progress inside a stage matures it. When a milestone is crossed the new structures *grow in* over a few seconds while the camera slowly pulls back to reveal them (no shake).

| ID | Name | Threshold | Body (silhouette) | Around it |
|---|---|---|---|---|
| 0 | Seed | 0 | a cell with one soft bulge, faint nucleus | — |
| 1 | Embryo | 5 | 3 rounded buds, visible nucleus, vessel network | — |
| 2 | Pulsar | 20 | 4 buds + **membrane frill** (scalloped skirt around the genome axis) | living particle ring |
| 3 | Star | 60 | 5 pointed **star-lobes**; first **ecosystems** sprout (L1 growths) | soft corona |
| 4 | White Hole | 150 | 6 long **horns**; **cilia** fur; secondary ecosystem | energy filaments |
| 5 | Singularity | 500 | **crown** of 8 horns + second frill; first **symbiont** detaches (L3) | accretion disc |
| 6+ | Epochs | 2×, 4×, 8× … 500 | one seeded mutation per doubling (below) | — |

Protrusion directions, frill axis and wave counts are seeded from the genome, so two organisms at the same stage still differ. Meditative genomes round their protrusions; volatile ones sharpen them.

### Epochs (beyond Singularity)
Every doubling of mass past 1 000 is an **epoch**. Each epoch picks one mutation deterministically from the genome (never the same twice in a row): **Crown** (protrusions lengthen), **Second frill**, **Symbiont** (+1 satellite, max 6), **Overgrowth** (ecosystems spread), **Deep veins**, **Cilia**. Effects accumulate and are capped — progression adds *kinds* of change, not bigger numbers. Shown as "Epoch N · <mutation>" when reached.

### Structure hierarchy
- **L0 body** — the genome's base form, displaced by one shared field (`orgField`).
- **L1 growths** — biome structures rooted on the skin (instanced, ≤ 60/120/180 by quality).
- **L2 microstructures** — veins, capillaries, membrane cells, pores (shader) and cilia (instanced).
- **L3 satellites** — symbionts on seeded inclined orbits, tethered by light; twin/binary/trinary traits.

All L1/L2 instances evaluate the same displacement field at their anchor, so they ride the breathing, ripples and protrusions. Placement is seeded (never `Math.random`), so the same organism keeps the same forests across sessions.

---

## 5b. Biomes (2.0)

Alien ecosystems emerge from the genome (surface and vein noise families) and cosmic history (accumulated traits). The player never chooses one. Scores are deterministic (with a genome-seeded tie-break); a new mutation can shift the balance.

| Biome | Leans on | Growths | Skin pattern |
|---|---|---|---|
| Luminous fungal fields | Worley / turbulence; smooth, auroral, quiet | glowing caps on curved stalks | soft bioluminescent spots |
| Crystalline forests | Voronoi / ridged; frozen, gemmed, ridged | clusters of living-glass prisms | sharp frost facets |
| Organic coral reefs | Warped; fissured, cratered, singed | branching tubes with glowing tips | porous rings |
| Floating spore colonies | Simplex; pulsing, twinned, binary | tethered floating orbs | flickering speckles |

Five patch territories are seeded per genome; three belong to the primary biome (from Star), two to the secondary (from White Hole). Growths sprout from patch centres outward as the continuous stage advances.

## 5c. Personality (emergent)

`computePersona` derives four axes from genome + traits: **energy** (meditative ↔ reactive), **luminosity**, **complexity**, **instability**. They drive animation rates, protrusion sharpness, vein pulse speed and brightness, and produce an emergent description shown in the Codex and once at Embryo (e.g. "Slow and meditative · highly luminous").

## 6. Traits (Mutations)

Traits are **permanent modifications** acquired through cosmic events. They are grouped into **5 mutually-exclusive families** (a new trait in a family replaces the old one).

### Trait families
- **Surface** (5): smooth, spiked, ridged, fissured, cratered — change vertex displacement style
- **Form** (3): oblate, prolate, twisted — change overall shape
- **Color** (4): singed, frozen, auroral, eclipsed — modify palette cast
- **Decoration** (5): ringed, gemmed, twinned, binary, trinary — add external meshes or extra cores
- **Rhythm** (3): pulsing, quiet, resonant — modulate pulse/audio rate

### Trait amounts
Each trait is stored as a **continuous 0..1 amount** in `traitAmounts`. Events grant 1.0 (full strength); composite presets use intermediate values for nuanced looks.

### Composite presets
Curated multi-trait combinations applied via debug or future achievement system. Examples: Coral, Storm, Meditant, Archon, Warm Pair, Eroded Rock, Biocosmic, Pure Chaos.

---

## 7. Cosmic Events & Phenomena (2.0)

An **event director** rolls every 22–60 s and picks a tier:

| Tier | Examples | Objective | Notes |
|---|---|---|---|
| Ambient (common) | comet, stellar wind, aurora veil | none | pure atmosphere; growths shiver in the wind |
| Interactive (uncommon) | the six events below | gentle | ≥ 45 s apart, never the same twice in a row, 150 s per-event cooldown |
| Mutation (outcome) | trait from the event's pool | — | only on success |
| Celestial (extremely rare) | distant supernova, a vast leviathan in the nebula | none | ≥ 10 min apart, recorded as discoveries |

Events are communicated through the world first: sky and body tint, a resonance ring rhythm, a quasar beacon with jets, a ghost twin that separates and returns. The on-screen lane shows the event's name, one line of invitation, progress dots, and a thin draining line (no countdown digits).

| Event | Objective | Duration | Reward |
|---|---|---|---|
| **Meteor Shower** | Gather 5 meteors | 12s | {spiked, cratered, singed, fissured, ridged} + 5 mass |
| **Eclipse** | Be still for 6s | 8s | {eclipsed, auroral, frozen, quiet, smooth} + 3 mass |
| **Resonance** | Answer with 5 touches (rings pulse every 1.4 s) | 10s | {resonant, pulsing, auroral, gemmed, ringed} + 4 mass |
| **Bloom** | Feed the bloom (+8 energy) | 14s | {smooth, oblate, ringed, auroral} + 6 mass |
| **Quasar** | Catch 3 of the 5 fragments the quasar sheds | 14s | {singed, prolate, gemmed, pulsing} + 8 mass |
| **Twinning** | Watch | 6s | {twinned, twisted} + 10 mass (always succeeds) |

Rebalanced in 2.0: Bloom used to need +20 energy in 10 s (≈ 25 rapid taps); Quasar depended on random drifter spawns (every 5–12 s) to catch 3 in 10 s.

On **failure**: +1 mass and "The moment passed. It will come again." No trait, nothing punishing.

## 7b. Passive behaviours (2.0)

Observation is a playstyle. After ~18 s without input the organism starts to **meditate** (fully by ~60 s): breathing deepens and slows, the membrane thins so the interior shows through, and genome-specific **hidden markings** (concentric glyph bands and dots) rise to the surface. During deep stillness it may:
- **Synchronise** (rare, every few minutes): every vessel and growth beats as one, with a low heartbeat chord.
- **Release spores** from its ecosystems, which drift away slowly.

Interacting simply wakes it up; nothing is lost. First-time phenomena are captioned once (stored locally in `orbloom.discoveries`, never in the save row).

---

## 8. Drifters

Free-floating energy motes that traverse the scene. Tapping or being touched by them collects energy.

- **6 shapes**: icosahedron, dodecahedron, octahedron, rounded box, cylinder, stellated
- **Spawn rate** accelerates with evolution: `5-12s * max(0.45, 1 - evo*0.05)`
- **Auto-collect** when distance to origin < 1.25
- **Manual collect** via tap (+10 energy vs +6 auto)

---

## 9. Visual Architecture (2.0)

### Layers of responsibility
1. **Persistent simulation** — `store/useGameStore.ts` (mass, traits, stage; unchanged save shape).
2. **Deterministic generation** — `lib/morphology.ts`, `lib/biomes.ts`, `lib/cosmos.ts`, `lib/rng.ts` (pure functions of genome + mass + traits).
3. **Rendering & animation** — `systems/organism.ts` (OrganismController: the only place that turns 1+2 into per-frame uniforms, smoothing targets so milestones grow in) and the components.
4. **Temporary effects** — `systems/fx.ts` (ripples, absorption, phenomena), never persisted.

### The organism material (`shaders/organismShader.ts`)
- **Vertex**: genome noise + layered biology (two-rhythm breathing that deepens when idle, regional membrane contractions out of phase, a peristaltic wave along the genome axis), protrusions with independent sway, membrane frills, tap ripples (dent then a travelling ring), the 1.x trait displacements. Normals by finite differences, so relief is actually lit.
- **Fragment**: translucent membrane over a parallax interior (nucleus seen through the skin, drifting nuclei, deep energy streams), a vessel network warped by the genome's vein family with pulses travelling through it, membrane cells (high quality), migrating energy concentrations, biome territories, bioluminescent protrusion tips, translucent frills, wrap diffuse + subsurface-style transmission, controlled fresnel, ACES shoulder.
- **Mutations as anatomy**: spikes get glowing thorn tips, fissures glow from inside, craters become pores with living rims.

### Rendering pipeline
- **Sky**: nebula sphere that follows the camera (at infinity), domain-warped clouds, dust lanes, three distant galaxies; three star shells at different depths for parallax. The sky is seeded with a universe constant, so every player shares it.
- **Dust**: two soft round layers around the organism (the 1.x dust rendered as squares).
- **Constellation**: see §13b.
- **Organism**: welded body geometries (6 forms), growths, cilia, secondary cores, symbionts.
- **Stage decorations**: living ring, soft corona (camera-facing, no hard edge), energy filaments, accretion disc — all scaled to the organism's bounding radius.
- **Energy**: particles stream along curled paths into a landing point on the skin.
- **Post-FX**: bloom with a high threshold (a halo, not fog), light grain (medium/high), soft vignette.

### Camera
Orbit with damping and inertia; **adaptive framing** keeps the player's *relative* zoom as the organism grows; milestone reveal pulls back slowly then returns; the look-at point breathes subtly. Auto-rotate resumes after 5 s idle.

### Color
Driven by genome (HSL) + per-stage palette shift + per-trait color cast.

### Noise (6 families for surface variety)
0 Simplex / 1 Ridged / 2 Voronoi / 3 Worley / 4 Warped / 5 Turbulence — selected per orb (and independently for internal vein pattern via `veinNoiseType`).

### Base forms (6 base geometries)
Sphere / Capsule / Torus / Crystal / Cube (beveled) / Knot

---

## 9b. Quality, performance, accessibility

Presets (auto-detected; changeable in the Codex; `?quality=low|medium|high`): tessellation (44/56/80), shader layers (`QUALITY` 0/1/2), growth/cilia/particle budgets, star layers, grain, DPR range. A `PerformanceMonitor` steps quality down (never up on its own) when frame rate stays low, unless the player chose a preset. WebGL context loss is recovered by remounting the canvas. `useFrame` loops avoid per-frame allocation.

Accessibility: reduced motion (OS setting or Codex toggle) scales animation amplitude to ~35% and disables UI animations; 44 px touch targets; event progress uses filled/hollow dots (not colour alone); all text over the scene has shadows for contrast; audio has a mute control with aria labels.

## 10. Audio

Procedural Web Audio (no sample files required).
- **Ambient drone**: min9 voicing on detuned oscillators + lowpass + synthesized convolution reverb
- **Tap SFX**: pentatonic note chosen by *where* you touched (low → high), soft fifth partial, quieter when tapping rapidly
- **Collect SFX**: bell-like FM
- **Stage transition**: ascending triangle wave chord
- **Resonance event**: shimmery harmonic stack
- **Mutation swell** (stage/epoch/trait), **synchronisation heartbeat**, **spore glint** (2.0)
- **Adaptive soundscape** (2.0): the pad is transposed per genome (−5…+6 semitones); a filtered-noise **breathing** layer swells at the organism's breath rate; a quiet **shimmer** layer joins from Pulsar and an internal **sub resonance** from White Hole; meditation darkens the pad and slows the breath. All changes ramp over seconds — nothing jumps.
- **Mute toggle** in UI

---

## 11. Persistence

Per-user state stored in **Supabase Postgres** with **localStorage fallback**.

```sql
planets (
  id uuid primary key,
  name text,
  custom_name text,
  mass double precision,
  energy double precision,
  evolution double precision,
  peak_mass double precision,
  total_taps integer,
  drifter_collected integer,
  traits text[],
  trait_amounts jsonb,
  updated_at timestamptz
)
```

- **Read flow**: localStorage hydrates instantly (with offline catch-up — fixed in 2.0, previously skipped) → Supabase fetched async → newer wins. Hydration snaps the morphology and camera instead of re-growing the organism on every load.
- **Write flow**: every 3.5s → localStorage first, then Supabase upsert
- **Schema-tolerant queries**: falls back gracefully if columns missing
- **Anonymous identity**: UUID in localStorage, no signup required

---

## 12. UI (2.0) — the organism is the interface

- **Top centre**: name (tap to rename) and one quiet line: *Stage · Epoch · Sector*. No numbers.
- **Top right**: Codex (ⓘ) and mute. The **Codex** card holds everything numeric and secondary: nature (personality), stage/epoch, ecosystems, mass, evolution, light gathered, discoveries, mutation chips, visual quality, reduced motion.
- **Contextual text**: captions (discoveries, milestones, neighbour names) appear in the lower third and leave by themselves; the event lane appears under the name only during an event; mutations are announced below the organism.
- **Gesture hint**: only until the player has tapped and orbited (or 45 s).
- Mobile: compact layout under 600 px, safe-area aware.

---

## 13. Debug Panel (dev mode or `?debug=1`)

Two leva panels:
- **LEFT**: composite presets, event triggers, **genome preview** (one preset per base form, random, back to mine — visual only), **look & quality** (legacy 1.x look, quality presets, reduced motion, phone frame), **behaviour & phenomena** (simulate long idle, comet, stellar wind, aurora, supernova, leviathan), base form / noise overrides, mass control (incl. *next epoch*), stage jump, drifter shapes
- **RIGHT (Traits · scalars)**: per-trait slider 0..1 grouped by family + clear / random grant

### Comparing old and new
`?legacy=1` renders the 1.x organism with the same genome and uniforms. `scripts/snapshots.mjs` renders a fixed genome at every stage (and two trait composites) with Playwright, e.g. once with `--legacy` and once without, for side-by-side review.

---

## 13b. Cosmic neighbourhood (2.0)

- **Persistent coordinates**: every organism has a fixed position in a shared disc galaxy derived from its id (`lib/cosmos.ts`) — no new column, nothing written.
- Up to 120 recently active organisms are fetched once (and every 5 min while visible); the 40 *nearest in cosmic space* are drawn in their true direction from you, nearer ones larger.
- **Silhouettes**: each neighbour is a tiny procedural sprite reflecting its stage (buds, frill, ring, lobes) in its genome's colours, breathing at its own pulse rate.
- **Discovery**: tap a neighbour to see its procedural name and stage (custom names are not shown, for privacy).
- **Resonance**: every few minutes, a neighbour with a compatible energy signature (close glow hue, same surface family, similar rhythm) may resonate — a thread of light, a shared pulse, a chime — captioned the first time.
- **Correlated sky**: comet and supernova paths are seeded by sector letter + UTC hour, so organisms in the same sector witness the same phenomenon in the same part of the sky (no network needed).
- Without a backend the sky is simply quieter; nothing breaks.

## 14. Roadmap

### Shipped
- Living shader sphere with 6 geometries × 6 noises × 18 traits × 8 composites
- Cosmic events with objectives
- Stages, decorations, multi-core composition
- Identity (name, quadrant, genome) + persistence + offline catchup
- Procedural ambient audio + SFX
- Costellazione di altri giocatori

### Shipped in 2.0
- Living organism material, layered biological animation, translucent interior
- Morphological evolution per stage, epochs beyond Singularity
- Biomes with rooted growths, cilia, symbionts
- Event director with ambient / celestial phenomena; passive behaviours
- Minimal HUD + Codex; quality presets; context recovery; reduced motion
- Cosmic coordinates, neighbour silhouettes, resonance

### Planned
- Shared/correlated phenomena between nearby players (e.g. a supernova seen by a whole sector)
- Achievement-driven composite unlocks
- Shard system (extra primitive attachments per trait)
- Real Supabase auth (replace open RLS)
- Multilanguage (i18n scaffolding)
- Haptics on supported devices

---

## 15. Project Structure

```
src/
  audio/         Procedural Web Audio
  components/    Three.js + R3F components
  dev/           Debug-only panels (leva)
  lib/           Pure logic (genome, traits, stages, persistence, scale, tiers, format)
  scenes/        Composition
  shaders/       GLSL chunks as TS template strings
  store/         Zustand global state
  systems/       Frame-driven systems (events)
docs/
  GAME_DESIGN.md This document
.github/
  workflows/     Deploy to GitHub Pages
```
