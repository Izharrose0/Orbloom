// Asynchronous cosmic neighbourhood.
//
// - Positions come from persistent cosmic coordinates (lib/cosmos): neighbours
//   appear in their true direction from your organism, nearest first.
// - Each neighbour is a tiny procedural silhouette drawn from its genome and
//   stage (lobes, frill, ring), breathing at its own pulse rate.
// - Tap one to learn its (procedural) name and stage — no profiles, no chat.
// - Rarely, a neighbour with a compatible energy signature resonates with you:
//   a thread of light, a shared pulse, a soft chime.
// One fetch on load and a slow refresh while visible; nothing is written.
// Without a backend the sky is simply quieter.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { fetchNeighbors, NeighborPlanet } from '../lib/persistence';
import { deriveGenome, deriveName, Genome } from '../lib/genome';
import { stageForMass } from '../lib/stages';
import { cosmicCoordinates, resonanceAffinity } from '../lib/cosmos';
import { useGameStore } from '../store/useGameStore';
import { U } from '../systems/organism';
import { tapGuard } from '../systems/fx';
import { discover } from '../lib/discoveries';
import { sfxResonance } from '../audio/audio';
import { formatBig } from '../lib/format';

const MAX_SHOWN = 40;
const REFRESH_MS = 5 * 60 * 1000;

type Neighbor = NeighborPlanet & {
  genome: Genome;
  stageId: number;
  dir: THREE.Vector3;
  shellR: number;
  size: number;
  affinity: number;
  glow: THREE.Color;
  accent: THREE.Color;
};

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const frag = /* glsl */ `
uniform float uTime; uniform float uStage; uniform float uPulse; uniform float uSeed;
uniform float uResonance; uniform float uHover;
uniform vec3 uGlow; uniform vec3 uAccent;
varying vec2 vUv;
void main() {
  vec2 p = vUv;
  float r = length(p);
  float a = atan(p.y, p.x);
  float breath = 0.5 + 0.5 * sin(uTime * uPulse * 0.55 + uSeed * 6.0);
  // silhouette grows features with stage: buds → frill → star lobes → crown
  float lobes = uStage >= 3.0 ? 5.0 + floor(uStage - 3.0) : uStage >= 1.0 ? 3.0 : 0.0;
  float lobeAmt = uStage >= 4.0 ? 0.16 : uStage >= 3.0 ? 0.1 : uStage >= 1.0 ? 0.06 : 0.0;
  float body = 0.32 + lobeAmt * pow(max(0.0, cos(a * lobes + uSeed * 9.0)), 3.0) + 0.012 * breath;
  float frill = uStage >= 2.0 ? exp(-pow(p.y * 14.0, 2.0)) * 0.12 : 0.0;
  float edge = smoothstep(body + frill + 0.025, body + frill - 0.01, r);
  float core = exp(-r * r * 22.0) * (0.6 + 0.4 * breath);
  float halo = exp(-r * 4.5) * 0.35;
  float ring = uStage >= 2.0 ? exp(-pow((length(vec2(p.x, p.y * 3.2)) - 0.62) * 22.0, 2.0)) * 0.45 : 0.0;
  vec3 col = mix(uGlow * 0.35, uGlow, smoothstep(body, 0.0, r)) * edge + uAccent * core + uGlow * (halo + ring);
  float alpha = max(edge * 0.95, halo + ring + core);
  col += uAccent * uResonance * exp(-r * 2.0) * 0.8;
  alpha *= 0.85 + uHover * 0.15;
  gl_FragColor = vec4(col * (1.0 + uHover * 0.4), clamp(alpha, 0.0, 1.0));
}
`;

function NeighborSprite({ n, onPick, resonance }: { n: Neighbor; onPick: (n: Neighbor) => void; resonance: { id: string | null; amt: number } }) {
  const ref = useRef<THREE.Mesh>(null);
  const [hover, setHover] = useState(false);
  const uniforms = useMemo(() => ({
    uTime: U.uTime,
    uStage: { value: n.stageId },
    uPulse: { value: n.genome.pulseRate },
    uSeed: { value: (n.genome.seed % 1000) / 1000 },
    uResonance: { value: 0 },
    uHover: { value: 0 },
    uGlow: { value: n.glow },
    uAccent: { value: n.accent },
  }), [n]);

  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    m.position.copy(n.dir).multiplyScalar(n.shellR);
    m.quaternion.copy(state.camera.quaternion);
    const res = resonance.id === n.id ? resonance.amt : 0;
    uniforms.uResonance.value = res;
    uniforms.uHover.value += ((hover ? 1 : 0) - uniforms.uHover.value) * 0.15;
    m.scale.setScalar(n.size * (1 + res * 0.4 + uniforms.uHover.value * 0.15));
  });

  return (
    <mesh
      ref={ref}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true); }}
      onPointerOut={() => setHover(false)}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); tapGuard.until = performance.now() + 450; onPick(n); }}
    >
      <planeGeometry args={[2, 2]} />
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms} vertexShader={vert} fragmentShader={frag} />
    </mesh>
  );
}

