// Visual quality controller. Presets trade shader layers, tessellation, particle
// budgets and post-processing for frame rate. The initial preset is guessed from
// the device; the PerformanceMonitor in MainScene steps it down (never up
// automatically) if the frame rate stays low.

export type QualityLevel = 0 | 1 | 2; // low, medium, high

export type QualityPreset = {
  level: QualityLevel;
  name: 'low' | 'medium' | 'high';
  dpr: [number, number];
  sphereDetail: number;       // icosahedron subdivision for the body
  shaderQuality: number;      // QUALITY define: 0 = derivative normals, no interior; 1 = FD normals + interior; 2 = + membrane cells
  growthBudget: number;       // max L1 growth instances
  ciliaBudget: number;        // max L2 filament instances
  particleBudget: number;     // energy particles
  starLayers: number;         // parallax star shells
  bloom: boolean;
  grain: boolean;
};

export const QUALITY_PRESETS: QualityPreset[] = [
  { level: 0, name: 'low',    dpr: [0.75, 1.25], sphereDetail: 44, shaderQuality: 0, growthBudget: 60,  ciliaBudget: 140, particleBudget: 500,  starLayers: 2, bloom: true,  grain: false },
  { level: 1, name: 'medium', dpr: [1, 1.5],     sphereDetail: 56, shaderQuality: 1, growthBudget: 120, ciliaBudget: 320, particleBudget: 1000, starLayers: 3, bloom: true,  grain: true  },
  { level: 2, name: 'high',   dpr: [1, 2],       sphereDetail: 80, shaderQuality: 2, growthBudget: 180, ciliaBudget: 520, particleBudget: 1600, starLayers: 3, bloom: true,  grain: true  },
];

const STORAGE_KEY = 'orbloom.quality';

export function detectInitialQuality(): QualityLevel {
  try {
    const forced = new URLSearchParams(window.location.search).get('quality');
    if (forced === 'low') return 0;
    if (forced === 'medium') return 1;
    if (forced === 'high') return 2;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '0' || saved === '1' || saved === '2') return Number(saved) as QualityLevel;
  } catch {
    /* ignore */
  }
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const mem = (navigator as any)?.deviceMemory ?? 4;
  if (coarse) return cores <= 4 || mem <= 3 ? 0 : 1;
  if (cores <= 2) return 1;
  return 2;
}

export function persistQuality(level: QualityLevel | null) {
  try {
    if (level === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
