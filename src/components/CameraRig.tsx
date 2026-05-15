import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const lastUserActivity = useRef(0);

  useFrame((state) => {
    const c = controlsRef.current;
    if (!c) return;
    const t = state.clock.elapsedTime;
    const idle = t - lastUserActivity.current > 4;
    c.autoRotate = idle;
    c.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={2.4}
      maxDistance={14}
      autoRotate
      autoRotateSpeed={0.45}
      onStart={() => {
        lastUserActivity.current = performance.now() / 1000;
      }}
      onChange={() => {
        lastUserActivity.current = performance.now() / 1000;
      }}
      target={[0, 0, 0]}
    />
  );
}
