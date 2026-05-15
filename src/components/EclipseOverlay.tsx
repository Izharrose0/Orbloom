import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function EclipseOverlay() {
  const activeEvent = useGameStore((s) => s.activeEvent);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (activeEvent === 'eclipse') {
      setOpacity(0.55);
      const t = setTimeout(() => setOpacity(0), 6500);
      return () => clearTimeout(t);
    } else {
      setOpacity(0);
    }
  }, [activeEvent]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.85) 100%)',
        opacity,
        transition: 'opacity 1.2s ease',
        zIndex: 5,
      }}
    />
  );
}
