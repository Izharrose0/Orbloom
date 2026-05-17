import { useControls, button, folder, Leva } from 'leva';
import { useGameStore } from '../store/useGameStore';
import { STAGES, stageForMass } from '../lib/stages';
import { DEBUG_ENABLED } from './debug';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function DebugPanel() {
  if (!DEBUG_ENABLED) return null;

  // Live values displayed in panel
  const liveMass = useGameStore((s) => s.mass);
  const liveStage = useGameStore((s) => s.stage);
  const livePulse = useGameStore((s) => s.pulseIntensity);
  const liveEvent = useGameStore((s) => s.activeEvent);

  useControls({
    Live: folder(
      {
        Mass:  { value: liveMass.toFixed(2), editable: false } as any,
        Stage: { value: `${liveStage.id} · ${liveStage.name}`, editable: false } as any,
        Pulse: { value: livePulse.toFixed(2), editable: false } as any,
        Event: { value: liveEvent ?? '—', editable: false } as any,
      },
      { collapsed: false }
    ),
  }, [liveMass, liveStage.id, livePulse, liveEvent]);

  useControls({
    'Set mass': folder(
      {
        mass: {
          value: clamp(liveMass, 1, 1e9),
          min: 1,
          max: 1e9,
          step: 0.1,
          onChange: (v: number) => {
            const stage = stageForMass(v);
            useGameStore.setState({ mass: v, evolution: Math.log2(1 + v), stage });
          },
        },
        'Jump x10':   button(() => bumpMass(10)),
        'Jump x100':  button(() => bumpMass(100)),
        'Reset':      button(() => setMass(1)),
      },
      { collapsed: true }
    ),

    'Jump to stage': folder(
      Object.fromEntries(
        STAGES.map((s) => [s.name, button(() => setMass(s.threshold + 0.5))])
      ),
      { collapsed: true }
    ),

    'Events': folder(
      {
        'Meteor shower':  button(() => {
          window.__orbloom?.triggerMeteorShower?.();
          useGameStore.getState().startEvent('meteor', 8);
        }),
        'Eclipse':        button(() => useGameStore.getState().startEvent('eclipse', 8)),
        'Resonance':      button(() => useGameStore.getState().startEvent('resonance', 10)),
        'Clear event':    button(() => useGameStore.getState().clearEvent()),
      },
      { collapsed: true }
    ),

    'Actions': folder(
      {
        'Pulse +1':       button(() => useGameStore.getState().absorbEnergy(1)),
        'Pulse +10':      button(() => useGameStore.getState().absorbEnergy(10)),
        'Collect drifter':button(() => useGameStore.getState().collectDrifter(8)),
        'Welcome back demo': button(() =>
          useGameStore.setState({
            welcomeBackAmount: 12.34,
            welcomeBackShownAt: performance.now() / 1000,
          })
        ),
      },
      { collapsed: true }
    ),
  });

  return <Leva collapsed titleBar={{ title: 'orbloom debug' }} />;
}

function setMass(v: number) {
  const stage = stageForMass(v);
  useGameStore.setState({ mass: v, evolution: Math.log2(1 + v), stage });
}
function bumpMass(mul: number) {
  const s = useGameStore.getState();
  setMass(Math.max(1, s.mass * mul));
}
