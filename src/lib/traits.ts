// Composable trait system. Each trait belongs to a "family"; only one trait per family
// can be active at a time (newer overrides older). Traits are earned via cosmic events.

export type TraitFamily = 'surface' | 'form' | 'color' | 'decoration' | 'rhythm';

export type TraitDef = {
  id: string;
  name: string;
  family: TraitFamily;
  rarity: 'common' | 'rare' | 'legendary';
  description: string;
};

export const TRAITS: Record<string, TraitDef> = {
  // SURFACE — vertex displacement style
  smooth:   { id: 'smooth',   name: 'Smooth',    family: 'surface', rarity: 'common',    description: 'Nearly polished, glassy surface.' },
  spiked:   { id: 'spiked',   name: 'Spiked',    family: 'surface', rarity: 'common',    description: 'Outward protrusions scattered across the skin.' },
  ridged:   { id: 'ridged',   name: 'Ridged',    family: 'surface', rarity: 'common',    description: 'Concentric ridges along one axis.' },
  fissured: { id: 'fissured', name: 'Fissured',  family: 'surface', rarity: 'rare',      description: 'Deep cracks slice through the surface.' },
  cratered: { id: 'cratered', name: 'Cratered',  family: 'surface', rarity: 'rare',      description: 'Circular impact craters etched in.' },

  // FORM — shape distortion
  oblate:   { id: 'oblate',   name: 'Oblate',    family: 'form',    rarity: 'common',    description: 'Squashed at the poles.' },
  prolate:  { id: 'prolate',  name: 'Prolate',   family: 'form',    rarity: 'common',    description: 'Stretched along one axis.' },
  twisted:  { id: 'twisted',  name: 'Twisted',   family: 'form',    rarity: 'rare',      description: 'Mass wrung into a spiral.' },

  // COLOR — palette cast
  singed:   { id: 'singed',   name: 'Singed',    family: 'color',   rarity: 'common',    description: 'Warm hues of a dying star.' },
  frozen:   { id: 'frozen',   name: 'Frozen',    family: 'color',   rarity: 'common',    description: 'Icy reflections from a distant world.' },
  aurorae:  { id: 'aurorae',  name: 'Auroral',   family: 'color',   rarity: 'rare',      description: 'Bands of green and magenta light.' },
  eclipsed: { id: 'eclipsed', name: 'Eclipsed',  family: 'color',   rarity: 'rare',      description: 'Permanently dimmed luminosity.' },

  // DECORATION — extra meshes around
  haloRing: { id: 'haloRing', name: 'Ringed',    family: 'decoration', rarity: 'common', description: 'A thin equatorial ring.' },
  gemmed:   { id: 'gemmed',   name: 'Gemmed',    family: 'decoration', rarity: 'rare',   description: 'Crystal shards in orbit.' },
  twinned:  { id: 'twinned',  name: 'Twinned',   family: 'decoration', rarity: 'legendary', description: 'A small companion orbits alongside.' },

  // RHYTHM — pulse / audio modulation
  pulsar:   { id: 'pulsar',   name: 'Pulsing',   family: 'rhythm',  rarity: 'common',    description: 'Breath rate doubled.' },
  quiet:    { id: 'quiet',    name: 'Quiet',     family: 'rhythm',  rarity: 'common',    description: 'Slow, deep breath.' },
  resonant: { id: 'resonant', name: 'Resonant',  family: 'rhythm',  rarity: 'rare',      description: 'Extra harmonics in the song.' },
};

export const ALL_TRAIT_IDS = Object.keys(TRAITS);

// Pools per event type — what traits an event can grant.
export const EVENT_TRAIT_POOL: Record<string, string[]> = {
  meteor:   ['spiked', 'cratered', 'singed', 'fissured', 'ridged'],
  eclipse:  ['eclipsed', 'aurorae', 'frozen', 'quiet', 'smooth'],
  resonance:['resonant', 'pulsar', 'aurorae', 'gemmed', 'haloRing'],
  bloom:    ['smooth', 'oblate', 'haloRing', 'aurorae'],
  quasar:   ['singed', 'prolate', 'gemmed', 'pulsar'],
  twinning: ['twinned', 'twisted'],
};

