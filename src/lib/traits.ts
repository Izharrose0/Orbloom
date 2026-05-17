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
  smooth:   { id: 'smooth',   name: 'Glassato',  family: 'surface', rarity: 'common',    description: 'Superficie quasi liscia, vetrosa.' },
  spiked:   { id: 'spiked',   name: 'Spinato',   family: 'surface', rarity: 'common',    description: 'Spuntoni sporgenti distribuiti.' },
  ridged:   { id: 'ridged',   name: 'Costato',   family: 'surface', rarity: 'common',    description: 'Anelli concentrici lungo un asse.' },
  fissured: { id: 'fissured', name: 'Solcato',   family: 'surface', rarity: 'rare',      description: 'Profonde fenditure tagliano la pelle.' },
  cratered: { id: 'cratered', name: 'Craterato', family: 'surface', rarity: 'rare',      description: 'Avvallamenti circolari incisi.' },

  // FORM — shape distortion
  oblate:   { id: 'oblate',   name: 'Oblato',    family: 'form',    rarity: 'common',    description: 'Schiacciato ai poli.' },
  prolate:  { id: 'prolate',  name: 'Allungato', family: 'form',    rarity: 'common',    description: 'Stirato lungo un asse.' },
  twisted:  { id: 'twisted',  name: 'Contorto',  family: 'form',    rarity: 'rare',      description: 'Massa torta in spirale.' },

  // COLOR — palette cast
  singed:   { id: 'singed',   name: 'Bruciato',  family: 'color',   rarity: 'common',    description: 'Tinte calde di una stella morente.' },
  frozen:   { id: 'frozen',   name: 'Gelato',    family: 'color',   rarity: 'common',    description: 'Riflessi gelidi di un mondo lontano.' },
  aurorae:  { id: 'aurorae',  name: 'Aurorale',  family: 'color',   rarity: 'rare',      description: 'Bande di luce verde e magenta.' },
  eclipsed: { id: 'eclipsed', name: 'Eclissato', family: 'color',   rarity: 'rare',      description: 'Luminosità permanente dimezzata.' },

  // DECORATION — extra meshes around
  haloRing: { id: 'haloRing', name: 'Anellato',  family: 'decoration', rarity: 'common', description: 'Sottile anello equatoriale.' },
  gemmed:   { id: 'gemmed',   name: 'Gemmato',   family: 'decoration', rarity: 'rare',   description: 'Schegge cristalline in orbita.' },
  twinned:  { id: 'twinned',  name: 'Geminato',  family: 'decoration', rarity: 'legendary', description: 'Un piccolo compagno orbita accanto.' },

  // RHYTHM — pulse / audio modulation
  pulsar:   { id: 'pulsar',   name: 'Pulsante',  family: 'rhythm',  rarity: 'common',    description: 'Respiro raddoppiato.' },
  quiet:    { id: 'quiet',    name: 'Quieto',    family: 'rhythm',  rarity: 'common',    description: 'Respiro lento, profondo.' },
  resonant: { id: 'resonant', name: 'Risonante', family: 'rhythm',  rarity: 'rare',      description: 'Armoniche aggiunte al canto.' },
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
