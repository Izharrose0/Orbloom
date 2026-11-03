// Cosmic phenomena: how events are *seen*. Ambient phenomena are pure
// atmosphere; interactive events get a diegetic signature (resonance rings,
// a quasar beacon, a dividing twin) so the world communicates the event before
// any text does. All effects are temporary presentation (never persisted).

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { organismState, U } from './organism';

import { phenomena } from './fx';
export type { PhenomenonKind } from './fx';

const softPointFrag = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.0, d), 1.8);
  gl_FragColor = vec4(uColor, a * vA);
}
`;

function dirFromSeed(seed: number, out = new THREE.Vector3()) {
  const a = seed * Math.PI * 2;
  const z = (seed * 7.31) % 1 * 1.2 - 0.6;
  const r = Math.sqrt(1 - z * z);
  return out.set(r * Math.cos(a), z, r * Math.sin(a)).normalize();
}

// ---------------- comet: a long streak crossing the far sky ----------------
const COMET_PTS = 48;
function Comet() {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => ({ pos: new Float32Array(COMET_PTS * 3), a: new Float32Array(COMET_PTS), size: new Float32Array(COMET_PTS) }), []);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#dff4ff') }, uPixelRatio: { value: 1 } }), []);
  const v = useMemo(() => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), p: new THREE.Vector3() }), []);
  useFrame((state) => {
    const p = phenomena.progress('comet');
    if (!ref.current) return;
    ref.current.visible = p >= 0 && p <= 1;
    if (!ref.current.visible) return;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    const seed = phenomena.active!.seed;
    dirFromSeed(seed, v.from).multiplyScalar(170);
    dirFromSeed((seed + 0.37) % 1, v.to).multiplyScalar(170);
    for (let i = 0; i < COMET_PTS; i++) {
      const t = THREE.MathUtils.clamp(p * 1.3 - i * 0.0045, 0, 1);
      v.p.copy(v.from).lerp(v.to, t).setLength(170);
      data.pos.set([v.p.x, v.p.y, v.p.z], i * 3);
      const fade = Math.sin(Math.PI * Math.min(1, p * 1.1));
      data.a[i] = (1 - i / COMET_PTS) * fade * (i === 0 ? 1 : 0.55);
      data.size[i] = (i === 0 ? 7 : 4.5 * (1 - i / COMET_PTS)) * uniforms.uPixelRatio.value;
    }
    const g = ref.current.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aA.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
  });
  return (
    <points ref={ref} visible={false} frustumCulled={false} renderOrder={-8}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
        <bufferAttribute attach="attributes-aA" args={[data.a, 1]} />
        <bufferAttribute attach="attributes-aSize" args={[data.size, 1]} />
      </bufferGeometry>
      <shaderMaterial transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `attribute float aA; attribute float aSize; varying float vA;
          void main(){ vA = aA; gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={softPointFrag} />
    </points>
  );
}

// ---------------- stellar wind: streams of dust flowing past ----------------
const WIND_PTS = 160;
function StellarWind() {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const base = new Float32Array(WIND_PTS * 3);
    for (let i = 0; i < WIND_PTS; i++) base.set([(Math.random() - 0.5) * 2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2], i * 3);
    return { base, pos: new Float32Array(WIND_PTS * 3), off: Float32Array.from({ length: WIND_PTS }, () => Math.random()) };
  }, []);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#9fc4ff') }, uPixelRatio: { value: 1 }, uFade: { value: 0 } }), []);
  const white = useMemo(() => new THREE.Color(1, 1, 1), []);
  useFrame((state) => {
    const p = phenomena.progress('stellarWind');
    if (!ref.current) return;
    ref.current.visible = p >= 0 && p <= 1;
    if (!ref.current.visible) return;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uFade.value = Math.sin(Math.PI * Math.min(1, p)) * 0.8;
    uniforms.uColor.value.copy(U.uColorGlow.value).lerp(white, 0.5);
    const R = organismState.boundRadius * 3.2;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < WIND_PTS; i++) {
      const x = ((data.off[i] + t * 0.09) % 1) * 2 - 1;
      data.pos[i * 3] = x * R * 1.6;
      data.pos[i * 3 + 1] = data.base[i * 3 + 1] * R + Math.sin(x * 3 + i) * 0.3;
      data.pos[i * 3 + 2] = data.base[i * 3 + 2] * R;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    // the organism leans into it: a soft continuous shiver of its growths
    U.uAbsorb.value = Math.max(U.uAbsorb.value, 0.12 * uniforms.uFade.value);
  });
  return (
    <points ref={ref} visible={false} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.pos, 3]} /></bufferGeometry>
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `uniform float uPixelRatio; uniform float uFade; varying float vA;
          void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vA = uFade * 0.5; gl_PointSize = uPixelRatio * 120.0 / -mv.z; gl_Position = projectionMatrix * mv; }`}
        fragmentShader={softPointFrag} />
    </points>
  );
}

