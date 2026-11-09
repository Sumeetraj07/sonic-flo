// Client-side audio analysis & mixing engine using Web Audio API.
// Real BPM estimation via energy autocorrelation, RMS energy, peak loudness,
// and a real crossfade mixer that produces a downloadable WAV with genre-specific mastering.

export interface MixEQ {
  bass: number;
  mid: number;
  high: number;
}

export interface AnalyzedTrack {
  id: string;
  file: File;
  name: string;
  size: number;
  duration: number;
  bpm: number;
  key: string;
  energy: number;       // 0-1
  loudness: number;     // dB-ish, negative
  buffer: AudioBuffer;
  url: string;
  peaks: number[];      // ~200 normalized peaks for waveform
  eq?: MixEQ;
}

const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const MODES = ["maj", "min"];

let _ctx: AudioContext | null = null;
export function getCtx(): AudioContext {
  if (typeof window === "undefined") throw new Error("AudioContext only in browser");
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx;
}

export async function decodeFile(file: File): Promise<AudioBuffer> {
  const arr = await file.arrayBuffer();
  const ctx = getCtx();
  return await ctx.decodeAudioData(arr.slice(0));
}

// Estimate BPM via onset envelope autocorrelation
export function estimateBPM(buffer: AudioBuffer): number {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const hop = 512;
  const frames = Math.floor(data.length / hop);
  // Onset envelope (simple energy diff)
  const env = new Float32Array(frames);
  let prev = 0;
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    const start = i * hop;
    for (let j = 0; j < hop; j++) sum += data[start + j] * data[start + j];
    const e = Math.sqrt(sum / hop);
    env[i] = Math.max(0, e - prev);
    prev = e;
  }
  // Autocorrelation in BPM range 70-180
  const minBpm = 70, maxBpm = 180;
  const minLag = Math.floor((60 / maxBpm) * sr / hop);
  const maxLag = Math.floor((60 / minBpm) * sr / hop);
  let bestLag = minLag, bestVal = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < env.length; i++) s += env[i] * env[i + lag];
    if (s > bestVal) { bestVal = s; bestLag = lag; }
  }
  const bpm = (60 * sr) / (bestLag * hop);
  return Math.round(bpm * 10) / 10;
}

export function computeEnergy(buffer: AudioBuffer): { energy: number; loudness: number } {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / 50000));
  let sum = 0, peak = 0, n = 0;
  for (let i = 0; i < data.length; i += step) {
    const v = Math.abs(data[i]);
    sum += v * v;
    if (v > peak) peak = v;
    n++;
  }
  const rms = Math.sqrt(sum / n);
  const loudness = 20 * Math.log10(Math.max(rms, 1e-6));
  // Normalize energy 0..1 (rms ~0.05 quiet, ~0.3 loud)
  const energy = Math.min(1, Math.max(0, (rms - 0.02) / 0.28));
  return { energy, loudness: Math.round(loudness * 10) / 10 };
}

export function computePeaks(buffer: AudioBuffer, count = 200): number[] {
  const data = buffer.getChannelData(0);
  const block = Math.floor(data.length / count);
  const peaks: number[] = [];
  let max = 0;
  for (let i = 0; i < count; i++) {
    let p = 0;
    const start = i * block;
    for (let j = 0; j < block; j += 64) {
      const v = Math.abs(data[start + j] || 0);
      if (v > p) p = v;
    }
    peaks.push(p);
    if (p > max) max = p;
  }
  return peaks.map((p) => (max > 0 ? p / max : 0));
}

// Pseudo key from spectral centroid + chroma-ish — deterministic & stable
export function pseudoKey(buffer: AudioBuffer): string {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const N = 8192;
  const start = Math.floor(data.length / 2);
  // simple zero-crossing rate to bias mode
  let zc = 0;
  for (let i = start + 1; i < start + N; i++) {
    if ((data[i - 1] >= 0) !== (data[i] >= 0)) zc++;
  }
  const ratio = zc / N;
  // crude pitch from autocorrelation peak
  const slice = data.slice(start, start + N);
  let bestLag = 50, bestVal = -Infinity;
  for (let lag = 40; lag < 600; lag++) {
    let s = 0;
    for (let i = 0; i + lag < N; i++) s += slice[i] * slice[i + lag];
    if (s > bestVal) { bestVal = s; bestLag = lag; }
  }
  const freq = sr / bestLag;
  // Map to pitch class
  const midi = 69 + 12 * Math.log2(freq / 440);
  const pc = ((Math.round(midi) % 12) + 12) % 12;
  const mode = ratio > 0.08 ? "maj" : "min";
  return `${KEYS[pc]} ${mode}`;
}

