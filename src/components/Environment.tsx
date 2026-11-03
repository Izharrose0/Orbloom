import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mulberry32 } from '../lib/rng';
import { organismState, U } from '../systems/organism';
import { useGameStore } from '../store/useGameStore';

/**
 * Near-field cosmic dust. Two soft layers around the organism:
 *  - motes: close, slowly circulating, catch the organism's glow colour
 *  - haze: wider, dimmer, gives atmospheric depth and parallax when orbiting
 * Distances scale with the organism so the composition holds as it grows.
 */
const dustVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uScale;
uniform float uPixelRatio;
uniform float uMotion;
varying float vAlpha;
varying float vPhase;
void main() {
  vec3 p = position * uScale;
  // slow curl-ish drift
  float t = uTime * 0.05 * uMotion;
  p += vec3(sin(t + aPhase * 3.1), cos(t * 0.8 + aPhase * 2.3), sin(t * 0.6 + aPhase * 1.7)) * 0.35 * uScale;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  gl_PointSize = aSize * uPixelRatio * (220.0 / dist);
  // fade motes that come too close to the lens or sit too far
  vAlpha = smoothstep(0.6, 2.5, dist) * (1.0 - smoothstep(30.0, 80.0, dist));
  vPhase = aPhase;
  gl_Position = projectionMatrix * mv;
}
`;
const dustFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying float vAlpha;
varying float vPhase;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = pow(smoothstep(0.5, 0.0, length(c)), 1.8);
  float tw = 0.65 + 0.35 * sin(uTime * 0.7 + vPhase * 11.0);
  gl_FragColor = vec4(uColor, a * vAlpha * uOpacity * tw);
}
`;

function DustLayer({ count, rMin, rMax, size, opacity, seed, spin, colorMix }: {
  count: number; rMin: number; rMax: number; size: number; opacity: number; seed: number; spin: number; colorMix: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const { positions, sizes, phases } = useMemo(() => {
    const rand = mulberry32(seed);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.pow(rand(), 0.7) * (rMax - rMin);
      const z = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(1 - z * z);
      positions[i * 3] = rr * Math.cos(a) * r;
      positions[i * 3 + 1] = z * r * 0.75;
      positions[i * 3 + 2] = rr * Math.sin(a) * r;
      sizes[i] = size * (0.4 + rand() * rand() * 1.6);
      phases[i] = rand() * 10;
    }
    return { positions, sizes, phases };
  }, [count, rMin, rMax, size, seed]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uScale: { value: 1 },
    uPixelRatio: { value: 1 },
    uMotion: { value: 1 },
    uColor: { value: new THREE.Color('#7aa6ff') },
    uOpacity: { value: opacity },
  }), [opacity]);
  const base = useMemo(() => new THREE.Color('#7aa6ff'), []);

  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uMotion.value = useGameStore.getState().reducedMotion ? 0.3 : 1;
    // dust keeps a comfortable distance from a growing organism
    const target = Math.max(1, organismState.boundRadius / 1.4);
    uniforms.uScale.value += (target - uniforms.uScale.value) * Math.min(1, delta * 0.5);
    uniforms.uColor.value.copy(base).lerp(U.uColorGlow.value, colorMix);
    if (ref.current) {
      ref.current.rotation.y -= delta * spin;
      ref.current.rotation.x += delta * spin * 0.3;
    }
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={dustVertex}
        fragmentShader={dustFragment}
      />
    </points>
  );
}

export default function Environment() {
  const quality = useGameStore((s) => s.quality);
  const k = quality === 0 ? 0.5 : quality === 1 ? 0.8 : 1;
  return (
    <group>
      <DustLayer count={Math.round(260 * k)} rMin={2.2} rMax={6.5} size={0.09} opacity={0.55} seed={11} spin={0.03} colorMix={0.45} />
      <DustLayer count={Math.round(520 * k)} rMin={7} rMax={22} size={0.16} opacity={0.32} seed={23} spin={0.012} colorMix={0.15} />
    </group>
  );
}
