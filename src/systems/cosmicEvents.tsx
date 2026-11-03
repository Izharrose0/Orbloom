import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, CosmicEventKind } from '../store/useGameStore';
import { sfxResonance, sfxStageUp, sfxCollect } from '../audio/audio';
import { startObjectiveForEvent } from './eventObjectives';
import { discover } from '../lib/discoveries';
import { sceneHooks, phenomena, PhenomenonKind } from './fx';

// Event director. Four tiers:
//   ambient     — common, purely atmospheric, no objective (comets, stellar wind, aurora veils)
//   interactive — the six 1.x events with gentle objectives that can grant a mutation
//   (mutation)  — outcome of a successful interactive event (traits.ts pools)
//   celestial   — extremely rare discoveries (supernova, leviathan), remembered locally
// Weights, per-kind cooldowns and "never twice in a row" keep the rhythm varied.

const EVENT_TYPES: CosmicEventKind[] = ['meteor', 'eclipse', 'resonance', 'bloom', 'quasar', 'twinning'];
const EVENT_WEIGHTS: Record<CosmicEventKind, number> = { meteor: 4, eclipse: 3, resonance: 3, bloom: 3, quasar: 2, twinning: 1 };
const EVENT_COOLDOWN = 150;      // s before the same interactive event may return
const INTERACTIVE_GAP = 45;      // s minimum between interactive events

const AMBIENT: { kind: PhenomenonKind; w: number; dur: number }[] = [
  { kind: 'comet', w: 3, dur: 14 },
  { kind: 'stellarWind', w: 3, dur: 16 },
  { kind: 'aurora', w: 2, dur: 18 },
];
const CELESTIAL: { kind: PhenomenonKind; w: number; dur: number }[] = [
  { kind: 'supernova', w: 1, dur: 28 },
  { kind: 'leviathan', w: 1, dur: 45 },
];

function weightedPick<T>(items: T[], weight: (t: T) => number): T | null {
  const total = items.reduce((a, t) => a + weight(t), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const t of items) {
    r -= weight(t);
    if (r <= 0) return t;
  }
  return items[items.length - 1];
}

export default function CosmicEventsSystem({ onMeteorBurst }: { onMeteorBurst: () => void }) {
  const live = useRef({
    nextRollAt: performance.now() / 1000 + 14,
    lastInteractiveAt: -999,
    lastKind: null as CosmicEventKind | null,
    lastFired: {} as Record<string, number>,
    lastCelestialAt: -9999,
    first: true,
  });

  useFrame(() => {
    const L = live.current;
    const t = performance.now() / 1000;
    if (t < L.nextRollAt) return;
    const s = useGameStore.getState();
    if (s.activeObjective || phenomena.active) { L.nextRollAt = t + 5; return; }

    const roll = Math.random();
    const canInteractive = t - L.lastInteractiveAt > INTERACTIVE_GAP;
    const canCelestial = t - L.lastCelestialAt > 600 && s.stage.id >= 1;

    if (L.first || (canInteractive && roll < 0.5)) {
      L.first = false;
      const kind = weightedPick(EVENT_TYPES, (k) =>
        k === L.lastKind || t - (L.lastFired[k] ?? -999) < EVENT_COOLDOWN ? 0 : EVENT_WEIGHTS[k]);
      if (kind) {
        fireEvent(kind, onMeteorBurst);
        L.lastKind = kind;
        L.lastFired[kind] = t;
        L.lastInteractiveAt = t;
      }
    } else if (canCelestial && roll > 0.97) {
      const c = weightedPick(CELESTIAL, (p) => p.w)!;
      phenomena.start(c.kind, c.dur);
      L.lastCelestialAt = t;
      if (discover('celestial-' + c.kind)) {
        useGameStore.getState().showCaption(
          c.kind === 'supernova' ? 'A star has died far away.' : 'Something vast is passing through the nebula.',
          'A rare celestial discovery');
      }
    } else {
      const a = weightedPick(AMBIENT, (p) => (L.lastFired[p.kind] && t - L.lastFired[p.kind] < 90 ? 0 : p.w));
      if (a) {
        phenomena.start(a.kind, a.dur);
        L.lastFired[a.kind] = t;
      }
    }
    L.nextRollAt = t + 22 + Math.random() * 38;
  });

  return null;
}

/** Fire an interactive event: atmosphere + objective. The trait reward is
 *  granted by the objective system only on success. */
export function fireEvent(kind: CosmicEventKind, onMeteorBurst?: () => void) {
  const store = useGameStore.getState();
  switch (kind) {
    case 'meteor':
      (onMeteorBurst ?? sceneHooks.meteorShower)?.();
      store.startEvent('meteor', 12);
      break;
    case 'eclipse':
      store.startEvent('eclipse', 8);
      break;
    case 'resonance':
      store.startEvent('resonance', 10);
      sfxResonance();
      break;
    case 'bloom':
      store.startEvent('bloom', 14);
      sfxCollect();
      break;
    case 'quasar':
      store.startEvent('quasar', 14);
      sceneHooks.quasarFragments?.();
      sfxStageUp();
      break;
    case 'twinning':
      store.startEvent('twinning', 6);
      sfxStageUp();
      break;
  }
  startObjectiveForEvent(kind);
}
