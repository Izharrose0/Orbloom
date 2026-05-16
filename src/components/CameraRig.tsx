import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGameStore } from '../store/useGameStore';

export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const lastUserActivity = useRef(0);
  const shakeUntil = useRef(0);
  const lastStageId = useRef<number>(useGameStore.getState().stage.id);

  useFrame((state) => {
    const c = controlsRef.current;
    if (!c) return;
    const t = state.clock.elapsedTime;
    const idle = t - lastUserActivity.current > 4;
    c.autoRotate = idle;

    const stageNow = useGameStore.getState().stage.id;
    if (stageNow !== lastStageId.current) {
      lastStageId.current = stageNow;
      if (stageNow > 0) shakeUntil.current = t + 1.0;
    }

    if (t < shakeUntil.current) {
      const remain = shakeUntil.current - t;
      const amp = 0.05 * remain;
      camera.position.x += (Math.random() - 0.5) * amp;
      camera.position.y += (Math.random() - 0.5) * amp;
    }

    c.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={2.2}
      maxDistance={14}
      autoRotate
      autoRotateSpeed={0.4}
      onStart={() => { lastUserActivity.current = performance.now() / 1000; }}
      onChange={() => { lastUserActivity.current = performance.now() / 1000; }}
      target={[0, 0, 0]}
    />
  );
}
