// Organism controller: the single place that turns persistent simulation state
// (store) + deterministic morphology into per-frame render uniforms.
//
//   store (persistent sim) ──► computeMorphology / computeBiomes (deterministic, 2 Hz)
//                          └─► OrganismController (smooths targets, animates) ──► shared uniforms U
//
// Every organism material (body, cores, growths, cilia) references the SAME
// uniform objects, so they always agree on time, ripples and morphology.

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../store/useGameStore';
import { NEBULA_A, NEBULA_B } from '../lib/skyPalette';
import { computeMorphology, Morphology, MAX_LOBES } from '../lib/morphology';
import { computeBiomes, BiomeState } from '../lib/biomes';
import { visualScaleForMass } from '../lib/scale';
import { rippleFx, arrivalFx, phenomena } from './fx';
import type { Genome } from '../lib/genome';

function amt(traits: string[], amounts: Record<string, number>, id: string): number {
  if (amounts[id] !== undefined) return amounts[id];
  return traits.includes(id) ? 1 : 0;
}

function vec4Array(n: number) {
  return Array.from({ length: n }, () => new THREE.Vector4());
}

export function createOrganismUniforms() {
  return {
    uTime:         { value: 0 },
    uMass:         { value: 1 },
    uPulse:        { value: 0 },
    uEvolution:    { value: 0 },
    uPulseRate:    { value: 1 },
    uVeinDensity:  { value: 1 },
    uReflectivity: { value: 0.15 },
    uNoiseType:    { value: 0 },
    uVeinNoiseType:{ value: 0 },
    uMotion:       { value: 1 },
    uIdle:         { value: 0 },
    uAbsorb:       { value: 0 },
    uSync:         { value: 0 },
    uPersona:      { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.2) },
    uGenomeAxis:   { value: new THREE.Vector3(0, 1, 0) },
    uStageF:       { value: 0 },
    uColorDeep:    { value: new THREE.Color('#070a1f') },
    uColorMid:     { value: new THREE.Color('#1a2a6c') },
    uColorGlow:    { value: new THREE.Color('#7df3ff') },
    uColorVein:    { value: new THREE.Color('#b066ff') },
    uColorAccent:  { value: new THREE.Color('#ffc46b') },
    uNebulaA:      { value: NEBULA_A.clone() },
    uNebulaB:      { value: NEBULA_B.clone() },
    uEventTint:    { value: new THREE.Vector4(1, 1, 1, 0) },
    uCamLocal:     { value: new THREE.Vector3(0, 0, 5) },
    uKeyDir:       { value: new THREE.Vector3(-0.55, 0.65, 0.55).normalize() },
    // traits
    uTraitSmooth:   { value: 0 },
    uTraitSpiked:   { value: 0 },
    uTraitRidged:   { value: 0 },
    uTraitFissured: { value: 0 },
    uTraitCratered: { value: 0 },
    uTraitOblate:   { value: 0 },
    uTraitProlate:  { value: 0 },
    uTraitTwisted:  { value: 0 },
    uTraitAurorae:  { value: 0 },
    uTraitEclipsed: { value: 0 },
    uColorCast:         { value: new THREE.Color(1, 1, 1) },
    uColorCastStrength: { value: 0 },
    uFissureAxis:   { value: new THREE.Vector3(0.7, 0.2, 0.6) },
    uCraterSeed:    { value: new THREE.Vector3(1.7, 4.2, 9.1) },
    // morphology
    uLobes:      { value: vec4Array(MAX_LOBES) },
    uLobeSharp:  { value: 1.4 },
    uLobeRadius: { value: 1.0 },
    uFin:        { value: new THREE.Vector4(0, 1, 0, 0) },
    uFin2:       { value: new THREE.Vector4(1, 0, 0, 0) },
    uFinWaves:   { value: 7 },
    uNucleus:    { value: 0.3 },
    uVeinGrowth: { value: 0.2 },
    // biomes
    uBiome:      { value: 0 },
    uBiome2:     { value: 1 },
    uBiomeLevel: { value: 0 },
    uPatches:    { value: vec4Array(5) },
    uPatchOwner: { value: [0, 0, 0, 1, 1] },
    // touch
    uRipples:    { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 1, 0, -100)) },
    uRippleAmp:  { value: [0, 0, 0, 0] },
  };
}

export type OrganismUniforms = ReturnType<typeof createOrganismUniforms>;

