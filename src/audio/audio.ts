// Procedural Web Audio. Zero asset files required.
// Designed to be soft, slow, non-fatiguing — sub bass + warm pad + occasional shimmer.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbBus: GainNode | null = null;
let dryBus: GainNode | null = null;

let droneStarted = false;
let muted = false;

const MASTER_VOL = 0.32;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOL;
    masterGain.connect(ctx.destination);

    // Buses
    dryBus = ctx.createGain();
    dryBus.gain.value = 0.85;
    dryBus.connect(masterGain);

    reverbBus = ctx.createGain();
    reverbBus.gain.value = 0.55;

    const conv = ctx.createConvolver();
    conv.buffer = synthIR(ctx, 3.6, 0.0008);
    reverbBus.connect(conv).connect(masterGain);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Synthesize a smooth exponential-decay impulse response (no asset file needed).
function synthIR(ac: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ac.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ac.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // colored noise (slightly low-pass) with exponential decay
      const env = Math.pow(1 - i / len, 2);
      const n = (Math.random() * 2 - 1) * env;
      data[i] = n * Math.exp(-i * decay);
    }
  }
  return buf;
}

function send(node: AudioNode, dryAmt = 1, wetAmt = 0.5) {
  if (dryBus) {
    const d = ctx!.createGain();
    d.gain.value = dryAmt;
    node.connect(d).connect(dryBus);
  }
  if (reverbBus) {
    const w = ctx!.createGain();
    w.gain.value = wetAmt;
    node.connect(w).connect(reverbBus);
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (masterGain && ctx) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(m ? 0 : MASTER_VOL, ctx.currentTime + 0.4);
  }
}

// Soft sustained pad on a Cmin9 voicing. Sine + triangle, gentle filter, slow LFO.
export function startAmbient() {
  const c = getCtx();
  if (!c || !masterGain || droneStarted) return;
  droneStarted = true;

  // Notes (Hz): C2, G2, Eb3, Bb3, F4
  const notes = [65.41, 98.0, 155.56, 233.08, 349.23];
  const types: OscillatorType[] = ['sine', 'sine', 'triangle', 'sine', 'triangle'];

  const padBus = c.createGain();
  padBus.gain.value = 0.0001;

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  filter.Q.value = 0.7; // gentle, no resonance ringing

  const lfo = c.createOscillator();
  lfo.frequency.value = 0.04;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 120; // small filter sweep
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  notes.forEach((freq, i) => {
    // Two slightly detuned voices per note for chorusing
    [-4, +5].forEach((detuneCents) => {
      const o = c.createOscillator();
      o.type = types[i] || 'sine';
      o.frequency.value = freq;
      o.detune.value = detuneCents;
      const g = c.createGain();
      g.gain.value = 0.13;

      // Slow amplitude wobble per voice
      const ampLfo = c.createOscillator();
      ampLfo.frequency.value = 0.03 + Math.random() * 0.04;
      const ampLfoGain = c.createGain();
      ampLfoGain.gain.value = 0.04;
      ampLfo.connect(ampLfoGain).connect(g.gain);
      ampLfo.start();

      o.connect(g).connect(filter);
      o.start();
    });
  });

  filter.connect(padBus);
  send(padBus, 0.7, 0.85);

  // Very long attack
  padBus.gain.linearRampToValueAtTime(0.85, c.currentTime + 8);
}

// Soft tap — rounded sine pluck, low volume, plenty of reverb
export function sfxTap() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  // pentatonic notes for a "musical" tap experience
  const notes = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5 D5 E5 G5 A5
  o.frequency.value = notes[Math.floor(Math.random() * notes.length)];

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

  // Low-pass to take edge off
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;

  o.connect(lp).connect(g);
  send(g, 0.55, 0.95);
  o.start(now);
  o.stop(now + 1.5);
}

// Collect — soft bell, two-voice, generous reverb
export function sfxCollect() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  const fundamentals = [440, 523.25]; // A4 + C5 third-ish
  fundamentals.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * 2; // shift up an octave for sparkle
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now + i * 0.03);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.02 + i * 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2 + i * 0.1);
    o.connect(g);
    send(g, 0.4, 1.0);
    o.start(now + i * 0.03);
    o.stop(now + 2.4 + i * 0.1);
  });
}

// Stage transition swell — uplifting, soft
export function sfxStageUp() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  const notes = [261.63, 392.0, 523.25, 783.99]; // C4 G4 C5 G5
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    const start = now + i * 0.18;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.11, start + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 3.0);
    o.connect(g);
    send(g, 0.4, 1.0);
    o.start(start);
    o.stop(start + 3.2);
  });
}

// Resonance event — slow harmonic shift on the drone (use a brief lush chime)
export function sfxResonance() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  const notes = [329.63, 415.3, 493.88]; // E4 Ab4 B4 - shimmery
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = c.createGain();
    const start = now + i * 0.08;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.08, start + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 4.5);
    o.connect(g);
    send(g, 0.3, 1.0);
    o.start(start);
    o.stop(start + 4.6);
  });
}
