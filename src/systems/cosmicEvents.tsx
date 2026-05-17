import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/useGameStore';
import { sfxResonance, sfxStageUp, sfxCollect } from '../audio/audio';
import { startObjectiveForEvent } from './eventObjectives';

const MIN_INTERVAL = 35;
const MAX_INTERVAL = 90;

const EVENT_TYPES = ['meteor', 'eclipse', 'resonance', 'bloom', 'quasar', 'twinning'] as const;
type EventKind = typeof EVENT_TYPES[number];

function pickEventKind(): EventKind {
  const weights: Record<EventKind, number> = {
    meteor: 4, eclipse: 3, resonance: 3, bloom: 2, quasar: 2, twinning: 1,
  };
  const total = EVENT_TYPES.reduce((a, k) => a + weights[k], 0);
  let r = Math.random() * total;
  for (const k of EVENT_TYPES) {
    r -= weights[k];
    if (r <= 0) return k;
  }
  return 'meteor';
}

export default function CosmicEventsSystem({ onMeteorBurst }: { onMeteorBurst: () => void }) {
  const nextAt = useRef(performance.now() / 1000 + 15);

  useFrame(() => {
    const t = performance.now() / 1000;
    if (t < nextAt.current) return;

    fireEvent(pickEventKind(), onMeteorBurst);
    nextAt.current = t + MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
  });

  return null;
}

/** Fire an event: visible effect + objective. Trait reward is now granted by the
 *  objective system only on success. */
export function fireEvent(kind: EventKind, onMeteorBurst?: () => void) {
  const store = useGameStore.getState();

  // Visible/audible effect for the event itself (atmosphere)
  switch (kind) {
    case 'meteor':
      onMeteorBurst?.();
      store.startEvent('meteor', 12);
      break;
    case 'eclipse':
      store.startEvent('eclipse', 8);
      break;
    case 'resonance':
      store.startEvent('resonance', 8);
      sfxResonance();
      break;
    case 'bloom':
      store.startEvent('bloom', 10);
      sfxCollect();
      break;
    case 'quasar':
      store.startEvent('quasar', 10);
      sfxStageUp();
      break;
    case 'twinning':
      store.startEvent('twinning', 5);
      sfxStageUp();
      break;
  }

  // Set up the objective — completing it grants the trait + mass reward
  startObjectiveForEvent(kind);
}
