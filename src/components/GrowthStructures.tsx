// LEVEL 1 (biome growths) and LEVEL 2 (cilia) structures, rooted on the living skin.
//
// Placement is deterministic (genome seed + biome patches), so an organism keeps
// the same forests/colonies across sessions. Each instance stores an anchor on
// the base geometry; the vertex shader evaluates the SAME displacement field as
// the body at that anchor, so growths ride breathing, ripples and protrusions.
// Instances sprout when the continuous stage (uStageF + boosts) passes their
// `appearAt`, so ecosystems spread outward from patch centres over time.

import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { QUALITY_PRESETS } from '../lib/quality';
import { surfaceAnchors, nearestAnchor } from '../lib/bodyGeometry';
import { ARCHETYPE_GEOMETRY, ciliumGeometry } from '../lib/growthGeometry';
import { mulberry32, subSeed, randomUnitVector } from '../lib/rng';
import { computeBiomes } from '../lib/biomes';
import { simplexNoise3D } from '../shaders/noise';
import { organismVertexUniforms, organismFieldChunk } from '../shaders/organismShader';
import { U, organismState } from '../systems/organism';

const growthVertex = /* glsl */ `
${organismVertexUniforms}
uniform float uReach;      // stage reach for sprouting
uniform float uSwayAmp;
uniform float uKind;       // 0 biome growth, 1 cilia
attribute vec3 aAnchor;
attribute vec3 aNormal;
attribute vec4 aParams;    // scale, rotation, appearAt, phase
attribute float aOwner;    // 0 primary biome, 1 secondary
attribute float aPart;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vH;
varying float vPart;
varying float vOwner;
varying float vPhase;
varying float vGrow;
${simplexNoise3D}
${organismFieldChunk}
void main() {
  float grow = smoothstep(aParams.z, aParams.z + 0.45, uReach);
  vGrow = grow;
  vPart = aPart;
  vOwner = aOwner;
  vPhase = aParams.w;
  if (grow <= 0.001) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; } // dormant: culled

  vec3 n = normalize(aNormal);
  vec4 m1; vec4 m2;
  float d = orgField(aAnchor, n, m1, m2);
  vec3 root = aAnchor + n * (d - 0.025);

  vec3 tA = normalize(cross(n, abs(n.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 tB = cross(n, tA);
  float r = aParams.y;
  vec3 X = tA * cos(r) + tB * sin(r);
  vec3 Z = cross(X, n);

  float h = clamp(position.y, 0.0, 1.2);
  vH = h;
  // grow-in: emerge from the skin, stretch to full height
  float sc = aParams.x * (0.25 + 0.75 * grow);
  vec3 lp = position * sc;
  lp.y *= grow;

  // delayed procedural motion: bending grows with height; cilia beat in metachronal waves
  float ph = aParams.w;
  float wavePh = uKind > 0.5 ? dot(n, uGenomeAxis) * 7.0 : ph;
  float speed = uKind > 0.5 ? 2.3 : 0.6;
  vec2 sway = vec2(sin(uTime * speed * uPulseRate + wavePh), cos(uTime * speed * 0.77 * uPulseRate + wavePh * 1.3 + ph));
  // reaction to touch: recent absorption makes everything shiver a little
  sway += vec2(sin(uTime * 9.0 + ph * 3.0)) * uAbsorb * 0.6;
  lp.x += sway.x * uSwayAmp * h * h * sc;
  lp.z += sway.y * uSwayAmp * h * h * sc;

  vec3 p = root + X * lp.x + n * lp.y + Z * lp.z;
  p = orgForm(p);
  vec3 nl = normalize(X * normal.x + n * normal.y + Z * normal.z);

  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * nl);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const growthFragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uPulseRate;
uniform float uAbsorb;
uniform float uSync;
uniform vec4  uPersona;
uniform vec4  uEventTint;
uniform vec3  uColorDeep;
uniform vec3  uColorMid;
uniform vec3  uColorGlow;
uniform vec3  uColorVein;
uniform vec3  uColorAccent;
uniform vec3  uTintA;     // primary biome tint
uniform vec3  uTintB;     // secondary biome tint
uniform float uArchetype; // 0 fungal, 1 crystal, 2 coral, 3 spore, 4 cilia
uniform float uKind;
uniform float uTraitEclipsed;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying float vH;
varying float vPart;
varying float vOwner;
varying float vPhase;
varying float vGrow;

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorldPos);
  if (!gl_FrontFacing) N = -N;
  float NdotV = abs(dot(N, V));
  float fres = pow(1.0 - NdotV, 2.5);
  vec3 tint = mix(uTintA, uTintB, vOwner);
  float lum = uPersona.y;
  // each growth breathes on its own phase; synchronisation locks them together
  float beat = 0.5 + 0.5 * sin(uTime * 0.9 * uPulseRate + vPhase * (1.0 - uSync));
  vec3 col;

  if (uArchetype < 0.5) {                 // fungal
    vec3 stem = mix(uColorDeep, uColorMid, 0.4 + vH * 0.6);
    vec3 cap = tint * (0.55 + 0.6 * beat) + uColorGlow * 0.15;
    col = mix(stem, cap, vPart);
    col += tint * fres * 0.5;
  } else if (uArchetype < 1.5) {          // crystal
    vec3 glass = mix(uColorDeep * 0.6, tint * 0.35, vH);
    col = glass + mix(tint, vec3(1.0), 0.35) * fres * 1.2;
    col += tint * smoothstep(0.6, 1.0, vH) * (0.35 + 0.4 * beat) * vPart;
  } else if (uArchetype < 2.5) {          // coral
    vec3 body = mix(uColorMid * 0.8, mix(tint, uColorVein, 0.4), vH);
    col = body * (0.5 + 0.3 * beat) + tint * vPart * (0.7 + 0.5 * beat);
    col += uColorVein * fres * 0.4;
  } else if (uArchetype < 3.5) {          // spore
    vec3 thread = uColorMid * 0.6 + tint * 0.15 * vH;
    vec3 orb = tint * (0.8 + 0.7 * beat) + vec3(0.25) * fres;
    col = mix(thread, orb, vPart);
  } else {                                // cilia
    col = mix(uColorMid * 0.7, mix(uColorGlow, tint, 0.4), vH) * (0.5 + 0.5 * vH);
    col += uColorGlow * fres * 0.3;
  }

  col *= 0.75 + lum * 0.4;
  col += tint * uAbsorb * 0.25 * vH;
  col = mix(col, col * uEventTint.rgb * 1.4, uEventTint.a * 0.5);
  col *= mix(1.0, 0.55, uTraitEclipsed);
  col = aces(col);
  float alpha = (uKind > 0.5 ? 0.85 : 1.0) * smoothstep(0.0, 0.25, vGrow);
  gl_FragColor = vec4(col, alpha);
}
`;

