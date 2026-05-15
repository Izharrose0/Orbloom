import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchNeighbors, NeighborPlanet } from '../lib/persistence';
import { deriveGenome } from '../lib/genome';
import { stageForMass } from '../lib/stages';

type Star = NeighborPlanet & { pos: THREE.Vector3; color: THREE.Color; size: number };

export default function Constellation() {
  const [stars, setStars] = useState<Star[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    let mounted = true;
    fetchNeighbors(60).then((rows) => {
      if (!mounted) return;
      const out: Star[] = rows.map((r, i) => {
        const g = deriveGenome(r.id);
        const stage = stageForMass(r.mass ?? 1);
        const phi = Math.acos(2 * ((i * 0.6180339) % 1) - 1);
        const theta = (i * 2.39996) % (Math.PI * 2);
        const radius = 18 + Math.random() * 6;
        return {
          ...r,
          pos: new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi) * 0.5 + (Math.random() - 0.5) * 4,
            radius * Math.sin(phi) * Math.sin(theta)
          ),
          color: new THREE.Color().setHSL(((g.hueGlow + stage.paletteShift) % 360) / 360, 0.85, 0.65),
          size: 0.18 + Math.min(0.5, Math.log2(1 + (r.mass ?? 1)) * 0.06),
        };
      });
      setStars(out);
    });
    return () => { mounted = false; };
  }, []);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(stars.length * 3);
    const colors = new Float32Array(stars.length * 3);
    const sizes = new Float32Array(stars.length);
    stars.forEach((s, i) => {
      positions[i * 3] = s.pos.x;
      positions[i * 3 + 1] = s.pos.y;
      positions[i * 3 + 2] = s.pos.z;
      colors[i * 3] = s.color.r;
      colors[i * 3 + 1] = s.color.g;
      colors[i * 3 + 2] = s.color.b;
      sizes[i] = s.size;
    });
    return { positions, colors, sizes };
  }, [stars]);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.005;
  });

  if (stars.length === 0) return null;

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexColors
          vertexShader={/* glsl */ `
            attribute float aSize;
            varying vec3 vColor;
            void main() {
              vColor = color;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = aSize * (260.0 / -mv.z);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec3 vColor;
            void main() {
              vec2 c = gl_PointCoord - 0.5;
              float a = smoothstep(0.5, 0.0, length(c));
              a = pow(a, 1.4);
              gl_FragColor = vec4(vColor, a * 0.95);
            }
          `}
        />
      </points>
    </group>
  );
}
