import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { orbVertexShader, orbFragmentShader } from '../shaders/orbShader';
import { useGameStore } from '../store/useGameStore';

export default function LivingSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime:        { value: 0 },
      uMass:        { value: 1 },
      uPulse:       { value: 0 },
      uEvolution:   { value: 0 },
      uPulseRate:   { value: 1 },
      uVeinDensity: { value: 1 },
      uColorDeep:   { value: new THREE.Color('#070a1f') },
      uColorMid:    { value: new THREE.Color('#1a2a6c') },
      uColorGlow:   { value: new THREE.Color('#7df3ff') },
      uColorVein:   { value: new THREE.Color('#b066ff') },
    }),
    []
  );

  const haloUniforms = useMemo(
    () => ({
      uTime:  { value: 0 },
      uPulse: { value: 0 },
      uColor: { value: new THREE.Color('#7df3ff') },
    }),
    []
  );

  // Reused scratch
  const tmpDeep = useMemo(() => new THREE.Color(), []);
  const tmpMid  = useMemo(() => new THREE.Color(), []);
  const tmpGlow = useMemo(() => new THREE.Color(), []);
  const tmpVein = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    useGameStore.getState().tick(delta, elapsed);

    const { mass, pulseIntensity, evolution, genome, stage } = useGameStore.getState();

    // Apply genome + stage palette shift
    const shift = stage.paletteShift;
    tmpDeep.setHSL(((genome.hueDeep + shift) % 360) / 360, 0.7, 0.10);
    tmpMid .setHSL(((genome.hueDeep + shift + 30) % 360) / 360, 0.65, 0.28);
    tmpGlow.setHSL(((genome.hueGlow + shift) % 360) / 360, 0.85, 0.62);
    tmpVein.setHSL(((genome.hueVein + shift) % 360) / 360, 0.9, 0.6);

    if (matRef.current) {
      uniforms.uTime.value += delta;
      uniforms.uMass.value = mass;
      uniforms.uPulse.value = pulseIntensity;
      uniforms.uEvolution.value = evolution;
      uniforms.uPulseRate.value = genome.pulseRate;
      uniforms.uVeinDensity.value = genome.veinDensity;
      uniforms.uColorDeep.value.copy(tmpDeep);
      uniforms.uColorMid.value.copy(tmpMid);
      uniforms.uColorGlow.value.copy(tmpGlow);
      uniforms.uColorVein.value.copy(tmpVein);
    }

    if (meshRef.current) {
      const target = 1 + Math.log2(1 + mass) * 0.18;
      meshRef.current.scale.lerp(
        new THREE.Vector3(target, target, target),
        Math.min(1, delta * 1.5)
      );
      meshRef.current.rotation.y += delta * 0.04;
      meshRef.current.rotation.x += delta * 0.012;
    }

    if (haloRef.current) {
      haloUniforms.uTime.value += delta;
      haloUniforms.uPulse.value = pulseIntensity;
      haloUniforms.uColor.value.copy(tmpGlow);
      const s = (1 + Math.log2(1 + mass) * 0.18) * 1.55;
      haloRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 64]} />
        <shaderMaterial
          ref={matRef}
          uniforms={uniforms}
          vertexShader={orbVertexShader}
          fragmentShader={orbFragmentShader}
        />
      </mesh>

      <mesh ref={haloRef}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          uniforms={haloUniforms}
          vertexShader={/* glsl */ `
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vView = normalize(cameraPosition - wp.xyz);
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `}
          fragmentShader={/* glsl */ `
            uniform float uTime;
            uniform float uPulse;
            uniform vec3  uColor;
            varying vec3 vNormal;
            varying vec3 vView;
            void main() {
              float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 3.0);
              float a = f * (0.55 + uPulse * 0.6 + 0.08 * sin(uTime * 0.7));
              gl_FragColor = vec4(uColor * (0.7 + uPulse), a);
            }
          `}
        />
      </mesh>
    </group>
  );
}
