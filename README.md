# Orbloom

A contemplative cosmic-organism simulator: watch an unknown lifeform grow, mutate and become a unique living world. React 18 · TypeScript · Vite · Three.js / React Three Fiber · Zustand · Supabase (optional).

Design: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)

## Run locally

```bash
npm install
npm run dev          # http://localhost:5173/orbloom/  (debug panels are on in dev)
npm run build        # type-check + production build
npx vite preview     # serve the build at http://localhost:4173/orbloom/
```

Supabase is optional: copy `.env.example` to `.env` with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Without it, progress is saved in `localStorage` and the neighbour sky stays empty.

## Useful URL flags

| Flag | Effect |
|---|---|
| `?debug=1` | debug panels (always on in `npm run dev`) |
| `?quality=low\|medium\|high` | force a visual quality preset |
| `?legacy=1` | render the 1.x organism with the same genome, for comparison |

## Dev panels (leva)

Composite presets, cosmic events, **genome preview** (one preset per base form, random, back to mine — visual only), **look & quality** (legacy look, quality, reduced motion, phone frame), **behaviour & phenomena** (simulate long idle, comet, aurora, supernova, leviathan…), base form / noise overrides, mass control (incl. *next epoch*), stage jump, per-trait sliders.

## Visual comparison & checks (optional, needs Playwright)

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npx vite preview --port 4173 &
node scripts/snapshots.mjs --out snapshots/new                 # every stage, fixed genome
node scripts/snapshots.mjs --out snapshots/legacy --legacy     # same genome, 1.x look
node scripts/snapshots.mjs --out snapshots/phone --mobile --quality low
node scripts/interaction-test.mjs                              # taps, events, phenomena; fails on page errors
node scripts/perf.mjs                                          # relative frame time: legacy vs presets
```
