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

function DynamicBloom() {
  const bloomRef = useRef<any>(null);
  useFrame(() => {
    const { stage, pulseIntensity, activeEvent } = useGameStore.getState();
    if (bloomRef.current) {
      const base = 1.0 + stage.bloomBoost;
      const pulse = pulseIntensity * 0.6;
      const eventBoost = activeEvent === 'resonance' ? 0.4 : 0;
      bloomRef.current.intensity = base + pulse + eventBoost;
    }
  });
  return (
    <Bloom
      ref={bloomRef}
      intensity={1.2}
      luminanceThreshold={0.18}
      luminanceSmoothing={0.6}
      mipmapBlur
      radius={0.85}
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