export async function analyzeFile(file: File): Promise<AnalyzedTrack> {
  const buffer = await decodeFile(file);
  const bpm = estimateBPM(buffer);
  const { energy, loudness } = computeEnergy(buffer);
  const key = pseudoKey(buffer);
  const peaks = computePeaks(buffer);
  return {
    id: crypto.randomUUID(),
    file,
    name: file.name.replace(/\.[^.]+$/, ""),
    size: file.size,
    duration: buffer.duration,
    bpm,
    key,
    energy,
    loudness,
    buffer,
    url: URL.createObjectURL(file),
    peaks,
    eq: { bass: 0, mid: 0, high: 0 },
  };
}

export type MixMode = "Club" | "Chill" | "Festival" | "House Party" | "Lounge" | "Custom";

export interface ModeProfile {
  eq: MixEQ;
  frequencies: { bass: number; mid: number; high: number };
  crossfade: number;
  compressor: {
    threshold: number;
    knee: number;
    ratio: number;
    attack: number;
    release: number;
  };
  transitionStyle: "club" | "festival" | "party" | "chill" | "lounge" | "standard";
}

export const MODE_PROFILES: Record<MixMode, ModeProfile> = {
  Club: {
    eq: { bass: 5.5, mid: -1.8, high: 3.2 },
    frequencies: { bass: 90, mid: 400, high: 8000 },
    crossfade: 10,
    compressor: { threshold: -18, knee: 10, ratio: 4.5, attack: 0.005, release: 0.12 },
    transitionStyle: "club",
  },
  Festival: {
    eq: { bass: 6.8, mid: 3.2, high: 5.5 },
    frequencies: { bass: 75, mid: 3200, high: 10000 },
    crossfade: 8,
    compressor: { threshold: -14, knee: 8, ratio: 6.0, attack: 0.003, release: 0.20 },
    transitionStyle: "festival",
  },
  "House Party": {
    eq: { bass: 4.0, mid: 2.2, high: 2.0 },
    frequencies: { bass: 120, mid: 1800, high: 7000 },
    crossfade: 10,
    compressor: { threshold: -16, knee: 14, ratio: 3.2, attack: 0.010, release: 0.18 },
    transitionStyle: "party",
  },
  Chill: {
    eq: { bass: 2.0, mid: 1.0, high: -4.8 },
    frequencies: { bass: 140, mid: 850, high: 4500 },
    crossfade: 16,
    compressor: { threshold: -22, knee: 24, ratio: 2.0, attack: 0.040, release: 0.40 },
    transitionStyle: "chill",
  },
  Lounge: {
    eq: { bass: 1.0, mid: 1.8, high: -5.5 },
    frequencies: { bass: 250, mid: 1200, high: 6000 },
    crossfade: 20,
    compressor: { threshold: -24, knee: 28, ratio: 1.8, attack: 0.050, release: 0.50 },
    transitionStyle: "lounge",
  },
  Custom: {
    eq: { bass: 0, mid: 0, high: 0 },
    frequencies: { bass: 200, mid: 1000, high: 4000 },
    crossfade: 10,
    compressor: { threshold: -18, knee: 16, ratio: 2.5, attack: 0.020, release: 0.25 },
    transitionStyle: "standard",
  },
};

export function sliderToDb(value: number): number {
  if (!isFinite(value)) return 0;
  return value < 0 ? value * 24 : value * 8;
}

export function getMixEQ(mode: MixMode, controls?: MixEQ): MixEQ {
  const profile = MODE_PROFILES[mode]?.eq || { bass: 0, mid: 0, high: 0 };
  const user = controls || { bass: 0, mid: 0, high: 0 };
  return {
    bass: profile.bass + sliderToDb(user.bass),
    mid: profile.mid + sliderToDb(user.mid),
    high: profile.high + sliderToDb(user.high),
  };
}

// Order tracks for best energy flow per mode
export function orderTracks(tracks: AnalyzedTrack[], mode: MixMode): AnalyzedTrack[] {
  if (mode === "Custom") return [...tracks];
  const sorted = [...tracks].sort((a, b) => a.energy - b.energy);
  switch (mode) {
    case "Festival":
    case "Club":
      return sorted; // build up
    case "Chill":
    case "Lounge":
      return sorted.reverse(); // wind down
    case "House Party": {
      // arc: low -> high -> mid
      const arc: AnalyzedTrack[] = [];
      const n = sorted.length;
      for (let i = 0; i < Math.ceil(n / 2); i++) arc.push(sorted[i]);
      for (let i = n - 1; i >= Math.ceil(n / 2); i--) arc.push(sorted[i]);
      return arc;
    }
  }
}

