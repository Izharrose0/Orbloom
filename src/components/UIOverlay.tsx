import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { setMuted as setAudioMuted, startAmbient } from '../audio/audio';
import { formatBig, formatDecimal } from '../lib/format';
import { TRAITS } from '../lib/traits';
import { describePersona } from '../lib/morphology';
import { organismState } from '../systems/organism';
import { QualityLevel, QUALITY_PRESETS, persistQuality } from '../lib/quality';
import { discoveryCount } from '../lib/discoveries';

/** Minimal HUD. The organism is the interface: on screen there is only its name,
 *  a quiet stage line, and contextual text. Numbers live in the Codex card. */
export default function UIOverlay() {
  const [, force] = useState(0);
  const muted = useGameStore((s) => s.muted);
  const setMuted = useGameStore((s) => s.setMuted);
  const setCustomName = useGameStore((s) => s.setCustomName);
  const welcomeBackAmount = useGameStore((s) => s.welcomeBackAmount);
  const consumeWelcomeBack = useGameStore((s) => s.consumeWelcomeBack);
  const totalTaps = useGameStore((s) => s.totalTaps);
  const lastInteractionAt = useGameStore((s) => s.lastInteractionAt);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [codexOpen, setCodexOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hintVisible, setHintVisible] = useState(true);

  // refresh slowly — nothing here needs per-frame precision
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), codexOpen ? 500 : 1000);
    return () => clearInterval(id);
  }, [codexOpen]);

  useEffect(() => {
    if (welcomeBackAmount > 0) {
      const t = setTimeout(() => consumeWelcomeBack(), 6500);
      return () => clearTimeout(t);
    }
  }, [welcomeBackAmount, consumeWelcomeBack]);

  // gesture hint: only until the player has tapped and orbited a little (or 45 s pass)
  useEffect(() => {
    if (totalTaps >= 3 && lastInteractionAt > 0) setHintVisible(false);
  }, [totalTaps, lastInteractionAt]);
  useEffect(() => {
    const t = setTimeout(() => setHintVisible(false), 45000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setAudioMuted(next);
    if (!next) startAmbient();
  };

  const s = useGameStore.getState();
  const { name, customName, quadrant, stage } = s;
  const displayName = customName ?? name;
  const epoch = organismState.morph?.epoch ?? 0;

  const commitEdit = () => {
    setCustomName(draft);
    setEditing(false);
  };

  return (
    <div className="ui-overlay">
      <header className="ui-topbar">
        <div className="ui-name" style={{ pointerEvents: 'auto' }}>
          <span className="dot" aria-hidden />
          {editing ? (
            <input
              ref={inputRef}
              className="ui-name-input"
              value={draft}
              maxLength={32}
              placeholder={name}
              aria-label="Name your organism"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <button className="ui-name-text" title="Rename" onClick={() => { setDraft(customName ?? ''); setEditing(true); }}>
              {displayName}
            </button>
          )}
          {!editing && customName && (
            <button className="ui-name-reset" onClick={() => setCustomName(null)} title="Reset to procedural name" aria-label="Reset name">×</button>
          )}
        </div>
        <div className="ui-subline" aria-live="polite">
          {stage.name}{epoch > 0 ? ` · Epoch ${epoch}` : ''}<span className="ui-subline-sep">·</span>{quadrant}
        </div>
      </header>

      <div className="ui-controls">
        <button className="ui-icon" onClick={() => setCodexOpen((o) => !o)} aria-label={codexOpen ? 'Close codex' : 'Open codex'} aria-expanded={codexOpen}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <button className="ui-icon" onClick={toggleMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}>
          {muted ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M4 10h3l4-3.5v11L7 14H4z" fill="currentColor" /><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M4 10h3l4-3.5v11L7 14H4z" fill="currentColor" /><path d="M15 9.5a3.5 3.5 0 010 5M17.5 7a7 7 0 010 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          )}
        </button>
      </div>

      {codexOpen && <Codex onClose={() => setCodexOpen(false)} />}

      {welcomeBackAmount > 0 && (
        <div className="welcome-back" role="status">
          <div className="welcome-back-eyebrow">While you were away</div>
          <div className="welcome-back-body">it kept growing — <strong>+{formatBig(welcomeBackAmount)}</strong> mass</div>
        </div>
      )}

      <Caption />

      <div className={`ui-hint ${hintVisible ? '' : 'hidden'}`}>
        Tap to feed · Drag to orbit · Pinch to zoom · Or simply watch
      </div>
    </div>
  );
}

function Caption() {
  const caption = useGameStore((s) => s.caption);
  const [visible, setVisible] = useState<typeof caption>(null);
  useEffect(() => {
    if (!caption) return;
    setVisible(caption);
    const t = setTimeout(() => setVisible(null), 7000);
    return () => clearTimeout(t);
  }, [caption]);
  if (!visible) return null;
  return (
    <div className="caption" key={visible.at} role="status" aria-live="polite">
      <div className="caption-text">{visible.text}</div>
      {visible.sub && <div className="caption-sub">{visible.sub}</div>}
    </div>
  );
}

function Codex({ onClose }: { onClose: () => void }) {
  const s = useGameStore.getState();
  const quality = useGameStore((st) => st.quality);
  const setQuality = useGameStore((st) => st.setQuality);
  const reducedMotion = useGameStore((st) => st.reducedMotion);
  const m = organismState.morph;
  const b = organismState.biomes;
  const symbiotic = (m?.symbionts ?? 0) > 0 || ['twinned', 'binary', 'trinary'].some((t) => s.traits.includes(t));
  const nature = m ? describePersona(m.persona, { symbiotic, biome: b?.primary.id }) : '—';
  const ecosystems = [
    m && m.growthDensity > 0 ? b?.primary.name : null,
    s.stage.id >= 4 && b ? b.secondary.name : null,
  ].filter(Boolean) as string[];

  const pickQuality = (q: QualityLevel) => {
    setQuality(q);
    persistQuality(q);
  };

  return (
    <aside className="codex" aria-label="Codex">
      <div className="codex-head">
        <span className="codex-title">Codex</span>
        <button className="codex-close" onClick={onClose} aria-label="Close codex">×</button>
      </div>
      <dl className="codex-grid">
        <dt>Nature</dt><dd>{nature}</dd>
        <dt>Stage</dt><dd>{s.stage.name}{m && m.epoch > 0 ? ` · Epoch ${m.epoch}` : ''}</dd>
        <dt>Ecosystems</dt><dd>{ecosystems.length ? ecosystems.join(' · ') : 'Not yet'}</dd>
        <dt>Mass</dt><dd>{formatBig(s.mass)}</dd>
        <dt>Evolution</dt><dd>{formatDecimal(s.evolution)}</dd>
        <dt>Light gathered</dt><dd>{formatBig(s.drifterCollected, 0)}</dd>
        <dt>Discoveries</dt><dd>{discoveryCount()}</dd>
      </dl>
      {s.traits.length > 0 && (
        <div className="codex-traits">
          {s.traits.map((t) => {
            const def = TRAITS[t];
            if (!def) return null;
            return <span key={t} className={`trait-chip trait-${def.family}`} title={def.description}>{def.name}</span>;
          })}
        </div>
      )}
      <div className="codex-settings">
        <span className="codex-label">Visual quality</span>
        <div className="codex-seg" role="radiogroup" aria-label="Visual quality">
          {QUALITY_PRESETS.map((p) => (
            <button key={p.level} role="radio" aria-checked={quality === p.level} className={quality === p.level ? 'on' : ''} onClick={() => pickQuality(p.level)}>
              {p.name}
            </button>
          ))}
        </div>
        <label className="codex-toggle">
          <input type="checkbox" checked={reducedMotion} onChange={(e) => useGameStore.setState({ reducedMotion: e.target.checked })} />
          Reduced motion
        </label>
      </div>
    </aside>
  );
}
