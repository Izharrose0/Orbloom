import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { organismVertexShader, organismFragmentShader } from '../shaders/organismShader';
import { useGameStore } from '../store/useGameStore';
import { QUALITY_PRESETS } from '../lib/quality';
import { makeBodyGeometries } from '../lib/bodyGeometry';
import { U, organismState } from '../systems/organism';
import GrowthStructures from './GrowthStructures';
import LegacySphere from './LegacySphere';

/**
 * The organism. A root group carries scale + slow rotation; the body and every
 * rooted structure (growths, cilia) are children so they move as one creature.
 */
export default function LivingSphere() {
  const rootRef = useRef<THREE.Group>(null);
  const quality = useGameStore((s) => s.quality);
  const legacy = useGameStore((s) => s.legacyLook);
  const baseForm = useGameStore((s) => (s.baseFormOverride !== null ? s.baseFormOverride : s.genome.baseForm));
  const preset = QUALITY_PRESETS[quality];

  const geometries = useMemo(() => makeBodyGeometries(preset.sphereDetail), [preset.sphereDetail]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);

  useEffect(() => {
    organismState.root = rootRef.current;
    return () => { organismState.root = null; };
  }, []);

  const geometry = geometries[baseForm] ?? geometries[0];

  return (
    <group ref={rootRef}>
      {legacy ? (
        <LegacySphere />
      ) : (
        <>
          <mesh geometry={geometry}>
            <shaderMaterial
              key={`body-q${preset.shaderQuality}`}
              uniforms={U}
              defines={preset.shaderQuality === 0 ? { QUALITY: 0, ORG_COARSE: 1 } : { QUALITY: preset.shaderQuality }}
              vertexShader={organismVertexShader}
              fragmentShader={organismFragmentShader}
            />
          </mesh>
          <GrowthStructures geometry={geometry} />
        </>
      )}
    </group>
  );
}
