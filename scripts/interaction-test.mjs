// Interaction smoke test: loads the game, taps the body and empty space, fires
// each event + phenomenon through the debug hooks, and fails on page errors.
// Usage: node scripts/interaction-test.mjs --url http://localhost:4173/orbloom/ [--out dir]
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i === -1 ? d : args[i + 1]; };
const URL_BASE = opt('url', 'http://localhost:4173/orbloom/');
const OUT = opt('out', 'snapshots/interaction');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
const id = '7c2f9a41-5be3-4d10-9e60-2b8d31f0c7a5';
await context.addInitScript((id) => {
  localStorage.setItem('orbloom.userId', id);
  localStorage.setItem('orbloom.snapshot.' + id, JSON.stringify({ id, mass: 90, energy: 0, evolution: 6.5, traits: [], trait_amounts: {}, updated_at: new Date().toISOString() }));
}, id);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${URL_BASE}?debug=1&quality=low`, { waitUntil: 'load' });
await page.waitForTimeout(6000);

const state = () => page.evaluate(() => {
  // zustand store isn't global; read the HUD instead
  return document.querySelector('.ui-subline')?.textContent ?? '';
});
console.log('HUD:', await state());

// tap the body (centre), then empty space
await page.mouse.click(500, 350);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/tap-body.png`, timeout: 120000 });
await page.mouse.click(860, 160);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/tap-space.png`, timeout: 120000 });

for (const kind of ['resonance', 'quasar', 'eclipse', 'bloom', 'twinning', 'meteor']) {
  await page.evaluate((k) => window.__orbloom?.fireEvent?.(k), kind);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/event-${kind}.png`, timeout: 120000 });
}
for (const kind of ['aurora', 'supernova', 'leviathan', 'comet', 'stellarWind']) {
  await page.evaluate((k) => window.__orbloom?.phenomenon?.(k, 12), kind);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/phen-${kind}.png`, timeout: 120000 });
}

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await browser.close();
process.exit(errors.filter((e) => !/vibrate/.test(e)).length ? 1 : 0);
