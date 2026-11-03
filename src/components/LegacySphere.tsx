import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { orbVertexShader, orbFragmentShader } from '../shaders/legacyOrbShader';
import { useGameStore } from '../store/useGameStore';
import { U } from '../systems/organism';

/**
 * Pre-2.0 organism, kept only for side-by-side comparison (`?legacy=1`).
 * Uses the same genome and the same shared uniforms, so the two looks can be
 * compared on an identical organism.
 */
export default function LegacySphere() {
  const baseForm = useGameStore((s) => (s.baseFormOverride !== null ? s.baseFormOverride : s.genome.baseForm));
  const geometries = useMemo(() => [
    new THREE.IcosahedronGeometry(1, 64),
    new THREE.CapsuleGeometry(0.85, 0.9, 12, 48),
    new THREE.TorusGeometry(0.9, 0.42, 28, 96),
    new THREE.OctahedronGeometry(1.05, 5),
    new RoundedBoxGeometry(1.5, 1.5, 1.5, 8, 0.32),
    new THREE.TorusKnotGeometry(0.7, 0.3, 128, 24, 3, 4),
  ], []);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  return (
    <mesh geometry={geometries[baseForm] ?? geometries[0]}>
      <shaderMaterial uniforms={U} vertexShader={orbVertexShader} fragmentShader={orbFragmentShader} />
    </mesh>
  );
}
