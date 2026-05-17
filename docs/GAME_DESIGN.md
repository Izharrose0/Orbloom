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

---

## 2. Core Loop

```
TAP → absorb energy → mass increases
       ↓
TIME → idle growth (offline catchup)
       ↓
RANDOM EVENTS → spawn objectives
       ↓
COMPLETE OBJECTIVE → trait granted → planet mutates
       ↓
MASS THRESHOLDS → stage transitions (cinematic)
```

The player **never has a menu choice**. Their actions are: tap, drag, zoom. Everything else happens to them.

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

## 5. Stages

Stages are **timeline checkpoints** triggered when mass crosses thresholds. Each unlocks decoration meshes and modulates bloom.

| ID | Name | Threshold | Adds |
|---|---|---|---|
| 0 | Seed | 0 | base orb |
| 1 | Embryo | 5 | denser veins (color shift) |
| 2 | Pulsar | 20 | equatorial particle ring |
| 3 | Star | 60 | plasma corona shell |
| 4 | White Hole | 150 | curved tendrils |
| 5 | Singularity | 500 | accretion disc |

Each transition triggers a cinematic: flash + camera shake + label "Mutation: <name>" + chord sound.

**Beyond Singularity**: growth continues but stages don't add new tiers (yet). Future work: procedural stages 6-∞.

---

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

## 7. Cosmic Events & Objectives

Events spawn randomly every **35-90 seconds**. Each event presents an **objective** the player must complete within a time window. **Only on success** does the planet receive a trait and a small mass bonus.

| Event | Objective | Duration | Reward |
|---|---|---|---|
| **Meteor Shower** | Collect ≥5 drifters | 12s | random trait from {spiked, cratered, singed, fissured, ridged} + 5 mass |
| **Eclipse** | Don't tap for 6s | 8s | random trait from {eclipsed, auroral, frozen, quiet, smooth} + 3 mass |
| **Resonance** | Tap exactly 6 times | 8s | random trait from {resonant, pulsing, auroral, gemmed, ringed} + 4 mass |
| **Bloom** | Reach +20 energy in window | 10s | random trait from {smooth, oblate, ringed, auroral} + 6 mass |
| **Quasar** | Collect 3 drifters | 10s | random trait from {singed, prolate, gemmed, pulsing} + 8 mass |
| **Twinning** | Wait passively | 5s | trait from {twinned, twisted} + 10 mass (always succeeds) |

On **failure**: small mass bonus (+1) and a "the moment passed" message. No trait.

---

## 8. Drifters

Free-floating energy motes that traverse the scene. Tapping or being touched by them collects energy.

- **6 shapes**: icosahedron, dodecahedron, octahedron, rounded box, cylinder, stellated
- **Spawn rate** accelerates with evolution: `5-12s * max(0.45, 1 - evo*0.05)`
- **Auto-collect** when distance to origin < 1.25
- **Manual collect** via tap (+10 energy vs +6 auto)

---

## 9. Visual Architecture

### Rendering pipeline
- **Sky**: huge inside-out sphere (r=90) with procedural nebula + 3500 stars as Points
- **Constellation**: up to 60 other players' Orbs as distant points (radius 18-24)
- **Main Orb**: chosen geometry (6 options) with custom shader (vertex displacement + fresnel + fake env reflection)
- **Secondary cores**: binary/trinary traits spawn fused mass extensions sharing the main shader
- **Stage decorations**: ring/corona/tendrils/disc conditionally rendered
- **Trait decorations**: multi-tier rings, gem shards, twin companion
- **Energy particles**: tap-spawned bursts that fly toward the orb
- **Post-FX**: dynamic Bloom (capped + smoothed) + Vignette

### Color
Driven by genome (HSL) + per-stage palette shift + per-trait color cast.

### Noise (6 families for surface variety)
0 Simplex / 1 Ridged / 2 Voronoi / 3 Worley / 4 Warped / 5 Turbulence — selected per orb (and independently for internal vein pattern via `veinNoiseType`).

### Base forms (6 base geometries)
Sphere / Capsule / Torus / Crystal / Cube (beveled) / Knot

---

## 10. Audio

Procedural Web Audio (no sample files required).
- **Ambient drone**: Cmin9 voicing on detuned oscillators + lowpass + synthesized convolution reverb
- **Tap SFX**: pentatonic note (varies each tap → musical feedback)
- **Collect SFX**: bell-like FM
- **Stage transition**: ascending triangle wave chord
- **Resonance event**: shimmery harmonic stack
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

- **Read flow**: localStorage hydrates instantly → Supabase fetched async → newer wins
- **Write flow**: every 3.5s → localStorage first, then Supabase upsert
- **Schema-tolerant queries**: falls back gracefully if columns missing
- **Anonymous identity**: UUID in localStorage, no signup required

---

## 12. UI

Minimal HUD:
- **Top**: name pill (clickable to rename) + sub-pill with Quadrant · Stage · Mass · Evo · Drifter count
- **Bottom**: gesture hints
- **Right top**: mute toggle
- **Center transient**: stage transition flash, trait toast, welcome-back toast, event objective panel

Mobile: stacked compact layout under 600px.

---

## 13. Debug Panel (dev mode or `?debug=1`)

Two leva panels:
- **LEFT (Composites & events)**: composite presets, event triggers, base form selector, noise type selector, mass control, stage jump, drifter shape spawn
- **RIGHT (Traits · scalars)**: per-trait slider 0..1 grouped by family + clear / random grant

---

## 14. Roadmap

### Shipped
- Living shader sphere with 6 geometries × 6 noises × 18 traits × 8 composites
- Cosmic events with objectives
- Stages, decorations, multi-core composition
- Identity (name, quadrant, genome) + persistence + offline catchup
- Procedural ambient audio + SFX
- Costellazione di altri giocatori

### Planned
- Procedural stages 6+ for true infinite progression
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
