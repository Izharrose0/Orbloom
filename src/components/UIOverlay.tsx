import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { setMuted as setAudioMuted, startAmbient } from '../audio/audio';
import { formatBig, formatDecimal } from '../lib/format';
import { TRAITS } from '../lib/traits';

export default function UIOverlay() {
  const [, force] = useState(0);
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);
  const setCustomName = useGameStore((s) => s.setCustomName);
  const welcomeBackAmount = useGameStore((s) => s.welcomeBackAmount);
  const consumeWelcomeBack = useGameStore((s) => s.consumeWelcomeBack);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) startAmbient();
  };

  const { name, customName, quadrant, mass, evolution, stage, drifterCollected, traits } = useGameStore.getState();
  const displayName = customName ?? name;

  const startEdit = () => {
    setDraft(customName ?? '');
    setEditing(true);
  };

  const commitEdit = () => {
    setCustomName(draft);
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  return (
    <div className="ui-overlay">
      <div className="ui-topbar">
        <div className="ui-name" onClick={!editing ? startEdit : undefined} style={{ cursor: editing ? 'text' : 'pointer', pointerEvents: 'auto' }}>
          <span className="dot" />
          {editing ? (
            <input
              ref={inputRef}
              className="ui-name-input"
              value={draft}
              maxLength={32}
              placeholder={name}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
              }}
            />
          ) : (
            <span className="ui-name-text" title="Click to rename">{displayName}</span>
          )}
          {!editing && customName && (
            <button
              className="ui-name-reset"
              onClick={(e) => { e.stopPropagation(); setCustomName(null); }}
              title="Reset to procedural name"
            >×</button>
          )}
        </div>
        <div className="ui-stats">
          <span className="ui-stat"><span className="ui-stat-k">Sector</span><span className="ui-stat-v">{quadrant}</span></span>
          <span className="ui-stat"><span className="ui-stat-k">Stage</span><span className="ui-stat-v">{stage.name}</span></span>
          <span className="ui-stat"><span className="ui-stat-k">Mass</span><span className="ui-stat-v">{formatBig(mass)}</span></span>
          <span className="ui-stat"><span className="ui-stat-k">Evo</span><span className="ui-stat-v">{formatDecimal(evolution)}</span></span>
          <span className="ui-stat"><span className="ui-stat-k">★</span><span className="ui-stat-v">{formatBig(drifterCollected, 0)}</span></span>
        </div>
      </div>

      <button className="ui-button" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>

      {traits.length > 0 && (
        <div className="trait-list">
          {traits.map((t) => {
            const def = TRAITS[t];
            if (!def) return null;
            return (
              <span key={t} className={`trait-chip trait-${def.family}`} title={def.description}>
                {def.name}
              </span>
            );
          })}
        </div>
      )}

      {welcomeBackAmount > 0 && (
        <div className="welcome-back">
          <div className="welcome-back-eyebrow">Welcome back</div>
          <div className="welcome-back-body">
            While you were away your planet grew by <strong>+{formatBig(welcomeBackAmount)}</strong> mass
          </div>
        </div>
      )}

      <div className="ui-hint">
        Tap · feed &nbsp;·&nbsp; Drag · orbit &nbsp;·&nbsp; Pinch / wheel · zoom
      </div>
    </div>
  );
}
