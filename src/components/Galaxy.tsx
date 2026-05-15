import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const GALAXY_PARTICLES = 7000;
const ARMS = 4;
const RADIUS = 28;
const SPIN = 1.6;
const RANDOMNESS = 0.42;
const RANDOMNESS_POW = 2.6;

const COLOR_CORE = new THREE.Color('#ffd9a8');
const COLOR_ARM = new THREE.Color('#7a8cff');
const COLOR_OUTER = new THREE.Color('#3a1a6e');

export default function Galaxy() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(GALAXY_PARTICLES * 3);
    const colors = new Float32Array(GALAXY_PARTICLES * 3);
    const sizes = new Float32Array(GALAXY_PARTICLES);

    const tmp = new THREE.Color();

    for (let i = 0; i < GALAXY_PARTICLES; i++) {
      const i3 = i * 3;

      const radius = Math.pow(Math.random(), 1.5) * RADIUS;
      const arm = (i % ARMS) / ARMS;
      const branchAngle = arm * Math.PI * 2;
      const spinAngle = radius * SPIN * 0.1;

      const rx = Math.pow(Math.random(), RANDOMNESS_POW) * (Math.random() < 0.5 ? 1 : -1) * RANDOMNESS * radius;
      const ry = Math.pow(Math.random(), RANDOMNESS_POW) * (Math.random() < 0.5 ? 1 : -1) * RANDOMNESS * radius * 0.18;
      const rz = Math.pow(Math.random(), RANDOMNESS_POW) * (Math.random() < 0.5 ? 1 : -1) * RANDOMNESS * radius;

      positions[i3]     = Math.cos(branchAngle + spinAngle) * radius + rx;
      positions[i3 + 1] = ry;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + rz;

      const tCore = Math.max(0, 1 - radius / RADIUS);
      tmp.copy(COLOR_OUTER).lerp(COLOR_ARM, tCore);
      tmp.lerp(COLOR_CORE, Math.pow(tCore, 3));
      colors[i3]     = tmp.r;
      colors[i3 + 1] = tmp.g;
      colors[i3 + 2] = tmp.b;

      sizes[i] = 0.06 + Math.random() * 0.12 + tCore * 0.18;
    }

    return { positions, colors, sizes };
  }, []);

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.012;
      pointsRef.current.rotation.z = Math.sin(performance.now() * 0.00005) * 0.05;
    }
  });

  return (
    <group rotation={[Math.PI * 0.18, 0, Math.PI * 0.08]} position={[0, -2.5, -8]}>
      <points ref={pointsRef} frustumCulled={false}>
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
              float d = length(c);
              float a = smoothstep(0.5, 0.0, d);
              a = pow(a, 1.4);
              gl_FragColor = vec4(vColor, a * 0.85);
            }
          `}
        />
      </points>
    </group>
  );
}
