import { useEffect, useRef } from 'react';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useFrame } from '@react-three/fiber';
import { Stats, PerformanceMonitor } from '@react-three/drei';
import { QUALITY_PRESETS } from '../lib/quality';
import LivingSphere from '../components/LivingSphere';
import EnergyParticles from '../components/EnergyParticles';
import EnvironmentFX from '../components/Environment';
import CameraRig from '../components/CameraRig';
import Sky from '../components/Sky';
import Drifters, { DriftersHandle } from '../components/Drifters';
import StageDecorations from '../components/StageDecorations';
import TraitDecorations from '../components/TraitDecorations';
import MultiCoreOrbs from '../components/MultiCoreOrbs';
import Symbionts from '../components/Symbionts';
import Constellation from '../components/Constellation';
import CosmicEventsSystem from '../systems/cosmicEvents';
import EventObjectivesSystem from '../systems/eventObjectives';
import { useGameStore } from '../store/useGameStore';
import { DEBUG_ENABLED } from '../dev/debug';
import { OrganismController } from '../systems/organism';
import { sceneHooks, phenomena } from '../systems/fx';
import { fireEvent } from '../systems/cosmicEvents';
import { stageForMass } from '../lib/stages';
import EventPhenomena from '../systems/phenomena';
import PassiveBehaviors from '../systems/passiveBehaviors';

// Bloom is a halo, not a fog: high threshold so only veins, tips and rims glow.
const BLOOM_MIN = 0.45;
const BLOOM_MAX = 1.25;

function DynamicBloom() {
  const bloomRef = useRef<any>(null);
  const currentRef = useRef(0.9);
  useFrame((_, delta) => {
    const { stage, pulseIntensity, activeEvent } = useGameStore.getState();
    if (!bloomRef.current) return;
    const stageBoost = Math.min(0.3, stage.bloomBoost * 0.25);
    const pulse = Math.min(0.3, pulseIntensity * 0.2);
    const eventBoost = activeEvent === 'resonance' || activeEvent === 'quasar' ? 0.2 : activeEvent === 'eclipse' ? -0.25 : 0;
    const target = Math.max(BLOOM_MIN, Math.min(BLOOM_MAX, 0.7 + stageBoost + pulse + eventBoost));
    currentRef.current += (target - currentRef.current) * Math.min(1, delta * 2.5);
    bloomRef.current.intensity = currentRef.current;
  });
  return (
    <Bloom
      ref={bloomRef}
      intensity={0.75}
      luminanceThreshold={0.55}
      luminanceSmoothing={0.35}
      mipmapBlur
      radius={0.7}
    />
  );
}

function PostFX() {
  const quality = useGameStore((s) => s.quality);
  const preset = QUALITY_PRESETS[quality];
  return (
    <EffectComposer multisampling={0}>
      <DynamicBloom />
      {preset.grain ? <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.035} /> : <></>}
      <Vignette eskil={false} offset={0.3} darkness={0.7} />
    </EffectComposer>
  );
}

export default function MainScene() {
  const driftersRef = useRef<DriftersHandle>(null);

  useEffect(() => {
    sceneHooks.meteorShower = () => driftersRef.current?.triggerMeteorShower();
    sceneHooks.quasarFragments = () => driftersRef.current?.quasarFragments();
    return () => { sceneHooks.meteorShower = undefined; sceneHooks.quasarFragments = undefined; };
  }, []);

  useEffect(() => {
    if (!DEBUG_ENABLED) return;
    window.__orbloom = window.__orbloom || {};
    window.__orbloom.triggerMeteorShower = () => driftersRef.current?.triggerMeteorShower();
    window.__orbloom.spawnDrifterShape = (shape: string) =>
      driftersRef.current?.spawnShape(shape as any);
    window.__orbloom.fireEvent = (kind: string) => fireEvent(kind as any);
    window.__orbloom.phenomenon = (kind: string, dur = 15) => phenomena.start(kind as any, dur);
    window.__orbloom.setMass = (m: number) => useGameStore.setState({ mass: m, evolution: Math.log2(1 + m), stage: stageForMass(m) });
    return () => {
      if (window.__orbloom) {
        delete window.__orbloom.triggerMeteorShower;
        delete window.__orbloom.spawnDrifterShape;
      }
    };
  }, []);

  return (
    <>
      <OrganismController />
      <CameraRig />
      <Sky />
      <Constellation />
      <EnvironmentFX />
      <LivingSphere />
      <MultiCoreOrbs />
      <Symbionts />
      <StageDecorations />
      <TraitDecorations />
      <Drifters ref={driftersRef} />
      <EnergyParticles />

      <CosmicEventsSystem onMeteorBurst={() => driftersRef.current?.triggerMeteorShower()} />
      <EventObjectivesSystem />
      <PassiveBehaviors />
      <EventPhenomena />

      {/* Steps quality down (never up on its own) if the frame rate stays low */}
      <PerformanceMonitor
        flipflops={3}
        onDecline={() => {
          const { quality, setQuality } = useGameStore.getState();
          let forced = false;
          try { forced = localStorage.getItem('orbloom.quality') !== null || new URLSearchParams(location.search).has('quality'); } catch { /* ignore */ }
          if (!forced && quality > 0) setQuality((quality - 1) as 0 | 1);
        }}
      />

      <PostFX />

      {DEBUG_ENABLED && <Stats />}
    </>
  );
}
