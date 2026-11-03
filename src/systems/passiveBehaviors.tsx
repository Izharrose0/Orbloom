// Passive observation as a playstyle. When left alone the organism does things
// it never does while being handled: it meditates (deeper, slower breath and
// hidden markings surface), occasionally synchronises every vessel into one
// heartbeat, and releases spores from its ecosystems. None of this needs input,
// and interacting never "punishes" — it simply wakes the organism up again.
//
// Also hosts milestone/discovery captions (biome emergence, epoch mutations,
// personality), since they share the "show once, quietly" logic.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { organismState, U } from './organism';
import { discover } from '../lib/discoveries';
import { describePersona, EPOCH_MUTATION_TEXT } from '../lib/morphology';
import { sfxSync, sfxSpore } from '../audio/audio';

const MAX_SPORES = 220;

function caption(id: string, text: string, sub?: string) {
  if (discover(id)) useGameStore.getState().showCaption(text, sub);
}

export default function PassiveBehaviors() {
  const live = useRef({
    syncUntil: 0,
    nextSyncAt: 0,
    sporeAcc: 0,
    lastBiome: '',
    lastEpoch: -1,
    lastStage: -1,
    meditating: false,
    t: 0,
  });

  // ---------------- spores ----------------
  const pointsRef = useRef<THREE.Points>(null);
  const spores = useMemo(() => ({
    pos: new Float32Array(MAX_SPORES * 3),
    vel: new Float32Array(MAX_SPORES * 3),
    life: new Float32Array(MAX_SPORES),
    size: new Float32Array(MAX_SPORES),
    sizeAttr: new Float32Array(MAX_SPORES),
    lifeAttr: new Float32Array(MAX_SPORES),
    cursor: 0,
  }), []);
  const uniforms = useMemo(() => ({ uColor: U.uColorAccent, uPixelRatio: { value: 1 } }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  const emitSpore = () => {
    const root = organismState.root;
    const b = organismState.biomes;
    if (!root || !b) return;
    const i = spores.cursor;
    spores.cursor = (spores.cursor + 1) % MAX_SPORES;
    // from a biome patch when ecosystems exist, otherwise anywhere
    const p = b.patches[Math.floor(Math.random() * b.patches.length)];
    tmp.set(p[0] + (Math.random() - 0.5) * 0.6, p[1] + (Math.random() - 0.5) * 0.6, p[2] + (Math.random() - 0.5) * 0.6).normalize();
    const dir = tmp.clone();
    tmp.multiplyScalar(1.08);
    root.localToWorld(tmp);
    dir.transformDirection(root.matrixWorld);
    spores.pos.set([tmp.x, tmp.y, tmp.z], i * 3);
    const speed = 0.12 + Math.random() * 0.18;
    spores.vel.set([dir.x * speed, dir.y * speed + 0.03, dir.z * speed], i * 3);
    spores.life[i] = 9 + Math.random() * 6;
    spores.size[i] = 0.05 + Math.random() * 0.06;
  };

  // milestone captions that depend on store changes
  useEffect(() => useGameStore.subscribe((s, prev) => {
    if (s.stage.id > prev.stage.id && s.stage.id === 1) {
      const m = organismState.morph;
      if (m) {
        const text = describePersona(m.persona, { biome: organismState.biomes?.primary.id });
        setTimeout(() => caption('persona-' + text, 'It is ' + text.toLowerCase() + '.', 'Its nature is beginning to show'), 4500);
      }
    }
  }), []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const L = live.current;
    L.t += delta;
    const s = useGameStore.getState();
    const idle = U.uIdle.value;
    const now = L.t;

    // ---- meditation ----
    if (idle > 0.85 && !L.meditating) {
      L.meditating = true;
      caption('meditation', 'Left alone, it slows its breathing.', 'Hidden markings rise to the surface');
    } else if (idle < 0.3) {
      L.meditating = false;
    }

    // ---- synchronisation: rare, only during deep stillness ----
    if (idle > 0.7) {
      if (L.nextSyncAt === 0) L.nextSyncAt = now + 40 + Math.random() * 80;
      if (now >= L.nextSyncAt && now > L.syncUntil) {
        L.syncUntil = now + 10;
        L.nextSyncAt = now + 120 + Math.random() * 180;
        sfxSync();
        caption('sync', 'Every vessel beats as one.', 'A rare synchronisation');
      }
    } else {
      L.nextSyncAt = 0;
    }
    const syncTarget = now < L.syncUntil ? 1 : 0;
    U.uSync.value += (syncTarget - U.uSync.value) * (1 - Math.exp(-delta * (syncTarget ? 0.8 : 0.4)));

    // ---- spore release from ecosystems ----
    const hasEco = (organismState.morph?.growthDensity ?? 0) > 0 || s.stage.id >= 1;
    if (idle > 0.45 && hasEco) {
      L.sporeAcc += delta * (0.4 + idle * 1.4);
      while (L.sporeAcc > 1) {
        L.sporeAcc -= 1;
        emitSpore();
      }
      if (idle > 0.6 && Math.random() < delta * 0.05) {
        sfxSpore();
        caption('spores', 'It is releasing spores.', 'Ecosystems breathe when undisturbed');
      }
    }

    // ---- milestone discoveries ----
    const m = organismState.morph;
    const b = organismState.biomes;
    if (b && m && m.growthDensity > 0) {
      const key = b.primary.id;
      if (key !== L.lastBiome) {
        if (L.lastBiome !== '' || s.stage.id >= 3) caption('biome-' + key, b.primary.name + ' have emerged.', b.primary.description);
        L.lastBiome = key;
      }
    }
    if (m && m.epoch !== L.lastEpoch) {
      if (L.lastEpoch >= 0 && m.epoch > L.lastEpoch) {
        const mut = m.epochMutations[m.epoch - 1];
        const txt = EPOCH_MUTATION_TEXT[mut];
        s.showCaption(`Epoch ${m.epoch} · ${txt.name}`, txt.description);
      }
      L.lastEpoch = m.epoch;
    }

    // ---- spore simulation ----
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const sizeAttr = geom.attributes.aSize as THREE.BufferAttribute;
    const lifeAttr = geom.attributes.aLife as THREE.BufferAttribute;
    for (let i = 0; i < MAX_SPORES; i++) {
      if (spores.life[i] <= 0) { (sizeAttr.array as Float32Array)[i] = 0; continue; }
      spores.life[i] -= delta;
      const k = i * 3;
      // slow buoyant drift with a little wander
      spores.vel[k] += Math.sin(now * 0.7 + i) * 0.004 * delta;
      spores.vel[k + 2] += Math.cos(now * 0.6 + i * 1.3) * 0.004 * delta;
      spores.pos[k] += spores.vel[k] * delta;
      spores.pos[k + 1] += spores.vel[k + 1] * delta;
      spores.pos[k + 2] += spores.vel[k + 2] * delta;
      (sizeAttr.array as Float32Array)[i] = spores.size[i];
      (lifeAttr.array as Float32Array)[i] = spores.life[i];
    }
    geom.attributes.position.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false} renderOrder={4}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[spores.pos, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[spores.sizeAttr, 1]} />
        <bufferAttribute attach="attributes-aLife" args={[spores.lifeAttr, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute float aSize;
          attribute float aLife;
          uniform float uPixelRatio;
          varying float vA;
          void main() {
            vA = smoothstep(0.0, 3.0, aLife) * (1.0 - smoothstep(12.0, 15.0, aLife));
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float core = smoothstep(0.18, 0.0, d);
            float halo = pow(smoothstep(0.5, 0.0, d), 2.0) * 0.5;
            gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.5), (core + halo) * vA * 0.8);
          }
        `}
      />
    </points>
  );
}
