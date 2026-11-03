import { useControls, button, folder, useCreateStore, LevaPanel } from 'leva';
import { useGameStore } from '../store/useGameStore';
import { STAGES, stageForMass } from '../lib/stages';
import { TRAITS, ALL_TRAIT_IDS, COMPOSITES, TraitFamily } from '../lib/traits';
import { NOISE_TYPE_NAMES, BASE_FORM_NAMES, deriveGenome } from '../lib/genome';
import { phenomena } from '../systems/fx';
import { persistQuality, QualityLevel } from '../lib/quality';
import { SINGULARITY_MASS } from '../lib/morphology';

// Genome presets: one per base form, chosen for variety (noise families, hues).
const GENOME_PRESETS: Record<string, string> = {
  'Sphere · turbulence': 'c255404e-4fb4-4003-4d66-08697a8d41be',
  'Capsule · turbulence': 'a4c123b1-612d-d272-d137-1c17149d4395',
  'Torus · ridged': 'cc3fc162-6e53-a130-43b0-26c48bbf33fe',
  'Crystal · simplex': '36b3216f-daee-b975-729f-ae923d5a4fd1',
  'Cube · ridged': 'd6ba2b0a-ee0c-a923-7328-81584d8c4fa2',
  'Knot · warped': '5ec84d8d-bc74-2547-70f5-8904dba41ecc',
};

function previewGenome(uuid: string | null) {
  const s = useGameStore.getState();
  // visual-only: the save row stays tied to the real userId
  useGameStore.setState({ genome: deriveGenome(uuid ?? s.userId), baseFormOverride: null, noiseTypeOverride: null });
}

function randomUuid() {
  return crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2, 14).padEnd(12, '0');
}
import { fireEvent } from '../systems/cosmicEvents';
import { DEBUG_ENABLED } from './debug';
import OrbCensus from './OrbCensus';

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
    'Genome preview (visual only)',
    Object.fromEntries([
      ...Object.entries(GENOME_PRESETS).map(([n, id]) => [n, button(() => previewGenome(id))]),
      ['Random genome', button(() => previewGenome(randomUuid()))],
      ['(my genome)', button(() => previewGenome(null))],
    ]) as any,
    { store, collapsed: true } as any
  );

  useControls(
    'Look & quality',
    {
      'Toggle legacy look (1.x)': button(() => useGameStore.setState((st) => ({ legacyLook: !st.legacyLook }))),
      'Quality: low': button(() => { useGameStore.getState().setQuality(0); persistQuality(0 as QualityLevel); }),
      'Quality: medium': button(() => { useGameStore.getState().setQuality(1); persistQuality(1 as QualityLevel); }),
      'Quality: high': button(() => { useGameStore.getState().setQuality(2); persistQuality(2 as QualityLevel); }),
      'Quality: auto': button(() => persistQuality(null)),
      'Toggle reduced motion': button(() => useGameStore.setState((st) => ({ reducedMotion: !st.reducedMotion }))),
      'Toggle phone frame': button(() => document.body.classList.toggle('debug-phone')),
    },
    { store, collapsed: true } as any
  );

  useControls(
    'Behaviour & phenomena',
    {
      'Simulate long idle': button(() => useGameStore.setState({ lastTapAt: -1000, lastInteractionAt: -1000 })),
      'Wake up': button(() => useGameStore.getState().touchInteraction()),
      Comet: button(() => phenomena.start('comet', 14)),
      'Stellar wind': button(() => phenomena.start('stellarWind', 16)),
      Aurora: button(() => phenomena.start('aurora', 18)),
      'Supernova (rare)': button(() => phenomena.start('supernova', 28)),
      'Leviathan (rare)': button(() => phenomena.start('leviathan', 45)),
    },
    { store, collapsed: true } as any
  );

  useControls(
    'Base form (overrides genome)',
    Object.fromEntries(
      BASE_FORM_NAMES.map((n, i) => [
        n,
        button(() => useGameStore.setState({ baseFormOverride: i })),
      ]).concat([['(use genome)', button(() => useGameStore.setState({ baseFormOverride: null }))]])
    ) as any,
    { store, collapsed: false } as any
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
      'Next epoch (x2)': button(() => {
        const m = useGameStore.getState().mass;
        setMass(m < SINGULARITY_MASS * 2 ? SINGULARITY_MASS * 2 + 1 : m * 2);
      }),
      'Reset': button(() => setMass(1)),
    },
    { store, collapsed: false } as any
  );

  useControls(
    'Jump to stage',
    Object.fromEntries(STAGES.map((s) => [s.name, button(() => setMass(s.threshold + 0.5))])),
    { store, collapsed: false } as any
  );

  useControls(
    'Spawn drifter shape',
    {
      Icosa:      button(() => window.__orbloom?.spawnDrifterShape?.('icosa')),
      Dodeca:     button(() => window.__orbloom?.spawnDrifterShape?.('dodeca')),
      Octa:       button(() => window.__orbloom?.spawnDrifterShape?.('octa')),
      RoundedBox: button(() => window.__orbloom?.spawnDrifterShape?.('roundedBox')),
      Cylinder:   button(() => window.__orbloom?.spawnDrifterShape?.('cylinder')),
      Stellated:  button(() => window.__orbloom?.spawnDrifterShape?.('stellated')),
    },
    { store, collapsed: false } as any
  );

  useControls(
    'Direct (bypass objectives)',
    {
      'Spawn meteor shower NOW': button(() => {
        const ok = window.__orbloom?.triggerMeteorShower;
        if (ok) ok();
        else console.warn('[orbloom debug] meteor shower trigger not registered');
      }),
    },
    { store, collapsed: false } as any
  );

  return (
    <LevaPanel
      store={store}
      titleBar={{ title: 'Composites & events', drag: true }}
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
      titleBar={{ title: 'Traits · scalars', drag: true }}
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
      <OrbCensus />
    </>
  );
}
