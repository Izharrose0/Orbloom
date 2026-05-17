import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { visualScaleForMass } from '../lib/scale';
import { ringTier, gemTier, twinTier } from '../lib/tiers';

const MAX_GEMS = 12;
const MAX_RINGS = 3;

function amt(traits: string[], amounts: Record<string, number>, id: string): number {
  if (amounts[id] !== undefined) return amounts[id];
  return traits.includes(id) ? 1 : 0;
}

export default function TraitDecorations() {
  const ringsRef  = useRef<(THREE.Mesh | null)[]>([]);
  const gemsGroupRef = useRef<THREE.Group>(null);
  const twinRef = useRef<THREE.Mesh>(null);

  // 3 ring meshes with independent world-space rotation axes
  const ringAxes = useMemo(
    () =>
      Array.from({ length: MAX_RINGS }, (_, i) => {
        const tilt = (i * 47 + 20) * Math.PI / 180;
        const yaw  = (i * 113) * Math.PI / 180;
        return new THREE.Euler(tilt, yaw, 0);
      }),
    []
  );

  const gemColors = useMemo(
    () =>
      Array.from({ length: MAX_GEMS }, () =>
        new THREE.Color().setHSL(0.55 + Math.random() * 0.3, 0.85, 0.7)
      ),
    []
  );

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const { traits, traitAmounts, mass, genome } = useGameStore.getState();
    const visScale = visualScaleForMass(mass);

    const ringA = amt(traits, traitAmounts, 'haloRing');
    const gemA  = amt(traits, traitAmounts, 'gemmed');
    const twinA = amt(traits, traitAmounts, 'twinned');

    // ------ Multi-tier rings (1 = single thin, 2 = thicker, 3 = triple ring orbital) ------
    const rTier = ringTier(mass);
    const ringsToShow = ringA > 0.01 ? Math.min(MAX_RINGS, rTier) : 0;

    for (let i = 0; i < MAX_RINGS; i++) {
      const m = ringsRef.current[i];
      if (!m) continue;
      m.visible = i < ringsToShow;
      if (!m.visible) continue;

      const baseR = visScale * (1.65 + i * 0.55);
      m.scale.set(baseR, baseR, baseR);

      // Each ring has its own static tilt + slow independent rotation in world space
      const ax = ringAxes[i];
      m.rotation.x = ax.x + Math.sin(elapsed * 0.12 + i) * 0.04;
      m.rotation.y += delta * (0.12 + i * 0.05);
      m.rotation.z = ax.z;

      const mat = m.material as THREE.ShaderMaterial;
      if (mat?.uniforms?.uColor) {
        const hue = ((genome.hueGlow + i * 18) % 360) / 360;
        mat.uniforms.uColor.value.setHSL(hue, 0.75, 0.7);
        mat.uniforms.uTime.value = elapsed;
      }
    }

    // ------ Gems: count scales with tier (4 / 8 / 12) ------
    if (gemsGroupRef.current) {
      const tier = gemA > 0.01 ? gemTier(mass) : 0;
      const count = tier === 1 ? 4 : tier === 2 ? 8 : tier === 3 ? 12 : 0;
      gemsGroupRef.current.visible = count > 0;
      if (count > 0) {
        gemsGroupRef.current.rotation.y += delta * 0.35;
        gemsGroupRef.current.children.forEach((child, i) => {
          const m = child as THREE.Mesh;
          if (i >= count) {
            m.visible = false;
            return;
          }
          m.visible = true;
          const phase = (i / count) * Math.PI * 2 + elapsed * 0.35;
          const elev = Math.sin(elapsed * 0.6 + i * 1.7) * 0.4;
          const r = visScale * (2.3 + (i % 3) * 0.4) + Math.sin(elapsed * 0.7 + i) * 0.1;
          m.position.set(Math.cos(phase) * r, elev, Math.sin(phase) * r);
          m.rotation.x += delta * 0.6;
          m.rotation.y += delta * 0.4;
          const pulse = 1 + 0.1 * Math.sin(elapsed * 3 + i);
          m.scale.setScalar(0.18 * pulse * (0.8 + (tier - 1) * 0.15));
        });
      }
    }

    // ------ Twin: tier 1 = small ghost, tier 2 = same-ish sibling, tier 3 = big binary ------
    if (twinRef.current) {
      const tier = twinA > 0.01 ? twinTier(mass) : 0;
      twinRef.current.visible = tier > 0;
      if (tier > 0) {
        const phase = elapsed * (0.55 - tier * 0.08);
        const r = visScale * (2.4 + tier * 0.4);
        twinRef.current.position.set(Math.cos(phase) * r, Math.sin(phase * 0.7) * 0.4 * tier, Math.sin(phase) * r);
        const sizeMul = tier === 1 ? 0.25 : tier === 2 ? 0.45 : 0.7;
        const sz = visScale * sizeMul * twinA;
        twinRef.current.scale.set(sz, sz, sz);
        twinRef.current.rotation.y += delta * 0.5;
      }
    }
  });

  return (
    <group>
      {/* Multi-tier rings — independent world-space orientations */}
      {Array.from({ length: MAX_RINGS }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { ringsRef.current[i] = el; }}
          visible={false}
        >
          <torusGeometry args={[1, 0.015 + i * 0.006, 16, 128]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={{
              uTime: { value: 0 },
              uColor: { value: new THREE.Color('#a3d9ff') },
            }}
            vertexShader={/* glsl */ `
              varying vec3 vN;
              varying vec3 vV;
              void main() {
                vN = normalize(mat3(modelMatrix) * normal);
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vV = normalize(cameraPosition - wp.xyz);
                gl_Position = projectionMatrix * viewMatrix * wp;
              }
            `}
            fragmentShader={/* glsl */ `
              uniform float uTime; uniform vec3 uColor;
              varying vec3 vN; varying vec3 vV;
              void main() {
                float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 1.8);
                float a = 0.85 * f + 0.3;
                gl_FragColor = vec4(uColor * (0.7 + 0.5 * f), a);
              }
            `}
          />
        </mesh>
      ))}

      {/* Gem shards — up to MAX_GEMS, count driven by tier */}
      <group ref={gemsGroupRef} visible={false}>
        {Array.from({ length: MAX_GEMS }).map((_, i) => (
          <mesh key={i} visible={false}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color={gemColors[i]}
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Twinned companion */}
      <mesh ref={twinRef} visible={false}>
        <icosahedronGeometry args={[1, 3]} />
        <meshBasicMaterial color="#cfe9ff" transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}
