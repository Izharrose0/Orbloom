// Emergent biomes. A biome is never chosen by the player: it is scored from the
// genome (noise families) and the organism's cosmic history (the traits it has
// accumulated). Same inputs → same biome, so it is persistent and deterministic,
// but it can *shift* as new mutations arrive.

import { mulberry32, subSeed, randomUnitVector } from './rng';
import type { Genome } from './genome';

export type BiomeId = 'fungal' | 'crystal' | 'coral' | 'spore';

export type BiomeDef = {
  id: BiomeId;
  index: number;          // shader index (uBiome)
  name: string;           // shown on discovery
  description: string;
  hueShift: number;       // degrees, applied to the accent hue for growths
};

export const BIOMES: Record<BiomeId, BiomeDef> = {
  fungal:  { id: 'fungal',  index: 0, name: 'Luminous fungal fields', description: 'Soft caps of light bloom from damp membrane folds.', hueShift: 0 },
  crystal: { id: 'crystal', index: 1, name: 'Crystalline forests',     description: 'Lattices of living glass grow along the cold ridges.', hueShift: -40 },
  coral:   { id: 'coral',   index: 2, name: 'Organic coral reefs',          description: 'Branching tubes filter starlight from the void.',     hueShift: 30 },
  spore:   { id: 'spore',   index: 3, name: 'Floating spore colonies',  description: 'Drifting motes hover above the skin, tethered by light.', hueShift: 60 },
};

export const BIOME_LIST: BiomeDef[] = [BIOMES.fungal, BIOMES.crystal, BIOMES.coral, BIOMES.spore];

// Affinity of each noise family (0..5: simplex, ridged, voronoi, worley, warped, turbulence)
const NOISE_AFFINITY: Record<BiomeId, number[]> = {
  fungal:  [0.5, 0.1, 0.2, 1.0, 0.3, 0.6],
  crystal: [0.1, 0.7, 1.0, 0.3, 0.1, 0.2],
  coral:   [0.2, 0.4, 0.3, 0.2, 1.0, 0.5],
  spore:   [0.8, 0.1, 0.2, 0.5, 0.3, 0.3],
};

// Cosmic history: traits pull the ecosystem in a direction.
const TRAIT_AFFINITY: Record<BiomeId, Record<string, number>> = {
  fungal:  { smooth: 0.5, aurorae: 0.6, quiet: 0.35, resonant: 0.3, oblate: 0.2 },
  crystal: { frozen: 1.0, gemmed: 0.8, ridged: 0.5, spiked: 0.4, eclipsed: 0.3 },
  coral:   { fissured: 0.6, cratered: 0.5, singed: 0.4, prolate: 0.3, twisted: 0.4 },
  spore:   { pulsar: 0.5, twinned: 0.6, binary: 0.5, trinary: 0.6, haloRing: 0.4 },
};

export type BiomeState = {
  primary: BiomeDef;
  secondary: BiomeDef;
  /** Patch centres on the body (unit vectors) + angular radius in .w */
  patches: [number, number, number, number][];
  /** Which biome owns each patch (0 = primary, 1 = secondary) */
  patchOwner: number[];
};

export function scoreBiomes(genome: Genome, traitAmounts: Record<string, number>): { id: BiomeId; score: number }[] {
  const rand = mulberry32(subSeed(genome.seed, 'biome-tiebreak'));
  return BIOME_LIST.map((b) => {
    let s = NOISE_AFFINITY[b.id][genome.noiseType] ?? 0;
    s += (NOISE_AFFINITY[b.id][genome.veinNoiseType] ?? 0) * 0.35;
    for (const [trait, w] of Object.entries(TRAIT_AFFINITY[b.id])) {
      s += (traitAmounts[trait] ?? 0) * w;
    }
    s += rand() * 0.25; // genome-specific tie-break, stable across sessions
    return { id: b.id, score: s };
  }).sort((a, b) => b.score - a.score);
}

export function computeBiomes(genome: Genome, traitAmounts: Record<string, number>): BiomeState {
  const ranked = scoreBiomes(genome, traitAmounts);
  const primary = BIOMES[ranked[0].id];
  const secondary = BIOMES[ranked[1].id];

  // Patches are seeded only by the genome so the *places* stay stable even if the biome type shifts.
  const rand = mulberry32(subSeed(genome.seed, 'biome-patches'));
  const patches: [number, number, number, number][] = [];
  const patchOwner: number[] = [];
  const tmp: [number, number, number] = [0, 0, 0];
  let guard = 0;
  while (patches.length < 5 && guard++ < 200) {
    randomUnitVector(rand, tmp);
    // keep patches apart (≥ ~50°) so regions read as distinct territories
    if (patches.some((p) => p[0] * tmp[0] + p[1] * tmp[1] + p[2] * tmp[2] > 0.64)) continue;
    const radius = 0.45 + rand() * 0.35; // radians
    patches.push([tmp[0], tmp[1], tmp[2], radius]);
    patchOwner.push(patches.length === 4 || patches.length === 5 ? 1 : 0);
  }
  return { primary, secondary, patches, patchOwner };
}
