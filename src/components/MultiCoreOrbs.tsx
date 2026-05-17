import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { orbVertexShader, orbFragmentShader } from '../shaders/orbShader';
import { useGameStore } from '../store/useGameStore';
import { visualScaleForMass } from '../lib/scale';
import { NEBULA_A, NEBULA_B } from '../lib/skyPalette';

function amt(traits: string[], amounts: Record<string, number>, id: string): number {
  if (amounts[id] !== undefined) return amounts[id];
  return traits.includes(id) ? 1 : 0;
}

type CoreSpec = {
  offset: THREE.Vector3;
  size: number;
};

const BINARY_OFFSETS: CoreSpec[] = [
  { offset: new THREE.Vector3(0.95, -0.05, 0.0), size: 0.62 },
];

const TRINARY_OFFSETS: CoreSpec[] = [
  { offset: new THREE.Vector3(-0.78,  0.30, 0.45), size: 0.55 },
  { offset: new THREE.Vector3( 0.85, -0.25,-0.30), size: 0.50 },
];

function SecondaryCore({ spec, formIdx, geometries }: { spec: CoreSpec; formIdx: number; geometries: THREE.BufferGeometry[] }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);

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

  useFrame((_, delta) => {
    const s = useGameStore.getState();
    const { mass, pulseIntensity, evolution, genome, stage, traitAmounts, traits, noiseTypeOverride } = s;

    if (matRef.current) {
      uniforms.uTime.value += delta;
      uniforms.uMass.value = mass;
      uniforms.uPulse.value = pulseIntensity;
      uniforms.uEvolution.value = evolution;
      uniforms.uPulseRate.value = genome.pulseRate;
      uniforms.uVeinDensity.value = genome.veinDensity;
      uniforms.uReflectivity.value = 0.10 + Math.min(0.45, stage.id * 0.09);
      uniforms.uNoiseType.value = noiseTypeOverride !== null ? noiseTypeOverride : genome.noiseType;

      const shift = stage.paletteShift;
      uniforms.uColorDeep.value.setHSL(((genome.hueDeep + shift) % 360) / 360, 0.7, 0.10);
      uniforms.uColorMid .value.setHSL(((genome.hueDeep + shift + 30) % 360) / 360, 0.65, 0.28);
      uniforms.uColorGlow.value.setHSL(((genome.hueGlow + shift) % 360) / 360, 0.85, 0.62);
      uniforms.uColorVein.value.setHSL(((genome.hueVein + shift) % 360) / 360, 0.9, 0.6);

      // Mirror trait amounts (so secondary cores share the same look)
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
    }

    if (meshRef.current) {
      const visScale = visualScaleForMass(mass) * spec.size;
      meshRef.current.scale.setScalar(visScale);
      // Position offset is in WORLD space, scaled by parent visScale so cores stay "fused"
      const parentScale = visualScaleForMass(mass);
      meshRef.current.position.copy(spec.offset).multiplyScalar(parentScale);
      meshRef.current.rotation.y += delta * 0.05;
      meshRef.current.rotation.x += delta * 0.015;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometries[formIdx] ?? geometries[0]}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={orbVertexShader}
        fragmentShader={orbFragmentShader}
      />
    </mesh>
  );
}

const SHARED_GEOMETRIES_PROMISE = (() => {
  // Defer until first use to avoid duplicating with LivingSphere geometries
  return null;
})();

export default function MultiCoreOrbs() {
  const traits = useGameStore((s) => s.traits);
  const traitAmounts = useGameStore((s) => s.traitAmounts);
  const baseForm = useGameStore((s) => (s.baseFormOverride !== null ? s.baseFormOverride : s.genome.baseForm));

  const binaryActive = amt(traits, traitAmounts, 'binary') > 0.01;
  const trinaryActive = amt(traits, traitAmounts, 'trinary') > 0.01;

  // Re-create geometries for secondary cores (lightweight; sphere by default for fusion clarity)
  const geometries = useMemo(
    () => [
      new THREE.IcosahedronGeometry(1, 48),
      new THREE.CapsuleGeometry(0.85, 0.9, 12, 36),
      new THREE.TorusGeometry(0.9, 0.42, 24, 64),
      new THREE.OctahedronGeometry(1.05, 4),
      new THREE.BoxGeometry(1.5, 1.5, 1.5, 20, 20, 20),
      new THREE.TorusKnotGeometry(0.7, 0.3, 96, 18, 3, 4),
    ],
    []
  );

  if (!binaryActive && !trinaryActive) return null;

  return (
    <group>
      {binaryActive && BINARY_OFFSETS.map((spec, i) => (
        <SecondaryCore key={`b${i}`} spec={spec} formIdx={baseForm} geometries={geometries} />
      ))}
      {trinaryActive && TRINARY_OFFSETS.map((spec, i) => (
        <SecondaryCore key={`t${i}`} spec={spec} formIdx={baseForm} geometries={geometries} />
      ))}
    </group>
  );
}
