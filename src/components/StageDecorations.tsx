import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { mulberry32, subSeed } from '../lib/rng';
import { organismState, U } from '../systems/organism';

// Stage-bound structures that live AROUND the organism (the body's own
// morphology is in the organism shader). All layouts are seeded per genome.

const RING_COUNT = 260;
const TENDRIL_COUNT = 6;

/** Fades a decoration in over a few seconds after it unlocks instead of popping. */
function useAppear() {
  const v = useRef(0);
  return (delta: number) => {
    v.current = Math.min(1, v.current + delta * 0.3);
    return v.current * v.current * (3 - 2 * v.current);
  };
}

function LivingRing() {
  const ref = useRef<THREE.Points>(null);
  const seed = useGameStore((s) => s.genome.seed);
  const appear = useAppear();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#7df3ff') },
    uAccent: { value: new THREE.Color('#ffc46b') },
    uAppear: { value: 0 },
    uPixelRatio: { value: 1 },
  }), []);

  const geom = useMemo(() => {
    const rand = mulberry32(subSeed(seed, 'ring'));
    const positions = new Float32Array(RING_COUNT * 3);
    const sizes = new Float32Array(RING_COUNT);
    const phases = new Float32Array(RING_COUNT);
    for (let i = 0; i < RING_COUNT; i++) {
      const angle = (i / RING_COUNT) * Math.PI * 2 + rand() * 0.02;
      const r = 1 + (rand() - 0.5) * 0.12;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = (rand() - 0.5) * 0.03;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      sizes[i] = 0.03 + rand() * rand() * 0.07;
      phases[i] = angle;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    return g;
  }, [seed]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uAppear.value = appear(delta);
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uColor.value.copy(U.uColorGlow.value);
    uniforms.uAccent.value.copy(U.uColorAccent.value);
    ref.current.scale.setScalar(organismState.boundRadius * 1.08);
    ref.current.rotation.y += delta * 0.18;
    const ax = U.uGenomeAxis.value;
    ref.current.rotation.x = Math.atan2(ax.z, ax.y) * 0.6 + 0.08;
  });

  return (
    <points ref={ref} geometry={geom} frustumCulled={false}>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          attribute float aSize;
          attribute float aPhase;
          uniform float uTime;
          uniform float uPixelRatio;
          varying float vPulse;
          void main() {
            vec3 p = position;
            // a slow wave travels around the ring, lifting particles like a membrane edge
            float w = sin(aPhase * 3.0 - uTime * 0.9);
            p.y += w * 0.035;
            vPulse = pow(0.5 + 0.5 * sin(aPhase * 2.0 - uTime * 1.6), 6.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = aSize * (1.0 + vPulse * 0.8) * uPixelRatio * (300.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uColor;
          uniform vec3 uAccent;
          uniform float uAppear;
          varying float vPulse;
          void main() {
            float a = pow(smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)), 1.6);
            gl_FragColor = vec4(mix(uColor, uAccent, vPulse * 0.6), a * (0.45 + vPulse * 0.5) * uAppear);
          }
        `}
      />
    </points>
  );
}

/** Corona: a soft, camera-facing radial glow behind the body. No hard edge, so
 *  it reads as light around the organism rather than a glass bubble. */
function Corona() {
  const ref = useRef<THREE.Mesh>(null);
  const appear = useAppear();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uPulse: { value: 0 }, uAppear: { value: 0 }, uInner: { value: 0.45 },
    uColor: { value: new THREE.Color('#ffae66') },
  }), []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPulse.value = U.uPulse.value;
    uniforms.uAppear.value = appear(delta);
    uniforms.uColor.value.copy(U.uColorGlow.value).lerp(U.uColorAccent.value, 0.3);
    const outer = organismState.boundRadius * 1.4;
    ref.current.scale.setScalar(outer);
    uniforms.uInner.value = (organismState.visScale * 0.95) / outer;
    ref.current.quaternion.copy(state.camera.quaternion);
  });

  return (
    <mesh ref={ref} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime; uniform float uPulse; uniform float uAppear; uniform float uInner; uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float r = length(vUv);
            float ang = atan(vUv.y, vUv.x);
            // streamers: slow angular modulation
            float rays = 0.75 + 0.25 * sin(ang * 7.0 + uTime * 0.15) * sin(ang * 3.0 - uTime * 0.11);
            float fall = smoothstep(1.0, uInner, r) ;
            float glow = pow(fall, 2.6) * rays;
            gl_FragColor = vec4(uColor, glow * (0.09 + uPulse * 0.05) * uAppear);
          }
        `}
      />
    </mesh>
  );
}

