export type Stage = {
  id: number;
  name: string;
  threshold: number;
  // Visual
  ringEnabled: boolean;
  coronaEnabled: boolean;
  tendrilsEnabled: boolean;
  discEnabled: boolean;
  bloomBoost: number;     // additive to base bloom intensity
  paletteShift: number;   // hue shift in degrees applied globally to genome palette
  // Audio: harmonic layer enables (cumulative)
  audioPad: boolean;
  audioShimmer: boolean;
  audioBass: boolean;
};

export const STAGES: Stage[] = [
  { id: 0, name: 'Seme',         threshold: 0,   ringEnabled: false, coronaEnabled: false, tendrilsEnabled: false, discEnabled: false, bloomBoost: 0.0, paletteShift: 0,   audioPad: false, audioShimmer: false, audioBass: true  },
  { id: 1, name: 'Embrione',     threshold: 5,   ringEnabled: false, coronaEnabled: false, tendrilsEnabled: false, discEnabled: false, bloomBoost: 0.15, paletteShift: 6,  audioPad: true,  audioShimmer: false, audioBass: true  },
  { id: 2, name: 'Pulsar',       threshold: 20,  ringEnabled: true,  coronaEnabled: false, tendrilsEnabled: false, discEnabled: false, bloomBoost: 0.4,  paletteShift: 14, audioPad: true,  audioShimmer: true,  audioBass: true  },
  { id: 3, name: 'Stella',       threshold: 60,  ringEnabled: true,  coronaEnabled: true,  tendrilsEnabled: false, discEnabled: false, bloomBoost: 0.7,  paletteShift: 30, audioPad: true,  audioShimmer: true,  audioBass: true  },
  { id: 4, name: 'Buco bianco',  threshold: 150, ringEnabled: true,  coronaEnabled: true,  tendrilsEnabled: true,  discEnabled: false, bloomBoost: 0.95, paletteShift: 60, audioPad: true,  audioShimmer: true,  audioBass: true  },
  { id: 5, name: 'Singolarità',  threshold: 500, ringEnabled: true,  coronaEnabled: true,  tendrilsEnabled: true,  discEnabled: true,  bloomBoost: 1.2,  paletteShift: 110,audioPad: true,  audioShimmer: true,  audioBass: true  },
];

export function stageForMass(mass: number): Stage {
  let s = STAGES[0];
  for (const stage of STAGES) {
    if (mass >= stage.threshold) s = stage;
  }
  return s;
}
