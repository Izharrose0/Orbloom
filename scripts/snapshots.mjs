// Visual comparison tool — renders the same deterministic organism at several
// evolution states and saves PNGs, so two builds (or the legacy vs. new look)
// can be compared side by side.
//
// Usage (requires Playwright: `npm i -D playwright && npx playwright install chromium`):
//   npm run build && npx vite preview --port 4173 &
//   node scripts/snapshots.mjs --url http://localhost:4173/orbloom/ --out snapshots/new
//   node scripts/snapshots.mjs --url http://localhost:4173/orbloom/ --out snapshots/legacy --legacy
//
// Options:
//   --id <uuid>       genome seed (default: a fixed demo id)
//   --legacy          render with the pre-2.0 shader (?legacy=1)
//   --wait <ms>       settle time per scene (default 6000)
//   --mobile          emulate a phone viewport
//   --only <a,b>      only render named scenes
//   --quality <q>     force low | medium | high
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  if (i === -1) return d;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
};

const URL_BASE = opt('url', 'http://localhost:4173/orbloom/');
const OUT = opt('out', 'snapshots/current');
const ID = opt('id', '7c2f9a41-5be3-4d10-9e60-2b8d31f0c7a5');
const LEGACY = Boolean(opt('legacy', false));
const WAIT = Number(opt('wait', 6000));
const MOBILE = Boolean(opt('mobile', false));
const ONLY = opt('only', null);
const QUALITY = opt('quality', null); // low | medium | high (software GL is slow: use low/medium in CI)

// Mass values chosen to land inside each stage (and two post-Singularity epochs).
const SCENES = [
  { name: '0-seed',        mass: 2 },
  { name: '1-embryo',      mass: 10 },
  { name: '2-pulsar',      mass: 35 },
  { name: '3-star',        mass: 90 },
  { name: '4-whitehole',   mass: 260 },
  { name: '5-singularity', mass: 700 },
  { name: '6-epoch',       mass: 4000 },
  { name: 'traits-storm',  mass: 90,  traits: { spiked: 0.9, prolate: 0.7, singed: 1, pulsar: 1 } },
  { name: 'traits-coral',  mass: 260, traits: { smooth: 0.6, ridged: 0.8, frozen: 1, haloRing: 1, quiet: 1 } },
];

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctxOpts = MOBILE
  ? { ...devices['iPhone 13'] }
  : { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };

for (const scene of SCENES) {
  if (ONLY && !String(ONLY).split(',').includes(scene.name)) continue;
  const context = await browser.newContext(ctxOpts);
  const traitIds = Object.keys(scene.traits ?? {});
  await context.addInitScript(({ id, mass, traits, traitIds }) => {
    localStorage.setItem('orbloom.userId', id);
    localStorage.setItem('orbloom.snapshot.' + id, JSON.stringify({
      id, mass, energy: 0, evolution: Math.log2(1 + mass), traits: traitIds,
      trait_amounts: traits, updated_at: new Date().toISOString(),
    }));
    localStorage.setItem('orbloom.capture', '1');
  }, { id: ID, mass: scene.mass, traits: scene.traits ?? {}, traitIds });

  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[${scene.name}] pageerror`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error(`[${scene.name}]`, m.text()); });
  const q = new URLSearchParams({ capture: '1' });
  if (LEGACY) q.set('legacy', '1');
  if (QUALITY) q.set('quality', QUALITY);
  await page.goto(`${URL_BASE}?${q}`, { waitUntil: 'load' });
  await page.waitForTimeout(WAIT);
  const file = path.join(OUT, `${scene.name}.png`);
  await page.screenshot({ path: file, timeout: 180000 });
  console.log('saved', file);
  await context.close();
}

await browser.close();
