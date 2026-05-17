import { PREFIX, SUFFIX } from './names';

export type Genome = {
  hueDeep: number;   // 0..360
  hueGlow: number;
  hueVein: number;
  pulseRate: number; // 0.4..1.6
  veinDensity: number; // 0.6..1.6
  noiseType: number; // 0..5 — surface noise family
  baseForm: number;  // 0..5 — base body geometry
};

export const NOISE_TYPE_NAMES = ['Simplex', 'Ridged', 'Voronoi', 'Worley', 'Warped', 'Turbulence'];
export const BASE_FORM_NAMES  = ['Sphere', 'Capsule', 'Torus', 'Crystal', 'Cube', 'Knot'];

function hashBytes(uuid: string): number[] {
  const clean = uuid.replace(/-/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

export function deriveName(uuid: string): string {
  const b = hashBytes(uuid);
  const p = PREFIX[b[0] % PREFIX.length];
  const s = SUFFIX[b[1] % SUFFIX.length];
  const n = (b[2] % 9) + 1;
  return `${p}-${n} ${s}`;
}

export function deriveGenome(uuid: string): Genome {
  const b = hashBytes(uuid);
  // Constrain hues to a cool/cosmic-leaning palette: blues/purples/cyans/magentas (180..320)
  const baseHue = 180 + (b[3] % 140);
  const hueDeep = (baseHue + 180) % 360;
  const hueGlow = (baseHue + (b[4] % 60) - 30 + 360) % 360;
  const hueVein = (baseHue + 60 + (b[5] % 80) - 40 + 360) % 360;
  const pulseRate = 0.5 + (b[6] / 255) * 1.0;
  const veinDensity = 0.7 + (b[7] / 255) * 0.9;
  const noiseType = b[8] % 6;
  const baseForm = b[9] % 6;
  return { hueDeep, hueGlow, hueVein, pulseRate, veinDensity, noiseType, baseForm };
}
