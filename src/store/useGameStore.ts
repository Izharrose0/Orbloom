import { create } from 'zustand';
import { Genome, deriveGenome, deriveName } from '../lib/genome';
import { Stage, stageForMass, STAGES } from '../lib/stages';

export type CosmicEventKind = 'meteor' | 'eclipse' | 'resonance';

export type GameState = {
  // Identity
  userId: string;
  name: string;
  genome: Genome;

  // Progression
  energy: number;
  mass: number;
  evolution: number;
  pulseIntensity: number;
  lastTapAt: number;
  drifterCollected: number;
  totalTaps: number;
  peakMass: number;

  // Stage
  stage: Stage;
  stageJustChanged: number; // timestamp seconds
  stageTransitionUntil: number; // seconds elapsed-time at which transition ends

  // Cosmic events
  activeEvent: CosmicEventKind | null;
  activeEventUntil: number;

  // Welcome-back
  welcomeBackAmount: number; // seconds-equivalent to display once
  welcomeBackShownAt: number;

  // UI
  muted: boolean;

  // Actions
  init: (userId: string) => void;
  hydrateFromRemote: (data: { mass: number; energy: number; evolution: number; updatedAt?: string | null; peakMass?: number; totalTaps?: number; drifterCollected?: number }) => void;
  absorbEnergy: (amount?: number) => void;
  collectDrifter: (value?: number) => void;
  setMuted: (m: boolean) => void;
  startEvent: (k: CosmicEventKind, durationSec: number) => void;
  clearEvent: () => void;
  consumeWelcomeBack: () => void;
  tick: (delta: number, elapsed: number) => void;
};

const PLACEHOLDER_GENOME: Genome = {
  hueDeep: 220, hueGlow: 195, hueVein: 285, pulseRate: 1.0, veinDensity: 1.0,
};

export const useGameStore = create<GameState>((set, get) => ({
  userId: '',
  name: '—',
  genome: PLACEHOLDER_GENOME,

  energy: 0,
  mass: 1,
  evolution: 0,
  pulseIntensity: 0,
  lastTapAt: -10,
  drifterCollected: 0,
  totalTaps: 0,
  peakMass: 1,

  stage: STAGES[0],
  stageJustChanged: -10,
  stageTransitionUntil: 0,

  activeEvent: null,
  activeEventUntil: 0,

  welcomeBackAmount: 0,
  welcomeBackShownAt: 0,

  muted: false,

  init: (userId) => {
    set({
      userId,
      name: deriveName(userId),
      genome: deriveGenome(userId),
    });
  },

  hydrateFromRemote: (data) => {
    const mass = Math.max(1, data.mass);
    const stage = stageForMass(mass);
    set({
      mass,
      energy: data.energy ?? 0,
      evolution: data.evolution ?? Math.log2(1 + mass),
      peakMass: Math.max(data.peakMass ?? mass, mass),
      totalTaps: data.totalTaps ?? 0,
      drifterCollected: data.drifterCollected ?? 0,
      stage,
    });
  },

  absorbEnergy: (amount = 1) => {
    const now = performance.now() / 1000;
    set((s) => ({
      energy: s.energy + amount,
      pulseIntensity: Math.min(1.8, s.pulseIntensity + 0.55),
      lastTapAt: now,
      totalTaps: s.totalTaps + 1,
    }));
  },

  collectDrifter: (value = 8) => {
    set((s) => ({
      energy: s.energy + value,
      mass: s.mass + value * 0.12,
      pulseIntensity: Math.min(2.4, s.pulseIntensity + 1.2),
      drifterCollected: s.drifterCollected + 1,
      lastTapAt: performance.now() / 1000,
    }));
  },

  setMuted: (m) => set({ muted: m }),

  startEvent: (k, durationSec) => {
    set({ activeEvent: k, activeEventUntil: performance.now() / 1000 + durationSec });
  },
  clearEvent: () => set({ activeEvent: null, activeEventUntil: 0 }),

  consumeWelcomeBack: () => set({ welcomeBackAmount: 0 }),

  tick: (delta, elapsed) => {
    const s = get();
    const growthRate = 0.0035 + s.energy * 0.00015;
    const newMass = s.mass + growthRate * delta;
    const newEvolution = Math.log2(1 + newMass);
    const decayedPulse = Math.max(0, s.pulseIntensity - delta * 0.45);

    const newStage = stageForMass(newMass);
    const stageChanged = newStage.id !== s.stage.id;

    // Auto-clear event when expired
    let activeEvent = s.activeEvent;
    let activeEventUntil = s.activeEventUntil;
    if (activeEvent && performance.now() / 1000 > activeEventUntil) {
      activeEvent = null;
      activeEventUntil = 0;
    }

    set({
      mass: newMass,
      evolution: newEvolution,
      pulseIntensity: decayedPulse,
      peakMass: Math.max(s.peakMass, newMass),
      stage: newStage,
      stageJustChanged: stageChanged ? elapsed : s.stageJustChanged,
      stageTransitionUntil: stageChanged ? elapsed + 3.2 : s.stageTransitionUntil,
      activeEvent,
      activeEventUntil,
    });
  },
}));

export function setWelcomeBack(seconds: number, gainedMass: number) {
  useGameStore.setState({
    welcomeBackAmount: gainedMass,
    welcomeBackShownAt: performance.now() / 1000,
  });
  // We pass seconds for display only; gainedMass already merged into mass before this.
  void seconds;
}
