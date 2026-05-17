import { supabase, supabaseEnabled } from './supabase';
import { getUserId } from './identity';
import { useGameStore, setWelcomeBack } from '../store/useGameStore';
import { deriveName } from './genome';

type PlanetRow = {
  id: string;
  name?: string | null;
  mass: number;
  energy: number;
  evolution: number;
  peak_mass?: number | null;
  total_taps?: number | null;
  drifter_collected?: number | null;
  traits?: string[] | null;
  updated_at?: string | null;
};

const SAVE_INTERVAL_MS = 3500;
const OFFLINE_RATE_PER_SEC = 0.012; // mass/sec while away, capped
const OFFLINE_CAP_HOURS = 12;

export async function loadPlanet(): Promise<void> {
  const id = getUserId();
  useGameStore.getState().init(id);

  if (!supabaseEnabled || !supabase) return;

  const { data, error } = await supabase
    .from('planets')
    .select('mass, energy, evolution, peak_mass, total_taps, drifter_collected, traits, updated_at')
    .eq('id', id)
    .maybeSingle<PlanetRow>();

  if (error) {
    console.warn('[orbloom] load failed', error.message);
    return;
  }

  if (!data) return;

  // Offline progression catchup
  let mass = data.mass;
  let gainedMass = 0;
  let awaySec = 0;
  if (data.updated_at) {
    const last = new Date(data.updated_at).getTime();
    const now = Date.now();
    awaySec = Math.max(0, (now - last) / 1000);
    const cappedSec = Math.min(awaySec, OFFLINE_CAP_HOURS * 3600);
    // Growth scales mildly with current mass (richer get richer slightly)
    const rate = OFFLINE_RATE_PER_SEC * (1 + Math.log2(1 + mass) * 0.05);
    gainedMass = rate * cappedSec;
    mass = mass + gainedMass;
  }

  useGameStore.getState().hydrateFromRemote({
    mass,
    energy: data.energy ?? 0,
    evolution: Math.log2(1 + mass),
    peakMass: data.peak_mass ?? mass,
    totalTaps: data.total_taps ?? 0,
    drifterCollected: data.drifter_collected ?? 0,
    traits: data.traits ?? [],
    updatedAt: data.updated_at,
  });

  if (gainedMass > 0.05 && awaySec > 30) {
    setWelcomeBack(awaySec, gainedMass);
  }
}

export function startAutoSave(): () => void {
  if (!supabaseEnabled || !supabase) return () => {};
  const id = getUserId();
  const name = deriveName(id);

  let lastSerialized = '';
  let inFlight = false;

  const save = async () => {
    if (inFlight) return;
    const s = useGameStore.getState();
    const payload: PlanetRow = {
      id,
      name,
      mass: s.mass,
      energy: s.energy,
      evolution: s.evolution,
      peak_mass: s.peakMass,
      total_taps: s.totalTaps,
      drifter_collected: s.drifterCollected,
      traits: s.traits,
      updated_at: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSerialized) return;
    inFlight = true;
    const { error } = await supabase!.from('planets').upsert(payload, { onConflict: 'id' });
    inFlight = false;
    if (error) console.warn('[orbloom] save failed', error.message);
    else lastSerialized = serialized;
  };

  const interval = window.setInterval(save, SAVE_INTERVAL_MS);
  const onHide = () => save();
  window.addEventListener('beforeunload', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });

  return () => {
    window.clearInterval(interval);
    window.removeEventListener('beforeunload', onHide);
  };
}

export type NeighborPlanet = { id: string; name: string | null; mass: number };

export async function fetchNeighbors(limit = 50): Promise<NeighborPlanet[]> {
  if (!supabaseEnabled || !supabase) return [];
  const me = getUserId();
  const { data, error } = await supabase
    .from('planets')
    .select('id, name, mass')
    .neq('id', me)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[orbloom] neighbors failed', error.message);
    return [];
  }
  return (data ?? []) as NeighborPlanet[];
}
