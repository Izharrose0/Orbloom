// Evolution visual controller (pure, deterministic).
//
// Turns (genome, mass, traits) into morphological targets: protrusions, membrane
// frills, interior nucleus, vein growth, growth-structure levels, symbionts.
// Stage milestones introduce NEW structures (silhouette changes); progress inside
// a stage matures them. Past Singularity, "epochs" (every doubling of mass) each
// add one seeded morphological mutation instead of scaling numbers up.

import { STAGES } from './stages';
import { mulberry32, subSeed, randomUnitVector } from './rng';
import type { Genome } from './genome';

export const MAX_LOBES = 8;
export const SINGULARITY_MASS = STAGES[STAGES.length - 1].threshold; // 500

export type EpochMutation = 'crown' | 'frill' | 'symbiont' | 'bloom' | 'veins' | 'cilia';

export const EPOCH_MUTATION_TEXT: Record<EpochMutation, { name: string; description: string }> = {
  crown:    { name: 'Crown',        description: 'Its protrusions lengthen into a crown.' },
  frill:    { name: 'Second frill', description: 'A new membrane unfurls across its body.' },
  symbiont: { name: 'Symbiont',     description: 'A fragment detaches and begins to orbit.' },
  bloom:    { name: 'Overgrowth',   description: 'Its ecosystems spread into new territory.' },
  veins:    { name: 'Deep veins',   description: 'Its circulation branches into finer vessels.' },
  cilia:    { name: 'Cilia',        description: 'A fine fur of sensing filaments emerges.' },
};
const EPOCH_POOL: EpochMutation[] = ['crown', 'frill', 'symbiont', 'bloom', 'veins', 'cilia'];

export type Persona = {
  energy: number;       // 0 meditative … 1 reactive
  luminosity: number;   // 0 dim … 1 radiant
  complexity: number;   // 0 simple … 1 intricate
  instability: number;  // 0 serene … 1 volatile
};

export type Morphology = {
  stageF: number;            // continuous stage (id + intra-stage progress), drives growth sprouting
  epoch: number;             // 0 until mass ≥ 2×Singularity
  epochMutations: EpochMutation[];
  lobes: Float32Array;       // MAX_LOBES × (dir.xyz, amount)
  lobeSharp: number;
  lobeRadius: number;
  fin: [number, number, number, number];
  fin2: [number, number, number, number];
  finWaves: number;
  nucleus: number;
  veinGrowth: number;
  growthDensity: number;     // 0..1 how much of the growth budget is used
  cilia: number;             // 0..1
  symbionts: number;         // integer count
  genomeAxis: [number, number, number];
  persona: Persona;
};

const NOISE_COMPLEXITY = [0.2, 0.6, 0.7, 0.45, 0.8, 0.55];

function amt(traitAmounts: Record<string, number>, id: string) {
  return traitAmounts[id] ?? 0;
}
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function stageProgress(mass: number): { id: number; progress: number } {
  let id = 0;
  for (const s of STAGES) if (mass >= s.threshold) id = s.id;
  const cur = STAGES[id];
  const next = STAGES[id + 1];
  if (!next) {
    // within Singularity: progress to the first epoch (2× threshold)
    const p = Math.log2(Math.max(1, mass / cur.threshold));
    return { id, progress: clamp01(p) };
  }
  const a = Math.log2(1 + cur.threshold);
  const b = Math.log2(1 + next.threshold);
  return { id, progress: clamp01((Math.log2(1 + mass) - a) / (b - a)) };
}

export function epochForMass(mass: number): number {
  if (mass < SINGULARITY_MASS * 2) return 0;
  return Math.floor(Math.log2(mass / SINGULARITY_MASS));
}

export function epochMutations(genome: Genome, epoch: number): EpochMutation[] {
  const out: EpochMutation[] = [];
  for (let k = 1; k <= epoch; k++) {
    const rand = mulberry32(subSeed(genome.seed, `epoch-${k}`));
    let pick = EPOCH_POOL[Math.floor(rand() * EPOCH_POOL.length)];
    if (out.length && out[out.length - 1] === pick) {
      pick = EPOCH_POOL[(EPOCH_POOL.indexOf(pick) + 1 + Math.floor(rand() * 4)) % EPOCH_POOL.length];
    }
    out.push(pick);
  }
  return out;
}

