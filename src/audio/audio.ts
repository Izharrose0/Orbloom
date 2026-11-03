// Procedural Web Audio. Zero asset files required.
// Designed to be soft, slow, non-fatiguing — sub bass + warm pad + occasional shimmer.

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbBus: GainNode | null = null;
let dryBus: GainNode | null = null;

let droneStarted = false;
let muted = false;

// Adaptive soundscape profile (set by the organism controller; applied with slow ramps)
export type AudioProfile = { transpose: number; breathHz: number; stage: number; idle: number; brightness: number };
let profile: AudioProfile = { transpose: 0, breathHz: 0.09, stage: 0, idle: 0, brightness: 0.5 };
let padFilter: BiquadFilterNode | null = null;
let breathLfo: OscillatorNode | null = null;
let breathBus: GainNode | null = null;
let shimmerBus: GainNode | null = null;
let subBus: GainNode | null = null;

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

  // Notes (Hz): C2, G2, Eb3, Bb3, F4 — transposed per genome so every organism has its own key
  const k = Math.pow(2, profile.transpose / 12);
  const notes = [65.41, 98.0, 155.56, 233.08, 349.23].map((f) => f * k);
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
  padFilter = filter;

  // Very long attack
  padBus.gain.linearRampToValueAtTime(0.85, c.currentTime + 8);

  startLayers(c, k);
  applyProfile();
}

// Biological breathing (filtered noise swelling at the organism's breath rate),
// surface shimmer (from Pulsar) and internal sub resonance (from White Hole).
function startLayers(c: AudioContext, k: number) {
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 3; }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 420;
  bp.Q.value = 0.6;
  breathBus = c.createGain();
  breathBus.gain.value = 0;
  const amp = c.createGain();
  amp.gain.value = 0.5;
  breathLfo = c.createOscillator();
  breathLfo.frequency.value = profile.breathHz;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 0.5;
  breathLfo.connect(lfoDepth).connect(amp.gain);
  noise.connect(bp).connect(amp).connect(breathBus);
  send(breathBus, 0.6, 0.6);
  noise.start();
  breathLfo.start();

  shimmerBus = c.createGain();
  shimmerBus.gain.value = 0;
  [1046.5, 1568.0].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * k;
    const g = c.createGain();
    g.gain.value = 0.012;
    const trem = c.createOscillator();
    trem.frequency.value = 0.07 + i * 0.05;
    const tg = c.createGain();
    tg.gain.value = 0.01;
    trem.connect(tg).connect(g.gain);
    o.connect(g).connect(shimmerBus!);
    o.start();
    trem.start();
  });
  send(shimmerBus, 0.2, 1.0);

  subBus = c.createGain();
  subBus.gain.value = 0;
  const sub = c.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 32.7 * k * 2;
  const subG = c.createGain();
  subG.gain.value = 0.09;
  sub.connect(subG).connect(subBus);
  send(subBus, 0.9, 0.2);
  sub.start();
}

function applyProfile() {
  if (!ctx || !droneStarted) return;
  const t = ctx.currentTime;
  const p = profile;
  breathBus?.gain.setTargetAtTime(0.05 * (0.6 + p.idle * 0.6), t, 2.5);
  breathLfo?.frequency.setTargetAtTime(p.breathHz * (1 - p.idle * 0.3), t, 3);
  shimmerBus?.gain.setTargetAtTime(p.stage >= 2 ? 0.6 + p.brightness * 0.4 : 0, t, 4);
  subBus?.gain.setTargetAtTime(p.stage >= 4 ? 0.7 : 0, t, 5);
  // meditation darkens the pad; luminous organisms keep it a little brighter
  padFilter?.frequency.setTargetAtTime(520 + p.brightness * 360 - p.idle * 200, t, 4);
}

/** Called ~1 Hz by the organism controller. Never jumps: everything ramps. */
export function setAudioProfile(p: Partial<AudioProfile>) {
  const prevTranspose = profile.transpose;
  profile = { ...profile, ...p };
  if (droneStarted && prevTranspose !== profile.transpose) {
    // key is fixed once the pad is running (it would require rebuilding every voice);
    // genome normally arrives before the first gesture starts audio.
    profile.transpose = prevTranspose;
  }
  applyProfile();
}

// Soft tap — rounded sine pluck. `pitch` (0..1) maps where you touched the
// organism onto a pentatonic scale (low on the underside, high on top), so
// exploring the body plays a melody. `intensity` drops with rapid tapping.
const TAP_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
export function sfxTap(pitch = Math.random(), intensity = 1) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  const idx = Math.max(0, Math.min(TAP_SCALE.length - 1, Math.round(pitch * (TAP_SCALE.length - 1))));
  o.frequency.value = TAP_SCALE[idx];
  // soft second partial a fifth above, quieter — a little more "bell", less "beep"
  const o2 = c.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = TAP_SCALE[idx] * 1.5;

  const peak = 0.05 + 0.045 * Math.max(0, Math.min(1, intensity));
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  const g2 = c.createGain();
  g2.gain.value = 0.18;

  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;

  o.connect(lp);
  o2.connect(g2).connect(lp);
  lp.connect(g);
  send(g, 0.55, 0.95);
  o.start(now);
  o2.start(now);
  o.stop(now + 1.5);
  o2.stop(now + 1.5);
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

// Synchronisation — a slow, low heartbeat chord swelling under the pad
export function sfxSync() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  [98.0, 146.83, 196.0].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    // four soft heartbeats
    for (let k = 0; k < 4; k++) {
      const t0 = now + k * 2.2 + i * 0.02;
      g.gain.exponentialRampToValueAtTime(0.06 / (i + 1), t0 + 0.25);
      g.gain.exponentialRampToValueAtTime(0.004, t0 + 1.6);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, now + 9.5);
    o.connect(g);
    send(g, 0.5, 0.9);
    o.start(now);
    o.stop(now + 9.8);
  });
}

// Spore release — a tiny airy glint, very quiet
export function sfxSpore() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(1318.5, now);
  o.frequency.exponentialRampToValueAtTime(1760, now + 1.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.018, now + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
  o.connect(g);
  send(g, 0.2, 1.0);
  o.start(now);
  o.stop(now + 2.3);
}

// Morphological mutation — a slow rising swell (used for stage/epoch growth)
export function sfxMutation() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  [130.81, 196.0, 261.63, 329.63, 392.0].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(f * 0.985, now);
    o.frequency.linearRampToValueAtTime(f, now + 3);
    const g = c.createGain();
    const start = now + i * 0.35;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.06, start + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 6.0);
    o.connect(g);
    send(g, 0.3, 1.0);
    o.start(start);
    o.stop(start + 6.2);
  });
}
