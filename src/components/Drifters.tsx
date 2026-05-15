import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { sfxCollect } from '../audio/audio';

export type DriftersHandle = {
  triggerMeteorShower: () => void;
};

const MAX_DRIFTERS = 16;
const SPAWN_MIN = 5;
const SPAWN_MAX = 12;

type Drifter = {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hue: number;
  size: number;
  life: number;
  spin: number;
};

function spawn(d: Drifter) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const yJitter = (Math.random() - 0.5) * 4;
  const zJitter = (Math.random() - 0.5) * 3 - 1;
  d.pos.set(side * 12, yJitter, zJitter);
  const speed = 0.55 + Math.random() * 0.5;
  d.vel.set(-side * speed, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05);
  d.hue = Math.random();
  d.size = 0.18 + Math.random() * 0.22;
  d.life = 28;
  d.spin = (Math.random() - 0.5) * 1.2;
  d.alive = true;
}

export default forwardRef<DriftersHandle, {}>(function Drifters(_, fwdRef) {
  const groupRef = useRef<THREE.Group>(null);
  const meshes = useRef<THREE.Mesh[]>([]);

  const drifters = useMemo<Drifter[]>(
    () =>
      Array.from({ length: MAX_DRIFTERS }, () => ({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        hue: 0,
        size: 0.2,
        life: 0,
        spin: 0,
      })),
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
  }));

  useFrame((_, delta) => {
    tRef.current += delta;

    // Spawn cadence (slightly faster as evolution grows)
    const evo = useGameStore.getState().evolution;
    const cadenceMul = Math.max(0.45, 1 - evo * 0.05);
    if (tRef.current >= nextSpawnRef.current) {
      const slot = drifters.find((d) => !d.alive);
      if (slot) spawn(slot);
      nextSpawnRef.current =
        tRef.current + (SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)) * cadenceMul;
    }

    // Meteor burst
    if (meteorBurstRemaining.current > 0) {
      meteorTimer.current -= delta;
      if (meteorTimer.current <= 0) {
        const slot = drifters.find((d) => !d.alive);
        if (slot) {
          spawn(slot);
          // make meteors faster
          slot.vel.multiplyScalar(2.4);
          slot.size *= 0.7;
        }
        meteorBurstRemaining.current -= 1;
        meteorTimer.current = 0.18 + Math.random() * 0.18;
      }
    }

    drifters.forEach((d, i) => {
      const m = meshes.current[i];
      if (!m) return;
      if (!d.alive) {
        m.visible = false;
        return;
      }
      m.visible = true;

      d.life -= delta;
      d.pos.addScaledVector(d.vel, delta);

      // Slight gravitational lure toward orb
      const toCenter = new THREE.Vector3().copy(d.pos).multiplyScalar(-1);
      const r = toCenter.length();
      toCenter.normalize().multiplyScalar(0.18 / Math.max(0.6, r * r));
      d.vel.addScaledVector(toCenter, delta);

      m.position.copy(d.pos);
      m.rotation.x += delta * d.spin;
      m.rotation.y += delta * d.spin * 0.7;
      const pulse = 1 + 0.08 * Math.sin(tRef.current * 4 + i);
      m.scale.setScalar(d.size * pulse);

      // Auto-collect if it touches the orb
      if (r < 1.25) {
        d.alive = false;
        useGameStore.getState().collectDrifter(6);
        sfxCollect();
      }

      // Despawn if too far / expired
      if (d.life <= 0 || Math.abs(d.pos.x) > 16) {
        d.alive = false;
      }
    });
  });

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
          visible={false}
          onPointerDown={handleClick(i)}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={new THREE.Color().setHSL(0.55 + Math.random() * 0.3, 0.85, 0.6)}
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
});
