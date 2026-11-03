import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useGameStore } from '../store/useGameStore';
import { organismState } from '../systems/organism';

/**
 * Cinematic orbit camera.
 * - Adaptive framing: the camera keeps the player's *relative* zoom as the
 *   organism grows, so evolved silhouettes stay composed without ever fighting
 *   the player's own zoom.
 * - Stage milestones: a slow pull-back to reveal the new silhouette, then a
 *   gentle return — no shake.
 * - Subtle breathing of the look-at point.
 */
export default function CameraRig() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const live = useRef({
    lastUser: -10,
    interacting: false,
    ratio: 1,              // player's zoom relative to the comfortable framing
    revealUntil: 0,
    reveal: 0,             // 0..1 extra pull-back during milestone reveal
    lastStageId: useGameStore.getState().stage.id,
    lastEpoch: 0,
    initialized: false,
    settle: 0,             // frames after an interaction during which we only measure the new zoom
    hydration: -1,
  });
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, rawDelta) => {
    const c = controlsRef.current;
    if (!c) return;
    const L = live.current;
    const delta = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;
    const { stage, reducedMotion, hydrationVersion } = useGameStore.getState();
    if (hydrationVersion !== L.hydration) {
      // a save was just loaded: frame it immediately, and don't treat the jump as a milestone
      L.hydration = hydrationVersion;
      L.initialized = false;
      L.lastStageId = stage.id;
      L.lastEpoch = organismState.morph?.epoch ?? 0;
    }
    const motion = reducedMotion ? 0.3 : 1;

    // ---- comfortable distance for the current silhouette ----
    const persp = camera as THREE.PerspectiveCamera;
    const halfV = THREE.MathUtils.degToRad(persp.fov / 2);
    const tanV = Math.tan(halfV);
    const tanFit = Math.min(tanV, tanV * (size.width / Math.max(1, size.height)));
    const R = Math.max(1.1, organismState.boundRadius);
    const comfortable = R / (tanFit * 0.7);

    // ---- milestone reveal ----
    const epoch = organismState.morph?.epoch ?? 0;
    if (stage.id !== L.lastStageId || epoch !== L.lastEpoch) {
      if (L.initialized && (stage.id > L.lastStageId || epoch > L.lastEpoch)) L.revealUntil = t + 5.5;
      L.lastStageId = stage.id;
      L.lastEpoch = epoch;
    }
    const revealTarget = t < L.revealUntil ? 1 : 0;
    L.reveal += (revealTarget - L.reveal) * (1 - Math.exp(-delta * (revealTarget ? 0.9 : 0.35)));

    // ---- adaptive framing (only while the player isn't driving) ----
    const dist = camera.position.distanceTo(c.target);
    if (!L.initialized) {
      L.initialized = true;
      L.ratio = 1;
      camera.position.sub(c.target).setLength(comfortable).add(c.target);
    } else if (L.interacting || L.settle > 0) {
      // wheel zoom emits start/end in the same event, so keep measuring for a few frames after
      L.settle = Math.max(0, L.settle - 1);
      L.ratio = THREE.MathUtils.clamp(dist / comfortable, 0.4, 2.8);
    } else {
      const desired = comfortable * L.ratio * (1 + 0.22 * L.reveal);
      const next = dist + (desired - dist) * (1 - Math.exp(-delta * 0.8));
      tmp.current.copy(camera.position).sub(c.target).setLength(next);
      camera.position.copy(c.target).add(tmp.current);
    }
    c.minDistance = R * 1.15;
    c.maxDistance = R * 7 + 6;

    // ---- breathing look-at + idle drift ----
    c.target.set(0, 0.04 * Math.sin(t * 0.21) * motion * Math.min(1, R / 2), 0);
    const idle = performance.now() / 1000 - L.lastUser > 5;
    c.autoRotate = idle;
    c.autoRotateSpeed = (0.32 + 0.25 * L.reveal) * motion;

    c.update();
  });

  const onStart = () => {
    live.current.interacting = true;
    live.current.lastUser = performance.now() / 1000;
    useGameStore.getState().touchInteraction();
  };
  const onEnd = () => {
    live.current.interacting = false;
    live.current.settle = 45;
    live.current.lastUser = performance.now() / 1000;
  };

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.7}
      zoomSpeed={0.7}
      enablePan={false}
      minDistance={1.6}
      maxDistance={40}
      autoRotate
      autoRotateSpeed={0.32}
      onStart={onStart}
      onEnd={onEnd}
      target={[0, 0, 0]}
    />
  );
}