// ---------------- aurora veil: curtains of light around the organism ----------------
function AuroraVeil() {
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uFade: { value: 0 } }), []);
  useFrame((state) => {
    const p = phenomena.progress('aurora');
    if (!ref.current) return;
    ref.current.visible = p >= 0 && p <= 1;
    if (!ref.current.visible) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uFade.value = Math.sin(Math.PI * Math.min(1, p));
    const R = organismState.boundRadius * 1.9;
    ref.current.scale.set(R, R * 0.7, R);
    ref.current.rotation.y += 0.001;
  });
  return (
    <mesh ref={ref} visible={false}>
      <cylinderGeometry args={[1, 1, 1, 96, 1, true]} />
      <shaderMaterial transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={/* glsl */ `uniform float uTime; uniform float uFade; varying vec2 vUv;
          void main(){
            float x = vUv.x * 6.2831;
            float folds = 0.5 + 0.5 * sin(x * 7.0 + sin(x * 3.0 + uTime * 0.3) * 2.0 + uTime * 0.2);
            float rays = pow(0.5 + 0.5 * sin(x * 41.0 + uTime * 0.5), 3.0);
            float v = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
            vec3 col = mix(vec3(0.25, 1.0, 0.6), vec3(0.85, 0.35, 1.0), vUv.y);
            gl_FragColor = vec4(col, (folds * 0.6 + rays * 0.4) * v * 0.18 * uFade);
          }`} />
    </mesh>
  );
}

// ---------------- supernova: a distant star flares and leaves a remnant ----------------
function Supernova() {
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uP: { value: 0 } }), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const p = phenomena.progress('supernova');
    if (!ref.current) return;
    ref.current.visible = p >= 0 && p <= 1;
    if (!ref.current.visible) return;
    uniforms.uP.value = p;
    dirFromSeed(phenomena.active!.seed, dir).multiplyScalar(260);
    ref.current.position.copy(dir);
    ref.current.quaternion.copy(state.camera.quaternion);
    ref.current.scale.setScalar(26);
  });
  return (
    <mesh ref={ref} visible={false} renderOrder={-8}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={/* glsl */ `uniform float uP; varying vec2 vUv;
          void main(){
            float r = length(vUv);
            float flash = exp(-uP * 6.0) * smoothstep(0.0, 0.03, uP);
            float core = exp(-r * r * mix(400.0, 80.0, flash)) * (0.4 + flash * 3.0);
            float shell = exp(-pow((r - uP * 0.8) * 14.0, 2.0)) * (1.0 - uP) * 0.5;
            float spikes = pow(max(0.0, 1.0 - abs(vUv.x) * 40.0), 2.0) + pow(max(0.0, 1.0 - abs(vUv.y) * 40.0), 2.0);
            spikes *= exp(-r * 3.0) * flash;
            vec3 col = mix(vec3(1.0, 0.75, 0.55), vec3(0.6, 0.8, 1.0), r * 1.5);
            float fade = 1.0 - smoothstep(0.85, 1.0, uP);
            gl_FragColor = vec4(col, (core + shell + spikes) * fade);
          }`} />
    </mesh>
  );
}

