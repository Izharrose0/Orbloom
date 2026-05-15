import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useGameStore } from '../store/useGameStore';

export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, gl } = useThree();
  const lastUserActivity = useRef(0);
  const shakeUntil = useRef(0);
  const lastStageId = useRef<number>(useGameStore.getState().stage.id);
  const closeUpRef = useRef(false);
  const lastTapTime = useRef(0);

  useEffect(() => {
    const dom = gl.domElement;
    const onPointerUp = (e: PointerEvent) => {
      const now = performance.now();
      // double-tap detection: two ups within 320ms with small movement
      if (now - lastTapTime.current < 320) {
        closeUpRef.current = !closeUpRef.current;
        if (controlsRef.current) {
          controlsRef.current.minDistance = closeUpRef.current ? 1.4 : 2.4;
        }
        if (closeUpRef.current) {
          // dolly-in toward orb
          const dir = camera.position.clone().normalize().multiplyScalar(1.6);
          camera.position.lerp(dir, 0.5);
        }
      }
      lastTapTime.current = now;
    };
    dom.addEventListener('pointerup', onPointerUp);
    return () => dom.removeEventListener('pointerup', onPointerUp);
  }, [gl, camera]);

  useFrame((state) => {
    const c = controlsRef.current;
    if (!c) return;
    const t = state.clock.elapsedTime;
    const idle = t - lastUserActivity.current > 4;
    c.autoRotate = idle;

    // detect stage change → trigger shake
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
      minDistance={2.4}
      maxDistance={14}
      autoRotate
      autoRotateSpeed={0.4}
      onStart={() => { lastUserActivity.current = performance.now() / 1000; }}
      onChange={() => { lastUserActivity.current = performance.now() / 1000; }}
      target={[0, 0, 0]}
    />
  );
}
