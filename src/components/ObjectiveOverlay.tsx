import { useEffect, useState } from 'react';
import { useGameStore, CosmicEventKind } from '../store/useGameStore';

// Events are introduced as phenomena, not tasks: a name, one line of
// invitation, and a quiet progress row. No countdown digits; failure is gentle.
const EVENT_COPY: Record<CosmicEventKind, { name: string; invite: string }> = {
  meteor:    { name: 'Meteor shower',  invite: 'Falling light crosses your sector — gather it' },
  eclipse:   { name: 'Eclipse',        invite: 'Darkness passes over. Be still and let it pass' },
  resonance: { name: 'Resonance',      invite: 'It is calling — answer its pulse with a few touches' },
  bloom:     { name: 'Bloom',          invite: 'It has opened — feed it while the bloom lasts' },
  quasar:    { name: 'Quasar',         invite: 'Fragments drift from a waking quasar — catch them' },
  twinning:  { name: 'Twinning',       invite: 'Something is dividing. Watch' },
};

export default function ObjectiveOverlay() {
  const obj = useGameStore((s) => s.activeObjective);
  const [, force] = useState(0);

  useEffect(() => {
    if (!obj) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [obj]);

  if (!obj) return null;
  const copy = EVENT_COPY[obj.kind];
  const elapsed = performance.now() / 1000 - obj.startedAt;
  const remain = Math.max(0, 1 - elapsed / obj.durationSec);
  const pct = Math.min(1, obj.progress / obj.target);
  const discrete = obj.target <= 8 && obj.kind !== 'eclipse' && obj.kind !== 'twinning';
  const stateClass = obj.completed ? 'done' : obj.failed ? 'failed' : '';

  return (
    <div className={`event-lane ${stateClass}`} role="status" aria-live="polite">
      <div className="event-name">{copy.name}</div>
      <div className="event-invite">
        {obj.completed ? 'It left a mark on your organism' : obj.failed ? 'The moment passed. It will come again' : copy.invite}
      </div>
      {!obj.completed && !obj.failed && (
        <>
          {discrete ? (
            <div className="event-dots" aria-label={`${Math.floor(obj.progress)} of ${obj.target}`}>
              {Array.from({ length: obj.target }).map((_, i) => (
                <span key={i} className={i < Math.floor(obj.progress) ? 'on' : ''} />
              ))}
            </div>
          ) : (
            <div className="event-bar" aria-hidden><div style={{ width: `${pct * 100}%` }} /></div>
          )}
          <div className="event-time" aria-hidden><div style={{ transform: `scaleX(${remain})` }} /></div>
        </>
      )}
    </div>
  );
}
