import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { TRAITS } from '../lib/traits';

export default function TraitToast() {
  const recentTraitId = useGameStore((s) => s.recentTraitId);
  const consume = useGameStore((s) => s.consumeRecentTrait);

  useEffect(() => {
    if (!recentTraitId) return;
    const t = setTimeout(consume, 5200);
    return () => clearTimeout(t);
  }, [recentTraitId, consume]);

  if (!recentTraitId) return null;
  const def = TRAITS[recentTraitId];
  if (!def) return null;

  return (
    <div className="trait-toast" key={recentTraitId + Date.now()}>
      <div className="trait-toast-eyebrow">Nuovo tratto · {def.family}</div>
      <div className="trait-toast-name">{def.name}</div>
      <div className="trait-toast-desc">{def.description}</div>
    </div>
  );
}
