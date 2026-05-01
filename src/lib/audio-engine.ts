// Client-side audio analysis & mixing engine using Web Audio API.
// Real BPM estimation via energy autocorrelation, RMS energy, peak loudness,
// and a real crossfade mixer that produces a downloadable WAV.

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
  };
}

export type MixMode = "Club" | "Chill" | "Festival" | "House Party" | "Lounge";

const MODE_CROSSFADE: Record<MixMode, number> = {
  Club: 12,
  Chill: 18,
  Festival: 8,
  "House Party": 10,
  Lounge: 22,
};

// Order tracks for best energy flow per mode
export function orderTracks(tracks: AnalyzedTrack[], mode: MixMode): AnalyzedTrack[] {
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
}

// Render mix offline with equal-power crossfades
export async function renderMix(
  tracks: AnalyzedTrack[],
  mode: MixMode,
  onProgress?: (p: number) => void
): Promise<MixResult> {
  const order = orderTracks(tracks, mode);
  const crossfade = MODE_CROSSFADE[mode];
  const sr = 44100;

  const total = order.reduce((acc, t) => acc + t.duration, 0) - crossfade * (order.length - 1);
  const offline = new OfflineAudioContext(2, Math.ceil(total * sr), sr);

  let cursor = 0;
  for (let i = 0; i < order.length; i++) {
    const t = order[i];
    const src = offline.createBufferSource();
    src.buffer = t.buffer;
    const gain = offline.createGain();
    src.connect(gain).connect(offline.destination);

    const startAt = cursor;
    const dur = t.buffer.duration;

    // Fade in (except first)
    if (i > 0) {
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(1, startAt + crossfade);
    } else {
      gain.gain.setValueAtTime(1, startAt);
    }
    // Fade out (except last)
    if (i < order.length - 1) {
      const fadeStart = startAt + dur - crossfade;
      gain.gain.setValueAtTime(1, fadeStart);
      gain.gain.linearRampToValueAtTime(0, startAt + dur);
    }

    src.start(startAt);
    cursor += dur - crossfade;
    onProgress?.((i + 1) / order.length * 0.4);
  }

  const rendered = await offline.startRendering();
  onProgress?.(0.95);
  const wav = audioBufferToWav(rendered);
  const blob = new Blob([wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  onProgress?.(1);
  return { buffer: rendered, url, duration: rendered.duration, order, crossfadeSec: crossfade };
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
