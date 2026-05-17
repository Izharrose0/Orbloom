import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export default function ObjectiveOverlay() {
  const obj = useGameStore((s) => s.activeObjective);
  const [, force] = useState(0);

  // tick so the timer counter visibly updates
  useEffect(() => {
    if (!obj) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [obj]);

  if (!obj) return null;

  const now = performance.now() / 1000;
  const elapsed = now - obj.startedAt;
  const remain = Math.max(0, obj.durationSec - elapsed);
  const pct = Math.min(1, obj.progress / obj.target);
  const stateClass = obj.completed ? 'done' : obj.failed ? 'failed' : '';

  return (
    <div className={`objective ${stateClass}`}>
      <div className="objective-row">
        <span className="objective-kind">{obj.kind}</span>
        <span className="objective-timer">{remain.toFixed(1)}s</span>
      </div>
      <div className="objective-desc">{obj.description}</div>
      <div className="objective-bar">
        <div className="objective-bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="objective-progress">
        {Math.floor(obj.progress)} / {obj.target}
        {obj.completed && ' · COMPLETE'}
        {obj.failed && ' · MISSED'}
      </div>
    </div>
  );
}
