import { create } from 'zustand';

export type GameState = {
  energy: number;
  mass: number;
  evolution: number;
  pulseIntensity: number;
  lastTapAt: number;

  absorbEnergy: (amount?: number) => void;
  tick: (delta: number) => void;
};

export const useGameStore = create<GameState>((set, get) => ({
  energy: 0,
  mass: 1,
  evolution: 0,
  pulseIntensity: 0,
  lastTapAt: -10,

  absorbEnergy: (amount = 1) => {
    const now = performance.now() / 1000;
    set((s) => ({
      energy: s.energy + amount,
      pulseIntensity: Math.min(1.6, s.pulseIntensity + 0.55),
      lastTapAt: now,
    }));
  },

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
