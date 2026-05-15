import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function CameraRig() {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector3());
  const current = useRef(new THREE.Vector3().copy(camera.position));
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Cinematic ambient orbit
    const baseRadius = 5.4;
    const orbitX = Math.sin(t * 0.05) * 0.9;
    const orbitY = 0.4 + Math.sin(t * 0.07) * 0.25;
    const orbitZ = baseRadius + Math.cos(t * 0.05) * 0.4;

    // Pointer parallax influence
    const px = pointer.x * 1.4;
    const py = pointer.y * 0.8;

    target.current.set(orbitX + px, orbitY + py, orbitZ);

    current.current.lerp(target.current, Math.min(1, delta * 1.1));
    camera.position.copy(current.current);
    camera.lookAt(lookAt.current);
  });

  return null;
}
