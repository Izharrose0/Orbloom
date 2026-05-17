import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { sfxStageUp } from '../audio/audio';

export default function StageTransition() {
  const stage = useGameStore((s) => s.stage);
  const welcomeBackAmount = useGameStore((s) => s.welcomeBackAmount);
  const [flash, setFlash] = useState<{ name: string; key: number } | null>(null);
  const lastShownId = useRef<number>(stage.id);
  const isFirstChange = useRef(true);

  useEffect(() => {
    // Skip the very first stage change (it's the hydration from remote, not a real "mutation")
    if (isFirstChange.current) {
      isFirstChange.current = false;
      lastShownId.current = stage.id;
      return;
    }
    if (stage.id === lastShownId.current) return;
    if (stage.id <= lastShownId.current) {
      // could happen if mass is reset (prestige later) — don't celebrate downward
      lastShownId.current = stage.id;
      return;
    }
    // If the welcome-back toast is currently on screen, defer the flash so they don't overlap
    if (welcomeBackAmount > 0) {
      const wait = setTimeout(() => {
        lastShownId.current = stage.id;
        setFlash({ name: stage.name, key: Date.now() });
        sfxStageUp();
        if ('vibrate' in navigator) navigator.vibrate?.([20, 80, 60]);
      }, 6200);
      return () => clearTimeout(wait);
    }
    lastShownId.current = stage.id;
    setFlash({ name: stage.name, key: Date.now() });
    sfxStageUp();
    if ('vibrate' in navigator) navigator.vibrate?.([20, 80, 60]);
    const t = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(t);
  }, [stage.id, stage.name, welcomeBackAmount]);

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