type Layout = {
  geometry: THREE.InstancedBufferGeometry;
  archetype: number;
  isCilia: boolean;
};

function buildLayout(
  baseGeom: THREE.BufferGeometry,
  template: THREE.BufferGeometry,
  count: number,
  fill: (i: number, out: { dir: [number, number, number]; scale: number; rot: number; appear: number; phase: number; owner: number }) => boolean,
  anchorsCache: ReturnType<typeof surfaceAnchors>,
): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.index = template.index;
  for (const [name, attr] of Object.entries(template.attributes)) g.setAttribute(name, attr);
  const anchor = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);
  const owner = new Float32Array(count);
  const tmp = { dir: [0, 1, 0] as [number, number, number], scale: 0.1, rot: 0, appear: 99, phase: 0, owner: 0 };
  const stride = anchorsCache.count > 30000 ? 3 : anchorsCache.count > 12000 ? 2 : 1;
  let n = 0;
  for (let i = 0; i < count; i++) {
    if (!fill(i, tmp)) continue;
    const idx = nearestAnchor(anchorsCache, tmp.dir[0], tmp.dir[1], tmp.dir[2], stride);
    anchor.set(anchorsCache.positions.subarray(idx * 3, idx * 3 + 3), n * 3);
    normal.set(anchorsCache.normals.subarray(idx * 3, idx * 3 + 3), n * 3);
    params.set([tmp.scale, tmp.rot, tmp.appear, tmp.phase], n * 4);
    owner[n] = tmp.owner;
    n++;
  }
  g.setAttribute('aAnchor', new THREE.InstancedBufferAttribute(anchor, 3));
  g.setAttribute('aNormal', new THREE.InstancedBufferAttribute(normal, 3));
  g.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
  g.setAttribute('aOwner', new THREE.InstancedBufferAttribute(owner, 1));
  g.instanceCount = n;
  void baseGeom;
  return g;
}

