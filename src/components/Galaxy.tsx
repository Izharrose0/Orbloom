import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COLOR_CORE = new THREE.Color('#ffd9a8');
const COLOR_ARM = new THREE.Color('#7a8cff');
const COLOR_OUTER = new THREE.Color('#3a1a6e');

function buildSpiralGeometry(count: number, radius: number, arms = 4, randomness = 0.42) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = Math.pow(Math.random(), 1.5) * radius;
    const arm = (i % arms) / arms;
    const branchAngle = arm * Math.PI * 2;
    const spinAngle = r * 0.16;
    const rx = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;
    const ry = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r * 0.18;
    const rz = Math.pow(Math.random(), 2.6) * (Math.random() < 0.5 ? 1 : -1) * randomness * r;
    positions[i3]     = Math.cos(branchAngle + spinAngle) * r + rx;
    positions[i3 + 1] = ry;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rz;

    const tCore = Math.max(0, 1 - r / radius);
    tmp.copy(COLOR_OUTER).lerp(COLOR_ARM, tCore);
    tmp.lerp(COLOR_CORE, Math.pow(tCore, 3));
    colors[i3] = tmp.r; colors[i3 + 1] = tmp.g; colors[i3 + 2] = tmp.b;
    sizes[i] = 0.04 + Math.random() * 0.10 + tCore * 0.18;
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  return g;
}

export default function Galaxy() {
  const farRef = useRef<THREE.Points>(null);
  const midRef = useRef<THREE.Points>(null);
  const nearRef = useRef<THREE.Points>(null);

  const farGeo = useMemo(() => buildSpiralGeometry(5000, 38), []);
  const midGeo = useMemo(() => buildSpiralGeometry(3500, 28, 5), []);
  const nearGeo = useMemo(() => buildSpiralGeometry(1800, 18, 3, 0.55), []);

  const mat = (intensity: number) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (260.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(c));
          a = pow(a, 1.4);
          gl_FragColor = vec4(vColor * ${intensity.toFixed(2)}, a * ${intensity.toFixed(2)});
        }
      `,
    });

  const farMat = useMemo(() => mat(0.55), []);
  const midMat = useMemo(() => mat(0.85), []);
  const nearMat = useMemo(() => mat(1.0), []);

  useFrame((_, delta) => {
    if (farRef.current) farRef.current.rotation.y += delta * 0.004;
    if (midRef.current) midRef.current.rotation.y += delta * 0.012;
    if (nearRef.current) nearRef.current.rotation.y += delta * 0.022;
  });

  return (
    <>
      <group rotation={[Math.PI * 0.18, 0, Math.PI * 0.08]} position={[0, -4, -14]}>
        <points ref={farRef} geometry={farGeo} material={farMat} frustumCulled={false} />
      </group>
      <group rotation={[Math.PI * 0.16, 0, Math.PI * 0.05]} position={[0, -3, -8]}>
        <points ref={midRef} geometry={midGeo} material={midMat} frustumCulled={false} />
      </group>
      <group rotation={[Math.PI * 0.2, 0, -Math.PI * 0.04]} position={[0, -2, -4]}>
        <points ref={nearRef} geometry={nearGeo} material={nearMat} frustumCulled={false} />
      </group>
    </>
  );
}
