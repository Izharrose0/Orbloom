import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three-stdlib';
import { useGameStore } from '../store/useGameStore';
import { sfxCollect } from '../audio/audio';

function makeStellatedGeometry(): THREE.BufferGeometry {
  // Base icosa, then push every original vertex outward to make smoothed spikes,
  // then compute smooth-ish normals.
  const g = new THREE.IcosahedronGeometry(0.7, 1);
  const pos = g.attributes.position;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    const r = tmp.length();
    // Push vertices whose direction snaps near original 12 verts a bit outward
    const k = Math.abs(tmp.x * tmp.y * tmp.z) * 5;
    tmp.normalize().multiplyScalar(r * (1 + Math.min(0.5, k)));
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

export type DriftersHandle = {
  triggerMeteorShower: () => void;
  spawnShape: (shape: ShapeKind) => void;
};

const MAX_DRIFTERS = 16;
const SPAWN_MIN = 5;
const SPAWN_MAX = 12;

type ShapeKind = 'icosa' | 'dodeca' | 'octa' | 'roundedBox' | 'cylinder' | 'stellated';

type Drifter = {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  size: number;
  life: number;
  spin: number;
  shape: ShapeKind;
  color: THREE.Color;
};

function spawn(d: Drifter) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const yJitter = (Math.random() - 0.5) * 4;
  const zJitter = (Math.random() - 0.5) * 3 - 1;
  d.pos.set(side * 12, yJitter, zJitter);
  const speed = 0.55 + Math.random() * 0.5;
  d.vel.set(-side * speed, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05);
  d.size = 0.22 + Math.random() * 0.22;
  d.life = 28;
  d.spin = (Math.random() - 0.5) * 1.2;
  // Pick a shape with probability across 6 kinds
  const r = Math.random();
  d.shape =
      r < 0.28 ? 'icosa'
    : r < 0.46 ? 'dodeca'
    : r < 0.6  ? 'octa'
    : r < 0.76 ? 'roundedBox'
    : r < 0.90 ? 'cylinder'
    :            'stellated';
  // Color: jewel-tones, biased toward cyan/violet/amber palette
  const hueRoll = Math.random();
  const hue = hueRoll < 0.5 ? 0.5 + Math.random() * 0.1 // cyan family
            : hueRoll < 0.8 ? 0.75 + Math.random() * 0.08 // violet
            :                 0.08 + Math.random() * 0.05; // amber
  d.color.setHSL(hue, 0.85, 0.62);
}

// Shared fresnel-glow shader for all drifters; per-instance uniforms via cloning material
const drifterVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const drifterFragment = /* glsl */ `
precision highp float;
uniform vec3  uColor;
uniform float uTime;
varying vec3 vN; varying vec3 vV; varying vec3 vLocal;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  float NdotV = max(dot(N, V), 0.0);
  float fres = pow(1.0 - NdotV, 2.2);

  // Inner gradient: darker core, bright skin
  vec3 core = uColor * 0.32;
  vec3 skin = uColor * 1.35;
  vec3 col = mix(core, skin, fres);

  // Soft inner pulse
  float pulse = 0.5 + 0.5 * sin(uTime * 1.8);
  col += uColor * 0.08 * pulse;

  // Edge sparkle
  col += vec3(0.9, 0.95, 1.0) * pow(fres, 6.0) * 0.6;

  gl_FragColor = vec4(col, 0.92);
}
`;

