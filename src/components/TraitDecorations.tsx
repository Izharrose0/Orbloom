import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { visualScaleForMass } from '../lib/scale';

function amt(traits: string[], amounts: Record<string, number>, id: string): number {
  if (amounts[id] !== undefined) return amounts[id];
  return traits.includes(id) ? 1 : 0;
}

const GEM_COUNT = 4;

export default function TraitDecorations() {
  const haloRingRef = useRef<THREE.Mesh>(null);
  const gemsGroupRef = useRef<THREE.Group>(null);
  const twinRef = useRef<THREE.Mesh>(null);

  const ringUniforms = useMemo(
    () => ({
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color('#a3d9ff') },
    }),
    []
  );

  const gemColors = useMemo(
    () =>
      Array.from({ length: GEM_COUNT }, () =>
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

    // Halo ring (thin equatorial) — opacity scales with amount
    if (haloRingRef.current) {
      haloRingRef.current.visible = ringA > 0.01;
      if (ringA > 0.01) {
        const s = visScale * 1.65;
        haloRingRef.current.scale.set(s, s, s);
        haloRingRef.current.rotation.z = Math.PI / 2 + Math.sin(elapsed * 0.15) * 0.05;
        haloRingRef.current.rotation.y += delta * 0.15;
        ringUniforms.uTime.value = elapsed;
        ringUniforms.uColor.value.setHSL(
          (genome.hueGlow / 360 + 0.02) % 1,
          0.7,
          0.7
        );
      }
    }

    // Gem shards orbiting — count scales with amount (1..4)
    if (gemsGroupRef.current) {
      gemsGroupRef.current.visible = gemA > 0.01;
      if (gemA > 0.01) {
        gemsGroupRef.current.rotation.y += delta * 0.35;
        gemsGroupRef.current.children.forEach((child, i) => {
          const m = child as THREE.Mesh;
          const phase = (i / GEM_COUNT) * Math.PI * 2 + elapsed * 0.4;
          const r = visScale * 2.3 + Math.sin(elapsed * 0.7 + i) * 0.12;
          m.position.set(Math.cos(phase) * r, Math.sin(elapsed * 0.5 + i) * 0.3, Math.sin(phase) * r);
          m.rotation.x += delta * 0.6;
          m.rotation.y += delta * 0.4;
          const pulse = 1 + 0.08 * Math.sin(elapsed * 3 + i);
          m.scale.setScalar(0.18 * pulse);
        });
      }
    }

    // Twinned companion — scale shrinks with amount
    if (twinRef.current) {
      twinRef.current.visible = twinA > 0.01;
      if (twinA > 0.01) {
        const phase = elapsed * 0.55;
        const r = visScale * 2.4;
        twinRef.current.position.set(Math.cos(phase) * r, Math.sin(phase * 0.7) * 0.3, Math.sin(phase) * r);
        const sz = visScale * 0.34 * twinA;
        twinRef.current.scale.set(sz, sz, sz);
        twinRef.current.rotation.y += delta * 0.5;
      }
    }
  });

  return (
    <group>
      {/* Halo ring */}
      <mesh ref={haloRingRef} visible={false} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.018, 16, 128]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={ringUniforms}
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
              float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
              gl_FragColor = vec4(uColor * (0.7 + 0.5 * f), 0.85 * f + 0.4);
            }
          `}
        />
      </mesh>

      {/* Gem shards */}
      <group ref={gemsGroupRef} visible={false}>
        {Array.from({ length: GEM_COUNT }).map((_, i) => (
          <mesh key={i}>
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