export default function Constellation() {
  const [rows, setRows] = useState<NeighborPlanet[]>([]);
  const userId = useGameStore((s) => s.userId);
  const myGenome = useGameStore((s) => s.genome);
  const resonance = useRef({ id: null as string | null, amt: 0, until: 0, nextAt: 0 });

  useEffect(() => {
    let mounted = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      fetchNeighbors(120).then((r) => { if (mounted) setRows(r); });
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const neighbors = useMemo<Neighbor[]>(() => {
    if (!userId || rows.length === 0) return [];
    const me = cosmicCoordinates(userId);
    const list = rows.map((r) => {
      const c = cosmicCoordinates(r.id);
      const d = new THREE.Vector3(c[0] - me[0], c[1] - me[1], c[2] - me[2]);
      const dist = d.length();
      const genome = deriveGenome(r.id);
      const stage = stageForMass(r.mass ?? 1);
      return { r, d: d.normalize(), dist, genome, stageId: stage.id, paletteShift: stage.paletteShift };
    }).sort((a, b) => a.dist - b.dist).slice(0, MAX_SHOWN);
    const maxD = Math.max(1, ...list.map((x) => x.dist));
    return list.map(({ r, d, dist, genome, stageId, paletteShift }) => {
      const near = 1 - dist / maxD;
      // flatten toward the horizon a little so neighbours sit around the organism, not overhead
      d.y *= 0.55;
      d.normalize();
      return {
        ...r,
        genome,
        stageId,
        dir: d,
        shellR: 40 + (1 - near) * 70,
        size: (0.5 + Math.min(1.4, Math.log2(1 + (r.mass ?? 1)) * 0.12)) * (0.7 + near * 0.9),
        affinity: resonanceAffinity(myGenome, genome),
        glow: new THREE.Color().setHSL(((genome.hueGlow + paletteShift) % 360) / 360, 0.8, 0.62),
        accent: new THREE.Color().setHSL((genome.hueAccent % 360) / 360, 0.8, 0.66),
      };
    });
  }, [rows, userId, myGenome]);

  const pick = (n: Neighbor) => {
    const stage = stageForMass(n.mass ?? 1);
    useGameStore.getState().showCaption(deriveName(n.id), `${stage.name} · ${formatBig(n.mass ?? 1)} mass · a distant organism`);
  };

  const threadGeom = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3)), []);
  const threadMat = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const thread = useMemo(() => {
    const l = new THREE.Line(threadGeom, threadMat);
    l.frustumCulled = false;
    l.visible = false;
    return l;
  }, [threadGeom, threadMat]);

  useFrame((_, delta) => {
    const R = resonance.current;
    const t = performance.now() / 1000;
    if (R.nextAt === 0) R.nextAt = t + 90 + Math.random() * 120;
    // rare passive resonance with a compatible neighbour
    if (!R.id && t > R.nextAt && neighbors.length) {
      const candidates = neighbors.filter((n) => n.affinity > 0.55);
      const pickN = candidates[Math.floor(Math.random() * candidates.length)];
      R.nextAt = t + 150 + Math.random() * 240;
      if (pickN) {
        R.id = pickN.id;
        R.until = t + 9;
        sfxResonance();
        if (discover('resonance-' + pickN.id)) {
          useGameStore.getState().showCaption(`${deriveName(pickN.id)} resonates with yours.`, 'A compatible energy signature, far away');
        }
      }
    }
    const target = R.id && t < R.until ? 1 : 0;
    R.amt += (target - R.amt) * Math.min(1, delta * (target ? 1.2 : 0.6));
    if (!target && R.amt < 0.01) R.id = null;
    U.uAbsorb.value = Math.max(U.uAbsorb.value, R.amt * 0.25 * (0.5 + 0.5 * Math.sin(t * 2.2)));

    // thread of light between the two organisms
    const line = thread;
    const n = R.id ? neighbors.find((x) => x.id === R.id) : undefined;
    if (line) {
      line.visible = !!n && R.amt > 0.01;
      if (n) {
        const pos = threadGeom.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < 24; i++) {
          const k = i / 23;
          const sag = Math.sin(k * Math.PI) * 3;
          pos.setXYZ(i, n.dir.x * n.shellR * k, n.dir.y * n.shellR * k + sag, n.dir.z * n.shellR * k);
        }
        pos.needsUpdate = true;
        threadMat.color.copy(n.accent);
        threadMat.opacity = R.amt * 0.35;
      }
    }
  });

  if (neighbors.length === 0) return null;

  return (
    <group>
      {neighbors.map((n) => (
        <NeighborSprite key={n.id} n={n} onPick={pick} resonance={resonance.current} />
      ))}
      <primitive object={thread} />
    </group>
  );
}
