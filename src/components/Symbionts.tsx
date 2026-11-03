// LEVEL 3 — satellite structures. From Singularity on (and with "symbiont"
// epoch mutations) fragments detach and orbit the organism on seeded, inclined
// orbits, tethered by faint light. Their pulse lags the body's breath, so they
// read as separate living things in symbiosis rather than decorations.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { mulberry32, subSeed } from '../lib/rng';
import { organismState, U } from '../systems/organism';
import { simplexNoise3D } from '../shaders/noise';

const MAX_SYMBIONTS = 6;

const symVertex = /* glsl */ `
uniform float uTime;
uniform float uPhase;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
${simplexNoise3D}
void main() {
  vec3 n = normalize(normal);
  float d = snoise(position * 2.2 + vec3(uTime * 0.2 + uPhase)) * 0.18 + sin(uTime * 0.8 + uPhase) * 0.04;
  vec3 p = position + n * d;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vN = normalize(mat3(modelMatrix) * n);
  vV = normalize(cameraPosition - wp.xyz);
  vP = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const symFragment = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uAppear;
uniform vec3 uGlow; uniform vec3 uAccent; uniform vec3 uDeep;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  float ndv = max(dot(normalize(vN), normalize(vV)), 0.0);
  float fres = pow(1.0 - ndv, 2.5);
  float beat = 0.5 + 0.5 * sin(uTime * 0.55 - uPhase);
  vec3 col = uDeep * 1.5 + uAccent * (0.25 + 0.35 * beat) * ndv + uGlow * fres * 0.9;
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, uAppear);
}
`;

type Orbit = { radius: number; speed: number; tilt: THREE.Quaternion; phase: number; size: number };

export default function Symbionts() {
  const seed = useGameStore((s) => s.genome.seed);
  const groupRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const tetherRef = useRef<THREE.LineSegments>(null);

  const orbits = useMemo<Orbit[]>(() => {
    const rand = mulberry32(subSeed(seed, 'symbionts'));
    return Array.from({ length: MAX_SYMBIONTS }, (_, i) => {
      const axis = new THREE.Vector3(rand() - 0.5, 1.5, rand() - 0.5).normalize();
      return {
        radius: 1.65 + i * 0.32 + rand() * 0.25,
        speed: (0.16 + rand() * 0.12) * (rand() < 0.3 ? -1 : 1) / (1 + i * 0.25),
        tilt: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis),
        phase: rand() * Math.PI * 2,
        size: 0.12 + rand() * 0.08,
      };
    });
  }, [seed]);

  const materials = useMemo(() => orbits.map((o) => new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uPhase: { value: o.phase }, uAppear: { value: 0 },
      uGlow: U.uColorGlow, uAccent: U.uColorAccent, uDeep: U.uColorDeep,
    },
    vertexShader: symVertex,
    fragmentShader: symFragment,
    transparent: true,
  })), [orbits]);

  const tetherGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SYMBIONTS * 6), 3));
    return g;
  }, []);
  const tetherMat = useMemo(() => new THREE.LineBasicMaterial({ transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const appear = useRef(new Float32Array(MAX_SYMBIONTS));

  useFrame((_, delta) => {
    const count = organismState.morph?.symbionts ?? 0;
    const vis = organismState.visScale;
    const t = U.uTime.value;
    const pos = tetherGeom.attributes.position as THREE.BufferAttribute;
    let anyVisible = false;
    orbits.forEach((o, i) => {
      const m = meshRefs.current[i];
      if (!m) return;
      const target = i < count ? 1 : 0;
      appear.current[i] += (target - appear.current[i]) * Math.min(1, delta * 0.4);
      const a = appear.current[i];
      m.visible = a > 0.01;
      materials[i].uniforms.uAppear.value = a;
      if (!m.visible) {
        pos.setXYZ(i * 2, 0, 0, 0); pos.setXYZ(i * 2 + 1, 0, 0, 0);
        return;
      }
      anyVisible = true;
      const ang = o.phase + t * o.speed;
      // drift out from the body as it detaches
      const r = vis * (1.0 + (o.radius - 1.0) * a);
      tmp.set(Math.cos(ang) * r, Math.sin(t * 0.3 + o.phase) * 0.15 * vis, Math.sin(ang) * r).applyQuaternion(o.tilt);
      m.position.copy(tmp);
      m.scale.setScalar(vis * o.size * (0.4 + 0.6 * a) * (1 + 0.05 * Math.sin(t * 0.55 - o.phase)));
      m.rotation.y += delta * 0.3;
      // tether: from the body surface toward the symbiont
      pos.setXYZ(i * 2, tmp.x * (vis * 1.05 / r), tmp.y * (vis * 1.05 / r), tmp.z * (vis * 1.05 / r));
      pos.setXYZ(i * 2 + 1, tmp.x * 0.92, tmp.y * 0.92, tmp.z * 0.92);
    });
    pos.needsUpdate = true;
    tetherMat.color.copy(U.uColorGlow.value);
    tetherMat.opacity = anyVisible ? 0.12 + 0.06 * Math.sin(t * 0.8) : 0;
    if (tetherRef.current) tetherRef.current.visible = anyVisible;
  });

  return (
    <group ref={groupRef}>
      {orbits.map((_, i) => (
        <mesh key={i} ref={(el) => { meshRefs.current[i] = el; }} material={materials[i]} visible={false}>
          <icosahedronGeometry args={[1, 3]} />
        </mesh>
      ))}
      <lineSegments ref={tetherRef} geometry={tetherGeom} material={tetherMat} frustumCulled={false} />
    </group>
  );
}
