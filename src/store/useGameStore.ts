import { create } from 'zustand';

export type GameState = {
  energy: number;
  mass: number;
  evolution: number;
  pulseIntensity: number;
  lastTapAt: number;
  drifterCollected: number;
  muted: boolean;

  absorbEnergy: (amount?: number) => void;
  collectDrifter: (value?: number) => void;
  setMuted: (m: boolean) => void;
  tick: (delta: number) => void;
};

export const useGameStore = create<GameState>((set, get) => ({
  energy: 0,
  mass: 1,
  evolution: 0,
  pulseIntensity: 0,
  lastTapAt: -10,
  drifterCollected: 0,
  muted: false,

  absorbEnergy: (amount = 1) => {
    const now = performance.now() / 1000;
    set((s) => ({
      energy: s.energy + amount,
      pulseIntensity: Math.min(1.8, s.pulseIntensity + 0.55),
      lastTapAt: now,
    }));
  },

  collectDrifter: (value = 8) => {
    set((s) => ({
      energy: s.energy + value,
      mass: s.mass + value * 0.12,
      pulseIntensity: Math.min(2.2, s.pulseIntensity + 1.1),
      drifterCollected: s.drifterCollected + 1,
      lastTapAt: performance.now() / 1000,
    }));
  },

  setMuted: (m) => set({ muted: m }),

  tick: (delta) => {
    const s = get();
    const growthRate = 0.0035 + s.energy * 0.00015;
    const newMass = s.mass + growthRate * delta;
    const newEvolution = Math.log2(1 + newMass);
    const decayedPulse = Math.max(0, s.pulseIntensity - delta * 0.45);
    set({
      mass: newMass,
      evolution: newEvolution,
      pulseIntensity: decayedPulse,
    });
  },
}));
