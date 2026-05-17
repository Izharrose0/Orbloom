import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { simplexNoise3D } from '../shaders/noise';
import { NEBULA_A, NEBULA_B } from '../lib/skyPalette';

// Huge inside-out sphere. Procedural galaxy band + nebulae + tiny pinpoint stars.
// Renders FIRST (renderOrder=-1) so depth fades correctly behind everything.

const SKY_RADIUS = 90;

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  // Direction from origin in WORLD space — independent from camera so it feels infinite
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = normalize(wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const skyFragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3  uNebulaA;
uniform vec3  uNebulaB;
uniform vec3  uDeep;

varying vec3 vDir;

${simplexNoise3D}

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

// Multi-octave star field at several densities for layered depth
float starLayer(vec3 d, float density, float threshold, float twinkleSpeed, float sharp) {
  vec3 cell = floor(d * density);
  float h = hash13(cell);
  float s = step(threshold, h);
  // soft glow + twinkle
  float tw = 0.5 + 0.5 * sin(uTime * twinkleSpeed + h * 50.0);
  return s * pow(tw, sharp);
}

void main() {
  vec3 d = normalize(vDir);

  // Slow nebula clouds via fbm
  float n1 = fbm(d * 1.8 + vec3(uTime * 0.008, 0.0, 0.0));
  float n2 = fbm(d * 4.2 - vec3(0.0, uTime * 0.005, 0.0));
  float cloud = smoothstep(-0.05, 0.65, n1);
  float wisp  = smoothstep(0.35, 0.95, n2);

  // Galactic plane band: gaussian on y (tilted via the sphere rotation)
  float bandY = abs(d.y);
  float band = exp(-pow(bandY * 2.4, 2.0));
  float dust = fbm(d * 6.0 + vec3(uTime * 0.01, 0.0, 0.0)) * 0.5 + 0.5;

  vec3 col = uDeep;
  col = mix(col, uNebulaA * 0.55, cloud * 0.85);
  col = mix(col, uNebulaB * 0.7, wisp * 0.7);
  // Brighten band with mild dust modulation
  col += uNebulaA * 0.5 * band * (0.6 + 0.4 * dust);
  col += uNebulaB * 0.25 * band * (0.4 + 0.6 * dust);

  // Multi-layer stars
  float s1 = starLayer(d, 90.0,  0.985, 0.7, 2.2);   // sparse bright
  float s2 = starLayer(d, 240.0, 0.993, 1.3, 1.6);   // medium
  float s3 = starLayer(d, 480.0, 0.997, 2.4, 1.0);   // tiny pinpoints
  col += vec3(0.95, 0.95, 1.0) * s1 * 1.3;
  col += vec3(0.85, 0.92, 1.0) * s2 * 0.85;
  col += vec3(1.0,  0.88, 0.75) * s3 * 0.55;

  // Slight darkening at poles
  col *= mix(0.7, 1.0, exp(-pow(bandY * 1.1, 2.0)));

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function Sky() {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime:    { value: 0 },
      uNebulaA: { value: NEBULA_A.clone() },
      uNebulaB: { value: NEBULA_B.clone() },
      uDeep:    { value: new THREE.Color('#02030a') },
    }),
    []
  );

  useFrame((_, delta) => {
    uniforms.uTime.value += delta;
    // EXTREMELY slow drift → senso d'infinito (no rotazione percepibile su breve termine)
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.0025;
  });

  return (
    <mesh
      ref={meshRef}
      // Tilt to break the band's symmetry
      rotation={[0.32, 0.0, 0.18]}
      renderOrder={-10}
      frustumCulled={false}
    >
      <sphereGeometry args={[SKY_RADIUS, 64, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        uniforms={uniforms}
        vertexShader={skyVertex}
        fragmentShader={skyFragment}
      />
    </mesh>
  );
}
