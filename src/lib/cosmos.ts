// Shared fictional universe. Every organism has persistent cosmic coordinates
// derived from its id (no extra column, nothing to write): the same organism is
// always in the same place, for every player. Neighbours are shown in the sky in
// the true direction from YOUR organism, nearer ones larger and brighter.

import { hashString, mulberry32, subSeed } from './rng';
import type { Genome } from './genome';

export const UNIVERSE_RADIUS = 1000;

export function cosmicCoordinates(id: string): [number, number, number] {
  const rand = mulberry32(subSeed(hashString(id), 'cosmos'));
  // a thick disc galaxy: most organisms live near the galactic plane
  const r = Math.sqrt(rand()) * UNIVERSE_RADIUS;
  const a = rand() * Math.PI * 2;
  const y = (rand() - 0.5) * UNIVERSE_RADIUS * 0.18 * (1 - r / UNIVERSE_RADIUS * 0.6);
  return [Math.cos(a) * r, y, Math.sin(a) * r];
}

/** Compatibility of two energy signatures: close glow hues, or the same surface family. */
export function resonanceAffinity(a: Genome, b: Genome): number {
  const dh = Math.abs(((a.hueGlow - b.hueGlow + 540) % 360) - 180);
  const hue = Math.max(0, 1 - dh / 40);
  const family = a.noiseType === b.noiseType ? 0.5 : 0;
  const rhythm = Math.max(0, 1 - Math.abs(a.pulseRate - b.pulseRate) / 0.3) * 0.3;
  return Math.min(1, hue + family + rhythm);
}