export function computePersona(genome: Genome, traitAmounts: Record<string, number>, stageId: number): Persona {
  const traitCount = Object.values(traitAmounts).filter((v) => v > 0.01).length;
  return {
    energy: clamp01(((genome.pulseRate - 0.5) / 1.0) * 0.75 + amt(traitAmounts, 'pulsar') * 0.4 - amt(traitAmounts, 'quiet') * 0.45 + amt(traitAmounts, 'resonant') * 0.1),
    luminosity: clamp01(0.3 + ((genome.veinDensity - 0.7) / 0.9) * 0.4 + amt(traitAmounts, 'aurorae') * 0.3 - amt(traitAmounts, 'eclipsed') * 0.5 + amt(traitAmounts, 'gemmed') * 0.1),
    complexity: clamp01(NOISE_COMPLEXITY[genome.noiseType] * 0.7 + traitCount * 0.06 + stageId * 0.05),
    instability: clamp01((genome.noiseType === 5 ? 0.35 : genome.noiseType === 1 ? 0.2 : 0.05)
      + amt(traitAmounts, 'spiked') * 0.3 + amt(traitAmounts, 'fissured') * 0.35 + amt(traitAmounts, 'twisted') * 0.3
      + amt(traitAmounts, 'trinary') * 0.3 - amt(traitAmounts, 'smooth') * 0.3 - amt(traitAmounts, 'quiet') * 0.2),
  };
}

