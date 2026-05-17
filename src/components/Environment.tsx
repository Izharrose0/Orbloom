import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DUST_COUNT = 350;

export default function Environment() {
  const dustRef = useRef<THREE.Points>(null);

  const dustPositions = useMemo(() => {
    const arr = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      const r = 2.4 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((state, delta) => {
    if (dustRef.current) {
      dustRef.current.rotation.y -= delta * 0.04;
      dustRef.current.rotation.x += delta * 0.015;
      const t = state.clock.elapsedTime;
      const mat = dustRef.current.material as THREE.PointsMaterial;
      mat.opacity = 0.45 + Math.sin(t * 0.4) * 0.1;
    }
  });

  return (
    <group>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#7aa6ff"
          size={0.07}
          sizeAttenuation
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <ambientLight intensity={0.25} color="#5566aa" />
      <pointLight position={[5, 4, 5]} intensity={0.6} color="#7df3ff" distance={20} />
      <pointLight position={[-5, -3, -4]} intensity={0.4} color="#b066ff" distance={18} />
    </group>
  );
}
