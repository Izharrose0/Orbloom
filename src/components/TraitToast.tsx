import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';
import { TRAITS } from '../lib/traits';
import { sfxMutation } from '../audio/audio';

const FAMILY_VERB: Record<string, string> = {
  surface: 'Its skin changes',
  form: 'Its body reshapes',
  color: 'Its light shifts',
  decoration: 'Something new forms around it',
  rhythm: 'Its rhythm changes',
};

/** A mutation is announced quietly, below the organism — the change itself is the reward. */
export default function TraitToast() {
  const recentTraitId = useGameStore((s) => s.recentTraitId);
  const consume = useGameStore((s) => s.consumeRecentTrait);

  useEffect(() => {
    if (!recentTraitId) return;
    sfxMutation();
    const t = setTimeout(consume, 6500);
    return () => clearTimeout(t);
  }, [recentTraitId, consume]);

  if (!recentTraitId) return null;
  const def = TRAITS[recentTraitId];
  if (!def) return null;

  return (
    <div className="trait-toast" key={recentTraitId} role="status" aria-live="polite">
      <div className="trait-toast-eyebrow">{FAMILY_VERB[def.family] ?? 'Mutation'}</div>
      <div className="trait-toast-name">{def.name}</div>
      <div className="trait-toast-desc">{def.description}</div>
    </div>
  );
}
