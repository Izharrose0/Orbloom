import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { organismVertexShader, organismFragmentShader } from '../shaders/organismShader';
import { legacyCoreMaterialProps } from './legacyCore';
import { useGameStore } from '../store/useGameStore';
import { visualScaleForMass } from '../lib/scale';
import { QUALITY_PRESETS } from '../lib/quality';
import { makeBodyGeometries } from '../lib/bodyGeometry';
import { U } from '../systems/organism';

function amt(traits: string[], amounts: Record<string, number>, id: string): number {
  if (amounts[id] !== undefined) return amounts[id];
  return traits.includes(id) ? 1 : 0;
}

type CoreSpec = { offset: THREE.Vector3; size: number; phase: number };

const BINARY_OFFSETS: CoreSpec[] = [
  { offset: new THREE.Vector3(0.95, -0.05, 0.0), size: 0.62, phase: 0.0 },
];
const TRINARY_OFFSETS: CoreSpec[] = [
  { offset: new THREE.Vector3(-0.78, 0.30, 0.45), size: 0.55, phase: 1.7 },
  { offset: new THREE.Vector3(0.85, -0.25, -0.30), size: 0.50, phase: 3.1 },
];

/** Fused secondary cores (binary / trinary traits). They share the body material,
 *  so they breathe, ripple and colour-shift with the main organism. */
function SecondaryCore({ spec, geometry, quality, legacy }: { spec: CoreSpec; geometry: THREE.BufferGeometry; quality: number; legacy: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, delta) => {
    const m = meshRef.current;
    if (!m) return;
    const { mass } = useGameStore.getState();
    const parent = visualScaleForMass(mass);
    // slow independent drift so the cores read as separate bodies negotiating one membrane
    const t = state.clock.elapsedTime;
    const wobble = 0.04 * Math.sin(t * 0.37 + spec.phase);
    m.scale.setScalar(parent * spec.size * (1 + 0.03 * Math.sin(t * 0.5 + spec.phase)));
    m.position.copy(tmp.copy(spec.offset).multiplyScalar(parent * (1 + wobble)));
    m.rotation.y += delta * 0.05;
    m.rotation.x += delta * 0.015;
  });

  return (
    <mesh ref={meshRef} geometry={geometry}>
      {legacy ? (
        <shaderMaterial {...legacyCoreMaterialProps} />
      ) : (
        <shaderMaterial
          key={`core-q${quality}`}
          uniforms={U}
          defines={{ QUALITY: Math.min(1, quality) }}
          vertexShader={organismVertexShader}
          fragmentShader={organismFragmentShader}
        />
      )}
    </mesh>
  );
}

export default function MultiCoreOrbs() {
  const traits = useGameStore((s) => s.traits);
  const traitAmounts = useGameStore((s) => s.traitAmounts);
  const quality = useGameStore((s) => s.quality);
  const legacy = useGameStore((s) => s.legacyLook);
  const baseForm = useGameStore((s) => (s.baseFormOverride !== null ? s.baseFormOverride : s.genome.baseForm));
  const preset = QUALITY_PRESETS[quality];

  const binaryActive = amt(traits, traitAmounts, 'binary') > 0.01;
  const trinaryActive = amt(traits, traitAmounts, 'trinary') > 0.01;
  const active = binaryActive || trinaryActive;

  const geometries = useMemo(
    () => (active ? makeBodyGeometries(Math.round(preset.sphereDetail * 0.6)) : null),
    [active, preset.sphereDetail]
  );
  useEffect(() => () => geometries?.forEach((g) => g.dispose()), [geometries]);

  if (!active || !geometries) return null;
  const geometry = geometries[baseForm] ?? geometries[0];

  return (
    <group>
      {binaryActive && BINARY_OFFSETS.map((spec, i) => (
        <SecondaryCore key={`b${i}`} spec={spec} geometry={geometry} quality={preset.shaderQuality} legacy={legacy} />
      ))}
      {trinaryActive && TRINARY_OFFSETS.map((spec, i) => (
        <SecondaryCore key={`t${i}`} spec={spec} geometry={geometry} quality={preset.shaderQuality} legacy={legacy} />
      ))}
    </group>
  );
}
