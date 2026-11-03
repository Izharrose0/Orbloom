// ORBLOOM 2.0 — living organism material.
//
// One displacement field (`orgField`) is shared by the body, the secondary cores
// and every growth structure, so anything rooted on the skin rides the same
// breathing, contractions, ripples and protrusions.
//
// QUALITY define: 0 = core interior only, coarse detail noise
//                 1 = interior parallax (nuclei, deep streams), capillaries
//                 2 = + membrane cell structure

import { simplexNoise3D } from './noise';

export const organismVertexUniforms = /* glsl */ `
uniform float uTime;
uniform float uPulse;
uniform float uEvolution;
uniform float uMass;
uniform float uPulseRate;
uniform float uNoiseType;
uniform float uMotion;      // 1 normal, ~0.35 reduced-motion
uniform float uIdle;        // 0..1 meditation depth (time since last interaction)
uniform float uAbsorb;      // 0..1 recent energy absorption
uniform vec4  uPersona;     // energy, luminosity, complexity, instability
uniform vec3  uGenomeAxis;

uniform float uTraitSmooth;
uniform float uTraitSpiked;
uniform float uTraitRidged;
uniform float uTraitFissured;
uniform float uTraitCratered;
uniform float uTraitOblate;
uniform float uTraitProlate;
uniform float uTraitTwisted;
uniform vec3  uFissureAxis;
uniform vec3  uCraterSeed;

uniform vec4  uLobes[8];    // dir.xyz, length
uniform float uLobeSharp;   // profile exponent: <1 rounded bud, >1 pointed horn
uniform float uLobeRadius;  // angular radius (radians)
uniform vec4  uFin;         // axis.xyz, amount
uniform vec4  uFin2;
uniform float uFinWaves;
uniform vec4  uRipples[4];  // dir.xyz (organism space), start time
uniform float uRippleAmp[4];
`;

