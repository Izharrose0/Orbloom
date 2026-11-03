// Relative frame-time comparison (legacy vs. each quality preset) on the same machine.
// Absolute numbers depend on the GPU; under software GL (CI) only the ratios mean anything.
// Usage: node scripts/perf.mjs --url http://localhost:4173/orbloom/ [--mass 260] [--seconds 10]
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i === -1 ? d : args[i + 1]; };
const URL_BASE = opt('url', 'http://localhost:4173/orbloom/');
const MASS = Number(opt('mass', 260));
const SECONDS = Number(opt('seconds', 10));
const id = '7c2f9a41-5be3-4d10-9e60-2b8d31f0c7a5';
const runs = [
  { name: 'legacy 1.x', q: 'quality=high&legacy=1' },
  { name: '2.0 low', q: 'quality=low' },
  { name: '2.0 medium', q: 'quality=medium' },
  { name: '2.0 high', q: 'quality=high' },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const r of runs) {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 320 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(({ id, mass }) => {
    localStorage.setItem('orbloom.userId', id);
    localStorage.setItem('orbloom.snapshot.' + id, JSON.stringify({ id, mass, energy: 0, evolution: Math.log2(1 + mass), traits: [], trait_amounts: {}, updated_at: new Date().toISOString() }));
  }, { id, mass: MASS });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}?${r.q}`, { waitUntil: 'load' });
  await page.waitForTimeout(6000);
  const res = await page.evaluate((sec) => new Promise((resolve) => {
    const times = []; let last = performance.now(); const end = last + sec * 1000;
    const tick = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(tick); else resolve(times); };
    requestAnimationFrame(tick);
  }), SECONDS);
  res.shift();
  const avg = res.reduce((a, b) => a + b, 0) / res.length;
  console.log(`${r.name.padEnd(12)} frames=${String(res.length).padStart(4)}  avg=${avg.toFixed(1)} ms`);
  await ctx.close();
}
await browser.close();
