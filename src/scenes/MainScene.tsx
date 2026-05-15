import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import LivingSphere from '../components/LivingSphere';
import EnergyParticles from '../components/EnergyParticles';
import EnvironmentFX from '../components/Environment';
import CameraRig from '../components/CameraRig';
import Galaxy from '../components/Galaxy';
import Drifters from '../components/Drifters';

export default function MainScene() {
  return (
    <>
      <CameraRig />
      <Galaxy />
      <EnvironmentFX />
      <LivingSphere />
      <Drifters />
      <EnergyParticles />

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.25}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.6}
          mipmapBlur
          radius={0.85}
        />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>
    </>
  );
}
