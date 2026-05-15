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

  // Slow breathing — modulated by genome pulse rate
  float breath = sin(uTime * 0.6 * uPulseRate) * 0.04 + cos(uTime * 0.27 * uPulseRate) * 0.02;

  // Layered organic noise for surface
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
  vNormal = normalize(normalMatrix * n);
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
uniform vec3  uColorDeep;
uniform vec3  uColorMid;
uniform vec3  uColorGlow;
uniform vec3  uColorVein;

varying vec3  vNormal;
varying vec3  vWorldPos;
varying vec3  vViewDir;
varying float vDisplacement;
varying vec3  vLocalPos;

${simplexNoise3D}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);

  // Fresnel rim
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);

  // Energy veins via fbm gradient — density driven by genome
  vec3 q = vLocalPos * (1.4 + uVeinDensity * 0.6) + vec3(0.0, uTime * 0.08 * uPulseRate, 0.0);
  float veinNoise = fbm(q);
  float veinPattern = smoothstep(0.18, 0.0, abs(veinNoise - 0.05));
  veinPattern *= 0.6 + 0.4 * sin(uTime * 1.4 * uPulseRate + veinNoise * 6.0);

  // Slow flowing surface energy
  float flow = fbm(vLocalPos * 2.4 + vec3(uTime * 0.12, -uTime * 0.09, uTime * 0.05));
  flow = flow * 0.5 + 0.5;

  // Base mix between deep / mid based on displacement (valleys vs ridges)
  float ridge = smoothstep(-0.05, 0.18, vDisplacement);
  vec3 base = mix(uColorDeep, uColorMid, ridge);

  // Add flowing energy color
  vec3 energy = mix(uColorMid, uColorGlow, flow);
  base = mix(base, energy, 0.35 + 0.25 * sin(uTime * 0.4));

  // Veins glow
  base += uColorVein * veinPattern * (0.6 + uPulse * 1.2);

  // Pulse breath emission
  float pulseGlow = uPulse * (0.4 + 0.6 * sin(uTime * 6.0));
  base += uColorGlow * pulseGlow * 0.35;

  // Fresnel rim glow
  vec3 rim = uColorGlow * fres * (1.1 + uPulse * 0.8 + uEvolution * 0.05);
  vec3 color = base + rim;

  // Subtle inner emissive lift with evolution
  color += uColorVein * 0.04 * uEvolution;

  // Tonemap-ish soft clamp
  color = color / (1.0 + color * 0.35);

  gl_FragColor = vec4(color, 1.0);
}
`;