/** The shared uniform set. Module-level singleton: one organism per page. */
export const U: OrganismUniforms = createOrganismUniforms();

/** Live, non-persistent organism state other systems may read (camera framing, growths). */
export const organismState = {
  root: null as THREE.Object3D | null,
  visScale: 1,
  /** Approximate bounding radius in world units (body + protrusions + frills), for camera framing */
  boundRadius: 1.3,
  morph: null as Morphology | null,
  biomes: null as BiomeState | null,
  /** bumps whenever morphology/biome targets are recomputed (cheap change detection) */
  version: 0,
};

const COLOR_CAST_SINGED = new THREE.Color(1.35, 0.7, 0.45);
const COLOR_CAST_FROZEN = new THREE.Color(0.55, 0.9, 1.25);

const EVENT_TINTS: Record<string, [number, number, number]> = {
  meteor: [1.25, 0.85, 0.6],
  eclipse: [0.55, 0.6, 0.9],
  resonance: [0.85, 1.0, 1.3],
  bloom: [1.1, 1.3, 1.0],
  quasar: [1.35, 1.1, 0.8],
  twinning: [1.1, 0.95, 1.3],
};

export function OrganismController() {
  const { camera } = useThree();
  const tmp = useMemo(() => ({
    v: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    cast: new THREE.Color(),
    tint: new THREE.Vector3(1, 1, 1),
    targetLobes: new Float32Array(MAX_LOBES * 4),
    targetFin: new THREE.Vector4(),
    targetFin2: new THREE.Vector4(),
  }), []);

  const live = useMemo(() => ({
    nextMorphAt: 0,
    lastMass: -1,
    lastTraitsKey: '',
    lastGenomeSeed: -1,
    lastHydration: -1,
    rippleSlot: 0,
    absorb: 0,
    lobeSharp: 1.4,
    lobeRadius: 1.0,
    nucleus: 0.3,
    veinGrowth: 0.2,
    biomeLevel: 0,
    eventTintAmt: 0,
    initialized: false,
  }), []);

  // Ripples + absorption from gameplay
  useEffect(() => {
    const offR = rippleFx.on(({ point, strength }) => {
      const root = organismState.root;
      if (!root) return;
      const local = root.worldToLocal(point.clone());
      if (local.lengthSq() < 1e-6) local.set(0, 1, 0);
      local.normalize();
      const i = live.rippleSlot;
      live.rippleSlot = (live.rippleSlot + 1) % 4;
      U.uRipples.value[i].set(local.x, local.y, local.z, U.uTime.value);
      U.uRippleAmp.value[i] = Math.min(1.5, strength);
      live.absorb = Math.min(1, live.absorb + 0.25 * strength);
    });
    const offA = arrivalFx.on(() => {
      live.absorb = Math.min(1, live.absorb + 0.035);
    });
    return () => { offR(); offA(); };
  }, [live]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1); // tab switches shouldn't teleport the animation
    const elapsed = state.clock.elapsedTime;
    useGameStore.getState().tick(delta, elapsed);
    const s = useGameStore.getState();
    const { mass, pulseIntensity, evolution, genome, stage, traits, traitAmounts, noiseTypeOverride } = s;

    U.uTime.value += delta;
    U.uMass.value = mass;
    U.uPulse.value = pulseIntensity;
    U.uEvolution.value = evolution;
    U.uMotion.value = s.reducedMotion ? 0.35 : 1;

    // ---------- deterministic targets (recomputed at most twice a second) ----------
    const traitsKey = traits.join(',') + '|' + Object.entries(traitAmounts).map(([k, v]) => k + v.toFixed(2)).join(',');
    const now = elapsed;
    const genomeChanged = genome.seed !== live.lastGenomeSeed;
    const hydrated = s.hydrationVersion !== live.lastHydration;
    if (hydrated) {
      live.lastHydration = s.hydrationVersion;
      live.initialized = false; // loaded from a save: snap to the saved form, don't regrow it
    }
    if (hydrated || genomeChanged || traitsKey !== live.lastTraitsKey || (now >= live.nextMorphAt && Math.abs(mass - live.lastMass) > 1e-3)) {
      live.nextMorphAt = now + 0.5;
      live.lastMass = mass;
      live.lastTraitsKey = traitsKey;
      live.lastGenomeSeed = genome.seed;
      const amounts: Record<string, number> = {};
      for (const t of traits) amounts[t] = amt(traits, traitAmounts, t);
      for (const [k, v] of Object.entries(traitAmounts)) amounts[k] = v;
      organismState.morph = computeMorphology(genome, mass, amounts);
      organismState.biomes = computeBiomes(genome, amounts);
      organismState.version++;
      applyStaticTargets(genome, organismState.morph, organismState.biomes);
      if (!live.initialized || genomeChanged) {
        if (organismState.root) organismState.root.scale.setScalar(visualScaleForMass(mass));
        // first frame (or new genome): snap instead of growing from nothing
        live.initialized = true;
        snapMorph(organismState.morph);
        live.lobeSharp = organismState.morph.lobeSharp;
        live.lobeRadius = organismState.morph.lobeRadius;
        live.nucleus = organismState.morph.nucleus;
        live.veinGrowth = organismState.morph.veinGrowth;
        live.biomeLevel = organismState.morph.growthDensity;
      }
    }

    // ---------- smooth morphology toward targets: milestones GROW in over seconds ----------
    const m = organismState.morph;
    if (m) {
      const k = 1 - Math.exp(-delta * 0.55);
      const lobes = U.uLobes.value;
      for (let i = 0; i < MAX_LOBES; i++) {
        const L = lobes[i];
        L.x = m.lobes[i * 4]; L.y = m.lobes[i * 4 + 1]; L.z = m.lobes[i * 4 + 2];
        L.w += (m.lobes[i * 4 + 3] - L.w) * k;
      }
      live.lobeSharp += (m.lobeSharp - live.lobeSharp) * k;
      live.lobeRadius += (m.lobeRadius - live.lobeRadius) * k;
      U.uLobeSharp.value = live.lobeSharp;
      U.uLobeRadius.value = live.lobeRadius;
      U.uFin.value.x = m.fin[0]; U.uFin.value.y = m.fin[1]; U.uFin.value.z = m.fin[2];
      U.uFin.value.w += (m.fin[3] - U.uFin.value.w) * k;
      U.uFin2.value.x = m.fin2[0]; U.uFin2.value.y = m.fin2[1]; U.uFin2.value.z = m.fin2[2];
      U.uFin2.value.w += (m.fin2[3] - U.uFin2.value.w) * k;
      live.nucleus += (m.nucleus - live.nucleus) * k;
      live.veinGrowth += (m.veinGrowth - live.veinGrowth) * k;
      live.biomeLevel += (Math.min(1, m.growthDensity * 1.2) - live.biomeLevel) * k;
      U.uNucleus.value = live.nucleus;
      U.uVeinGrowth.value = live.veinGrowth;
      U.uBiomeLevel.value = live.biomeLevel;
      U.uStageF.value += (m.stageF - U.uStageF.value) * k;
      U.uPersona.value.set(m.persona.energy, m.persona.luminosity, m.persona.complexity, m.persona.instability);
    }

    // ---------- palette ----------
    const shift = stage.paletteShift;
    U.uColorDeep.value.setHSL(((genome.hueDeep + shift) % 360) / 360, 0.6, 0.07);
    U.uColorMid.value.setHSL(((genome.hueDeep + shift + 30) % 360) / 360, 0.42, 0.19);
    U.uColorGlow.value.setHSL(((genome.hueGlow + shift) % 360) / 360, 0.85, 0.6);
    U.uColorVein.value.setHSL(((genome.hueVein + shift) % 360) / 360, 0.88, 0.58);
    U.uColorAccent.value.setHSL(((genome.hueAccent + shift * 0.5) % 360) / 360, 0.8, 0.62);

    // ---------- genome & traits ----------
    const pulsarA = amt(traits, traitAmounts, 'pulsar');
    const quietA = amt(traits, traitAmounts, 'quiet');
    U.uPulseRate.value = genome.pulseRate * (1 + pulsarA) * (1 - quietA * 0.5);
    U.uVeinDensity.value = genome.veinDensity;
    U.uReflectivity.value = 0.1 + Math.min(0.4, stage.id * 0.07);
    U.uNoiseType.value = noiseTypeOverride !== null ? noiseTypeOverride : genome.noiseType;
    U.uVeinNoiseType.value = genome.veinNoiseType;
    U.uTraitSmooth.value = amt(traits, traitAmounts, 'smooth');
    U.uTraitSpiked.value = amt(traits, traitAmounts, 'spiked');
    U.uTraitRidged.value = amt(traits, traitAmounts, 'ridged');
    U.uTraitFissured.value = amt(traits, traitAmounts, 'fissured');
    U.uTraitCratered.value = amt(traits, traitAmounts, 'cratered');
    U.uTraitOblate.value = amt(traits, traitAmounts, 'oblate');
    U.uTraitProlate.value = amt(traits, traitAmounts, 'prolate');
    U.uTraitTwisted.value = amt(traits, traitAmounts, 'twisted');
    U.uTraitAurorae.value = amt(traits, traitAmounts, 'aurorae');
    U.uTraitEclipsed.value = amt(traits, traitAmounts, 'eclipsed');
    const singedA = amt(traits, traitAmounts, 'singed');
    const frozenA = amt(traits, traitAmounts, 'frozen');
    const castStrength = Math.max(singedA, frozenA);
    if (castStrength > 0) {
      tmp.cast.copy(COLOR_CAST_SINGED).multiplyScalar(singedA);
      U.uColorCast.value.copy(COLOR_CAST_FROZEN).multiplyScalar(frozenA).add(tmp.cast).multiplyScalar(1 / (singedA + frozenA));
    }
    U.uColorCastStrength.value = castStrength;

    // ---------- behaviour signals ----------
    const nowSec = performance.now() / 1000;
    const sinceInteraction = nowSec - Math.max(s.lastTapAt, s.lastInteractionAt);
    const idleTarget = THREE.MathUtils.smoothstep(sinceInteraction, 18, 60);
    U.uIdle.value += (idleTarget - U.uIdle.value) * (1 - Math.exp(-delta * 0.3));
    live.absorb = Math.max(0, live.absorb - delta * 0.6);
    U.uAbsorb.value = live.absorb;

    // event lighting
    const tint = s.activeEvent ? EVENT_TINTS[s.activeEvent] : phenomena.tint();
    const tintTarget = tint ? 1 : 0;
    live.eventTintAmt += (tintTarget - live.eventTintAmt) * (1 - Math.exp(-delta * 0.8));
    if (tint) tmp.tint.set(tint[0], tint[1], tint[2]);
    U.uEventTint.value.set(tmp.tint.x, tmp.tint.y, tmp.tint.z, live.eventTintAmt);

    // ---------- transform & camera-in-organism-space ----------
    const root = organismState.root;
    const vis = visualScaleForMass(mass);
    organismState.visScale = vis;
    if (root) {
      const cur = root.scale.x;
      const sc = cur + (vis - cur) * Math.min(1, delta * 1.5);
      root.scale.setScalar(sc);
      root.rotation.y += delta * 0.04;
      root.rotation.x += delta * 0.012;
      root.updateMatrixWorld();
      U.uCamLocal.value.copy(root.worldToLocal(tmp.v.copy(camera.position)));
    }
    if (m) {
      let maxLobe = 0;
      for (let i = 0; i < MAX_LOBES; i++) maxLobe = Math.max(maxLobe, m.lobes[i * 4 + 3]);
      const formExt = (s.baseFormOverride ?? genome.baseForm) === 1 || amt(traits, traitAmounts, 'prolate') > 0.3 ? 1.35 : 1.15;
      organismState.boundRadius = vis * (formExt + 0.2 + maxLobe + Math.max(m.fin[3], m.fin2[3]) * 0.8);
    }
  }, -1);

  return null;
}

function snapMorph(m: Morphology) {
  const lobes = U.uLobes.value;
  for (let i = 0; i < MAX_LOBES; i++) lobes[i].set(m.lobes[i * 4], m.lobes[i * 4 + 1], m.lobes[i * 4 + 2], m.lobes[i * 4 + 3]);
  U.uFin.value.set(...m.fin);
  U.uFin2.value.set(...m.fin2);
  U.uStageF.value = m.stageF;
}

function applyStaticTargets(genome: Genome, m: Morphology, b: BiomeState) {
  U.uGenomeAxis.value.set(...m.genomeAxis);
  U.uFinWaves.value = m.finWaves;
  U.uBiome.value = b.primary.index;
  U.uBiome2.value = b.secondary.index;
  b.patches.forEach((p, i) => U.uPatches.value[i]?.set(p[0], p[1], p[2], p[3]));
  for (let i = 0; i < 5; i++) U.uPatchOwner.value[i] = b.patchOwner[i] ?? 0;
  void genome;
}
