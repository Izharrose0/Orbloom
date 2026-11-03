import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, EventObjective, CosmicEventKind } from '../store/useGameStore';
import { rollTraitFromEvent } from '../lib/traits';
import { sfxCollect } from '../audio/audio';

type Spec = { description: string; target: number; durationSec: number; massReward: number };

const SPECS: Record<CosmicEventKind, Spec> = {
  meteor:    { description: 'Collect 5 meteors',          target: 5,  durationSec: 12, massReward: 5  },
  eclipse:   { description: "Don't tap for 6 seconds",    target: 6,  durationSec: 8,  massReward: 3  },
  resonance: { description: 'Answer with 5 touches',      target: 5,  durationSec: 10, massReward: 4  },
  // 1.x asked for +20 energy in 10 s (≈25 rapid taps) — rebalanced to reward a few calm touches or one drifter
  bloom:     { description: 'Feed the bloom',             target: 8,  durationSec: 14, massReward: 6  },
  // 1.x relied on random spawns (every 5–12 s) for 3 catches in 10 s; the quasar now sheds its own fragments
  quasar:    { description: 'Catch 3 quasar fragments',   target: 3,  durationSec: 14, massReward: 8  },
  twinning:  { description: 'Hold still and witness',     target: 1,  durationSec: 6,  massReward: 10 },
};

export function buildObjective(kind: CosmicEventKind): EventObjective {
  const spec = SPECS[kind];
  const s = useGameStore.getState();
  return {
    kind,
    description: spec.description,
    target: spec.target,
    progress: 0,
    startedAt: performance.now() / 1000,
    durationSec: spec.durationSec,
    baselineTaps: s.totalTaps,
    baselineDrifters: s.drifterCollected,
    baselineEnergy: s.energy,
    baselineLastTap: performance.now() / 1000,
    completed: false,
    failed: false,
  };
}

function computeProgress(obj: EventObjective): number {
  const s = useGameStore.getState();
  const now = performance.now() / 1000;
  switch (obj.kind) {
    case 'meteor':
    case 'quasar':
      return s.drifterCollected - obj.baselineDrifters;
    case 'resonance':
      return s.totalTaps - obj.baselineTaps;
    case 'bloom':
      return s.energy - obj.baselineEnergy;
    case 'eclipse':
      // Progress = seconds since event start with NO new taps
      return s.totalTaps === obj.baselineTaps
        ? Math.min(obj.target, now - obj.startedAt)
        : 0;  // reset if tapped
    case 'twinning':
      return now - obj.startedAt >= obj.durationSec ? obj.target : 0;
  }
}

/** Frame-driven evaluator that updates progress + decides success/failure. */
export default function EventObjectivesSystem() {
  const settledForRef = useRef<number | null>(null);

  useFrame(() => {
    const obj = useGameStore.getState().activeObjective;
    if (!obj) return;

    // If this is a NEW objective (different start time), clear settled flag
    if (settledForRef.current !== null && settledForRef.current !== obj.startedAt) {
      settledForRef.current = null;
    }
    if (settledForRef.current === obj.startedAt) return;

    const now = performance.now() / 1000;
    const elapsed = now - obj.startedAt;
    const progress = computeProgress(obj);

    // Update progress in store (cheap shallow set)
    if (progress !== obj.progress) {
      useGameStore.setState({
        activeObjective: { ...obj, progress },
      });
    }

    // Success
    if (progress >= obj.target && !obj.completed) {
      settledForRef.current = obj.startedAt;
      resolveObjective(obj.kind, true);
      return;
    }

    // Timeout failure
    if (elapsed >= obj.durationSec && progress < obj.target) {
      settledForRef.current = obj.startedAt;
      resolveObjective(obj.kind, false);
    }
  });

  return null;
}

function resolveObjective(kind: CosmicEventKind, success: boolean) {
  const store = useGameStore.getState();

  if (success) {
    // Grant trait + reward mass
    const trait = rollTraitFromEvent(kind);
    if (trait) store.grantTrait(trait);
    const spec = SPECS[kind];
    useGameStore.setState((s) => ({
      mass: s.mass + spec.massReward,
    }));
    store.completeObjective(); // TraitToast plays the mutation swell
  } else {
    // Failure: tiny consolation + no trait
    useGameStore.setState((s) => ({ mass: s.mass + 1 }));
    store.failObjective();
    sfxCollect();
  }

  // Clear the objective after a brief delay (let the UI fade out the toast)
  setTimeout(() => {
    if (useGameStore.getState().activeObjective?.startedAt === store.activeObjective?.startedAt) {
      useGameStore.setState({ activeObjective: null });
    }
  }, 2200);
}

// Hook the cosmic events system can call to start a new objective alongside an event
export function startObjectiveForEvent(kind: CosmicEventKind) {
  const obj = buildObjective(kind);
  useGameStore.getState().startObjective(obj);
}
