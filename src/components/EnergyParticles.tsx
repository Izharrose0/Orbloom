import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { sfxTap, startAmbient } from '../audio/audio';

const MAX_PARTICLES = 1600;

type Particle = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
};

export default function EnergyParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const { gl, camera, size, raycaster } = useThree();

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: MAX_PARTICLES }, () => ({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
      })),
    []
  );

  const positions = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const colors = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const sizes = useMemo(() => new Float32Array(MAX_PARTICLES), []);

  const tmpPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const tmpVec = useMemo(() => new THREE.Vector3(), []);

  const burst = (worldPoint: THREE.Vector3) => {
    const evo = useGameStore.getState().evolution;
    const wantedCount = 30 + Math.floor(evo * 14) + Math.floor(Math.random() * 18);
    let spawned = 0;
    for (let i = 0; i < particles.length && spawned < wantedCount; i++) {
      const p = particles[i];
      if (p.active) continue;
      p.active = true;
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      );
      p.pos.copy(worldPoint).add(jitter);
      p.vel
        .set(0, 0, 0)
        .subVectors(new THREE.Vector3(0, 0, 0), p.pos)
        .normalize()
        .multiplyScalar(0.6 + Math.random() * 0.7)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.7,
            (Math.random() - 0.5) * 0.7,
            (Math.random() - 0.5) * 0.7
          )
        );
      p.maxLife = 1.3 + Math.random() * 1.1;
      p.life = p.maxLife;
      p.size = 0.04 + Math.random() * 0.08 + evo * 0.012;
      spawned++;
    }
  };

  // Tap vs drag detection
  const downStateRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  const onPointerDown = (event: PointerEvent) => {
    downStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      t: performance.now(),
      id: event.pointerId,
    };
  };

  const onPointerUp = (event: PointerEvent) => {
    const d = downStateRef.current;
    downStateRef.current = null;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - d.t;
    if (dist > 8 || dt > 400) return; // it was a drag/orbit, not a tap

    const x = (event.clientX / size.width) * 2 - 1;
    const y = -(event.clientY / size.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const planeNormal = camera.position.clone().normalize();
    tmpPlane.set(planeNormal, 0);
    raycaster.ray.intersectPlane(tmpPlane, tmpVec);
    if (!isFinite(tmpVec.x)) return;
    tmpVec.normalize().multiplyScalar(3.5);

    burst(tmpVec);
    useGameStore.getState().absorbEnergy(1);
    startAmbient();
    sfxTap();
  };

  useEffect(() => {
    const dom = gl.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', () => (downStateRef.current = null));
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, size.width, size.height]);

  useFrame((_, delta) => {
    let writeIdx = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) {
        positions[writeIdx * 3] = 9999;
        positions[writeIdx * 3 + 1] = 9999;
        positions[writeIdx * 3 + 2] = 9999;
        sizes[writeIdx] = 0;
        writeIdx++;
        continue;
      }
      const toCenter = p.pos.clone().multiplyScalar(-1);
      const dist = toCenter.length();
      toCenter.normalize().multiplyScalar(2.4 + 3.0 / Math.max(0.4, dist));
      p.vel.addScaledVector(toCenter, delta);
      p.vel.multiplyScalar(0.985);
      p.pos.addScaledVector(p.vel, delta);
      p.life -= delta;

      if (dist < 1.05 || p.life <= 0) p.active = false;

      const lifeRatio = Math.max(0, p.life / p.maxLife);
      positions[writeIdx * 3] = p.pos.x;
      positions[writeIdx * 3 + 1] = p.pos.y;
      positions[writeIdx * 3 + 2] = p.pos.z;
      sizes[writeIdx] = p.size * (0.4 + lifeRatio);
      const t = 1 - Math.min(1, dist / 4);
      colors[writeIdx * 3] = 0.5 + t * 0.4;
      colors[writeIdx * 3 + 1] = 0.9 - t * 0.4;
      colors[writeIdx * 3 + 2] = 1.0;
      writeIdx++;
    }

    const geom = pointsRef.current?.geometry as THREE.BufferGeometry | undefined;
    if (geom) {
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          attribute float aSize;
          varying vec3 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (320.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={/* glsl */ `
          varying vec3 vColor;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float a = smoothstep(0.5, 0.0, d);
            a = pow(a, 1.6);
            gl_FragColor = vec4(vColor, a);
          }
        `}
        vertexColors
      />
    </points>
  );
}
