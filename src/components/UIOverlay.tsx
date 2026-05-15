import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { setMuted as setAudioMuted, startAmbient } from '../audio/audio';

export default function UIOverlay() {
  const [, force] = useState(0);
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) startAmbient();
  };

  const { mass, evolution, energy, drifterCollected } = useGameStore.getState();

  return (
    <div className="ui-overlay">
      <div className="ui-bar">
        <span className="dot" />
        <span>Orbloom</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Mass {mass.toFixed(2)}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>Evo {evolution.toFixed(2)}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>★ {drifterCollected}</span>
      </div>

      <button className="ui-button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>

      <div className="ui-hint">
        Tap · feed the bloom &nbsp;·&nbsp; Drag · orbit &nbsp;·&nbsp; Pinch / wheel · zoom
        <br />
        {Math.floor(energy)} pulses absorbed
      </div>
    </div>
  );
}
