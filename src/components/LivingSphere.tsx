import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { orbVertexShader, orbFragmentShader } from '../shaders/orbShader';
import { useGameStore } from '../store/useGameStore';
import { visualScaleForMass } from '../lib/scale';
import { NEBULA_A, NEBULA_B } from '../lib/skyPalette';
function amt(traits: string[], amounts: Record<string, number>, id: string): number {
  if (amounts[id] !== undefined) return amounts[id];
  return traits.includes(id) ? 1 : 0;
}

function makeGeometries() {
  return [
    new THREE.IcosahedronGeometry(1, 64),                       // 0 Sphere
    new THREE.CapsuleGeometry(0.85, 0.9, 12, 48),               // 1 Capsule
    new THREE.TorusGeometry(0.9, 0.42, 28, 96),                 // 2 Torus
    new THREE.OctahedronGeometry(1.05, 5),                      // 3 Crystal
    new RoundedBoxGeometry(1.5, 1.5, 1.5, 8, 0.32),             // 4 Cube (beveled corners)
    new THREE.TorusKnotGeometry(0.7, 0.3, 128, 24, 3, 4),       // 5 Knot
  ];
}

const COLOR_CAST_SINGED = new THREE.Color(1.35, 0.7, 0.45);
const COLOR_CAST_FROZEN = new THREE.Color(0.55, 0.9, 1.25);

export default function LivingSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const geometries = useMemo(makeGeometries, []);
  const baseForm = useGameStore((s) => {
    return s.baseFormOverride !== null ? s.baseFormOverride : s.genome.baseForm;
  });

  const uniforms = useMemo(
    () => ({
      uTime:         { value: 0 },
      uMass:         { value: 1 },
      uPulse:        { value: 0 },
      uEvolution:    { value: 0 },
      uPulseRate:    { value: 1 },
      uVeinDensity:  { value: 1 },
      uReflectivity: { value: 0.15 },
      uNoiseType:    { value: 0 },
      uColorDeep:    { value: new THREE.Color('#070a1f') },
      uColorMid:     { value: new THREE.Color('#1a2a6c') },
      uColorGlow:    { value: new THREE.Color('#7df3ff') },
      uColorVein:    { value: new THREE.Color('#b066ff') },
      uNebulaA:      { value: NEBULA_A.clone() },
      uNebulaB:      { value: NEBULA_B.clone() },
      // Trait uniforms
      uTraitSmooth:        { value: 0 },
      uTraitSpiked:        { value: 0 },
      uTraitRidged:        { value: 0 },
      uTraitFissured:      { value: 0 },
      uTraitCratered:      { value: 0 },
      uTraitOblate:        { value: 0 },
      uTraitProlate:       { value: 0 },
      uTraitTwisted:       { value: 0 },
      uTraitAurorae:       { value: 0 },
      uTraitEclipsed:      { value: 0 },
      uColorCast:          { value: new THREE.Color(1, 1, 1) },
      uColorCastStrength:  { value: 0 },
      uFissureAxis:        { value: new THREE.Vector3(0.7, 0.2, 0.6) },
      uCraterSeed:         { value: new THREE.Vector3(1.7, 4.2, 9.1) },
    }),
    []
  );

  const tmpDeep = useMemo(() => new THREE.Color(), []);
  const tmpMid  = useMemo(() => new THREE.Color(), []);
  const tmpGlow = useMemo(() => new THREE.Color(), []);
  const tmpVein = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    useGameStore.getState().tick(delta, elapsed);

    const s = useGameStore.getState();
    const { mass, pulseIntensity, evolution, genome, stage, traits, traitAmounts, noiseTypeOverride } = s;

    const shift = stage.paletteShift;
    tmpDeep.setHSL(((genome.hueDeep + shift) % 360) / 360, 0.7, 0.10);
    tmpMid .setHSL(((genome.hueDeep + shift + 30) % 360) / 360, 0.65, 0.28);
    tmpGlow.setHSL(((genome.hueGlow + shift) % 360) / 360, 0.85, 0.62);
    tmpVein.setHSL(((genome.hueVein + shift) % 360) / 360, 0.9, 0.6);

    // Pulse rate trait modifiers (continuous)
    const pulsarA = amt(traits, traitAmounts, 'pulsar');
    const quietA  = amt(traits, traitAmounts, 'quiet');
    const pulseRateMul = (1 + pulsarA * 1.0) * (1 - quietA * 0.5);

    if (matRef.current) {
      uniforms.uTime.value += delta;
      uniforms.uMass.value = mass;
      uniforms.uPulse.value = pulseIntensity;
      uniforms.uEvolution.value = evolution;
      uniforms.uPulseRate.value = genome.pulseRate * pulseRateMul;
      uniforms.uVeinDensity.value = genome.veinDensity;
      uniforms.uReflectivity.value = 0.10 + Math.min(0.45, stage.id * 0.09);
      uniforms.uNoiseType.value = noiseTypeOverride !== null ? noiseTypeOverride : genome.noiseType;
      uniforms.uColorDeep.value.copy(tmpDeep);
      uniforms.uColorMid.value.copy(tmpMid);
      uniforms.uColorGlow.value.copy(tmpGlow);
      uniforms.uColorVein.value.copy(tmpVein);

      // Wire traits as CONTINUOUS amounts (composites can use any in-between value)
      uniforms.uTraitSmooth.value   = amt(traits, traitAmounts, 'smooth');
      uniforms.uTraitSpiked.value   = amt(traits, traitAmounts, 'spiked');
      uniforms.uTraitRidged.value   = amt(traits, traitAmounts, 'ridged');
      uniforms.uTraitFissured.value = amt(traits, traitAmounts, 'fissured');
      uniforms.uTraitCratered.value = amt(traits, traitAmounts, 'cratered');
      uniforms.uTraitOblate.value   = amt(traits, traitAmounts, 'oblate');
      uniforms.uTraitProlate.value  = amt(traits, traitAmounts, 'prolate');
      uniforms.uTraitTwisted.value  = amt(traits, traitAmounts, 'twisted');
      uniforms.uTraitAurorae.value  = amt(traits, traitAmounts, 'aurorae');
      uniforms.uTraitEclipsed.value = amt(traits, traitAmounts, 'eclipsed');

      // Color cast can BLEND between singed and frozen
      const singedA = amt(traits, traitAmounts, 'singed');
      const frozenA = amt(traits, traitAmounts, 'frozen');
      const colorStrength = Math.max(singedA, frozenA);
      if (colorStrength > 0) {
        uniforms.uColorCast.value.copy(COLOR_CAST_SINGED).multiplyScalar(singedA).add(
          new THREE.Color().copy(COLOR_CAST_FROZEN).multiplyScalar(frozenA)
        );
        // Normalize if both present
        if (singedA + frozenA > 0) {
          uniforms.uColorCast.value.multiplyScalar(1 / (singedA + frozenA));
        }
        uniforms.uColorCastStrength.value = colorStrength;
      } else {
        uniforms.uColorCastStrength.value = 0;
      }
    }

    const visScale = visualScaleForMass(mass);

    if (meshRef.current) {
      meshRef.current.scale.lerp(
        new THREE.Vector3(visScale, visScale, visScale),
        Math.min(1, delta * 1.5)
      );
      meshRef.current.rotation.y += delta * 0.04;
      meshRef.current.rotation.x += delta * 0.012;
    }

  });

  return (
    <mesh ref={meshRef} geometry={geometries[baseForm] ?? geometries[0]}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={orbVertexShader}
        fragmentShader={orbFragmentShader}
      />
    </mesh>
  );
}
