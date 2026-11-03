import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { sfxTap, startAmbient } from '../audio/audio';
import { QUALITY_PRESETS } from '../lib/quality';
import { organismState, U } from '../systems/organism';
import { rippleFx, absorbFx, arrivalFx, tapGuard } from '../systems/fx';

// Energy is never a counter that just ticks up: it is light that visibly
// travels INTO the organism. Taps on the body press the membrane (ripple) and
// splash light that is re-absorbed; taps in space release light that spirals in.

const MAX_PARTICLES = 1600;
const TAP_WINDOW = 2.5; // seconds

type Particle = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target: THREE.Vector3;   // landing direction (unit, world)
  life: number;
  maxLife: number;
  size: number;
  hue: number;             // 0 glow … 1 accent
  swirl: number;
  burst: number;           // burst id (first arrival of a burst ripples the skin)
};

/** Soft limit: rapid tapping still feels responsive but feeds less. */
const recentTaps: number[] = [];
export function tapEfficiency(now: number): number {
  while (recentTaps.length && now - recentTaps[0] > TAP_WINDOW) recentTaps.shift();
  const n = recentTaps.length;
  return 1 / (1 + Math.max(0, n - 4) * 0.35);
}

export default function EnergyParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const { gl, camera, raycaster } = useThree();
  const quality = useGameStore((s) => s.quality);
  const budget = Math.min(MAX_PARTICLES, QUALITY_PRESETS[quality].particleBudget);

  const particles = useMemo<Particle[]>(
    () => Array.from({ length: MAX_PARTICLES }, () => ({
      active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), target: new THREE.Vector3(0, 1, 0),
      life: 0, maxLife: 1, size: 1, hue: 0, swirl: 1, burst: 0,
    })),
    []
  );
  const positions = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const colors = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const sizes = useMemo(() => new Float32Array(MAX_PARTICLES), []);
  const scratch = useMemo(() => ({
    v: new THREE.Vector3(), w: new THREE.Vector3(), ndc: new THREE.Vector2(),
    plane: new THREE.Plane(), c1: new THREE.Color(), c2: new THREE.Color(), up: new THREE.Vector3(0, 1, 0),
  }), []);
  const live = useRef({ burstId: 1, landed: new Set<number>(), cursor: 0, uPixelRatio: { value: 1 } });

  const spawnBurst = (from: THREE.Vector3, landing: THREE.Vector3, count: number, opts: { splash?: boolean; hue?: number } = {}) => {
    const L = live.current;
    const id = L.burstId++;
    const vis = organismState.visScale;
    let spawned = 0;
    for (let k = 0; k < budget && spawned < count; k++) {
      const i = (L.cursor + k) % budget;
      const p = particles[i];
      if (p.active) continue;
      p.active = true;
      p.burst = id;
      p.target.copy(landing).normalize();
      const jitter = opts.splash ? 0.12 * vis : 0.35;
      p.pos.copy(from).add(scratch.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(jitter));
      if (opts.splash) {
        // splash outward off the membrane, then fall back in
        p.vel.copy(p.target).multiplyScalar(0.9 + Math.random() * 0.9)
          .add(scratch.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(1.4));
      } else {
        p.vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.8);
      }
      p.maxLife = 2.6 + Math.random() * 1.2;
      p.life = p.maxLife;
      p.size = (0.05 + Math.random() * 0.07) * (0.8 + Math.min(1, U.uEvolution.value * 0.05));
      p.hue = opts.hue ?? Math.random() * 0.6;
      p.swirl = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9);
      spawned++;
    }
    L.cursor = (L.cursor + spawned) % budget;
  };

  // ---------------- tap handling ----------------
  const downRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  useEffect(() => {
    const dom = gl.domElement;
    const onDown = (e: PointerEvent) => {
      downRef.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    };
    const onCancel = () => { downRef.current = null; };
    const onUp = (e: PointerEvent) => {
      const d = downRef.current;
      downRef.current = null;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 400) return; // drag, not tap
      if (performance.now() < tapGuard.until) return; // a drifter consumed this tap

      const rect = dom.getBoundingClientRect();
      scratch.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(scratch.ndc, camera);

      const now = performance.now() / 1000;
      const eff = tapEfficiency(now);
      recentTaps.push(now);
      const vis = organismState.visScale;

      const root = organismState.root;
      const body = root?.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
      const hit = body ? raycaster.intersectObject(body, false)[0] : undefined;

      let pitch: number;
      if (hit) {
        // pressed the skin: ripple there, splash a little light that is re-absorbed
        rippleFx.emit({ point: hit.point, strength: 0.6 + 0.6 * eff });
        spawnBurst(hit.point, scratch.w.copy(hit.point), Math.round((10 + 16 * eff)), { splash: true });
        pitch = THREE.MathUtils.clamp(0.5 + hit.point.y / (vis * 2.4), 0, 1);
      } else {
        // released light in space: it spirals into the organism and lands on the facing side
        scratch.plane.setFromNormalAndCoplanarPoint(scratch.v.copy(camera.position).normalize(), scratch.w.set(0, 0, 0));
        const point = scratch.w;
        if (!raycaster.ray.intersectPlane(scratch.plane, point)) return;
        const minR = organismState.boundRadius * 1.25;
        if (point.length() < minR) point.setLength(minR);
        // land on the camera-facing side, leaning toward where the light was released
        const landing = new THREE.Vector3().copy(point).normalize().multiplyScalar(0.55)
          .addScaledVector(scratch.v.copy(camera.position).normalize(), 0.7);
        spawnBurst(point.clone(), landing, Math.round((22 + 26 * eff) * (0.6 + Math.min(0.8, U.uEvolution.value * 0.06))));
        pitch = THREE.MathUtils.clamp(0.5 + point.y / (organismState.boundRadius * 3), 0, 1);
      }

      useGameStore.getState().absorbEnergy(eff);
      startAmbient();
      sfxTap(pitch, eff);
    };
    dom.addEventListener('pointerdown', onDown);
    dom.addEventListener('pointerup', onUp);
    dom.addEventListener('pointercancel', onCancel);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera, raycaster, budget]);

  // Drifters / events can stream energy in too
  useEffect(() => absorbFx.on(({ from, count, color }) => {
    const landing = scratch.w.copy(from).normalize();
    spawnBurst(from, landing, count, { hue: color ? 0.9 : undefined });
  }), [budget]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------- simulation ----------------
  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);
    const L = live.current;
    L.uPixelRatio.value = state.gl.getPixelRatio();
    const vis = organismState.visScale;
    const surfaceR = vis * 1.02;
    scratch.c1.copy(U.uColorGlow.value);
    scratch.c2.copy(U.uColorAccent.value);
    const { v, w } = scratch;

    for (let i = 0; i < budget; i++) {
      const p = particles[i];
      if (!p.active) {
        sizes[i] = 0;
        continue;
      }
      // steer toward the landing point on the surface, with a curling swirl
      w.copy(p.target).multiplyScalar(surfaceR).sub(p.pos);
      const dist = w.length();
      w.normalize();
      const age = 1 - p.life / p.maxLife;
      const pull = 1.2 + age * 6.0;
      p.vel.addScaledVector(w, pull * delta);
      v.crossVectors(w, scratch.up).normalize().multiplyScalar(p.swirl * Math.min(1, dist) * 1.2 * delta);
      p.vel.add(v);
      p.vel.multiplyScalar(1 - delta * 1.1);
      p.pos.addScaledVector(p.vel, delta);
      p.life -= delta;

      if (dist < 0.12 * vis || p.pos.length() < surfaceR * 0.96 || p.life <= 0) {
        p.active = false;
        if (p.life > 0) {
          if (!L.landed.has(p.burst)) {
            L.landed.add(p.burst);
            if (L.landed.size > 64) L.landed.clear();
            rippleFx.emit({ point: v.copy(p.target).multiplyScalar(surfaceR), strength: 0.45 });
          }
          arrivalFx.emit({ point: p.pos });
        }
        sizes[i] = 0;
        continue;
      }

      positions[i * 3] = p.pos.x;
      positions[i * 3 + 1] = p.pos.y;
      positions[i * 3 + 2] = p.pos.z;
      const fadeIn = Math.min(1, age * 8);
      sizes[i] = p.size * fadeIn * (0.6 + 0.4 * Math.min(1, dist));
      const h = p.hue + age * 0.3;
      colors[i * 3] = scratch.c1.r + (scratch.c2.r - scratch.c1.r) * h + 0.25;
      colors[i * 3 + 1] = scratch.c1.g + (scratch.c2.g - scratch.c1.g) * h + 0.25;
      colors[i * 3 + 2] = scratch.c1.b + (scratch.c2.b - scratch.c1.b) * h + 0.25;
    }

    const geom = pointsRef.current?.geometry as THREE.BufferGeometry | undefined;
    if (geom) {
      geom.attributes.position.needsUpdate = true;
      geom.attributes.aSize.needsUpdate = true;
      geom.attributes.color.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false} renderOrder={5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexColors
        uniforms={{ uPixelRatio: live.current.uPixelRatio }}
        vertexShader={/* glsl */ `
          attribute float aSize;
          uniform float uPixelRatio;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = pow(smoothstep(0.5, 0.0, d), 1.7);
            gl_FragColor = vec4(vColor, a);
          }
        `}
      />
    </points>
  );
}