// ---------------- leviathan: something vast swims through the far nebula ----------------
const LEV_PTS = 420;
function Leviathan() {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => ({
    pos: new Float32Array(LEV_PTS * 3),
    u: Float32Array.from({ length: LEV_PTS }, (_, i) => i / LEV_PTS),
    side: Float32Array.from({ length: LEV_PTS }, () => Math.random() * 2 - 1),
  }), []);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#9db8ff') }, uPixelRatio: { value: 1 }, uFade: { value: 0 } }), []);
  const v = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), p: new THREE.Vector3(), side: new THREE.Vector3() }), []);
  useFrame((state) => {
    const p = phenomena.progress('leviathan');
    if (!ref.current) return;
    ref.current.visible = p >= 0 && p <= 1;
    if (!ref.current.visible) return;
    uniforms.uPixelRatio.value = state.gl.getPixelRatio();
    uniforms.uFade.value = Math.sin(Math.PI * Math.min(1, p)) * 0.55;
    const seed = phenomena.active!.seed;
    dirFromSeed(seed, v.a);
    dirFromSeed((seed + 0.21) % 1, v.b);
    const t = state.clock.elapsedTime;
    for (let i = 0; i < LEV_PTS; i++) {
      const u = data.u[i];
      // head leads; body trails along the great arc
      const along = THREE.MathUtils.clamp(p * 1.4 - u * 0.35, 0, 1);
      v.p.copy(v.a).lerp(v.b, along).normalize();
      v.side.crossVectors(v.p, v.up).normalize();
      const width = Math.sin(Math.PI * Math.min(1, u * 1.3)) * 0.06 * (1 + 0.6 * Math.sin(u * 20.0));
      const undulate = Math.sin(u * 9 - t * 0.6) * 0.03;
      v.p.addScaledVector(v.side, data.side[i] * width).addScaledVector(v.up, undulate).normalize().multiplyScalar(230);
      data.pos.set([v.p.x, v.p.y, v.p.z], i * 3);
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={ref} visible={false} frustumCulled={false} renderOrder={-8}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.pos, 3]} /></bufferGeometry>
      <shaderMaterial transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `uniform float uPixelRatio; uniform float uFade; varying float vA;
          void main(){ vA = uFade; gl_PointSize = 9.0 * uPixelRatio; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={softPointFrag} />
    </points>
  );
}

// ---------------- resonance: rings of sound expanding from the body ----------------
function ResonanceRings() {
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uFade: { value: 0 }, uInner: { value: 0.3 }, uColor: U.uColorGlow }), []);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const on = useGameStore.getState().activeEvent === 'resonance';
    uniforms.uFade.value += ((on ? 1 : 0) - uniforms.uFade.value) * Math.min(1, delta * 1.5);
    ref.current.visible = uniforms.uFade.value > 0.01;
    if (!ref.current.visible) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    const outer = organismState.boundRadius * 2.6;
    ref.current.scale.setScalar(outer);
    uniforms.uInner.value = organismState.visScale / outer;
    ref.current.quaternion.copy(state.camera.quaternion);
  });
  return (
    <mesh ref={ref} visible={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={/* glsl */ `uniform float uTime; uniform float uFade; uniform float uInner; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            float r = length(vUv);
            float ph = fract(uTime / 1.4);                       // one ring every 1.4 s — a rhythm to answer
            float ringR = mix(uInner, 1.0, ph);
            float ring = exp(-pow((r - ringR) * 40.0, 2.0)) * (1.0 - ph);
            float ph2 = fract(uTime / 1.4 + 0.5);
            ring += exp(-pow((r - mix(uInner, 1.0, ph2)) * 40.0, 2.0)) * (1.0 - ph2) * 0.5;
            gl_FragColor = vec4(uColor, ring * 0.5 * uFade * step(uInner, r));
          }`} />
    </mesh>
  );
}

// ---------------- quasar: a distant beacon with jets ----------------
function QuasarBeacon() {
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uFade: { value: 0 } }), []);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const on = useGameStore.getState().activeEvent === 'quasar';
    uniforms.uFade.value += ((on ? 1 : 0) - uniforms.uFade.value) * Math.min(1, delta * 0.8);
    ref.current.visible = uniforms.uFade.value > 0.01;
    if (!ref.current.visible) return;
    uniforms.uTime.value = state.clock.elapsedTime;
    ref.current.position.set(-150, 40, -120);
    ref.current.quaternion.copy(state.camera.quaternion);
    ref.current.scale.setScalar(30);
  });
  return (
    <mesh ref={ref} visible={false} renderOrder={-8}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`}
        fragmentShader={/* glsl */ `uniform float uTime; uniform float uFade; varying vec2 vUv;
          void main(){
            vec2 p = vUv;
            float c = cos(0.6), s = sin(0.6);
            p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
            float core = exp(-dot(p, p) * 220.0) * (1.2 + 0.3 * sin(uTime * 7.0));
            float jet = exp(-p.x * p.x * 900.0) * exp(-abs(p.y) * 2.2) * (0.6 + 0.4 * sin(abs(p.y) * 30.0 - uTime * 6.0));
            float halo = exp(-length(p) * 9.0) * 0.25;
            vec3 col = mix(vec3(0.75, 0.9, 1.0), vec3(1.0, 0.85, 0.6), halo * 2.0);
            gl_FragColor = vec4(col, (core + jet * 0.5 + halo) * uFade);
          }`} />
    </mesh>
  );
}