const RARITY_WEIGHT: Record<TraitDef['rarity'], number> = {
  common: 8,
  rare: 3,
  legendary: 1,
};

export function rollTraitFromEvent(eventKind: string): string | null {
  const pool = EVENT_TRAIT_POOL[eventKind];
  if (!pool || pool.length === 0) return null;
  const weighted: { id: string; w: number }[] = pool.map((id) => ({
    id,
    w: RARITY_WEIGHT[TRAITS[id].rarity],
  }));
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let r = Math.random() * total;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) return x.id;
  }
  return weighted[0].id;
}

// Returns the new traits array with the new trait merged, replacing any existing of same family.
export function applyTrait(current: string[], newTraitId: string): string[] {
  const def = TRAITS[newTraitId];
  if (!def) return current;
  const filtered = current.filter((id) => {
    const cur = TRAITS[id];
    return cur && cur.family !== def.family;
  });
  return [...filtered, newTraitId];
}

export function hasTrait(traits: string[], id: string): boolean {
  return traits.includes(id);
}

export function traitsByFamily(traits: string[]): Record<TraitFamily, string | null> {
  const out: Record<TraitFamily, string | null> = {
    surface: null, form: null, color: null, decoration: null, rhythm: null,
  };
  for (const t of traits) {
    const def = TRAITS[t];
    if (def) out[def.family] = t;
  }
  return out;
}

// COMPOSITE PRESETS — combinations of multiple traits with custom intensities.
// Each preset replaces the current trait set when applied (use replaceAll=true).
export type CompositePreset = {
  id: string;
  name: string;
  description: string;
  recipe: Record<string, number>; // traitId -> amount 0..1
};

export const COMPOSITES: CompositePreset[] = [
  {
    id: 'coral',
    name: 'Coral',
    description: 'Glassy, ridged, icy — a crystalline world.',
    recipe: { smooth: 0.6, ridged: 0.8, frozen: 1, haloRing: 1, quiet: 1 },
  },
  {
    id: 'storm',
    name: 'Storm',
    description: 'Spiked, prolate, singed — a turbulent heart.',
    recipe: { spiked: 0.9, prolate: 0.7, singed: 1, pulsar: 1 },
  },
  {
    id: 'meditant',
    name: 'Meditant',
    description: 'Smooth, oblate, resonant — deep calm.',
    recipe: { smooth: 1, oblate: 0.8, aurorae: 0.7, resonant: 1, quiet: 1 },
  },
  {
    id: 'archon',
    name: 'Archon',
    description: 'Twisted, fissured, eclipsed — dark geometry.',
    recipe: { fissured: 1, twisted: 0.9, eclipsed: 1, gemmed: 1 },
  },
  {
    id: 'warm_pair',
    name: 'Warm Pair',
    description: 'Smooth, prolate, twinned, singed — a binary system.',
    recipe: { smooth: 0.5, prolate: 0.8, singed: 1, twinned: 1, pulsar: 1 },
  },
  {
    id: 'eroded_rock',
    name: 'Eroded Rock',
    description: 'Cratered, ridged — a surface weathered by time.',
    recipe: { cratered: 1, ridged: 0.5, singed: 0.5, haloRing: 1 },
  },
  {
    id: 'biocosmic',
    name: 'Biocosmic',
    description: 'Aurorae, rings, twins, resonant — intergalactic organic life.',
    recipe: { aurorae: 1, haloRing: 1, twinned: 1, resonant: 1, smooth: 0.4 },
  },
  {
    id: 'pure_chaos',
    name: 'Pure Chaos',
    description: 'Spiked + twisted + fissured. Maximum geometric overload.',
    recipe: { spiked: 1, twisted: 1, fissured: 0.7, gemmed: 1, pulsar: 1, singed: 0.7 },
  },
];

