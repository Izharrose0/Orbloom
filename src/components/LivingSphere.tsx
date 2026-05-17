import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { orbVertexShader, orbFragmentShader } from '../shaders/orbShader';
import { useGameStore } from '../store/useGameStore';
import { visualScaleForMass } from '../lib/scale';
import { NEBULA_A, NEBULA_B } from '../lib/skyPalette';
import { hasTrait } from '../lib/traits';

const COLOR_CAST_SINGED = new THREE.Color(1.35, 0.7, 0.45);
const COLOR_CAST_FROZEN = new THREE.Color(0.55, 0.9, 1.25);

export default function LivingSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime:         { value: 0 },
      uMass:         { value: 1 },
      uPulse:        { value: 0 },
      uEvolution:    { value: 0 },
      uPulseRate:    { value: 1 },
      uVeinDensity:  { value: 1 },
      uReflectivity: { value: 0.15 },
      uColorDeep:    { value: new THREE.Color('#070a1f') },
      uColorMid:     { value: new THREE.Color('#1a2a6c') },
      uColorGlow:    { value: new THREE.Color('#7df3ff') },
      uColorVein:    { value: new THREE.Color('#b066ff') },
      uNebulaA:      { value: NEBULA_A.clone() },
      uNebulaB:      { value: NEBULA_B.clone() },
      // Trait uniforms
      uTraitSmooth:        { value: 0 },
      uTraitSpiked:        { value: 0 },
      uTraitRidged:        { value: 0 },
      uTraitFissured:      { value: 0 },
      uTraitCratered:      { value: 0 },
      uTraitOblate:        { value: 0 },
      uTraitProlate:       { value: 0 },
      uTraitTwisted:       { value: 0 },
      uTraitAurorae:       { value: 0 },
      uTraitEclipsed:      { value: 0 },
      uColorCast:          { value: new THREE.Color(1, 1, 1) },
      uColorCastStrength:  { value: 0 },
      uFissureAxis:        { value: new THREE.Vector3(0.7, 0.2, 0.6) },
      uCraterSeed:         { value: new THREE.Vector3(1.7, 4.2, 9.1) },
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

  const tmpDeep = useMemo(() => new THREE.Color(), []);
  const tmpMid  = useMemo(() => new THREE.Color(), []);
  const tmpGlow = useMemo(() => new THREE.Color(), []);
  const tmpVein = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime;
    useGameStore.getState().tick(delta, elapsed);

    const s = useGameStore.getState();
    const { mass, pulseIntensity, evolution, genome, stage, traits } = s;

    const shift = stage.paletteShift;
    tmpDeep.setHSL(((genome.hueDeep + shift) % 360) / 360, 0.7, 0.10);
    tmpMid .setHSL(((genome.hueDeep + shift + 30) % 360) / 360, 0.65, 0.28);
    tmpGlow.setHSL(((genome.hueGlow + shift) % 360) / 360, 0.85, 0.62);
    tmpVein.setHSL(((genome.hueVein + shift) % 360) / 360, 0.9, 0.6);

    // Pulse rate trait modifiers
    let pulseRateMul = 1;
    if (hasTrait(traits, 'pulsar')) pulseRateMul *= 2.0;
    if (hasTrait(traits, 'quiet'))  pulseRateMul *= 0.5;

    if (matRef.current) {
      uniforms.uTime.value += delta;
      uniforms.uMass.value = mass;
      uniforms.uPulse.value = pulseIntensity;
      uniforms.uEvolution.value = evolution;
      uniforms.uPulseRate.value = genome.pulseRate * pulseRateMul;
      uniforms.uVeinDensity.value = genome.veinDensity;
      uniforms.uReflectivity.value = 0.10 + Math.min(0.45, stage.id * 0.09);
      uniforms.uColorDeep.value.copy(tmpDeep);
      uniforms.uColorMid.value.copy(tmpMid);
      uniforms.uColorGlow.value.copy(tmpGlow);
      uniforms.uColorVein.value.copy(tmpVein);

      // Wire traits (binary 0/1 for now — could be eased later)
      uniforms.uTraitSmooth.value   = hasTrait(traits, 'smooth')   ? 1 : 0;
      uniforms.uTraitSpiked.value   = hasTrait(traits, 'spiked')   ? 1 : 0;
      uniforms.uTraitRidged.value   = hasTrait(traits, 'ridged')   ? 1 : 0;
      uniforms.uTraitFissured.value = hasTrait(traits, 'fissured') ? 1 : 0;
      uniforms.uTraitCratered.value = hasTrait(traits, 'cratered') ? 1 : 0;
      uniforms.uTraitOblate.value   = hasTrait(traits, 'oblate')   ? 1 : 0;
      uniforms.uTraitProlate.value  = hasTrait(traits, 'prolate')  ? 1 : 0;
      uniforms.uTraitTwisted.value  = hasTrait(traits, 'twisted')  ? 1 : 0;
      uniforms.uTraitAurorae.value  = hasTrait(traits, 'aurorae')  ? 1 : 0;
      uniforms.uTraitEclipsed.value = hasTrait(traits, 'eclipsed') ? 1 : 0;

      if (hasTrait(traits, 'singed')) {
        uniforms.uColorCast.value.copy(COLOR_CAST_SINGED);
        uniforms.uColorCastStrength.value = 1;
      } else if (hasTrait(traits, 'frozen')) {
        uniforms.uColorCast.value.copy(COLOR_CAST_FROZEN);
        uniforms.uColorCastStrength.value = 1;
      } else {
        uniforms.uColorCastStrength.value = 0;
      }
    }

    const visScale = visualScaleForMass(mass);

    if (meshRef.current) {
      meshRef.current.scale.lerp(
        new THREE.Vector3(visScale, visScale, visScale),
        Math.min(1, delta * 1.5)
      );
      meshRef.current.rotation.y += delta * 0.04;
      meshRef.current.rotation.x += delta * 0.012;
    }

    if (haloRef.current) {
      haloUniforms.uTime.value += delta;
      haloUniforms.uPulse.value = Math.min(0.9, pulseIntensity);
      haloUniforms.uColor.value.copy(tmpGlow);
      const sf = visScale * 1.4;
      haloRef.current.scale.set(sf, sf, sf);
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
              vNormal = normalize(mat3(modelMatrix) * normal);
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
              float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 3.2);
              float a = f * (0.32 + uPulse * 0.28 + 0.05 * sin(uTime * 0.7));
              gl_FragColor = vec4(uColor * (0.7 + uPulse * 0.4), a);
            }
          `}
        />
      </mesh>
    </group>
  );
}
