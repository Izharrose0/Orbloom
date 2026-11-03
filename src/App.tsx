import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useState } from 'react';
import { useGameStore } from './store/useGameStore';
import { QUALITY_PRESETS } from './lib/quality';
import MainScene from './scenes/MainScene';
import UIOverlay from './components/UIOverlay';
import StageTransition from './components/StageTransition';
import EclipseOverlay from './components/EclipseOverlay';
import TraitToast from './components/TraitToast';
import ObjectiveOverlay from './components/ObjectiveOverlay';
import DebugPanel from './dev/DebugPanel';
import ErrorBoundary from './components/ErrorBoundary';
import { loadPlanet, startAutoSave } from './lib/persistence';

export default function App() {
  const quality = useGameStore((s) => s.quality);
  const [canvasKey, setCanvasKey] = useState(0);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    loadPlanet();
    const stop = startAutoSave();
    return stop;
  }, []);

  return (
    <ErrorBoundary>
      <Canvas
        key={canvasKey}
        onCreated={({ gl }) => {
          // WebGL context recovery: mobile browsers drop contexts under memory
          // pressure. Remount the canvas when the context comes back.
          const el = gl.domElement;
          el.addEventListener('webglcontextlost', (e) => { e.preventDefault(); setContextLost(true); }, false);
          el.addEventListener('webglcontextrestored', () => { setContextLost(false); setCanvasKey((k) => k + 1); }, false);
        }}
        dpr={QUALITY_PRESETS[quality].dpr}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0.4, 5.2], fov: 45, near: 0.1, far: 900 }}
      >
        <color attach="background" args={['#02030a']} />
        <fog attach="fog" args={['#02030a', 6, 26]} />
        <Suspense fallback={null}>
          <MainScene />
        </Suspense>
      </Canvas>
      {contextLost && (
        <div className="context-lost" role="status">
          <div>Reconnecting to the cosmos…</div>
          <button onClick={() => { setContextLost(false); setCanvasKey((k) => k + 1); }}>Retry now</button>
        </div>
      )}
      <EclipseOverlay />
      <StageTransition />
      <TraitToast />
      <ObjectiveOverlay />
      <UIOverlay />
      <DebugPanel />
    </ErrorBoundary>
  );
}
