import { supabase, supabaseEnabled } from './supabase';
import { getUserId } from './identity';
import { useGameStore, setWelcomeBack } from '../store/useGameStore';
import { deriveName } from './genome';

type PlanetRow = {
  id: string;
  name?: string | null;
  custom_name?: string | null;
  mass: number;
  energy: number;
  evolution: number;
  peak_mass?: number | null;
  total_taps?: number | null;
  drifter_collected?: number | null;
  traits?: string[] | null;
  trait_amounts?: Record<string, number> | null;
  updated_at?: string | null;
};

const SAVE_INTERVAL_MS = 3500;
const OFFLINE_RATE_PER_SEC = 0.012;
const OFFLINE_CAP_HOURS = 12;
const LOCAL_KEY_PREFIX = 'orbloom.snapshot.';

// -------- LocalStorage cache (fallback if Supabase unreachable or schema mismatch) --------

function localKey(id: string) {
  return LOCAL_KEY_PREFIX + id;
}

function readLocal(id: string): PlanetRow | null {
  try {
    const raw = localStorage.getItem(localKey(id));
    return raw ? (JSON.parse(raw) as PlanetRow) : null;
  } catch {
    return null;
  }
}

function writeLocal(row: PlanetRow): void {
  try {
    localStorage.setItem(localKey(row.id), JSON.stringify(row));
  } catch {
    // quota etc. — ignore
  }
}

// -------- Tolerant fetch (retries with reduced column set on schema errors) --------

async function fetchPlanetRobust(id: string): Promise<{ data: PlanetRow | null; error: any }> {
  if (!supabase) return { data: null, error: { message: 'no-supabase' } };

  // 1st attempt: full schema
  let res = await supabase
    .from('planets')
    .select('id, name, custom_name, mass, energy, evolution, peak_mass, total_taps, drifter_collected, traits, trait_amounts, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (res.error && (res.error.code === '42703' || /column .* does not exist/i.test(res.error.message ?? ''))) {
    // 2nd attempt: drop optional columns one by one
    console.warn('[orbloom] schema mismatch on load — retrying with reduced columns');
    res = await supabase
      .from('planets')
      .select('id, mass, energy, evolution, peak_mass, total_taps, drifter_collected, updated_at')
      .eq('id', id)
      .maybeSingle();
  }
  if (res.error && (res.error.code === '42703' || /column .* does not exist/i.test(res.error.message ?? ''))) {
    res = await supabase
      .from('planets')
      .select('id, mass, energy, evolution, updated_at')
      .eq('id', id)
      .maybeSingle();
  }
  return { data: (res.data as PlanetRow) ?? null, error: res.error };
}

// -------- Public API --------

export async function loadPlanet(): Promise<void> {
  const id = getUserId();
  useGameStore.getState().init(id);

  // Hydrate immediately from local cache if available (no flicker, instant feel)
  const localRow = readLocal(id);
  if (localRow) {
    hydrate(localRow, { offlineCatchup: false });
  }

  if (!supabaseEnabled || !supabase) return;

  // Server fetch (authoritative if newer)
  const { data, error } = await fetchPlanetRobust(id);

  if (error) {
    console.warn('[orbloom] remote load failed:', error.message ?? error);
    return; // keep local state already hydrated
  }

  if (!data) {
    // No row yet — write the seed (current state) so next reload finds something
    return;
  }

  const localTs = localRow?.updated_at ? new Date(localRow.updated_at).getTime() : 0;
  const remoteTs = data.updated_at ? new Date(data.updated_at).getTime() : 0;

  // Use remote when there's no local snapshot OR when remote is newer than local
  // (mass-only comparison fallback if timestamps missing)
  const remoteWins =
    !localRow ||
    remoteTs > localTs ||
    (remoteTs === 0 && (data.mass ?? 0) > (localRow.mass ?? 0));

  if (remoteWins) {
    hydrate(data, { offlineCatchup: true });
    writeLocal(data);
  }
}

