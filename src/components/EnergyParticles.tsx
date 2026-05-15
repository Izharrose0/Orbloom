import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';

const MAX_PARTICLES = 800;

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
    let spawned = 0;
    const wantedCount = 28 + Math.floor(Math.random() * 12);
    for (let i = 0; i < particles.length && spawned < wantedCount; i++) {
      const p = particles[i];
      if (p.active) continue;
      p.active = true;
      const jitter = new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.4
      );
      p.pos.copy(worldPoint).add(jitter);
      p.vel
        .set(0, 0, 0)
        .subVectors(new THREE.Vector3(0, 0, 0), p.pos)
        .normalize()
        .multiplyScalar(0.6 + Math.random() * 0.6)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.6,
            (Math.random() - 0.5) * 0.6
          )
        );
      p.maxLife = 1.4 + Math.random() * 0.9;
      p.life = p.maxLife;
      p.size = 0.04 + Math.random() * 0.06;
      spawned++;
    }
  };

  // Pointer/tap handling at canvas level
  const handleDown = (event: PointerEvent) => {
    const x = (event.clientX / size.width) * 2 - 1;
    const y = -(event.clientY / size.height) * 2 + 1;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    // Plane through origin facing camera
    const planeNormal = camera.position.clone().normalize();
    tmpPlane.set(planeNormal, 0);
    raycaster.ray.intersectPlane(tmpPlane, tmpVec);
    if (!isFinite(tmpVec.x)) return;
    // push outward a bit so particles fly inward toward orb
    tmpVec.normalize().multiplyScalar(3.5);
    burst(tmpVec);
    useGameStore.getState().absorbEnergy(1);
  };

  // Attach native handler for full-canvas reactivity (incl. mobile touch)
  useEffect(() => {
    const dom = gl.domElement;
    dom.addEventListener('pointerdown', handleDown);
    return () => dom.removeEventListener('pointerdown', handleDown);
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
      // attraction toward origin (sphere center)
      const toCenter = p.pos.clone().multiplyScalar(-1);
      const dist = toCenter.length();
      toCenter.normalize().multiplyScalar(2.4 + (3.0 / Math.max(0.4, dist)));
      p.vel.addScaledVector(toCenter, delta);
      p.vel.multiplyScalar(0.985);
      p.pos.addScaledVector(p.vel, delta);
      p.life -= delta;

      if (dist < 1.05 || p.life <= 0) {
        p.active = false;
      }

      const lifeRatio = Math.max(0, p.life / p.maxLife);
      positions[writeIdx * 3] = p.pos.x;
      positions[writeIdx * 3 + 1] = p.pos.y;
      positions[writeIdx * 3 + 2] = p.pos.z;
      sizes[writeIdx] = p.size * (0.4 + lifeRatio);
      // color shifts cyan->purple as it nears center
      const t = 1 - Math.min(1, dist / 4);
      colors[writeIdx * 3] = 0.5 + t * 0.4;       // r
      colors[writeIdx * 3 + 1] = 0.9 - t * 0.4;   // g
      colors[writeIdx * 3 + 2] = 1.0;             // b
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
