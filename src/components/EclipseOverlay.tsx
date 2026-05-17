import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function EclipseOverlay() {
  const activeEvent = useGameStore((s) => s.activeEvent);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (activeEvent === 'eclipse') {
      // Gentler than before (was 0.55) — no longer reads as a "black flash"
      setOpacity(0.28);
      const t = setTimeout(() => setOpacity(0), 7000);
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
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.0) 45%, rgba(0,0,0,0.7) 100%)',
        opacity,
        transition: 'opacity 2s ease', // slower fade-in/out, no abrupt change
        zIndex: 5,
      }}
    />
  );
}