export default function GrowthStructures({ geometry }: { geometry: THREE.BufferGeometry }) {
  const quality = useGameStore((s) => s.quality);
  const genome = useGameStore((s) => s.genome);
  const traits = useGameStore((s) => s.traits);
  const traitAmounts = useGameStore((s) => s.traitAmounts);
  const preset = QUALITY_PRESETS[quality];

  // Biome identity only changes when genome or traits change.
  const biomes = useMemo(() => {
    const amounts: Record<string, number> = {};
    for (const t of traits) amounts[t] = traitAmounts[t] ?? 1;
    return computeBiomes(genome, { ...amounts, ...traitAmounts });
  }, [genome, traits, traitAmounts]);

  const anchors = useMemo(() => surfaceAnchors(geometry), [geometry]);
  const templates = useMemo(() => ARCHETYPE_GEOMETRY.map((f) => f()), []);
  const ciliumTemplate = useMemo(() => ciliumGeometry(), []);
  useEffect(() => () => { templates.forEach((t) => t.dispose()); ciliumTemplate.dispose(); }, [templates, ciliumTemplate]);

  const layouts = useMemo<Layout[]>(() => {
    const out: Layout[] = [];
    const budget = preset.growthBudget;
    const owners = [biomes.primary, biomes.secondary];
    owners.forEach((biome, ownerIdx) => {
      const patchIdx = biomes.patches.map((_, i) => i).filter((i) => biomes.patchOwner[i] === ownerIdx);
      if (patchIdx.length === 0) return;
      const perPatch = Math.floor((budget * (ownerIdx === 0 ? 0.65 : 0.35)) / patchIdx.length);
      const rand = mulberry32(subSeed(genome.seed, `growth-${biome.id}-${ownerIdx}`));
      const total = perPatch * patchIdx.length;
      const dir: [number, number, number] = [0, 0, 0];
      const geom = buildLayout(geometry, templates[biome.index], total, (i, o) => {
        const p = biomes.patches[patchIdx[Math.floor(i / perPatch)]];
        // uniform-ish sample in a spherical cap around the patch centre
        const ang = p[3] * Math.sqrt(rand());
        const az = rand() * Math.PI * 2;
        const c = [p[0], p[1], p[2]];
        const t = Math.abs(c[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
        const a = [c[1] * t[2] - c[2] * t[1], c[2] * t[0] - c[0] * t[2], c[0] * t[1] - c[1] * t[0]];
        const al = Math.hypot(a[0], a[1], a[2]);
        a[0] /= al; a[1] /= al; a[2] /= al;
        const b = [c[1] * a[2] - c[2] * a[1], c[2] * a[0] - c[0] * a[2], c[0] * a[1] - c[1] * a[0]];
        const s = Math.sin(ang);
        for (let k = 0; k < 3; k++) dir[k] = c[k] * Math.cos(ang) + (a[k] * Math.cos(az) + b[k] * Math.sin(az)) * s;
        const centrality = 1 - ang / p[3];
        o.dir = dir;
        o.scale = (0.11 + 0.15 * centrality * centrality + rand() * 0.07) * (biome.id === 'crystal' ? 1.1 : 1);
        o.rot = rand() * Math.PI * 2;
        // primary ecosystems sprout at Star and spread from the centre; secondary ones arrive later
        o.appear = (ownerIdx === 0 ? 3.0 : 4.6) + (1 - centrality) * 1.1 + rand() * 0.9;
        o.phase = rand() * Math.PI * 2;
        o.owner = ownerIdx;
        return true;
      }, anchors);
      out.push({ geometry: geom, archetype: biome.index, isCilia: false });
    });

    // Cilia: a fine fur over the whole body from White Hole on, metachronal beating
    const ciliaCount = preset.ciliaBudget;
    const rand = mulberry32(subSeed(genome.seed, 'cilia'));
    const cdir: [number, number, number] = [0, 0, 0];
    const cg = buildLayout(geometry, ciliumTemplate, ciliaCount, (_i, o) => {
      randomUnitVector(rand, cdir);
      o.dir = cdir;
      o.scale = 0.09 + rand() * 0.08;
      o.rot = rand() * Math.PI * 2;
      o.appear = 4.0 + rand() * 1.6;
      o.phase = rand() * Math.PI * 2;
      o.owner = 0;
      return true;
    }, anchors);
    out.push({ geometry: cg, archetype: 4, isCilia: true });
    return out;
  }, [geometry, anchors, templates, ciliumTemplate, biomes, genome.seed, preset.growthBudget, preset.ciliaBudget]);

  useEffect(() => () => layouts.forEach((l) => l.geometry.dispose()), [layouts]);

  const materials = useMemo(() => layouts.map((l) => {
    const tintA = new THREE.Color();
    const tintB = new THREE.Color();
    return new THREE.ShaderMaterial({
      uniforms: {
        ...U,
        uReach: { value: 0 },
        uSwayAmp: { value: l.isCilia ? 0.55 : 0.22 },
        uKind: { value: l.isCilia ? 1 : 0 },
        uArchetype: { value: l.archetype },
        uTintA: { value: tintA },
        uTintB: { value: tintB },
      },
      vertexShader: growthVertex,
      fragmentShader: growthFragment,
      defines: { ORG_LITE: 1 },
      side: THREE.DoubleSide,
      transparent: l.isCilia,
      depthWrite: !l.isCilia,
    });
  }), [layouts]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  useFrame(() => {
    const m = organismState.morph;
    const boosts = m?.epochMutations ?? [];
    const bloom = boosts.filter((x) => x === 'bloom').length;
    const cil = boosts.filter((x) => x === 'cilia').length;
    const accentHsl = { h: 0, s: 0, l: 0 };
    U.uColorAccent.value.getHSL(accentHsl);
    materials.forEach((mat, i) => {
      const l = layouts[i];
      mat.uniforms.uReach.value = U.uStageF.value + (l.isCilia ? cil * 0.8 : bloom * 0.7);
      const shiftA = biomes.primary.hueShift / 360;
      const shiftB = biomes.secondary.hueShift / 360;
      (mat.uniforms.uTintA.value as THREE.Color).setHSL((accentHsl.h + shiftA + 1) % 1, 0.8, 0.6);
      (mat.uniforms.uTintB.value as THREE.Color).setHSL((accentHsl.h + shiftB + 1) % 1, 0.75, 0.62);
    });
  });

  return (
    <group>
      {layouts.map((l, i) => (
        <mesh key={i} geometry={l.geometry} material={materials[i]} frustumCulled={false} renderOrder={l.isCilia ? 2 : 1} />
      ))}
    </group>
  );
}
