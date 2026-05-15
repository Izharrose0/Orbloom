import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect } from 'react';
import MainScene from './scenes/MainScene';
import UIOverlay from './components/UIOverlay';
import StageTransition from './components/StageTransition';
import EclipseOverlay from './components/EclipseOverlay';
import { loadPlanet, startAutoSave } from './lib/persistence';

export default function App() {
  useEffect(() => {
    loadPlanet();
    const stop = startAutoSave();
    return stop;
  }, []);

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0.4, 5.2], fov: 45, near: 0.1, far: 100 }}
      >
        <color attach="background" args={['#02030a']} />
        <fog attach="fog" args={['#02030a', 6, 26]} />
        <Suspense fallback={null}>
          <MainScene />
        </Suspense>
      </Canvas>
      <EclipseOverlay />
      <StageTransition />
      <UIOverlay />
    </>
  );
}