export const organismFieldChunk = /* glsl */ `
mat3 orgRotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s,  0.0, 1.0, 0.0,  s, 0.0, c);
}

float finField(vec3 n, vec4 F, float phase) {
  if (F.w <= 0.0005) return 0.0;
  vec3 fa = normalize(F.xyz);
  vec3 tA = normalize(cross(fa, abs(fa.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 tB = cross(fa, tA);
  float ang = atan(dot(n, tB), dot(n, tA));
  float h = dot(n, fa) + 0.06 * sin(ang * 3.0 + uTime * 0.45 + phase) * uMotion;   // undulating edge
  float scallop = 0.72 + 0.28 * sin(ang * uFinWaves + uTime * 0.3 * uMotion + phase);
  return exp(-pow(h * 9.0, 2.0)) * scallop * F.w;
}

// Returns scalar displacement along n. m1 = (lobe, fin, rippleGlow, spike), m2 = (fissure, crater, contraction, base)
float orgField(vec3 sp, vec3 n, out vec4 m1, out vec4 m2) {
  float t = uTime * 0.18 * uPulseRate;

  // ---- identity noise (genome family) ----
  float n1 = surfaceNoise(sp * 1.4 + vec3(0.0, t, 0.0), uNoiseType);
  float n2 = surfaceNoise(sp * 3.2 - vec3(t * 0.7, 0.0, t * 0.4), uNoiseType);
#ifdef ORG_COARSE
  float det = snoise(sp * 5.0 + vec3(t * 1.3));
  float base = n1 * 0.15 + n2 * 0.05 + det * 0.015;
#else
  float det = snoise(sp * (6.0 + min(uEvolution, 8.0) * 0.6) + vec3(t * 1.3));
  float base = n1 * 0.15 + n2 * 0.055 + det * (0.014 + min(uEvolution, 8.0) * 0.0025);
#endif
  base *= mix(1.0, 0.15, uTraitSmooth);

  // ---- biological animation: layered, out of phase ----
  float rate = uPulseRate * (0.85 + uPersona.x * 0.5);
  // global breathing: two incommensurate rhythms, deeper when meditating
  float breath = (sin(uTime * 0.55 * uPulseRate) * 0.030 + sin(uTime * 0.213 * uPulseRate + 1.3) * 0.016) * (1.0 + uIdle * 0.7);
  // local membrane contractions — regions pulse with their own phase
  float region = snoise(n * 1.25 + uGenomeAxis * 3.0 + vec3(0.0, uTime * 0.031, uTime * 0.023));
  float contraction = sin(uTime * 0.95 * rate + region * 5.5) * 0.024 * smoothstep(-0.3, 0.6, region);
  // peristaltic wave travelling along the genome axis
  float ax = dot(n, uGenomeAxis);
  float wave = pow(0.5 + 0.5 * sin(ax * 4.5 - uTime * 0.75 * rate), 6.0) * 0.032;
  // tap jiggle
  float jiggle = uPulse * 0.045 * sin(uTime * 4.0 + n1 * 5.0);
  float anim = (breath + contraction + wave + jiggle) * uMotion;

  // ---- protrusions (lobes → horns → crown) ----
  float lobe = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 L = uLobes[i];
    if (L.w <= 0.0005) continue;
    float fi = float(i);
    // each protrusion sways on its own slow orbit (delayed, independent motion)
    vec3 sway = vec3(sin(uTime * 0.29 + fi * 1.3), cos(uTime * 0.23 + fi * 2.1), sin(uTime * 0.31 + fi * 0.7));
    vec3 d = normalize(L.xyz + 0.075 * uMotion * sway);
    float th = acos(clamp(dot(n, d), -1.0, 1.0));
    float x = clamp(th / uLobeRadius, 0.0, 1.0);
    float shape = pow(1.0 - x * x, uLobeSharp);
    float grow = 1.0 + 0.09 * uMotion * sin(uTime * 0.6 * uPulseRate + fi * 1.9);
    lobe += L.w * shape * grow;
  }

  // ---- membrane frills ----
  float fin = finField(n, uFin, 0.0) + finField(n, uFin2, 2.1);

  // ---- tap ripples: dent, then a ring travels across the skin ----
  float rip = 0.0;
  float ripGlow = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 R = uRipples[i];
    float age = uTime - R.w;
    if (age < 0.0 || age > 3.5) continue;
    float d = acos(clamp(dot(n, R.xyz), -1.0, 1.0));
    float front = age * 1.35;
    float ring = exp(-pow((d - front) * 5.0, 2.0)) * exp(-age * 1.25);
    float dent = exp(-d * d * 18.0) * exp(-age * 5.0);
    float a = uRippleAmp[i];
    rip += (ring * 0.065 - dent * 0.09) * a;
    ripGlow += ring * a + dent * a * 0.6;
  }

  // ---- trait mutations (kept from 1.x, now shaded as anatomy in the fragment) ----
  float spikeNoise = snoise(sp * 7.0 + vec3(uMass * 0.001));
  float spikeMask = smoothstep(0.45, 0.85, spikeNoise);
  float spike = spikeMask * uTraitSpiked * 0.55;

  float ridges = pow(sin(n.y * 18.0) * 0.5 + 0.5, 2.0);
  float ridgeDisp = ridges * uTraitRidged * 0.18;

  float fd = abs(dot(n, normalize(uFissureAxis)));
  float fissure = exp(-pow(fd * 18.0, 2.0));
  fd = abs(dot(n, normalize(uFissureAxis.zxy)));
  fissure = max(fissure, exp(-pow(fd * 18.0, 2.0)) * 0.7);
  float fissureDisp = -fissure * uTraitFissured * 0.32;

  float craterMask = smoothstep(0.55, 0.85, snoise(sp * 4.5 + uCraterSeed));
  float craterDisp = -craterMask * uTraitCratered * 0.18;

  m1 = vec4(lobe, fin, ripGlow, spikeMask * uTraitSpiked);
  m2 = vec4(fissure * uTraitFissured, craterMask * uTraitCratered, contraction / 0.024, base);

  return base + anim + lobe + fin + rip + spike + ridgeDisp + fissureDisp + craterDisp + uAbsorb * 0.022;
}

vec3 orgForm(vec3 p) {
  p.y *= mix(1.0, 0.62, uTraitOblate);
  p.y *= mix(1.0, 1.42, uTraitProlate);
  return orgRotY(uTraitTwisted * 1.4 * p.y) * p;
}
`;