function makeTendrilCurve(rand: () => number, i: number) {
  const pts: THREE.Vector3[] = [];
  const baseAngle = (i / TENDRIL_COUNT) * Math.PI * 2 + rand() * 0.6;
  const lift = (rand() - 0.5) * 0.8;
  const curl = 1.0 + rand() * 1.0;
  for (let k = 0; k <= 8; k++) {
    const t = k / 8;
    const r = 0.85 + t * 1.6;
    const twist = baseAngle + t * curl;
    const y = lift * t + Math.sin(t * Math.PI * 1.3 + i) * 0.35 * t;
    pts.push(new THREE.Vector3(Math.cos(twist) * r, y, Math.sin(twist) * r));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** Energy filaments that stream out of the body and dissolve. */
function EnergyFilaments() {
  const ref = useRef<THREE.Group>(null);
  const seed = useGameStore((s) => s.genome.seed);
  const appear = useAppear();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAppear: { value: 0 },
    uColor: { value: new THREE.Color('#cfa8ff') },
    uAccent: { value: new THREE.Color('#ffc46b') },
  }), []);
  const geometries = useMemo(() => {
    const rand = mulberry32(subSeed(seed, 'tendrils'));
    return Array.from({ length: TENDRIL_COUNT }, (_, i) => new THREE.TubeGeometry(makeTendrilCurve(rand, i), 48, 0.022, 5, false));
  }, [seed]);

  useFrame((state, delta) => {
    if (!ref.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uAppear.value = appear(delta);
    uniforms.uColor.value.copy(U.uColorVein.value);
    uniforms.uAccent.value.copy(U.uColorAccent.value);
    ref.current.scale.setScalar(organismState.visScale);
    ref.current.rotation.y += delta * 0.12;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.21) * 0.1;
  });

  return (
    <group ref={ref}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g}>
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={uniforms}
            vertexShader={/* glsl */ `
              varying vec2 vUv;
              void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `}
            fragmentShader={/* glsl */ `
              uniform float uTime; uniform float uAppear; uniform vec3 uColor; uniform vec3 uAccent;
              varying vec2 vUv;
              void main() {
                float along = vUv.x;
                float flow = pow(0.5 + 0.5 * sin(along * 18.0 - uTime * 2.2), 4.0);
                float fade = smoothstep(0.0, 0.12, along) * (1.0 - smoothstep(0.55, 1.0, along));
                gl_FragColor = vec4(mix(uColor, uAccent, flow * 0.5), (0.12 + flow * 0.45) * fade * uAppear);
              }
            `}
          />
        </mesh>
      ))}
    </group>
  );
}

function AccretionDisc() {
  const ref = useRef<THREE.Mesh>(null);
  const appear = useAppear();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uAppear: { value: 0 },
    uColor: { value: new THREE.Color('#ff66cc') },
    uAccent: { value: new THREE.Color('#ffc46b') },
  }), []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uAppear.value = appear(delta);
    uniforms.uColor.value.copy(U.uColorGlow.value);
    uniforms.uAccent.value.copy(U.uColorAccent.value);
    const s = organismState.boundRadius * 0.82;
    ref.current.scale.set(s, s, 1);
    ref.current.rotation.z += delta * 0.12;
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2.9, 0.35, 0]}>
      <ringGeometry args={[1.0, 1.9, 160, 6]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={/* glsl */ `
          varying vec2 vP;
          void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `}
        fragmentShader={/* glsl */ `
          uniform float uTime; uniform float uAppear; uniform vec3 uColor; uniform vec3 uAccent;
          varying vec2 vP;
          void main() {
            float r = length(vP);
            float ang = atan(vP.y, vP.x);
            float spiral = 0.5 + 0.5 * sin(ang * 5.0 + uTime * 0.9 - r * 7.0);
            float fine = 0.5 + 0.5 * sin(ang * 23.0 - uTime * 1.7 + r * 30.0);
            float radial = smoothstep(1.0, 1.15, r) * (1.0 - smoothstep(1.35, 1.9, r));
            float a = (spiral * 0.55 + fine * 0.08 + 0.15) * radial;
            gl_FragColor = vec4(mix(uColor, uAccent, spiral * 0.4), a * 0.26 * uAppear);
          }
        `}
      />
    </mesh>
  );
}

export default function StageDecorations() {
  const stage = useGameStore((s) => s.stage);
  return (
    <group>
      {stage.ringEnabled && <LivingRing />}
      {stage.coronaEnabled && <Corona />}
      {stage.tendrilsEnabled && <EnergyFilaments />}
      {stage.discEnabled && <AccretionDisc />}
    </group>
  );
}
