import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';

const RING_COUNT = 220;
const TENDRIL_COUNT = 6;

export default function StageDecorations() {
  const ringRef = useRef<THREE.Points>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const tendrilsRef = useRef<THREE.Group>(null);
  const discRef = useRef<THREE.Mesh>(null);

  const ringGeo = useMemo(() => {
    const positions = new Float32Array(RING_COUNT * 3);
    const sizes = new Float32Array(RING_COUNT);
    for (let i = 0; i < RING_COUNT; i++) {
      const angle = (i / RING_COUNT) * Math.PI * 2;
      const r = 1.55 + Math.random() * 0.18;
      positions[i * 3]     = Math.cos(angle) * r;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.06;
      positions[i * 3 + 2] = Math.sin(angle) * r;
      sizes[i] = 0.04 + Math.random() * 0.06;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  const ringUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#7df3ff') },
    }),
    []
  );

  const coronaUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uColor: { value: new THREE.Color('#ffae66') },
    }),
    []
  );

  const discUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#ff66cc') },
    }),
    []
  );

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    const { stage, pulseIntensity, mass, genome } = useGameStore.getState();

    const sphereScale = 1 + Math.log2(1 + mass) * 0.18;

    const glow = new THREE.Color().setHSL((genome.hueGlow + stage.paletteShift) / 360, 0.85, 0.65);
    const warm = new THREE.Color().setHSL(((genome.hueGlow + stage.paletteShift + 25) % 360) / 360, 0.9, 0.62);

    if (ringRef.current) {
      ringRef.current.visible = stage.ringEnabled;
      if (stage.ringEnabled) {
        ringUniforms.uTime.value = elapsed;
        ringUniforms.uColor.value.copy(glow);
        ringRef.current.scale.setScalar(sphereScale);
        ringRef.current.rotation.y += delta * 0.45;
        ringRef.current.rotation.x = Math.PI * 0.05;
      }
    }

    if (coronaRef.current) {
      coronaRef.current.visible = stage.coronaEnabled;
      if (stage.coronaEnabled) {
        coronaUniforms.uTime.value = elapsed;
        coronaUniforms.uPulse.value = pulseIntensity;
        coronaUniforms.uColor.value.copy(warm);
        const s = sphereScale * (1.85 + 0.04 * Math.sin(elapsed * 0.7));
        coronaRef.current.scale.set(s, s, s);
        coronaRef.current.rotation.y += delta * 0.04;
      }
    }

    if (tendrilsRef.current) {
      tendrilsRef.current.visible = stage.tendrilsEnabled;
      if (stage.tendrilsEnabled) {
        tendrilsRef.current.scale.setScalar(sphereScale);
        tendrilsRef.current.rotation.y += delta * 0.18;
        tendrilsRef.current.children.forEach((child, i) => {
          const tw = 1 + 0.3 * Math.sin(elapsed * 0.6 + i);
          child.scale.set(tw, 1, tw);
        });
      }
    }

    if (discRef.current) {
      discRef.current.visible = stage.discEnabled;
      if (stage.discEnabled) {
        discUniforms.uTime.value = elapsed;
        discUniforms.uColor.value.copy(glow);
        const s = sphereScale * 4.2;
        discRef.current.scale.set(s, s, 1);
        discRef.current.rotation.z += delta * 0.25;
      }
    }
  });

  return (
    <group>
      {/* Equatorial ring (Pulsar+) */}
      <points ref={ringRef} geometry={ringGeo} visible={false} frustumCulled={false}>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={ringUniforms}
          vertexShader={/* glsl */ `
            attribute float aSize;
            varying float vA;
            void main() {
              vA = aSize;
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = aSize * (350.0 / -mv.z);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={/* glsl */ `
            uniform vec3 uColor;
            varying float vA;
            void main() {
              vec2 c = gl_PointCoord - 0.5;
              float a = smoothstep(0.5, 0.0, length(c));
              gl_FragColor = vec4(uColor, a * 0.9);
            }
          `}
        />
      </points>

      {/* Plasma corona shell (Stella+) */}
      <mesh ref={coronaRef} visible={false}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          uniforms={coronaUniforms}
          vertexShader={/* glsl */ `
            varying vec3 vN; varying vec3 vV;
            void main() {
              vN = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vV = normalize(cameraPosition - wp.xyz);
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime; uniform float uPulse; uniform vec3 uColor;
            varying vec3 vN; varying vec3 vV;
            void main() {
              float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.0);
              float flicker = 0.85 + 0.15 * sin(uTime * 2.3);
              float a = f * (0.35 + uPulse * 0.4) * flicker;
              gl_FragColor = vec4(uColor * (0.9 + uPulse * 0.5), a);
            }
          `}
        />
      </mesh>

      {/* Distortion tendrils (Buco bianco+) */}
      <group ref={tendrilsRef} visible={false}>
        {Array.from({ length: TENDRIL_COUNT }).map((_, i) => {
          const angle = (i / TENDRIL_COUNT) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 1.6, 0, Math.sin(angle) * 1.6]}
              rotation={[0, angle, Math.PI * 0.5]}
            >
              <coneGeometry args={[0.05, 1.2, 8, 1, true]} />
              <meshBasicMaterial
                color="#cfa8ff"
                transparent
                opacity={0.55}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* Accretion disc (Singularità) */}
      <mesh ref={discRef} visible={false} rotation={[Math.PI / 2.05, 0, 0]}>
        <ringGeometry args={[1.0, 1.4, 128, 8]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          uniforms={discUniforms}
          vertexShader={/* glsl */ `
            varying vec2 vUv; varying float vR;
            void main() {
              vUv = uv;
              vR = length(position.xy);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime; uniform vec3 uColor;
            varying vec2 vUv; varying float vR;
            void main() {
              float ang = atan(vUv.y - 0.5, vUv.x - 0.5);
              float spiral = 0.5 + 0.5 * sin(ang * 6.0 + uTime * 1.5 + vR * 6.0);
              float a = spiral * smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
              gl_FragColor = vec4(uColor, a * 0.7);
            }
          `}
        />
      </mesh>
    </group>
  );
}
