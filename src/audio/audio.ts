// Procedural Web Audio. Zero asset files required.
// Ambient drone + SFX synthesis. Started lazily on first user gesture (browser autoplay policy).

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let droneNodes: { stop: () => void } | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.55;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain && ctx) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(m ? 0 : 0.55, ctx.currentTime + 0.25);
  }
}

export function startAmbient() {
  const c = getCtx();
  if (!c || !masterGain || droneNodes) return;

  // Two slightly detuned saw oscillators through a slow lowpass, plus a sub.
  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 55;

  const o1 = c.createOscillator();
  o1.type = 'sawtooth';
  o1.frequency.value = 110;
  o1.detune.value = -7;

  const o2 = c.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = 110;
  o2.detune.value = +9;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 6;

  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 220;
  lfo.connect(lfoGain).connect(filter.frequency);

  const droneGain = c.createGain();
  droneGain.gain.value = 0;

  o1.connect(filter);
  o2.connect(filter);
  filter.connect(droneGain);

  const subGain = c.createGain();
  subGain.gain.value = 0;
  sub.connect(subGain);

  droneGain.connect(masterGain);
  subGain.connect(masterGain);

  o1.start();
  o2.start();
  sub.start();
  lfo.start();

  droneGain.gain.linearRampToValueAtTime(0.18, c.currentTime + 4);
  subGain.gain.linearRampToValueAtTime(0.12, c.currentTime + 6);

  droneNodes = {
    stop: () => {
      try {
        o1.stop();
        o2.stop();
        sub.stop();
        lfo.stop();
      } catch {}
    },
  };
}

export function sfxTap() {
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(880, now);
  o.frequency.exponentialRampToValueAtTime(220, now + 0.25);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  o.connect(g).connect(masterGain);
  o.start(now);
  o.stop(now + 0.32);
}

export function sfxCollect() {
  const c = getCtx();
  if (!c || !masterGain) return;
  const now = c.currentTime;

  // Bell-like FM
  const carrier = c.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.value = 660;

  const mod = c.createOscillator();
  mod.type = 'sine';
  mod.frequency.value = 990;

  const modGain = c.createGain();
  modGain.gain.value = 480;
  mod.connect(modGain).connect(carrier.frequency);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

  carrier.connect(g).connect(masterGain);
  carrier.start(now);
  mod.start(now);
  carrier.stop(now + 1.25);
  mod.stop(now + 1.25);

  // Sparkle
  for (let i = 0; i < 4; i++) {
    const s = c.createOscillator();
    s.type = 'triangle';
    s.frequency.value = 1320 + Math.random() * 1800;
    const sg = c.createGain();
    const start = now + 0.04 + i * 0.06;
    sg.gain.setValueAtTime(0.0001, start);
    sg.gain.exponentialRampToValueAtTime(0.07, start + 0.005);
    sg.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    s.connect(sg).connect(masterGain);
    s.start(start);
    s.stop(start + 0.3);
  }
}
