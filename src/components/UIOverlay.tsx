import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function UIOverlay() {
  const [, force] = useState(0);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const { mass, evolution, energy } = useGameStore.getState();

  return (
    <div className="ui-overlay">
      <div className="ui-bar">
        <span className="dot" />
        <span>Orbloom</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>Mass {mass.toFixed(2)}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>Evo {evolution.toFixed(2)}</span>
      </div>
      <div className="ui-hint">
        Tap anywhere · feed the bloom · {Math.floor(energy)} pulses absorbed
      </div>
    </div>
  );
}