function hydrate(row: PlanetRow, opts: { offlineCatchup: boolean }) {
  let mass = Math.max(1, row.mass);
  let gainedMass = 0;
  let awaySec = 0;

  if (opts.offlineCatchup && row.updated_at) {
    const last = new Date(row.updated_at).getTime();
    const now = Date.now();
    awaySec = Math.max(0, (now - last) / 1000);
    const cappedSec = Math.min(awaySec, OFFLINE_CAP_HOURS * 3600);
    const rate = OFFLINE_RATE_PER_SEC * (1 + Math.log2(1 + mass) * 0.05);
    gainedMass = rate * cappedSec;
    mass = mass + gainedMass;
  }

  useGameStore.getState().hydrateFromRemote({
    mass,
    energy: row.energy ?? 0,
    evolution: Math.log2(1 + mass),
    peakMass: row.peak_mass ?? mass,
    totalTaps: row.total_taps ?? 0,
    drifterCollected: row.drifter_collected ?? 0,
    traits: row.traits ?? [],
    traitAmounts: row.trait_amounts ?? {},
    customName: row.custom_name ?? null,
    updatedAt: row.updated_at,
  });

  if (gainedMass > 0.05 && awaySec > 30) {
    setWelcomeBack(awaySec, gainedMass);
  }
}

// -------- Auto-save (Supabase + localStorage, tolerant to schema) --------

export function startAutoSave(): () => void {
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
      custom_name: s.customName,
      mass: s.mass,
      energy: s.energy,
      evolution: s.evolution,
      peak_mass: s.peakMass,
      total_taps: s.totalTaps,
      drifter_collected: s.drifterCollected,
      traits: s.traits,
      trait_amounts: s.traitAmounts,
      updated_at: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSerialized) return;

    // Local first — survives even if network is down
    writeLocal(payload);

    if (!supabaseEnabled || !supabase) {
      lastSerialized = serialized;
      return;
    }

    inFlight = true;
    let { error } = await supabase.from('planets').upsert(payload, { onConflict: 'id' });

    // If schema mismatch, retry with reduced payload
    if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message ?? ''))) {
      console.warn('[orbloom] schema mismatch on save — retrying with reduced payload');
      const reduced: Partial<PlanetRow> = {
        id,
        name,
        mass: s.mass,
        energy: s.energy,
        evolution: s.evolution,
        peak_mass: s.peakMass,
        total_taps: s.totalTaps,
        drifter_collected: s.drifterCollected,
        updated_at: payload.updated_at,
      };
      const r = await supabase.from('planets').upsert(reduced as any, { onConflict: 'id' });
      error = r.error;
    }
    if (error && (error.code === '42703' || /column .* does not exist/i.test(error.message ?? ''))) {
      const minimal: Partial<PlanetRow> = {
        id,
        mass: s.mass,
        energy: s.energy,
        evolution: s.evolution,
        updated_at: payload.updated_at,
      };
      const r = await supabase.from('planets').upsert(minimal as any, { onConflict: 'id' });
      error = r.error;
    }

    inFlight = false;
    if (error) console.warn('[orbloom] save failed:', error.message ?? error);
    else lastSerialized = serialized;
  };

  const interval = window.setInterval(save, SAVE_INTERVAL_MS);
  const onHide = () => save();
  const onVisibility = () => { if (document.visibilityState === 'hidden') save(); };
  window.addEventListener('beforeunload', onHide);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener('beforeunload', onHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

// -------- Neighbors (constellation) --------

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

export type CensusRow = {
  id: string;
  name: string | null;
  custom_name: string | null;
  mass: number;
  evolution: number;
  drifter_collected: number | null;
  updated_at: string | null;
};

export async function fetchAllPlanets(limit = 200): Promise<CensusRow[]> {
  if (!supabaseEnabled || !supabase) return [];
  const { data, error } = await supabase
    .from('planets')
    .select('id, name, custom_name, mass, evolution, drifter_collected, updated_at')
    .order('mass', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[orbloom] census failed', error.message);
    return [];
  }
  return (data ?? []) as CensusRow[];
}
