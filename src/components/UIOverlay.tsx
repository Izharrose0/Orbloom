import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { setMuted as setAudioMuted, startAmbient } from '../audio/audio';
import { formatBig, formatDecimal } from '../lib/format';

export default function UIOverlay() {
  const [, force] = useState(0);
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);
  const welcomeBackAmount = useGameStore((s) => s.welcomeBackAmount);
  const consumeWelcomeBack = useGameStore((s) => s.consumeWelcomeBack);

  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (welcomeBackAmount > 0) {
      const t = setTimeout(() => consumeWelcomeBack(), 6000);
      return () => clearTimeout(t);
    }
  }, [welcomeBackAmount, consumeWelcomeBack]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) startAmbient();
  };

  const { name, mass, evolution, stage, drifterCollected } = useGameStore.getState();

  return (
    <div className="ui-overlay">
      <div className="ui-bar">
        <span className="dot" />
        <span style={{ color: '#e9efff', fontWeight: 600, letterSpacing: '0.14em' }}>{name}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{stage.name}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>m {formatBig(mass)}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>e {formatDecimal(evolution)}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>★ {formatBig(drifterCollected, 0)}</span>
      </div>

      <button className="ui-button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>

      {welcomeBackAmount > 0 && (
        <div className="welcome-back">
          <div className="welcome-back-eyebrow">Bentornato</div>
          <div className="welcome-back-body">
            Mentre eri via il tuo pianeta è cresciuto di <strong>+{formatBig(welcomeBackAmount)}</strong> massa
          </div>
        </div>
      )}

      <div className="ui-hint">
        Tap · feed &nbsp;·&nbsp; Drag · orbit &nbsp;·&nbsp; Pinch / wheel · zoom
      </div>
    </div>
  );
}
