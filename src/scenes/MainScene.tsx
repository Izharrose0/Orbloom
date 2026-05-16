import { useRef } from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import LivingSphere from '../components/LivingSphere';
import EnergyParticles from '../components/EnergyParticles';
import EnvironmentFX from '../components/Environment';
import CameraRig from '../components/CameraRig';
import Galaxy from '../components/Galaxy';
import Drifters, { DriftersHandle } from '../components/Drifters';
import StageDecorations from '../components/StageDecorations';
import Constellation from '../components/Constellation';
import CosmicEventsSystem from '../systems/cosmicEvents';
import { useGameStore } from '../store/useGameStore';

const BLOOM_MIN = 0.6;
const BLOOM_MAX = 1.9;

function DynamicBloom() {
  const bloomRef = useRef<any>(null);
  const currentRef = useRef(0.9);
  useFrame((_, delta) => {
    const { stage, pulseIntensity, activeEvent } = useGameStore.getState();
    if (!bloomRef.current) return;
    const stageBoost = Math.min(0.6, stage.bloomBoost * 0.5); // damp the per-stage growth
    const pulse = Math.min(0.55, pulseIntensity * 0.35);
    const eventBoost = activeEvent === 'resonance' ? 0.25 : activeEvent === 'eclipse' ? -0.35 : 0;
    const target = Math.max(BLOOM_MIN, Math.min(BLOOM_MAX, 0.85 + stageBoost + pulse + eventBoost));
    // temporal smoothing → no abrupt flashes
    currentRef.current += (target - currentRef.current) * Math.min(1, delta * 2.5);
    bloomRef.current.intensity = currentRef.current;
  });
  return (
    <Bloom
      ref={bloomRef}
      intensity={0.9}
      luminanceThreshold={0.28}
      luminanceSmoothing={0.7}
      mipmapBlur
      radius={0.78}
    />
  );
}

export default function MainScene() {
  const driftersRef = useRef<DriftersHandle>(null);

  return (
    <>
      <CameraRig />
      <Galaxy />
      <Constellation />
      <EnvironmentFX />
      <LivingSphere />
      <StageDecorations />
      <Drifters ref={driftersRef} />
      <EnergyParticles />

      <CosmicEventsSystem onMeteorBurst={() => driftersRef.current?.triggerMeteorShower()} />

      <EffectComposer multisampling={0}>
        <DynamicBloom />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>
    </>
  );
}
