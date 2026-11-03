// Deterministic PRNG helpers. Everything procedural that must persist across
// sessions (organism morphology, growth placement, biome patches) is derived
// from these — never from Math.random().

export function hashString(str: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 — tiny, fast, good enough for visuals. Returns floats in [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent stream from a base seed + a label. */
export function subSeed(seed: number, label: string | number): number {
  return (hashString(String(label)) ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
}

export function randomUnitVector(rand: () => number, out: [number, number, number] = [0, 0, 0]) {
  const z = rand() * 2 - 1;
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  out[0] = r * Math.cos(a);
  out[1] = z;
  out[2] = r * Math.sin(a);
  return out;
}
