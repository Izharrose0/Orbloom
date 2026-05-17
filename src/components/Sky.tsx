import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simplexNoise3D } from '../shaders/noise';
import { NEBULA_A, NEBULA_B } from '../lib/skyPalette';

const SKY_RADIUS = 90;
const STAR_COUNT = 3500;
const STAR_RADIUS = 86; // just inside the sky sphere

// --- Nebula shader (dark, subtle, mostly black) ---
const nebulaVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = normalize(wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const nebulaFragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3  uNebulaA;
uniform vec3  uNebulaB;
uniform vec3  uDeep;
varying vec3 vDir;

${simplexNoise3D}

void main() {
  vec3 d = normalize(vDir);

  // Start near-black
  vec3 col = uDeep;

  // VERY sparse clouds — only the highest noise peaks bleed through
  float n1 = fbm(d * 1.6 + vec3(uTime * 0.004, 0.0, 0.0));
  float cloud = smoothstep(0.65, 1.0, n1);
  col = mix(col, uNebulaA * 0.22, cloud * 0.35);

  // Even rarer wisps in second color
  float n2 = fbm(d * 3.4 - vec3(0.0, uTime * 0.003, 0.0));
  float wisp = smoothstep(0.78, 1.0, n2);
  col = mix(col, uNebulaB * 0.22, wisp * 0.28);

  // Very faint galactic band along the equator
  float band = exp(-pow(d.y * 4.0, 2.0));
  col += uNebulaA * 0.05 * band;
  col += uNebulaB * 0.03 * band;

  gl_FragColor = vec4(col, 1.0);
}
`;

function buildStars() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);

  for (let i = 0; i < STAR_COUNT; i++) {
    const r = STAR_RADIUS + (Math.random() - 0.5) * 2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    // Heavy-tailed brightness: mostly faint, few bright
    const u = Math.random();
    const bright = Math.pow(u, 5); // skew low
    sizes[i] = 0.4 + bright * 3.6;

    // Slight color variety: cool white, warm white, occasional bluish/golden
    const tint = Math.random();
    if (tint < 0.7) {
      colors[i * 3]     = 0.92 + Math.random() * 0.08;
      colors[i * 3 + 1] = 0.94 + Math.random() * 0.06;
      colors[i * 3 + 2] = 1.0;
    } else if (tint < 0.9) {
      colors[i * 3]     = 1.0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.7;
    } else {
      colors[i * 3]     = 0.7;
      colors[i * 3 + 1] = 0.82;
      colors[i * 3 + 2] = 1.0;
    }
  }
  return { positions, colors, sizes };
}

export default function Sky() {
  const nebRef = useRef<THREE.Mesh>(null);
  const starsRef = useRef<THREE.Points>(null);

  const nebUniforms = useMemo(
    () => ({
      uTime:    { value: 0 },
      uNebulaA: { value: NEBULA_A.clone() },
      uNebulaB: { value: NEBULA_B.clone() },
      uDeep:    { value: new THREE.Color('#000002') },
    }),
    []
  );

  const starsData = useMemo(buildStars, []);

  useFrame((_, delta) => {
    nebUniforms.uTime.value += delta;
    if (nebRef.current) nebRef.current.rotation.y += delta * 0.002;
    if (starsRef.current) starsRef.current.rotation.y += delta * 0.0008;
  });

  return (
    <group>
      <mesh
        ref={nebRef}
        rotation={[0.32, 0, 0.18]}
        renderOrder={-10}
        frustumCulled={false}
      >
        <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          uniforms={nebUniforms}
          vertexShader={nebulaVertex}
          fragmentShader={nebulaFragment}
        />
      </mesh>

      <points ref={starsRef} renderOrder={-9} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starsData.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[starsData.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[starsData.sizes, 1]} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          vertexColors
          vertexShader={/* glsl */ `
            attribute float aSize;
            varying vec3 vColor;
            void main() {
              vColor = color;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = aSize * (380.0 / -mv.z);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec3 vColor;
            void main() {
              vec2 c = gl_PointCoord - 0.5;
              float d = length(c);
              float a = smoothstep(0.5, 0.0, d);
              a = pow(a, 2.2);
              gl_FragColor = vec4(vColor, a);
            }
          `}
        />
      </points>
    </group>
  );
}