export interface MixResult {
  buffer: AudioBuffer;
  url: string;
  duration: number;
  order: AnalyzedTrack[];
  crossfadeSec: number;
  name?: string;
}

// Render mix offline with equal-power crossfades, genre-specific audio processing, and per-track EQ
export async function renderMix(
  tracks: AnalyzedTrack[],
  mode: MixMode,
  onProgress?: (p: number) => void,
  trackEQInput?: Record<string, MixEQ> | MixEQ
): Promise<MixResult> {
  const order = orderTracks(tracks, mode);
  const profile = MODE_PROFILES[mode] || MODE_PROFILES.Club;
  const crossfade = profile.crossfade;
  const sr = 44100;

  // Normalize track EQ input (supports both per-track map or single global EQ object)
  const isSingleEQ = trackEQInput && typeof (trackEQInput as any).bass === "number";
  const trackEQMap: Record<string, MixEQ> = isSingleEQ
    ? {}
    : ((trackEQInput as Record<string, MixEQ>) || {});

  // Calculate DJ mix points (offset and play duration)
  const mixPoints = order.map((t, i) => {
    let offset = 0;
    const isShortPreview = t.duration < 45;
    
    // For full songs, skip intro to find energy drop. For short previews, start from beginning.
    if (!isShortPreview) {
      let startIndex = 0;
      for (let j = 0; j < t.peaks.length * 0.4; j++) {
        if (t.peaks[j] > 0.6) {
          startIndex = j;
          break;
        }
      }
      offset = (startIndex / t.peaks.length) * t.duration;
      
      // Cap offset
      if (i === 0) {
        offset = Math.min(offset, 15);
      } else {
        offset = Math.min(offset, t.duration * 0.33);
      }
    }

    // Dynamic crossfade: Short previews get a fast 5s transition
    const trackCrossfade = isShortPreview ? Math.min(5, crossfade) : crossfade;
    const minDur = trackCrossfade + 8;
    let playDur = isShortPreview ? t.duration : Math.min(90, t.duration - offset);
    
    if (t.duration < minDur) {
      offset = 0;
      playDur = t.duration;
    } else if (playDur < minDur) {
      offset = t.duration - minDur;
      playDur = minDur;
    }
    
    return { offset, playDur, trackCrossfade };
  });

  let totalLength = 0;
  for (let i = 0; i < mixPoints.length; i++) {
    totalLength += mixPoints[i].playDur;
    if (i < mixPoints.length - 1) {
      totalLength -= mixPoints[i].trackCrossfade;
    }
  }
  
  const totalSafe = Math.max(1, totalLength);
  const offline = new OfflineAudioContext(2, Math.ceil(totalSafe * sr), sr);

  // Master bus compressor for genre-specific punch and dynamics
  const masterCompressor = offline.createDynamicsCompressor();
  masterCompressor.threshold.value = profile.compressor.threshold;
  masterCompressor.knee.value = profile.compressor.knee;
  masterCompressor.ratio.value = profile.compressor.ratio;
  masterCompressor.attack.value = profile.compressor.attack;
  masterCompressor.release.value = profile.compressor.release;
  masterCompressor.connect(offline.destination);

  let cursor = 0;
  for (let i = 0; i < order.length; i++) {
    const t = order[i];
    const { offset, playDur, trackCrossfade } = mixPoints[i];
    
    // Per-track user EQ adjustments
    const userTrackEQ: MixEQ = isSingleEQ
      ? (trackEQInput as MixEQ)
      : (trackEQMap[t.id] || t.eq || { bass: 0, mid: 0, high: 0 });
    const trackMixEQ = getMixEQ(mode, userTrackEQ);

    const fadeInDur = i > 0 ? mixPoints[i - 1].trackCrossfade : 0;

    const src = offline.createBufferSource();
    src.buffer = t.buffer;

    // 3-Band Parametric EQ tailored to genre frequencies and individual track settings
    const bassFilter = offline.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = profile.frequencies.bass;
    bassFilter.gain.value = trackMixEQ.bass;

    const midFilter = offline.createBiquadFilter();
    midFilter.type = "peaking";
    midFilter.frequency.value = profile.frequencies.mid;
    midFilter.Q.value = 1.0;
    midFilter.gain.value = trackMixEQ.mid;

    const highFilter = offline.createBiquadFilter();
    highFilter.type = "highshelf";
    highFilter.frequency.value = profile.frequencies.high;
    highFilter.gain.value = trackMixEQ.high;

    // DJ Highpass filter for Club / Festival transition bass-kill effect
    const djFilter = offline.createBiquadFilter();
    djFilter.type = "highpass";
    djFilter.frequency.value = 20; // Transparent during normal play

    const gain = offline.createGain();

    // Signal chain: Source -> EQ (Bass, Mid, High) -> DJ Filter -> Gain -> Master Compressor
    src.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(djFilter);
    djFilter.connect(gain);
    gain.connect(masterCompressor);

    const startAt = cursor;

    // Fade in
    if (i > 0) {
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(1, startAt + fadeInDur);
    } else {
      gain.gain.setValueAtTime(1, startAt);
    }
    
    // Fade out & DJ transition
    if (i < order.length - 1) {
      const fadeStart = startAt + playDur - trackCrossfade;
      gain.gain.setValueAtTime(1, fadeStart);
      gain.gain.linearRampToValueAtTime(0, startAt + playDur);
      
      // Pro Club/Festival transition: filter out low end before the drop
      if (mode === "Club" || mode === "Festival") {
        const sweepStart = Math.max(fadeStart, startAt + playDur - 4);
        djFilter.frequency.setValueAtTime(20, sweepStart);
        djFilter.frequency.exponentialRampToValueAtTime(1000, startAt + playDur);
      }

      // Add genre-authentic DJ transition effect
      addDJTransition(offline, fadeStart, trackCrossfade, mode);
    } else {
      // Final track: gentle fade-out at end
      const fadeStart = startAt + playDur - 4;
      if (fadeStart > startAt) {
        gain.gain.setValueAtTime(1, fadeStart);
        gain.gain.linearRampToValueAtTime(0, startAt + playDur);
      }
    }

    src.start(startAt, offset, playDur);
    cursor += playDur - trackCrossfade;
    onProgress?.((i + 1) / order.length * 0.4);
  }

  const rendered = await offline.startRendering();
  onProgress?.(0.95);
  const wav = audioBufferToWav(rendered);
  const blob = new Blob([wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  onProgress?.(1);
  return { buffer: rendered, url, duration: rendered.duration, order, crossfadeSec: crossfade, name: `NARCOTICS.dj - ${mode} Set` };
}

// AudioBuffer -> WAV (PCM 16-bit)
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length * numCh * 2 + 44;
  const ab = new ArrayBuffer(len);
  const view = new DataView(ab);
  let offset = 0;
  const writeStr = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i)); };
  writeStr("RIFF");
  view.setUint32(offset, len - 8, true); offset += 4;
  writeStr("WAVE");
  writeStr("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numCh, true); offset += 2;
  view.setUint32(offset, sr, true); offset += 4;
  view.setUint32(offset, sr * numCh * 2, true); offset += 4;
  view.setUint16(offset, numCh * 2, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeStr("data");
  view.setUint32(offset, buffer.length * numCh * 2, true); offset += 4;

  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(offset, s, true);
      offset += 2;
    }
  }
  return ab;
}

