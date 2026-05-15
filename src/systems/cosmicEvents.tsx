import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../store/useGameStore';
import { sfxResonance } from '../audio/audio';

const MIN_INTERVAL = 60;
const MAX_INTERVAL = 180;

export default function CosmicEventsSystem({
  onMeteorBurst,
}: {
  onMeteorBurst: () => void;
}) {
  const nextAt = useRef(performance.now() / 1000 + 35);

  useFrame((state) => {
    const now = state.clock.elapsedTime + performance.timeOrigin / 1000; // not strictly needed
    const t = performance.now() / 1000;
    if (t < nextAt.current) return;

    const r = Math.random();
    if (r < 0.4) {
      // meteor shower
      onMeteorBurst();
      useGameStore.getState().startEvent('meteor', 8);
    } else if (r < 0.75) {
      useGameStore.getState().startEvent('eclipse', 8);
    } else {
      useGameStore.getState().startEvent('resonance', 10);
      sfxResonance();
    }
    nextAt.current = t + MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
  });

  return null;
}
