import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simplexNoise3D } from '../shaders/noise';
import { NEBULA_A, NEBULA_B } from '../lib/skyPalette';
import { useGameStore } from '../store/useGameStore';
import { QUALITY_PRESETS } from '../lib/quality';
import { mulberry32 } from '../lib/rng';
import { U } from '../systems/organism';

// Every player shares the same universe: the sky is seeded with a constant.
const UNIVERSE_SEED = 0x0b100;
const NEBULA_RADIUS = 500;

const nebulaVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const nebulaFragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3  uNebulaA;
uniform vec3  uNebulaB;
uniform vec3  uDeep;
uniform vec4  uEventTint;
uniform vec4  uGalaxies[3];   // dir.xyz, size
varying vec3 vDir;

${simplexNoise3D}

float fbm4(vec3 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * snoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float t = uTime;
  vec3 col = uDeep;

  // domain-warped clouds, drifting very slowly
  vec3 w = vec3(fbm4(d * 1.3 + vec3(t * 0.0015)), fbm4(d * 1.3 + vec3(5.2, 1.3, 9.1)), 0.0);
  float n0 = fbm4(d * 1.1 + w * 0.9 + vec3(t * 0.002, 0.0, 0.0));
  float cloud = smoothstep(0.05, 0.9, n0);
  col = mix(col, uNebulaA * 0.16, cloud * 0.8);

  float n1 = fbm4(d * 2.3 - w * 0.6 + vec3(0.0, t * 0.003, 0.0));
  float wisp = smoothstep(0.35, 0.95, n1);
  col = mix(col, uNebulaB * 0.24, wisp * 0.55 * cloud);

  // dark dust lanes cut through the glow
  float lane = smoothstep(0.1, -0.35, fbm4(d * 3.1 + w));
  col *= mix(1.0, 0.45, lane * 0.7);

  // galactic band, warped
  float band = exp(-pow((d.y + 0.12 * w.x) * 3.2, 2.0));
  col += (uNebulaA * 0.06 + uNebulaB * 0.04) * band * (0.6 + 0.4 * cloud);

  // distant galaxies — tiny elliptical smudges
  for (int i = 0; i < 3; i++) {
    vec4 G = uGalaxies[i];
    float a = acos(clamp(dot(d, G.xyz), -1.0, 1.0));
    vec3 tA = normalize(cross(G.xyz, vec3(0.0, 1.0, 0.0)));
    vec3 tB = cross(G.xyz, tA);
    vec2 uv = vec2(dot(d, tA), dot(d, tB) * 2.6) / G.w;
    float r = length(uv);
    float core = exp(-r * r * 9.0);
    float arms = exp(-r * 2.2) * (0.5 + 0.5 * sin(atan(uv.y, uv.x) * 2.0 - r * 9.0));
    col += mix(vec3(1.0, 0.92, 0.85), uNebulaB, 0.3) * (core * 0.55 + arms * 0.12) * step(a, 0.3);
  }

  // cosmic events tint the whole sky softly
  col = mix(col, col * uEventTint.rgb * 1.3, uEventTint.a * 0.6);
  gl_FragColor = vec4(col, 1.0);
}
`;

type StarLayer = { positions: Float32Array; colors: Float32Array; sizes: Float32Array; phases: Float32Array };

function buildStarLayer(count: number, radius: number, seed: number, sizeMul: number): StarLayer {
  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // cluster some stars toward the galactic band for structure
    const banded = rand() < 0.45;
    const z = banded ? (rand() - 0.5) * 0.35 : rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(1 - z * z);
    const r = radius * (0.92 + rand() * 0.16);
    positions[i * 3] = rr * Math.cos(a) * r;
    positions[i * 3 + 1] = z * r;
    positions[i * 3 + 2] = rr * Math.sin(a) * r;
    const bright = Math.pow(rand(), 6);
    sizes[i] = (0.5 + bright * 3.4) * sizeMul;
    phases[i] = rand() * Math.PI * 2;
    const tint = rand();
    const c = tint < 0.68 ? [0.92, 0.95, 1.0] : tint < 0.88 ? [1.0, 0.86, 0.72] : [0.72, 0.82, 1.0];
    colors.set(c, i * 3);
  }
  return { positions, colors, sizes, phases };
}

const starVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTw;
void main() {
  vColor = color;
  vTw = 0.75 + 0.25 * sin(uTime * (0.6 + fract(aPhase) * 1.8) + aPhase * 7.0);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio; // stars are effectively at infinity: constant pixel size
  gl_Position = projectionMatrix * mv;
}
`;
const starFragment = /* glsl */ `
varying vec3 vColor;
varying float vTw;
uniform float uDim;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = pow(smoothstep(0.5, 0.0, d), 2.2);
  gl_FragColor = vec4(vColor * vTw * uDim, a);
}
`;

function StarShell({ layer, spin, dim }: { layer: StarLayer; spin: number; dim: number }) {
  const ref = useRef<THREE.Points>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uPixelRatio: { value: 1 }, uDim: { value: dim } }), [dim]);
  useFrame((state, delta) => {
    uniforms.uTime.value += delta;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    // eclipse dims the stars a touch
    uniforms.uDim.value = dim * (1 - U.uEventTint.value.w * (useGameStore.getState().activeEvent === 'eclipse' ? 0.35 : 0));
    if (ref.current) ref.current.rotation.y += delta * spin;
  });
  return (
    <points ref={ref} renderOrder={-9} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[layer.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[layer.colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[layer.sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[layer.phases, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        uniforms={uniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
      />
    </points>
  );
}

export default function Sky() {
  const nebRef = useRef<THREE.Mesh>(null);
  const quality = useGameStore((s) => s.quality);
  const layersCount = QUALITY_PRESETS[quality].starLayers;

  const nebUniforms = useMemo(() => {
    const rand = mulberry32(UNIVERSE_SEED);
    const galaxies = Array.from({ length: 3 }, () => {
      const z = rand() * 1.6 - 0.8;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      return new THREE.Vector4(r * Math.cos(a), z, r * Math.sin(a), 0.035 + rand() * 0.03);
    });
    return {
      uTime: { value: 0 },
      uNebulaA: { value: NEBULA_A.clone() },
      uNebulaB: { value: NEBULA_B.clone() },
      uDeep: { value: new THREE.Color('#03040f') },
      uEventTint: U.uEventTint,
      uGalaxies: { value: galaxies },
    };
  }, []);

  // Three shells at different depths → real parallax as the camera orbits.
  const layers = useMemo(() => [
    buildStarLayer(2600, 420, UNIVERSE_SEED + 1, 1.0),
    buildStarLayer(1100, 190, UNIVERSE_SEED + 2, 1.15),
    buildStarLayer(260, 70, UNIVERSE_SEED + 3, 1.4),
  ], []);

  useFrame((state, delta) => {
    nebUniforms.uTime.value += delta;
    if (nebRef.current) {
      nebRef.current.position.copy(state.camera.position); // nebula at infinity
      nebRef.current.rotation.y += delta * 0.0015;
    }
  });

  return (
    <group>
      <mesh ref={nebRef} rotation={[0.32, 0, 0.18]} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[NEBULA_RADIUS, 64, 32]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          uniforms={nebUniforms}
          vertexShader={nebulaVertex}
          fragmentShader={nebulaFragment}
        />
      </mesh>
      <StarShell layer={layers[0]} spin={0.0006} dim={0.9} />
      {layersCount >= 2 && <StarShell layer={layers[1]} spin={0.001} dim={0.8} />}
      {layersCount >= 3 && <StarShell layer={layers[2]} spin={0.0016} dim={0.55} />}
    </group>
  );
}