/** Short emergent description, e.g. "Slow and meditative · highly luminous". */
export function describePersona(p: Persona, extras: { symbiotic?: boolean; biome?: string } = {}): string {
  const parts: string[] = [];
  if (p.energy < 0.3) parts.push('slow and meditative');
  else if (p.energy > 0.65) parts.push('energetic and reactive');
  if (p.instability > 0.55) parts.push('unstable');
  if (p.luminosity > 0.62) parts.push('highly luminous');
  if (p.complexity > 0.62) parts.push('structurally complex');
  if (extras.symbiotic) parts.push('symbiotic');
  if (extras.biome === 'crystal') parts.push('crystalline');
  if ((extras.biome === 'fungal' || extras.biome === 'coral') && parts.length < 2) parts.push('deeply organic');
  if (parts.length === 0) parts.push('quietly curious');
  const s = parts.slice(0, 2).join(' · ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Lobe directions are fixed per genome: the organism always buds from the same places.
const lobeDirCache = new Map<number, Float32Array>();
function lobeDirections(seed: number): Float32Array {
  const cached = lobeDirCache.get(seed);
  if (cached) return cached;
  const rand = mulberry32(subSeed(seed, 'lobes'));
  const dirs = new Float32Array(MAX_LOBES * 3);
  const tmp: [number, number, number] = [0, 0, 0];
  let n = 0;
  let guard = 0;
  while (n < MAX_LOBES && guard++ < 500) {
    randomUnitVector(rand, tmp);
    let ok = true;
    for (let j = 0; j < n; j++) {
      const d = dirs[j * 3] * tmp[0] + dirs[j * 3 + 1] * tmp[1] + dirs[j * 3 + 2] * tmp[2];
      if (d > 0.55) { ok = false; break; } // keep ≥ ~57° apart
    }
    if (!ok) continue;
    dirs.set(tmp, n * 3);
    n++;
  }
  lobeDirCache.set(seed, dirs);
  return dirs;
}

// Stage table: which lobe slots are active and how long/sharp they are.
// Seed: a cell with one soft bulge · Embryo: rounded buds · Pulsar: + membrane frill
// Star: pointed star-lobes · White Hole: long horns · Singularity: a crown of horns + second frill
//                 Seed  Embryo Pulsar Star  WhiteHole Singularity
const LOBE_SLOTS = [1,    3,     4,     5,    6,        8];
const LOBE_LEN   = [0.08, 0.22,  0.24,  0.36, 0.56,     0.64];
const LOBE_GROW  = [0.04, 0.06,  0.06,  0.08, 0.1,      0.08]; // extra length gained across the stage
const LOBE_SHARP = [1.4,  0.75,  0.8,   1.8,  2.5,      2.9];  // profile: <1 rounded bud, >1 pointed
const LOBE_RAD   = [1.1,  0.6,   0.58,  0.46, 0.36,     0.32]; // angular radius (rad)

export function computeMorphology(genome: Genome, mass: number, traitAmounts: Record<string, number>): Morphology {
  const { id: stageId, progress } = stageProgress(mass);
  const epoch = epochForMass(mass);
  const muts = epochMutations(genome, epoch);
  const count = (m: EpochMutation) => muts.filter((x) => x === m).length;
  const persona = computePersona(genome, traitAmounts, stageId);

  const rand = mulberry32(subSeed(genome.seed, 'lobe-amounts'));
  const dirs = lobeDirections(genome.seed);
  const lobes = new Float32Array(MAX_LOBES * 4);

  // Meditative genomes round their protrusions off; volatile ones sharpen them.
  const sharpMul = 0.8 + persona.instability * 0.5 + persona.energy * 0.2;
  const crown = count('crown');
  const slots = Math.min(MAX_LOBES, LOBE_SLOTS[stageId]);
  for (let i = 0; i < MAX_LOBES; i++) {
    const variation = 0.65 + rand() * 0.6;
    lobes[i * 4] = dirs[i * 3];
    lobes[i * 4 + 1] = dirs[i * 3 + 1];
    lobes[i * 4 + 2] = dirs[i * 3 + 2];
    if (i >= slots) { lobes[i * 4 + 3] = 0; continue; }
    // The newest slot of a stage starts as a small bud and matures with progress.
    const newest = i === slots - 1 && stageId > 0 && LOBE_SLOTS[stageId] > LOBE_SLOTS[stageId - 1];
    const maturity = newest ? 0.35 + 0.65 * progress : 1;
    const len = (LOBE_LEN[stageId] + LOBE_GROW[stageId] * progress + crown * 0.05) * variation * maturity;
    lobes[i * 4 + 3] = Math.min(0.85, len);
  }
  const lobeSharp = (LOBE_SHARP[stageId] + crown * 0.4) * sharpMul;
  const lobeRadius = Math.max(0.22, LOBE_RAD[stageId] - crown * 0.03) * (1.1 - persona.instability * 0.2);

  // Genome axis: dominant body axis (fins wrap around it, peristaltic waves travel along it).
  const axRand = mulberry32(subSeed(genome.seed, 'axis'));
  const tilt = (axRand() - 0.5) * 0.9;
  const yaw = axRand() * Math.PI * 2;
  const genomeAxis: [number, number, number] = [Math.sin(tilt) * Math.cos(yaw), Math.cos(tilt), Math.sin(tilt) * Math.sin(yaw)];

  // Membrane frill appears at Pulsar and keeps maturing; a second one may come from epochs.
  const finAmt = stageId >= 2 ? Math.min(0.4, 0.2 + 0.1 * (stageId === 2 ? progress : 1) + (stageId >= 5 ? 0.06 : 0)) : 0;
  const fin: [number, number, number, number] = [genomeAxis[0], genomeAxis[1], genomeAxis[2], finAmt];
  const fin2Count = count('frill') + (stageId >= 5 ? 1 : 0);
  const perp: [number, number, number] = [genomeAxis[1], -genomeAxis[0], 0.35];
  const pl = Math.hypot(...perp) || 1;
  const fin2: [number, number, number, number] = [perp[0] / pl, perp[1] / pl, perp[2] / pl,
    fin2Count > 0 ? Math.min(0.28, (stageId >= 5 ? 0.08 + 0.08 * progress : 0) + count('frill') * 0.09) : 0];
  const finWaves = 5 + Math.floor(mulberry32(subSeed(genome.seed, 'fin-waves'))() * 7);

  const nucleus = stageId === 0 ? 0.25 + 0.25 * progress : Math.min(1, 0.55 + stageId * 0.09);
  const veinGrowth = clamp01(0.15 + stageId * 0.16 + progress * 0.08 + count('veins') * 0.2);

  // Growth structures sprout from Star; overgrowth epochs push the budget further.
  const growthDensity = stageId < 3 ? 0 : clamp01(0.35 + (stageId - 3) * 0.2 + (stageId === 3 ? progress * 0.2 : 0.1) + count('bloom') * 0.18);
  const cilia = stageId < 4 ? 0 : clamp01(0.45 + (stageId - 4) * 0.25 + progress * 0.15 + count('cilia') * 0.25);
  const symbionts = stageId < 5 ? 0 : Math.min(6, 1 + count('symbiont') + (epoch >= 3 ? 1 : 0));

  return {
    stageF: stageId + progress + epoch * 0.5,
    epoch,
    epochMutations: muts,
    lobes,
    lobeSharp,
    lobeRadius,
    fin,
    fin2,
    finWaves,
    nucleus,
    veinGrowth,
    growthDensity,
    cilia,
    symbionts,
    genomeAxis,
    persona,
  };
}
