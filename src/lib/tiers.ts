// Tier helpers — let trait/stage decorations progress through multiple visual levels
// based on mass without changing the trait/stage system itself.

export function ringTier(mass: number): number {
  if (mass >= 500) return 3;
  if (mass >= 50)  return 2;
  return 1;
}

export function gemTier(mass: number): number {
  if (mass >= 200) return 3;
  if (mass >= 30)  return 2;
  return 1;
}

export function twinTier(mass: number): number {
  if (mass >= 1000) return 3;
  if (mass >= 100)  return 2;
  return 1;
}
