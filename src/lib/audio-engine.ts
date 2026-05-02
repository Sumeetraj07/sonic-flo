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

export type MixMode = "Club" | "Chill" | "Festival" | "House Party" | "Lounge" | "Custom";

const MODE_CROSSFADE: Record<MixMode, number> = {
  Club: 12,
  Chill: 18,
  Festival: 8,
  "House Party": 10,
  Lounge: 22,
  Custom: 10,
};

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

// Render mix offline with equal-power crossfades
export async function renderMix(
  tracks: AnalyzedTrack[],
  mode: MixMode,
  onProgress?: (p: number) => void
): Promise<MixResult> {
  const order = orderTracks(tracks, mode);
  const crossfade = MODE_CROSSFADE[mode];
  const sr = 44100;

  // Calculate DJ mix points (offset and play duration)
  const mixPoints = order.map((t, i) => {
    let offset = 0;
    const isShortPreview = t.duration < 45;
    
    // For full songs, we skip the intro to find a drop.
    // For 30s Apple Music previews, we start from the very beginning.
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
        offset = Math.min(offset, 15); // Don't delay the first track too much
      } else {
        offset = Math.min(offset, t.duration * 0.33); // Start up to 1/3 in
      }
    }

    // Dynamic crossfade: Short previews get a fast 5s transition so they play longer solo
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
  
  const totalSafe = Math.max(1, totalLength); // Ensure > 0
  const offline = new OfflineAudioContext(2, Math.ceil(totalSafe * sr), sr);

  let cursor = 0;
  for (let i = 0; i < order.length; i++) {
    const t = order[i];
    const { offset, playDur, trackCrossfade } = mixPoints[i];
    
    // The fade-in duration matches the PREVIOUS track's fade-out duration
    const fadeInDur = i > 0 ? mixPoints[i-1].trackCrossfade : 0;

    const src = offline.createBufferSource();
    src.buffer = t.buffer;
    const gain = offline.createGain();
    src.connect(gain).connect(offline.destination);

    const startAt = cursor;

    // Fade in (except first)
    if (i > 0) {
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(1, startAt + fadeInDur);
    } else {
      gain.gain.setValueAtTime(1, startAt);
    }
    
    // Fade out
    if (i < order.length - 1) {
      const fadeStart = startAt + playDur - trackCrossfade;
      gain.gain.setValueAtTime(1, fadeStart);
      gain.gain.linearRampToValueAtTime(0, startAt + playDur);
      
      // Add professional DJ transition effect (Riser + Impact)
      addDJTransition(offline, fadeStart, trackCrossfade);
    } else {
      // Final track: Add a 4s fade-out at the very end
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

// Generate a synthetic "Riser" and "Impact Drop" to spice up transitions
function addDJTransition(ctx: OfflineAudioContext, startTime: number, duration: number) {
  if (duration <= 0) return;
  const sr = ctx.sampleRate;

  // --- 1. Riser (White Noise Sweep) ---
  const riserDur = duration;
  const riserFrames = sr * riserDur;
  const riserBuffer = ctx.createBuffer(1, riserFrames, sr);
  const rData = riserBuffer.getChannelData(0);
  for (let i = 0; i < riserFrames; i++) {
    rData[i] = (Math.random() * 2 - 1) * 0.4; 
  }
  const riserSrc = ctx.createBufferSource();
  riserSrc.buffer = riserBuffer;

  const riserFilter = ctx.createBiquadFilter();
  riserFilter.type = "bandpass";
  riserFilter.Q.value = 6; // Nice resonant whoosh
  riserFilter.frequency.setValueAtTime(200, startTime);
  riserFilter.frequency.exponentialRampToValueAtTime(6000, startTime + riserDur);

  const riserGain = ctx.createGain();
  riserGain.gain.setValueAtTime(0, startTime);
  riserGain.gain.linearRampToValueAtTime(0.5, startTime + riserDur - 0.1);
  riserGain.gain.linearRampToValueAtTime(0, startTime + riserDur);

  riserSrc.connect(riserFilter).connect(riserGain).connect(ctx.destination);
  riserSrc.start(startTime);

  // --- 2. Impact Drop (Crash) ---
  const impactTime = startTime + duration;
  const impactDur = 2.0; // 2 seconds decay
  const impactFrames = sr * impactDur;
  const impactBuffer = ctx.createBuffer(1, impactFrames, sr);
  const iData = impactBuffer.getChannelData(0);
  for (let i = 0; i < impactFrames; i++) {
    // Noise with exponential decay
    iData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.3)); 
  }
  const impactSrc = ctx.createBufferSource();
  impactSrc.buffer = impactBuffer;

  const impactFilter = ctx.createBiquadFilter();
  impactFilter.type = "lowpass";
  impactFilter.frequency.value = 1500; // Muffled impact

  const impactGain = ctx.createGain();
  impactGain.gain.setValueAtTime(0.7, impactTime);
  impactGain.gain.exponentialRampToValueAtTime(0.01, impactTime + impactDur);

  impactSrc.connect(impactFilter).connect(impactGain).connect(ctx.destination);
  impactSrc.start(impactTime);
}
