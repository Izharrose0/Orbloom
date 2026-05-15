import { supabase, supabaseEnabled } from './supabase';
import { getUserId } from './identity';
import { useGameStore } from '../store/useGameStore';

type PlanetRow = {
  id: string;
  mass: number;
  energy: number;
  evolution: number;
  updated_at?: string;
};

const SAVE_INTERVAL_MS = 3500;

export async function loadPlanet(): Promise<void> {
  if (!supabaseEnabled || !supabase) return;
  const id = getUserId();
  const { data, error } = await supabase
    .from('planets')
    .select('mass, energy, evolution')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn('[orbloom] load failed', error.message);
    return;
  }
  if (data) {
    useGameStore.setState({
      mass: data.mass,
      energy: data.energy,
      evolution: data.evolution,
    });
  }
}

export function startAutoSave(): () => void {
  if (!supabaseEnabled || !supabase) return () => {};
  const id = getUserId();

  let lastSerialized = '';
  let inFlight = false;

  const save = async () => {
    if (inFlight) return;
    const { mass, energy, evolution } = useGameStore.getState();
    const payload: PlanetRow = { id, mass, energy, evolution };
    const serialized = JSON.stringify(payload);
    if (serialized === lastSerialized) return;

    inFlight = true;
    const { error } = await supabase!
      .from('planets')
      .upsert(payload, { onConflict: 'id' });
    inFlight = false;

    if (error) {
      console.warn('[orbloom] save failed', error.message);
    } else {
      lastSerialized = serialized;
    }
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
