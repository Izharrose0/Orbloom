import { useControls, button, folder, useCreateStore, LevaPanel } from 'leva';
import { useGameStore } from '../store/useGameStore';
import { STAGES, stageForMass } from '../lib/stages';
import { TRAITS, ALL_TRAIT_IDS, COMPOSITES, TraitFamily } from '../lib/traits';
import { NOISE_TYPE_NAMES } from '../lib/genome';
import { fireEvent } from '../systems/cosmicEvents';
import { DEBUG_ENABLED } from './debug';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const FAMILY_ORDER: TraitFamily[] = ['surface', 'form', 'color', 'decoration', 'rhythm'];

function setMass(v: number) {
  const stage = stageForMass(v);
  useGameStore.setState({ mass: v, evolution: Math.log2(1 + v), stage });
}
function bumpMass(mul: number) {
  const s = useGameStore.getState();
  setMass(Math.max(1, s.mass * mul));
}

/** LEFT PANEL — composite presets + events + mass control */
function LeftPanel() {
  const store = useCreateStore();
  const liveMass = useGameStore((s) => s.mass);

  useControls(
    'Live',
    {
      Mass:  { value: liveMass.toFixed(2), editable: false } as any,
    },
    [liveMass],
    { store } as any
  );

  useControls(
    'Composite presets',
    () =>
      Object.fromEntries(
        COMPOSITES.map((c) => [
          c.name,
          button(() => useGameStore.getState().applyComposite(c.recipe, true)),
        ])
      ),
    { store } as any
  );

  useControls(
    'Add composite (no replace)',
    () =>
      Object.fromEntries(
        COMPOSITES.map((c) => [
          `+ ${c.name}`,
          button(() => useGameStore.getState().applyComposite(c.recipe, false)),
        ])
      ),
    { store, collapsed: true } as any
  );

  useControls(
    'Events',
    {
      Meteor:    button(() => fireEvent('meteor',    () => window.__orbloom?.triggerMeteorShower?.())),
      Eclipse:   button(() => fireEvent('eclipse')),
      Resonance: button(() => fireEvent('resonance')),
      Bloom:     button(() => fireEvent('bloom')),
      Quasar:    button(() => fireEvent('quasar')),
      Twinning:  button(() => fireEvent('twinning')),
      Clear:     button(() => useGameStore.getState().clearEvent()),
    },
    { store } as any
  );

  useControls(
    'Noise type (overrides genome)',
    Object.fromEntries(
      NOISE_TYPE_NAMES.map((n, i) => [
        n,
        button(() => useGameStore.setState({ noiseTypeOverride: i })),
      ]).concat([['(use genome)', button(() => useGameStore.setState({ noiseTypeOverride: null }))]])
    ) as any,
    { store, collapsed: false } as any
  );

  useControls(
    'Mass control',
    {
      mass: {
        value: clamp(liveMass, 1, 1e9),
        min: 1,
        max: 1e9,
        step: 0.1,
        onChange: (v: number) => setMass(v),
      },
      'x10':   button(() => bumpMass(10)),
      'x100':  button(() => bumpMass(100)),
      'Reset': button(() => setMass(1)),
    },
    { store, collapsed: true } as any
  );

  useControls(
    'Jump to stage',
    Object.fromEntries(STAGES.map((s) => [s.name, button(() => setMass(s.threshold + 0.5))])),
    { store, collapsed: true } as any
  );

  return (
    <LevaPanel
      store={store}
      titleBar={{ title: 'Composti & eventi', drag: true }}
      theme={{
        colors: { accent1: '#ffae66', accent2: '#ff66cc' },
        sizes: { rootWidth: '320px' },
      }}
    />
  );
}

/** RIGHT PANEL — scalar slider per trait, grouped by family */
function RightPanel() {
  const store = useCreateStore();
  const live = useGameStore((s) => s.traitAmounts);

  // Build all family folders in a single useControls call (rules-of-hooks safe)
  const schema: Record<string, any> = {};
  FAMILY_ORDER.forEach((family) => {
    const traitsInFamily = ALL_TRAIT_IDS.filter((id) => TRAITS[id].family === family);
    const fields: Record<string, any> = {};
    traitsInFamily.forEach((id) => {
      fields[TRAITS[id].name] = {
        value: live[id] ?? 0,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (v: number) => useGameStore.getState().setTraitAmount(id, v),
      };
    });
    schema[family.toUpperCase()] = folder(fields, { collapsed: false });
  });
  schema['_actions'] = folder(
    {
      'Clear all': button(() => useGameStore.getState().clearAllTraits()),
      'Grant random': button(() => {
        const id = ALL_TRAIT_IDS[Math.floor(Math.random() * ALL_TRAIT_IDS.length)];
        useGameStore.getState().grantTrait(id);
      }),
    },
    { collapsed: false }
  );

  useControls(() => schema, { store } as any);

  return (
    <LevaPanel
      store={store}
      titleBar={{ title: 'Tratti · scalari', drag: true }}
      theme={{
        colors: { accent1: '#7df3ff', accent2: '#b066ff' },
        sizes: { rootWidth: '320px' },
      }}
    />
  );
}

export default function DebugPanel() {
  if (!DEBUG_ENABLED) return null;
  return (
    <>
      <div className="debug-left">
        <LeftPanel />
      </div>
      <div className="debug-right">
        <RightPanel />
      </div>
    </>
  );
}