export default forwardRef<DriftersHandle, {}>(function Drifters(_, fwdRef) {
  const groupRef = useRef<THREE.Group>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const materials = useRef<THREE.ShaderMaterial[]>([]);

  const drifters = useMemo<Drifter[]>(
    () =>
      Array.from({ length: MAX_DRIFTERS }, () => ({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        size: 0.2,
        life: 0,
        spin: 0,
        shape: 'icosa' as ShapeKind,
        color: new THREE.Color(),
      })),
    []
  );

  // Pre-built geometries (shared across instances)
  const geometries = useMemo(
    () => ({
      icosa:      new THREE.IcosahedronGeometry(1, 3),
      dodeca:     new THREE.DodecahedronGeometry(1, 1),
      octa:       new THREE.OctahedronGeometry(1, 2),
      roundedBox: new RoundedBoxGeometry(1.3, 1.3, 1.3, 4, 0.28),
      cylinder:   new THREE.CylinderGeometry(0.65, 0.65, 1.4, 28, 1, false),
      stellated:  makeStellatedGeometry(),
    }),
    []
  );

  const nextSpawnRef = useRef<number>(2.5);
  const tRef = useRef(0);
  const meteorBurstRemaining = useRef(0);
  const meteorTimer = useRef(0);

  useImperativeHandle(fwdRef, () => ({
    triggerMeteorShower: () => {
      meteorBurstRemaining.current = 14;
      meteorTimer.current = 0;
    },
    spawnShape: (shape: ShapeKind) => {
      const slot = drifters.find((d) => !d.alive);
      if (!slot) return;
      spawn(slot);
      slot.shape = shape;
      const idx = drifters.indexOf(slot);
      applyDrifterToMesh(slot, idx);
    },
  }));

  useFrame((_, delta) => {
    tRef.current += delta;

    const evo = useGameStore.getState().evolution;
    const cadenceMul = Math.max(0.45, 1 - evo * 0.05);
    if (tRef.current >= nextSpawnRef.current) {
      const slot = drifters.find((d) => !d.alive);
      if (slot) {
        spawn(slot);
        applyDrifterToMesh(slot, drifters.indexOf(slot));
      }
      nextSpawnRef.current =
        tRef.current + (SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)) * cadenceMul;
    }

    if (meteorBurstRemaining.current > 0) {
      meteorTimer.current -= delta;
      if (meteorTimer.current <= 0) {
        const slot = drifters.find((d) => !d.alive);
        if (slot) {
          spawn(slot);
          slot.vel.multiplyScalar(2.4);
          slot.size *= 0.7;
          applyDrifterToMesh(slot, drifters.indexOf(slot));
        }
        meteorBurstRemaining.current -= 1;
        meteorTimer.current = 0.18 + Math.random() * 0.18;
      }
    }

    drifters.forEach((d, i) => {
      const m = meshes.current[i];
      const mat = materials.current[i];
      if (!m) return;
      if (!d.alive) {
        m.visible = false;
        return;
      }
      m.visible = true;

      d.life -= delta;
      d.pos.addScaledVector(d.vel, delta);

      const toCenter = new THREE.Vector3().copy(d.pos).multiplyScalar(-1);
      const r = toCenter.length();
      toCenter.normalize().multiplyScalar(0.18 / Math.max(0.6, r * r));
      d.vel.addScaledVector(toCenter, delta);

      m.position.copy(d.pos);
      m.rotation.x += delta * d.spin;
      m.rotation.y += delta * d.spin * 0.7;
      const pulse = 1 + 0.08 * Math.sin(tRef.current * 4 + i);
      m.scale.setScalar(d.size * pulse);

      if (mat) {
        mat.uniforms.uTime.value = tRef.current + i * 0.7;
      }

      if (r < 1.25) {
        d.alive = false;
        useGameStore.getState().collectDrifter(6);
        sfxCollect();
      }

      if (d.life <= 0 || Math.abs(d.pos.x) > 16) {
        d.alive = false;
      }
    });
  });

  const applyDrifterToMesh = (d: Drifter, idx: number) => {
    const m = meshes.current[idx];
    const mat = materials.current[idx];
    if (m) {
      m.geometry = geometries[d.shape];
    }
    if (mat) {
      mat.uniforms.uColor.value.copy(d.color);
    }
  };

  const handleClick = (idx: number) => (e: any) => {
    e.stopPropagation();
    const d = drifters[idx];
    if (!d.alive) return;
    d.alive = false;
    useGameStore.getState().collectDrifter(10);
    sfxCollect();
  };

  return (
    <group ref={groupRef}>
      {drifters.map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) meshes.current[i] = el;
          }}
          geometry={geometries.icosa}
          visible={false}
          onPointerDown={handleClick(i)}
        >
          <shaderMaterial
            ref={(el) => {
              if (el) materials.current[i] = el;
            }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            vertexShader={drifterVertex}
            fragmentShader={drifterFragment}
            uniforms={{
              uColor: { value: new THREE.Color('#7df3ff') },
              uTime:  { value: 0 },
            }}
          />
        </mesh>
      ))}
    </group>
  );
});
