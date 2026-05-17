import { simplexNoise3D } from './noise';

export const orbVertexShader = /* glsl */ `
uniform float uTime;
uniform float uMass;
uniform float uPulse;
uniform float uEvolution;
uniform float uPulseRate;
uniform float uVeinDensity;
uniform float uNoiseType; // 0..5 — selects noise family for surface displacement

// Trait uniforms (0 = inactive, 1 = full intensity)
uniform float uTraitSmooth;     // surface: smooth (scales down base noise)
uniform float uTraitSpiked;     // surface: spikes outward
uniform float uTraitRidged;     // surface: equatorial ridges
uniform float uTraitFissured;   // surface: deep fissures along great circles
uniform float uTraitCratered;   // surface: inward dimples
uniform float uTraitOblate;     // form: squash on Y
uniform float uTraitProlate;    // form: stretch on Y
uniform float uTraitTwisted;    // form: axial twist
uniform vec3  uFissureAxis;     // direction of fissures
uniform vec3  uCraterSeed;      // offset for craters

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying float vDisplacement;
varying vec3 vLocalPos;

${simplexNoise3D}

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c);
}

void main() {
  vec3 pos = position;
  // GEOMETRY-AGNOSTIC: use actual normal for displacement direction,
  // sample noise on position so any geometry gets coherent surface
  vec3 n = normalize(normal);
  vec3 sp = position;

  // -------- BASE ORGANIC NOISE (scaled by smoothness trait) --------
  float t = uTime * 0.18 * uPulseRate;
  float breath = sin(uTime * 0.6 * uPulseRate) * 0.04 + cos(uTime * 0.27 * uPulseRate) * 0.02;

  float noise1 = surfaceNoise(sp * 1.4 + vec3(0.0, t, 0.0), uNoiseType);
  float noise2 = surfaceNoise(sp * 3.2 - vec3(t * 0.7, 0.0, t * 0.4), uNoiseType);
  float detail = surfaceNoise(sp * (6.0 + uEvolution * 1.2) + vec3(t * 1.3), uNoiseType);

  float baseDisp =
      noise1 * 0.18
    + noise2 * 0.09
    + detail * (0.04 + uEvolution * 0.012)
    + breath
    + uPulse * 0.07 * sin(uTime * 4.0 + noise1 * 5.0);

  // Smooth trait dampens base displacement
  baseDisp *= mix(1.0, 0.15, uTraitSmooth);

  // -------- SPIKES (Voronoi-ish peaks via noise threshold) --------
  // High-frequency noise; only its peaks become spikes pointing outward
  float spikeNoise = snoise(sp * 7.0 + vec3(uMass * 0.001));
  float spikeMask = smoothstep(0.45, 0.85, spikeNoise);
  float spike = spikeMask * uTraitSpiked * 0.55;

  // -------- RIDGES (sinusoidal latitude bands) --------
  // Use absolute latitude → concentric bands around Y axis
  float lat = n.y;
  float ridges = sin(lat * 18.0) * 0.5 + 0.5;
  ridges = pow(ridges, 2.0);
  float ridgeDisp = ridges * uTraitRidged * 0.18;

  // -------- FISSURES (deep cuts along plane defined by axis) --------
  float fissureDist = abs(dot(n, normalize(uFissureAxis)));
  float fissure = exp(-pow(fissureDist * 18.0, 2.0));
  fissureDist = abs(dot(n, normalize(uFissureAxis.zxy)));
  fissure = max(fissure, exp(-pow(fissureDist * 18.0, 2.0)) * 0.7);
  float fissureDisp = -fissure * uTraitFissured * 0.32;

  // -------- CRATERS (sparse inward dimples) --------
  float craterField = snoise(sp * 4.5 + uCraterSeed);
  float craterMask = smoothstep(0.55, 0.85, craterField);
  float craterDisp = -craterMask * uTraitCratered * 0.18;

  // Sum displacement contributions
  float displacement = baseDisp + spike + ridgeDisp + fissureDisp + craterDisp;
  vDisplacement = displacement;
  pos += n * displacement;

  // -------- FORM mutations (after displacement, before world transform) --------
  // Oblate: squash on Y
  pos.y *= mix(1.0, 0.62, uTraitOblate);
  // Prolate: stretch on Y
  pos.y *= mix(1.0, 1.42, uTraitProlate);
  // Twisted: rotate around Y by angle proportional to pos.y
  float twistAngle = uTraitTwisted * 1.4 * pos.y;
  pos = rotY(twistAngle) * pos;

  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
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

// Color traits
uniform vec3  uColorCast;          // tint applied (already pre-mixed)
uniform float uColorCastStrength;  // 0-1 blend
uniform float uTraitAurorae;       // banded color drift
uniform float uTraitEclipsed;      // global darkening

varying vec3  vNormal;
varying vec3  vWorldPos;
varying vec3  vViewDir;
varying float vDisplacement;
varying vec3  vLocalPos;

${simplexNoise3D}

float hash13(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

vec3 sampleNebula(vec3 dir) {
  vec3 d = normalize(dir);
  float n1 = fbm(d * 2.2 + vec3(uTime * 0.02, 0.0, 0.0));
  float n2 = fbm(d * 5.5 - vec3(0.0, uTime * 0.015, 0.0));
  float cloud = smoothstep(-0.1, 0.7, n1);
  float wisp  = smoothstep(0.45, 0.95, n2);
  float band = exp(-pow(d.y * 2.2, 2.0)) * 0.85;
  vec3 col = mix(vec3(0.015, 0.02, 0.05), uNebulaA, cloud);
  col = mix(col, uNebulaB, wisp);
  col += band * uNebulaA * 0.35;
  vec3 cell = floor(d * 220.0);
  float st = step(0.9965, hash13(cell));
  col += vec3(st) * 1.4;
  return col;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);
  float NdotV = max(dot(N, V), 0.0);
  float fres = pow(1.0 - NdotV, 2.6);

  // Veins
  vec3 q = vLocalPos * (1.4 + uVeinDensity * 0.6) + vec3(0.0, uTime * 0.08 * uPulseRate, 0.0);
  float veinNoise = fbm(q);
  float veinPattern = smoothstep(0.18, 0.0, abs(veinNoise - 0.05));
  veinPattern *= 0.6 + 0.4 * sin(uTime * 1.4 * uPulseRate + veinNoise * 6.0);

  // Flow
  float flow = fbm(vLocalPos * 2.4 + vec3(uTime * 0.12, -uTime * 0.09, uTime * 0.05));
  flow = flow * 0.5 + 0.5;

  // Base
  float ridge = smoothstep(-0.05, 0.18, vDisplacement);
  vec3 base = mix(uColorDeep, uColorMid, ridge);
  vec3 energy = mix(uColorMid, uColorGlow, flow);
  base = mix(base, energy, 0.35 + 0.25 * sin(uTime * 0.4));
  base += uColorVein * veinPattern * (0.6 + uPulse * 1.2);
  float pulseGlow = uPulse * (0.4 + 0.6 * sin(uTime * 6.0));
  base += uColorGlow * pulseGlow * 0.35;

  // Aurorae trait: shifting bands of green & magenta along latitude
  if (uTraitAurorae > 0.0) {
    float lat = vLocalPos.y;
    float bandPhase = sin(lat * 6.0 + uTime * 0.6) * 0.5 + 0.5;
    vec3 auroraA = vec3(0.2, 1.0, 0.5);
    vec3 auroraB = vec3(0.9, 0.3, 1.0);
    vec3 aur = mix(auroraA, auroraB, bandPhase);
    base = mix(base, base + aur * 0.5, uTraitAurorae * 0.45);
  }

  // Fresnel rim — boosted so the silhouette READS as glow, not as a dark hole
  float rimBoost = 1.4 + uPulse * 0.7 + uEvolution * 0.04;
  vec3 rim = uColorGlow * fres * rimBoost;
  // Extra outer halo: even more concentrated at the very edge
  float outerRim = pow(fres, 4.5) * 1.8;
  rim += uColorVein * outerRim;
  vec3 color = base + rim;

  // Fake env reflection
  vec3 R = reflect(-V, N);
  vec3 nebula = sampleNebula(R);
  float smoothness = mix(0.4, 1.0, flow);
  float reflStrength = uReflectivity * smoothness * (0.18 + 0.82 * fres);
  color = mix(color, color + nebula, reflStrength);

  // Evolution emissive lift
  float evoLift = 1.0 - exp(-uEvolution * 0.18);
  color += uColorVein * 0.18 * evoLift;

  // Color cast (singed/frozen)
  color = mix(color, color * uColorCast, uColorCastStrength * 0.8);

  // Eclipsed: global dimming
  color *= mix(1.0, 0.5, uTraitEclipsed);

  // Tonemap-ish soft clamp
  color = color / (1.0 + color * 0.35);

  gl_FragColor = vec4(color, 1.0);
}
`;
