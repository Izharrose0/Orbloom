// Disaccoppia massa "logica" da scala visiva.
// Crescita tanh: parte lineare poi asintotica → l'Orb non riempie mai più di ~2.6x lo schermo.

const MAX_VISUAL_SCALE = 2.6;
const KNEE = 7; // mass log2 a cui inizia ad appiattire

export function visualScaleForMass(mass: number): number {
  const evo = Math.log2(1 + Math.max(0, mass));
  // logistica: 1 + (MAX-1) * tanh(evo / KNEE)
  return 1 + (MAX_VISUAL_SCALE - 1) * Math.tanh(evo / KNEE);
}
