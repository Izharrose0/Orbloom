import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { sfxStageUp } from '../audio/audio';

export default function StageTransition() {
  const stage = useGameStore((s) => s.stage);
  const [flash, setFlash] = useState<{ name: string; key: number } | null>(null);
  const [prevId, setPrevId] = useState(stage.id);

  useEffect(() => {
    if (stage.id !== prevId) {
      setPrevId(stage.id);
      if (stage.id > 0) {
        setFlash({ name: stage.name, key: Date.now() });
        sfxStageUp();
        if ('vibrate' in navigator) navigator.vibrate?.([20, 80, 60]);
        const t = setTimeout(() => setFlash(null), 3200);
        return () => clearTimeout(t);
      }
    }
  }, [stage.id, prevId, stage.name]);

  if (!flash) return null;

  return (
    <div className="stage-transition" key={flash.key}>
      <div className="stage-transition-flash" />
      <div className="stage-transition-label">
        <span className="stage-transition-eyebrow">Mutazione</span>
        <span className="stage-transition-name">{flash.name}</span>
      </div>
    </div>
  );
}
