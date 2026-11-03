// Temporary visual-effects bus. Gameplay code emits "something touched the
// organism here"; rendering systems (membrane ripples, energy particles) listen.
// Nothing here is persisted — it's purely presentation.

import * as THREE from 'three';

export type RippleFx = {
  /** World-space point near/on the organism surface */
  point: THREE.Vector3;
  /** 0..1.5 — scales ring amplitude and glow */
  strength: number;
};

export type AbsorbFx = {
  /** World-space origin the energy streams from */
  from: THREE.Vector3;
  count: number;
  /** Optional RGB tint for the stream */
  color?: THREE.Color;
};

type Listener<T> = (e: T) => void;

function channel<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    emit(e: T) {
      listeners.forEach((l) => l(e));
    },
    on(l: Listener<T>) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export const rippleFx = channel<RippleFx>();
export const absorbFx = channel<AbsorbFx>();
/** Fired when an energy particle reaches the membrane (used for soft glow + audio ticks). */
export const arrivalFx = channel<{ point: THREE.Vector3 }>();

/** Set by in-scene click handlers (e.g. drifters) so the generic tap handler doesn't double-fire. */
export const tapGuard = { until: 0 };

/** Scene-level actions registered by MainScene (always, not only in debug). */
export const sceneHooks: {
  meteorShower?: () => void;
  quasarFragments?: () => void;
} = {};

// ---------------- cosmic phenomena state (presentation only) ----------------
export type PhenomenonKind = 'comet' | 'stellarWind' | 'aurora' | 'supernova' | 'leviathan';

const TINTS: Partial<Record<PhenomenonKind, [number, number, number]>> = {
  aurora: [0.85, 1.25, 1.05],
  supernova: [1.3, 1.2, 1.1],
  stellarWind: [1.05, 1.05, 1.15],
};

/** Shared phenomenon state (one at a time). */
export const phenomena = {
  active: null as null | { kind: PhenomenonKind; start: number; dur: number; seed: number },
  start(kind: PhenomenonKind, dur: number) {
    this.active = { kind, start: performance.now() / 1000, dur, seed: Math.random() };
  },
  /** 0..1 progress, or -1 when not running this kind */
  progress(kind: PhenomenonKind): number {
    const a = this.active;
    if (!a || a.kind !== kind) return -1;
    return (performance.now() / 1000 - a.start) / a.dur;
  },
  tint(): [number, number, number] | null {
    const a = this.active;
    return a ? TINTS[a.kind] ?? null : null;
  },
};