// ---------------- twinning: a ghost of the organism separates and returns ----------------
function TwinGhost() {
  const ref = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({ uFade: { value: 0 }, uColor: U.uColorGlow, uAccent: U.uColorAccent }), []);
  const live = useRef({ startedAt: -1 });
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const s = useGameStore.getState();
    const on = s.activeEvent === 'twinning';
    if (on && live.current.startedAt < 0) live.current.startedAt = state.clock.elapsedTime;
    if (!on) live.current.startedAt = -1;
    const p = on ? (state.clock.elapsedTime - live.current.startedAt) / 6 : 1;
    const bell = on ? Math.sin(Math.PI * Math.min(1, p)) : 0;
    uniforms.uFade.value = bell;
    m.visible = bell > 0.01;
    const body = organismState.root?.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
    if (!m.visible || !body || !organismState.root) return;
    m.geometry = body.geometry;
    const vis = organismState.visScale;
    m.scale.setScalar(vis * (0.9 + 0.1 * bell));
    m.quaternion.copy(organismState.root.quaternion);
    m.position.set(Math.sin(p * Math.PI) * vis * 1.9, Math.sin(p * Math.PI * 2) * vis * 0.2, 0);
  });
  return (
    <mesh ref={ref} visible={false}>
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={uniforms}
        vertexShader={/* glsl */ `varying vec3 vN; varying vec3 vV;
          void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position,1.0);
            vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }`}
        fragmentShader={/* glsl */ `uniform float uFade; uniform vec3 uColor; uniform vec3 uAccent; varying vec3 vN; varying vec3 vV;
          void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
            gl_FragColor = vec4(mix(uColor, uAccent, f), (0.08 + f * 0.6) * uFade); }`} />
    </mesh>
  );
}

export default function EventPhenomena() {
  useFrame(() => {
    const a = phenomena.active;
    if (a && performance.now() / 1000 - a.start > a.dur) phenomena.active = null;
  });
  return (
    <group>
      <Comet />
      <StellarWind />
      <AuroraVeil />
      <Supernova />
      <Leviathan />
      <ResonanceRings />
      <QuasarBeacon />
      <TwinGhost />
    </group>
  );
}