export const organismVertexShader = /* glsl */ `
${organismVertexUniforms}

varying vec3  vWorldPos;
varying vec3  vNormalW;
varying vec3  vLocal;
varying float vDisp;
varying vec4  vM1;
varying vec4  vM2;

${simplexNoise3D}
${organismFieldChunk}

void main() {
  vec3 n = normalize(normal);
  vec3 p = position;
  vec4 m1; vec4 m2;
  float d0 = orgField(p, n, m1, m2);
  vec3 P0 = p + n * d0;
  vec3 F0 = orgForm(P0);

  // finite-difference normal of the displaced, formed surface (all quality levels:
  // vertex work is cheap next to the fragment layers, and flat-shaded facets look dead)
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 b1 = cross(n, t1);
  const float e = 0.018;
  vec4 a1; vec4 a2;
  vec3 nA = normalize(n + t1 * e);
  vec3 nB = normalize(n + b1 * e);
  vec3 FA = orgForm(p + t1 * e + nA * orgField(p + t1 * e, nA, a1, a2));
  vec3 FB = orgForm(p + b1 * e + nB * orgField(p + b1 * e, nB, a1, a2));
  vec3 nl = normalize(cross(FA - F0, FB - F0));
  if (dot(nl, n) < 0.0) nl = -nl;

  vec4 wp = modelMatrix * vec4(F0, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * nl);
  vLocal = P0;
  vDisp = d0;
  vM1 = m1;
  vM2 = m2;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const organismFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uPulse;
uniform float uEvolution;
uniform float uPulseRate;
uniform float uVeinDensity;
uniform float uVeinNoiseType;
uniform float uReflectivity;
uniform float uAbsorb;
uniform float uIdle;
uniform float uSync;
uniform float uNucleus;
uniform float uVeinGrowth;
uniform float uBiomeLevel;
uniform float uBiome;
uniform float uBiome2;
uniform vec4  uPatches[5];
uniform float uPatchOwner[5];
uniform vec4  uPersona;
uniform vec3  uGenomeAxis;
uniform vec3  uCamLocal;
uniform vec3  uKeyDir;
uniform vec3  uColorDeep;
uniform vec3  uColorMid;
uniform vec3  uColorGlow;
uniform vec3  uColorVein;
uniform vec3  uColorAccent;
uniform vec3  uNebulaA;
uniform vec3  uNebulaB;
uniform vec4  uEventTint;      // rgb, amount — cosmic event lighting
uniform vec3  uColorCast;
uniform float uColorCastStrength;
uniform float uTraitAurorae;
uniform float uTraitEclipsed;
uniform float uTraitFissured;
uniform float uTraitCratered;
uniform float uTraitSpiked;

varying vec3  vWorldPos;
varying vec3  vNormalW;
varying vec3  vLocal;
varying float vDisp;
varying vec4  vM1;
varying vec4  vM2;

${simplexNoise3D}

float fbm3(vec3 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

#if QUALITY >= 2
// F1/F2 cellular distances — membrane cell walls
vec2 cellular(vec3 x) {
  vec3 p = floor(x); vec3 f = fract(x);
  float d1 = 8.0; float d2 = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 b = vec3(float(i), float(j), float(k));
    vec3 o = vec3(hashCell(p + b), hashCell(p + b + 17.0), hashCell(p + b + 39.0));
    o = 0.5 + 0.38 * sin(uTime * 0.25 + 6.2831 * o);   // cells slowly shift
    vec3 r = b + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return sqrt(vec2(d1, d2));
}
#endif

float biomePattern(float id, vec3 p, float t) {
  if (id < 0.5) {            // fungal: soft bioluminescent spots
    float s = snoise(p * 7.0 + vec3(0.0, t * 0.05, 0.0));
    return smoothstep(0.45, 0.8, s) * (0.6 + 0.4 * sin(t * 0.9 + s * 9.0));
  } else if (id < 1.5) {     // crystal: sharp frost facets
    float s = abs(snoise(p * 5.0));
    return smoothstep(0.06, 0.0, s) + 0.35 * smoothstep(0.5, 0.9, snoise(p * 11.0));
  } else if (id < 2.5) {     // coral: porous rings
    float s = snoise(p * 3.2);
    return smoothstep(0.25, 0.0, abs(sin(s * 9.0))) * 0.8;
  }
  // spore: fine flickering speckles
  float s = snoise(p * 16.0 + vec3(t * 0.2));
  return smoothstep(0.7, 0.95, s) * (0.5 + 0.5 * sin(t * 3.0 + p.x * 40.0));
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  float t = uTime;
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - NdotV, 3.0);
  vec3 dirL = normalize(vLocal);
  vec3 Vl = normalize(uCamLocal - vLocal);

  float lobe = vM1.x;
  float fin = vM1.y;
  float ripGlow = vM1.z;
  float energy = uPersona.x;
  float lum = uPersona.y;

  // ---------------- membrane & colour migration ----------------
  float mig = snoise(vLocal * 0.7 + vec3(t * 0.025, -t * 0.018, t * 0.02));
  vec3 membrane = mix(uColorMid, uColorAccent * 0.55, smoothstep(-0.3, 0.9, mig) * 0.45);
  float ridge = smoothstep(-0.08, 0.22, vM2.w);
  vec3 albedo = mix(uColorDeep, membrane, 0.2 + 0.6 * ridge);
  // protrusions and frills thin out → paler, more translucent tissue
  float thin = clamp(lobe * 2.0 + fin * 2.4, 0.0, 1.0);
  albedo = mix(albedo, mix(uColorMid, uColorGlow, 0.35), thin * 0.45);

  float cellShade = 1.0;
  float cellWall = 0.0;
#if QUALITY >= 2
  vec2 c = cellular(vLocal * 4.2 + uGenomeAxis * 3.0);
  cellWall = 1.0 - smoothstep(0.02, 0.11, c.y - c.x);
  cellShade = 0.82 + 0.3 * smoothstep(0.0, 0.7, c.x);
#endif

  // ---------------- lighting ----------------
  vec3 Lk = normalize(uKeyDir);
  float wrap = 0.5;
  float diff = clamp((dot(N, Lk) + wrap) / (1.0 + wrap), 0.0, 1.0);
  vec3 H = normalize(Lk + V);
  float spec = pow(max(dot(N, H), 0.0), 56.0) * 0.2;
  // subsurface-ish transmission: light leaking through thin tissue toward the viewer
  float back = pow(clamp(dot(V, -normalize(Lk + N * 0.35)), 0.0, 1.0), 2.5);
  vec3 sss = mix(uColorGlow, uColorAccent, 0.3) * back * (0.18 + thin * 0.9);

  vec3 membraneLit = albedo * cellShade * (0.25 + 0.75 * diff);

  // ---------------- interior: depth seen through the membrane ----------------
  // closest approach of the view ray (entering at this point) to the organism centre
  float coreD = length(cross(vLocal, Vl));
  float breathe = 0.85 + 0.15 * sin(t * 0.55 * uPulseRate - 0.6);
  float core = exp(-coreD * coreD * 5.0) * uNucleus * breathe;
  vec3 inner = mix(uColorDeep, uColorMid, 0.5) * 0.6;
  inner += mix(uColorGlow, uColorAccent, 0.2) * core * 0.6;
#if QUALITY >= 1
  vec3 pIn = vLocal - Vl * 0.32;
  float nuclei = smoothstep(0.3, 0.85, snoise(pIn * 1.7 + vec3(0.0, t * 0.05, 0.0) + uGenomeAxis * 5.0));
  vec3 pDeep = vLocal - Vl * 0.65;
  float stream = fbm3(pDeep * 1.15 + vec3(t * 0.06, t * 0.04, -t * 0.05));
  inner += uColorGlow * nuclei * 0.4 * uNucleus * (0.4 + 0.6 * core + 0.3);
  inner += uColorVein * smoothstep(0.05, 0.7, stream) * 0.3;
#endif
  // the skin is thin where we look straight through it, thick at the limb
  float opacity = clamp(0.38 + 0.55 * pow(1.0 - NdotV, 1.5) + thin * 0.1 - uIdle * 0.08, 0.0, 1.0);
  vec3 col = mix(inner, membraneLit, opacity);

  // ---------------- circulation: veins + capillaries with travelling pulses ----------------
  vec3 q = (vLocal - Vl * 0.05) * (1.4 + uVeinDensity * 0.6) + vec3(0.0, t * 0.04 * uPulseRate, 0.0);
  // the genome's vein family warps a vessel network, so every family still reads as vessels
  float vn = surfaceNoise(q * 0.8, uVeinNoiseType);
  float vline = snoise(q * 1.05 + vec3(vn * 1.3));
  float vein = smoothstep(0.07 + 0.035 * uVeinGrowth, 0.0, abs(vline));
  float cap = 0.0;
#if QUALITY >= 1
  float cn = snoise(q * 2.7 + 11.0);
  cap = smoothstep(0.07, 0.0, abs(cn)) * 0.55 * uVeinGrowth;
#endif
  float flowCoord = dot(vLocal, uGenomeAxis) * 5.0 + vn * 4.0;
  float travel = pow(0.5 + 0.5 * sin(flowCoord - t * (1.5 + energy * 1.5) * uPulseRate), 5.0);
  // synchronisation (rare idle behaviour): every vessel pulses together
  float syncBeat = pow(0.5 + 0.5 * sin(t * 2.2), 8.0) * uSync;
  float veinLight = (vein + cap) * (0.28 + 0.85 * travel + uAbsorb * 0.9 + uPulse * 0.5 + syncBeat * 1.2);
  col += uColorVein * veinLight * (0.65 + lum * 0.5);
  col += uColorVein * cellWall * 0.12 * (0.6 + travel * 0.6);

  // ---------------- migrating energy concentrations ----------------
  float hs = smoothstep(0.55, 0.95, snoise(vLocal * 1.05 + vec3(t * 0.04, -t * 0.035, t * 0.03) + 7.0));
  col += uColorGlow * hs * (0.1 + lum * 0.15) * (0.8 + 0.2 * sin(t * 1.1));

  // ---------------- biomes: regional ecosystems on the skin ----------------
  if (uBiomeLevel > 0.001) {
    for (int i = 0; i < 5; i++) {
      vec4 P = uPatches[i];
      float ang = acos(clamp(dot(dirL, P.xyz), -1.0, 1.0));
      float w = smoothstep(P.w, P.w * 0.45, ang) * uBiomeLevel;
      if (w <= 0.001) continue;
      float id = uPatchOwner[i] > 0.5 ? uBiome2 : uBiome;
      float pat = biomePattern(id, vLocal, t);
      vec3 tint = id < 0.5 ? uColorAccent : id < 1.5 ? mix(uColorGlow, vec3(0.85, 0.95, 1.0), 0.5) : id < 2.5 ? mix(uColorAccent, uColorVein, 0.5) : uColorGlow;
      col = mix(col, col * 0.75 + tint * 0.08, w * 0.6);
      col += tint * pat * w * 0.55;
    }
  }

  // ---------------- anatomy of mutations ----------------
  // bioluminescent tips on protrusions
  float tip = smoothstep(0.12, 0.55, lobe);
  col += uColorAccent * tip * (0.35 + 0.25 * sin(t * 1.3 + vLocal.y * 3.0)) * (0.7 + lum * 0.6);
  // frill membrane: veined, translucent edge
  col += mix(uColorGlow, uColorAccent, 0.4) * smoothstep(0.05, 0.25, fin) * (0.25 + 0.2 * sin(t * 0.8 + dirL.x * 9.0));
  // spikes: glowing thorn tips
  col += uColorAccent * vM1.w * 0.9;
  // fissures: light from deep inside the cracks
  float fis = vM2.x;
  col = mix(col, uColorVein * (1.3 + 0.6 * travel) + uColorGlow * 0.4, fis * 0.75);
  // craters become pores: dark wells with a living rim
  float pore = vM2.y;
  col *= 1.0 - pore * 0.55;
  col += uColorGlow * smoothstep(0.2, 0.5, pore) * smoothstep(0.9, 0.5, pore) * uTraitCratered * 0.5;

  // aurorae: shifting latitude bands
  if (uTraitAurorae > 0.0) {
    float bandPhase = sin(vLocal.y * 6.0 + t * 0.6) * 0.5 + 0.5;
    vec3 aur = mix(vec3(0.2, 1.0, 0.5), vec3(0.9, 0.3, 1.0), bandPhase);
    col += aur * 0.28 * uTraitAurorae * (0.4 + fres);
  }

  // ---------------- touch ----------------
  col += mix(uColorGlow, vec3(1.0), 0.3) * ripGlow * 0.55;
  col += uColorGlow * uAbsorb * 0.12;

  // ---------------- light transport & rim ----------------
  col += sss;
  col += mix(uColorGlow, vec3(1.0), 0.5) * spec;
  col += uColorGlow * fres * (0.5 + uPulse * 0.4 + lum * 0.25);
  col += uColorVein * pow(1.0 - NdotV, 6.0) * 0.4;

  // faint environment reflection (cheap — no fbm)
  vec3 R = reflect(-V, N);
  float sky = 0.5 + 0.5 * snoise(R * 1.8 + vec3(t * 0.01));
  vec3 env = mix(uNebulaA, uNebulaB, sky) * (0.4 + 0.6 * exp(-pow(R.y * 2.2, 2.0)));
  col += env * uReflectivity * (0.1 + 0.6 * fres);

  // cosmic event light
  col = mix(col, col * uEventTint.rgb * 1.4, uEventTint.a * 0.5);

  // colour mutations
  col = mix(col, col * uColorCast, uColorCastStrength * 0.8);
  col *= mix(1.0, 0.5, uTraitEclipsed);

  // filmic shoulder keeps highlights from blowing out into bloom soup
  col = aces(col * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`;
