import { simplexNoise3D } from './noise';

export const orbVertexShader = /* glsl */ `
uniform float uTime;
uniform float uMass;
uniform float uPulse;
uniform float uEvolution;
uniform float uPulseRate;
uniform float uVeinDensity;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying float vDisplacement;
varying vec3 vLocalPos;

${simplexNoise3D}

void main() {
  vec3 pos = position;
  vec3 n = normalize(position);

  float t = uTime * 0.18 * uPulseRate;

  float breath = sin(uTime * 0.6 * uPulseRate) * 0.04 + cos(uTime * 0.27 * uPulseRate) * 0.02;

  float noise1 = fbm(n * 1.4 + vec3(0.0, t, 0.0));
  float noise2 = fbm(n * 3.2 - vec3(t * 0.7, 0.0, t * 0.4));
  float detail = fbm(n * (6.0 + uEvolution * 1.2) + vec3(t * 1.3));

  float displacement =
      noise1 * 0.18
    + noise2 * 0.09
    + detail * (0.04 + uEvolution * 0.012)
    + breath
    + uPulse * 0.07 * sin(uTime * 4.0 + noise1 * 5.0);

  vDisplacement = displacement;

  pos += n * displacement;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;

  // WORLD-space normal (was view-space — caused fresnel to look "position-based")
  vNormal = normalize(mat3(modelMatrix) * n);
  // WORLD-space view direction → coherent with normal above
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  vLocalPos = pos;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const orbFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uPulse;
uniform float uEvolution;
uniform float uPulseRate;
uniform float uVeinDensity;
uniform float uReflectivity;
uniform vec3  uColorDeep;
uniform vec3  uColorMid;
uniform vec3  uColorGlow;
uniform vec3  uColorVein;
uniform vec3  uNebulaA;
uniform vec3  uNebulaB;

varying vec3  vNormal;
varying vec3  vWorldPos;
varying vec3  vViewDir;
varying float vDisplacement;
varying vec3  vLocalPos;

${simplexNoise3D}

// Cheap hash for star sparkle on reflection
float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

// Procedural nebula sampled on a unit direction (used for fake env reflection)
vec3 sampleNebula(vec3 dir) {
  vec3 d = normalize(dir);

  // Two noise layers in different scales → cloudy bands
  float n1 = fbm(d * 2.2 + vec3(uTime * 0.02, 0.0, 0.0));
  float n2 = fbm(d * 5.5 - vec3(0.0, uTime * 0.015, 0.0));
  float cloud = smoothstep(-0.1, 0.7, n1);
  float wisp  = smoothstep(0.45, 0.95, n2);

  // Galactic band (gaussian on latitude)
  float band = exp(-pow(d.y * 2.2, 2.0)) * 0.85;

  vec3 col = mix(vec3(0.015, 0.02, 0.05), uNebulaA, cloud);
  col = mix(col, uNebulaB, wisp);
  col += band * uNebulaA * 0.35;

  // Tiny pinpoint stars
  vec3 cell = floor(d * 220.0);
  float st = step(0.9965, hash13(cell));
  col += vec3(st) * 1.4;

  return col;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);

  // Fresnel rim (now coherent: both world space)
  float NdotV = max(dot(N, V), 0.0);
  float fres = pow(1.0 - NdotV, 2.6);

  // Veins
  vec3 q = vLocalPos * (1.4 + uVeinDensity * 0.6) + vec3(0.0, uTime * 0.08 * uPulseRate, 0.0);
  float veinNoise = fbm(q);
  float veinPattern = smoothstep(0.18, 0.0, abs(veinNoise - 0.05));
  veinPattern *= 0.6 + 0.4 * sin(uTime * 1.4 * uPulseRate + veinNoise * 6.0);

  // Flowing energy
  float flow = fbm(vLocalPos * 2.4 + vec3(uTime * 0.12, -uTime * 0.09, uTime * 0.05));
  flow = flow * 0.5 + 0.5;

  // Base
  float ridge = smoothstep(-0.05, 0.18, vDisplacement);
  vec3 base = mix(uColorDeep, uColorMid, ridge);

  // Energy mix
  vec3 energy = mix(uColorMid, uColorGlow, flow);
  base = mix(base, energy, 0.35 + 0.25 * sin(uTime * 0.4));

  // Veins glow
  base += uColorVein * veinPattern * (0.6 + uPulse * 1.2);

  // Pulse breath emission
  float pulseGlow = uPulse * (0.4 + 0.6 * sin(uTime * 6.0));
  base += uColorGlow * pulseGlow * 0.35;

  // Fresnel rim
  vec3 rim = uColorGlow * fres * (1.1 + uPulse * 0.6);
  vec3 color = base + rim;

  // Fake environment reflection of the surrounding nebula (glassy feel)
  vec3 R = reflect(-V, N);
  vec3 nebula = sampleNebula(R);
  // surface "smoothness" — flow modulates micro-roughness; reflectivity grows with stage
  float smoothness = mix(0.4, 1.0, flow);
  // Schlick-ish reflectance: stronger at grazing angles
  float reflStrength = uReflectivity * smoothness * (0.18 + 0.82 * fres);
  color = mix(color, color + nebula, reflStrength);

  // Subtle inner emissive lift with evolution — saturating
  float evoLift = 1.0 - exp(-uEvolution * 0.18);
  color += uColorVein * 0.18 * evoLift;

  // Tonemap-ish soft clamp
  color = color / (1.0 + color * 0.35);

  gl_FragColor = vec4(color, 1.0);
}
`;
