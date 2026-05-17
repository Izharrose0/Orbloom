import { useEffect, useRef } from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useFrame } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import LivingSphere from '../components/LivingSphere';
import EnergyParticles from '../components/EnergyParticles';
import EnvironmentFX from '../components/Environment';
import CameraRig from '../components/CameraRig';
import Sky from '../components/Sky';
import Drifters, { DriftersHandle } from '../components/Drifters';
import StageDecorations from '../components/StageDecorations';
import TraitDecorations from '../components/TraitDecorations';
import MultiCoreOrbs from '../components/MultiCoreOrbs';
import Constellation from '../components/Constellation';
import CosmicEventsSystem from '../systems/cosmicEvents';
import { useGameStore } from '../store/useGameStore';
import { DEBUG_ENABLED } from '../dev/debug';

const BLOOM_MIN = 0.6;
const BLOOM_MAX = 1.9;

function DynamicBloom() {
  const bloomRef = useRef<any>(null);
  const currentRef = useRef(0.9);
  useFrame((_, delta) => {
    const { stage, pulseIntensity, activeEvent } = useGameStore.getState();
    if (!bloomRef.current) return;
    const stageBoost = Math.min(0.6, stage.bloomBoost * 0.5);
    const pulse = Math.min(0.55, pulseIntensity * 0.35);
    const eventBoost = activeEvent === 'resonance' ? 0.25 : activeEvent === 'eclipse' ? -0.35 : 0;
    const target = Math.max(BLOOM_MIN, Math.min(BLOOM_MAX, 0.85 + stageBoost + pulse + eventBoost));
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

  useEffect(() => {
    if (!DEBUG_ENABLED) return;
    window.__orbloom = window.__orbloom || {};
    window.__orbloom.triggerMeteorShower = () => driftersRef.current?.triggerMeteorShower();
    window.__orbloom.spawnDrifterShape = (shape: string) =>
      driftersRef.current?.spawnShape(shape as any);
    return () => {
      if (window.__orbloom) {
        delete window.__orbloom.triggerMeteorShower;
        delete window.__orbloom.spawnDrifterShape;
      }
    };
  }, []);

  return (
    <>
      <CameraRig />
      <Sky />
      <Constellation />
      <EnvironmentFX />
      <LivingSphere />
      <MultiCoreOrbs />
      <StageDecorations />
      <TraitDecorations />
      <Drifters ref={driftersRef} />
      <EnergyParticles />

      <CosmicEventsSystem onMeteorBurst={() => driftersRef.current?.triggerMeteorShower()} />

      <EffectComposer multisampling={0}>
        <DynamicBloom />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>

      {DEBUG_ENABLED && <Stats />}
    </>
  );
}