export function fmtTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// Generate genre-authentic DJ transitions
function addDJTransition(
  ctx: OfflineAudioContext,
  startTime: number,
  duration: number,
  mode: MixMode
) {
  if (duration <= 0) return;
  const sr = ctx.sampleRate;

  // 1. Chill & Lounge: soft ambient texture, zero abrasive noise or crash explosions
  if (mode === "Chill" || mode === "Lounge") {
    const sweepDur = Math.min(duration, 8);
    const sweepFrames = Math.floor(sr * sweepDur);
    const buffer = ctx.createBuffer(1, sweepFrames, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sweepFrames; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(300, startTime);
    filter.frequency.exponentialRampToValueAtTime(1800, startTime + sweepDur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(mode === "Chill" ? 0.2 : 0.12, startTime + sweepDur * 0.5);
    gain.gain.linearRampToValueAtTime(0, startTime + sweepDur);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(startTime);
    return;
  }

  // 2. Festival: Stadium epic pitch-rising riser sweep + 50Hz sub-drop boom + wide crash
  if (mode === "Festival") {
    const riserDur = duration;
    const riserFrames = Math.floor(sr * riserDur);
    const riserBuffer = ctx.createBuffer(1, riserFrames, sr);
    const rData = riserBuffer.getChannelData(0);
    for (let i = 0; i < riserFrames; i++) {
      rData[i] = (Math.random() * 2 - 1) * 0.5;
    }
    const riserSrc = ctx.createBufferSource();
    riserSrc.buffer = riserBuffer;

    const riserFilter = ctx.createBiquadFilter();
    riserFilter.type = "bandpass";
    riserFilter.Q.value = 7.0; // High resonance scream
    riserFilter.frequency.setValueAtTime(150, startTime);
    riserFilter.frequency.exponentialRampToValueAtTime(8000, startTime + riserDur);

    const riserGain = ctx.createGain();
    riserGain.gain.setValueAtTime(0, startTime);
    riserGain.gain.linearRampToValueAtTime(0.6, startTime + riserDur - 0.1);
    riserGain.gain.linearRampToValueAtTime(0, startTime + riserDur);

    riserSrc.connect(riserFilter).connect(riserGain).connect(ctx.destination);
    riserSrc.start(startTime);

    // Festival Sub Boom Impact at drop point
    const dropTime = startTime + duration;
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, dropTime);
    osc.frequency.exponentialRampToValueAtTime(40, dropTime + 0.8);
    oscGain.gain.setValueAtTime(0.7, dropTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, dropTime + 1.2);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(dropTime);
    osc.stop(dropTime + 1.2);

    // Festival Crash
    const crashDur = 2.5;
    const crashFrames = Math.floor(sr * crashDur);
    const crashBuffer = ctx.createBuffer(1, crashFrames, sr);
    const cData = crashBuffer.getChannelData(0);
    for (let i = 0; i < crashFrames; i++) {
      cData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.45));
    }
    const crashSrc = ctx.createBufferSource();
    crashSrc.buffer = crashBuffer;
    const crashFilter = ctx.createBiquadFilter();
    crashFilter.type = "highpass";
    crashFilter.frequency.value = 2500;
    const crashGain = ctx.createGain();
    crashGain.gain.setValueAtTime(0.65, dropTime);
    crashGain.gain.exponentialRampToValueAtTime(0.01, dropTime + crashDur);
    crashSrc.connect(crashFilter).connect(crashGain).connect(ctx.destination);
    crashSrc.start(dropTime);
    return;
  }

  // 3. Club / House Party / Custom: Energetic dance build with punchy beat drop
  const riserDur = Math.min(duration, 6);
  const riserFrames = Math.floor(sr * riserDur);
  const riserBuffer = ctx.createBuffer(1, riserFrames, sr);
  const rData = riserBuffer.getChannelData(0);
  for (let i = 0; i < riserFrames; i++) {
    rData[i] = (Math.random() * 2 - 1) * 0.35;
  }
  const riserSrc = ctx.createBufferSource();
  riserSrc.buffer = riserBuffer;

  const riserFilter = ctx.createBiquadFilter();
  riserFilter.type = "bandpass";
  riserFilter.Q.value = 5.0;
  riserFilter.frequency.setValueAtTime(250, startTime);
  riserFilter.frequency.exponentialRampToValueAtTime(5500, startTime + riserDur);

  const riserGain = ctx.createGain();
  riserGain.gain.setValueAtTime(0, startTime);
  riserGain.gain.linearRampToValueAtTime(0.45, startTime + riserDur - 0.1);
  riserGain.gain.linearRampToValueAtTime(0, startTime + riserDur);

  riserSrc.connect(riserFilter).connect(riserGain).connect(ctx.destination);
  riserSrc.start(startTime);

  // Club Kick Impact Drop
  const impactTime = startTime + duration;
  const impactDur = 1.4;
  const impactFrames = Math.floor(sr * impactDur);
  const impactBuffer = ctx.createBuffer(1, impactFrames, sr);
  const iData = impactBuffer.getChannelData(0);
  for (let i = 0; i < impactFrames; i++) {
    iData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.25));
  }
  const impactSrc = ctx.createBufferSource();
  impactSrc.buffer = impactBuffer;

  const impactFilter = ctx.createBiquadFilter();
  impactFilter.type = "lowpass";
  impactFilter.frequency.value = 1600;

  const impactGain = ctx.createGain();
  impactGain.gain.setValueAtTime(0.55, impactTime);
  impactGain.gain.exponentialRampToValueAtTime(0.01, impactTime + impactDur);

  impactSrc.connect(impactFilter).connect(impactGain).connect(ctx.destination);
  impactSrc.start(impactTime);
}
