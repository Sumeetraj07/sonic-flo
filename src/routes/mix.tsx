import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Disc3, Sparkles, Loader2, ArrowRight, Wand2, Play, Pause, ChevronUp, ChevronDown } from "lucide-react";
import { useMixStore, mixStore } from "../lib/mix-store";
import { renderMix, orderTracks, fmtTime } from "../lib/audio-engine";
import { Waveform } from "../components/Waveform";
import { EmptyState } from "./analyze";

const KEY_HUES: Record<string, string> = {
  "C maj": "0", "A min": "0",
  "G maj": "30", "E min": "30",
  "D maj": "60", "B min": "60",
  "A maj": "90", "F# min": "90",
  "E maj": "120", "C# min": "120",
  "B maj": "150", "G# min": "150",
  "F# maj": "180", "D# min": "180",
  "C# maj": "210", "A# min": "210",
  "G# maj": "240", "F min": "240",
  "D# maj": "270", "C min": "270",
  "A# maj": "300", "G min": "300",
  "F maj": "330", "D min": "330",
};

export const Route = createFileRoute("/mix")({
  head: () => ({
    meta: [
      { title: "Mixing Console — NARCOTICS.dj" },
      { name: "description", content: "Live dual-deck mixing console. Render your seamless AI DJ mix." },
    ],
  }),
  component: MixConsole,
});

function useAudioPreview(
  eq: { bass: number; mid: number; high: number },
  crossfader: number,
  deckAId?: string,
  deckBId?: string
) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const midFilterRef = useRef<BiquadFilterNode | null>(null);
  const highFilterRef = useRef<BiquadFilterNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(0));
  const rafRef = useRef<number>(0);

  // Apply EQ
  useEffect(() => {
    if (bassFilterRef.current && audioCtxRef.current) {
      const mapEq = (v: number) => (v < 0 ? v * 24 : v * 6);
      const time = audioCtxRef.current.currentTime;
      bassFilterRef.current.gain.setTargetAtTime(mapEq(eq.bass), time, 0.05);
      midFilterRef.current!.gain.setTargetAtTime(mapEq(eq.mid), time, 0.05);
      highFilterRef.current!.gain.setTargetAtTime(mapEq(eq.high), time, 0.05);
    }
  }, [eq]);

  // Apply Crossfader
  useEffect(() => {
    if (gainRef.current && audioCtxRef.current) {
      const angle = ((crossfader + 1) / 2) * (Math.PI / 2);
      let vol = 1;
      if (playingId === deckAId) {
        vol = Math.cos(angle);
      } else if (playingId === deckBId) {
        vol = Math.sin(angle);
      }
      gainRef.current.gain.setTargetAtTime(vol, audioCtxRef.current.currentTime, 0.05);
    }
  }, [crossfader, playingId, deckAId, deckBId]);

  const togglePlay = (id: string, url: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
      cancelAnimationFrame(rafRef.current);
      setAudioData(new Uint8Array(0));
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }
      }
      
      const audio = new Audio(url);
      audio.crossOrigin = "anonymous";
      
      if (!audioCtxRef.current) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        
        bassFilterRef.current = ctx.createBiquadFilter();
        bassFilterRef.current.type = "lowshelf";
        bassFilterRef.current.frequency.value = 250;

        midFilterRef.current = ctx.createBiquadFilter();
        midFilterRef.current.type = "peaking";
        midFilterRef.current.frequency.value = 1000;
        midFilterRef.current.Q.value = 1;

        highFilterRef.current = ctx.createBiquadFilter();
        highFilterRef.current.type = "highshelf";
        highFilterRef.current.frequency.value = 4000;

        gainRef.current = ctx.createGain();
        
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 64;

        bassFilterRef.current.connect(midFilterRef.current);
        midFilterRef.current.connect(highFilterRef.current);
        highFilterRef.current.connect(gainRef.current);
        gainRef.current.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
      }
      
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaElementSource(audio);
      source.connect(bassFilterRef.current!);
      sourceRef.current = source;
      
      // Initialize states for new play
      const mapEq = (v: number) => (v < 0 ? v * 24 : v * 6);
      bassFilterRef.current!.gain.value = mapEq(eq.bass);
      midFilterRef.current!.gain.value = mapEq(eq.mid);
      highFilterRef.current!.gain.value = mapEq(eq.high);

      const angle = ((crossfader + 1) / 2) * (Math.PI / 2);
      let vol = 1;
      if (id === deckAId) {
        vol = Math.cos(angle);
      } else if (id === deckBId) {
        vol = Math.sin(angle);
      }
      gainRef.current!.gain.value = vol;
      
      if (ctx.state === 'suspended') ctx.resume();

      audio.play();
      audio.onended = () => {
        setPlayingId(null);
        cancelAnimationFrame(rafRef.current);
        setAudioData(new Uint8Array(0));
      };
      audioRef.current = audio;
      setPlayingId(id);

      const updateData = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setAudioData(new Uint8Array(dataArray));
        rafRef.current = requestAnimationFrame(updateData);
      };
      updateData();
    }
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { playingId, togglePlay, audioData, audioRef };
}

function MixConsole() {
  const { tracks, mode, mix } = useMixStore();
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const [crossfader, setCrossfader] = useState(0);
  const [eq, setEq] = useState({ bass: 0, mid: 0, high: 0 });

  const ordered = tracks.length >= 2 ? orderTracks(tracks, mode) : [];
  const deckA = ordered[0];
  const deckB = ordered[1];

  const { playingId, togglePlay, audioData, audioRef } = useAudioPreview(
    eq,
    crossfader,
    deckA?.id,
    deckB?.id
  );

  if (tracks.length < 2) {
    return <EmptyState title="Need more tracks" body="Add at least 2 tracks before mixing." cta={{ to: "/upload", label: "Upload tracks" }} />;
  }

  const moveTrack = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= ordered.length) return;
    
    let newTracks = [...ordered];
    if (mode !== "Custom") {
      mixStore.setMode("Custom");
    }
    
    const temp = newTracks[index];
    newTracks[index] = newTracks[newIndex];
    newTracks[newIndex] = temp;
    
    mixStore.setTracks(newTracks);
  };

  const handleRender = async () => {
    setRendering(true);
    setProgress(0);
    try {
      const result = await renderMix(tracks, mode, (p) => setProgress(p));
      mixStore.setMix(result);
      setTimeout(() => navigate({ to: "/export" }), 400);
    } catch (e) {
      console.error(e);
      setRendering(false);
    }
  };

  return (
    <div className="px-4 sm:px-8 pt-10 pb-24">
      <div className="max-w-7xl mx-auto">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-[var(--neon-cyan)]">Step 03 — Console</div>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold">Mixing Console</h1>
          <p className="mt-2 text-muted-foreground">Mode: <span className="text-[var(--neon-cyan)]">{mode}</span> · {ordered.length} tracks queued</p>
        </div>

        {/* Dual deck */}
        <div className="mt-8 grid lg:grid-cols-2 gap-5">
          <Deck label="DECK A" track={deckA} hue={deckA ? KEY_HUES[deckA.key] || "195" : "195"} playingId={playingId} togglePlay={togglePlay} audioData={audioData} audioRef={audioRef} />
          <Deck label="DECK B" track={deckB} hue={deckB ? KEY_HUES[deckB.key] || "330" : "330"} reverse playingId={playingId} togglePlay={togglePlay} audioData={audioData} audioRef={audioRef} />
        </div>

        {/* Crossfader & controls */}
        <div className="mt-5 glass-strong rounded-3xl p-6">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            <span>Crossfader</span>
            <span>Auto · {mode}</span>
          </div>
          <div className="relative h-12 flex items-center group">
            <input 
              type="range" 
              min="-1" max="1" step="0.01" 
              value={crossfader} 
              onChange={(e) => setCrossfader(parseFloat(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              title="Crossfader"
            />
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/5" />
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center pointer-events-none">
              <div
                style={{ transform: `translateX(${crossfader * 200}%)` }}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-magenta)] shadow-[0_0_30px_oklch(0.78_0.18_195_/_0.6)] flex items-center justify-center transition-transform duration-75 group-hover:scale-105"
              >
                <div className="w-2 h-6 rounded-full bg-background/40" />
              </div>
            </div>
            <div className="absolute left-0 text-xs font-mono text-muted-foreground pointer-events-none">A</div>
            <div className="absolute right-0 text-xs font-mono text-muted-foreground pointer-events-none">B</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <Knob label="Bass" value={eq.bass} onChange={(v) => setEq({ ...eq, bass: v })} />
            <Knob label="Mid" value={eq.mid} onChange={(v) => setEq({ ...eq, mid: v })} />
            <Knob label="High" value={eq.high} onChange={(v) => setEq({ ...eq, high: v })} />
          </div>
        </div>

        {/* Queue */}
        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold mb-3 flex items-center justify-between">
            <span>Mix Order</span>
            {mode === "Custom" && <span className="text-xs text-[var(--neon-cyan)] font-mono uppercase">Custom Order</span>}
          </h2>
          <div className="glass rounded-2xl divide-y divide-white/5">
            {ordered.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 group">
                <div className="flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveTrack(i, -1)} disabled={i === 0} className="hover:text-[var(--neon-cyan)] disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => moveTrack(i, 1)} disabled={i === ordered.length - 1} className="hover:text-[var(--neon-cyan)] disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                </div>
                <div className="text-xs font-mono text-muted-foreground w-6 text-center">{String(i + 1).padStart(2, "0")}</div>
                <button 
                  onClick={() => togglePlay(t.id, t.url)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-[var(--neon-cyan)] hover:text-black transition shrink-0"
                >
                  {playingId === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate" style={{ color: playingId === t.id ? 'var(--neon-cyan)' : 'inherit' }}>{t.name}</div>
                </div>
                <div className="text-xs font-mono text-muted-foreground hidden sm:block">{t.bpm.toFixed(1)} BPM</div>
                <div className="text-xs font-mono text-[var(--neon-cyan)] hidden sm:block">{t.key}</div>
                <div className="text-xs font-mono text-muted-foreground">{fmtTime(t.duration)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Render */}
        <div className="mt-8 glass-strong rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-30" style={{ background: "radial-gradient(circle, oklch(0.7 0.27 330 / 0.6), transparent 70%)" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-bold flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-[var(--neon-magenta)]" />
                Render Final Mix
              </h3>
              <p className="text-sm text-muted-foreground mt-1">AI will arrange, crossfade and master your set.</p>
            </div>
            <button
              disabled={rendering}
              onClick={handleRender}
              className="btn-neon inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold disabled:opacity-60"
            >
              {rendering ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Rendering…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Mix <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>

          <AnimatePresence>
            {rendering && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="relative mt-5"
              >
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-magenta)]"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground font-mono">{Math.round(progress * 100)}% — {progress < 0.4 ? "Aligning beats" : progress < 0.95 ? "Mastering output" : "Finalizing"}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Deck({ label, track, hue, reverse, playingId, togglePlay, audioData, audioRef }: { label: string; track: any; hue: string; reverse?: boolean; playingId: string | null; togglePlay: (id: string, url: string) => void; audioData?: Uint8Array; audioRef?: React.MutableRefObject<HTMLAudioElement | null> }) {
  const isPlaying = playingId === track.id;
  
  // Audio reactive glow based on bass (first few bins)
  const bass = isPlaying && audioData && audioData.length > 0 ? audioData[1] / 255 : 0;
  const pulseScale = 1 + bass * 0.25; // 1 to 1.25 scale based on bass
  const pulseOpacity = 0.3 + bass * 0.4;

  return (
    <div className="glass-strong rounded-3xl p-6 relative overflow-hidden transition-colors" style={{ borderColor: isPlaying ? `oklch(0.7 0.25 ${hue} / 0.4)` : '' }}>
      <motion.div 
        className="absolute -top-20 -left-20 w-64 h-64 rounded-full" 
        style={{ background: `radial-gradient(circle, oklch(0.7 0.25 ${hue} / ${pulseOpacity}), transparent 70%)` }} 
        animate={{ scale: pulseScale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <div className="relative flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>{label}</span>
        <span style={{ color: `oklch(0.85 0.2 ${hue})` }}>● CUED</span>
      </div>
      <div className="relative mt-4 flex items-center gap-4">
        <motion.button
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDrag={(e, info) => {
            if (isPlaying && audioRef?.current) {
               // Vinyl scratching effect: scrub audio backward/forward based on drag delta
               const delta = info.delta.x;
               audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - delta * 0.05);
               audioRef.current.playbackRate = Math.max(0.1, Math.min(2.0, 1 + delta * 0.1));
            }
          }}
          onDragEnd={() => {
            if (audioRef?.current) {
              audioRef.current.playbackRate = 1;
            }
          }}
          onClick={(e) => {
            // Prevent play toggle if they were just dragging
            if (Math.abs((e as any).clientX) > 0) togglePlay(track.id, track.url);
          }}
          className={`relative w-24 h-24 rounded-full transition-transform hover:scale-105 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing shadow-lg ${isPlaying ? 'animate-spin-slow glow-cyan' : ''}`}
          style={{ 
            background: `conic-gradient(oklch(0.7 0.25 ${hue}), oklch(0.18 0.04 280), oklch(0.7 0.25 ${hue}))`,
            boxShadow: isPlaying ? `0 0 30px oklch(0.7 0.25 ${hue} / 0.5)` : ''
          }}
        >
          <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center pointer-events-none">
            {isPlaying ? <Pause className="w-8 h-8" style={{ color: `oklch(0.85 0.2 ${hue})` }} /> : <Play className="w-8 h-8 ml-1" style={{ color: `oklch(0.85 0.2 ${hue})` }} />}
          </div>
        </motion.button>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-lg truncate">{track.name}</div>
          <div className="mt-1 text-xs font-mono text-muted-foreground">{track.bpm.toFixed(1)} BPM · {track.key} · {fmtTime(track.duration)}</div>
          <div className="mt-3 flex gap-3 text-[10px] uppercase tracking-wider">
            <Pill label="Energy" value={Math.round(track.energy * 100) + "%"} />
            <Pill label="Vol" value={`${track.loudness}dB`} />
          </div>
        </div>
      </div>
      <div className="relative mt-5 h-16">
        <Waveform peaks={track.peaks} height={64} active />
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-md px-2 py-1">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}

function Knob({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const rotation = value * 135;
  return (
    <div className="text-center group relative">
      <div className="mx-auto relative w-16 h-16 rounded-full glass border border-white/10 flex items-center justify-center">
        <input 
          type="range" 
          min="-1" max="1" step="0.01" 
          value={value} 
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          title={label}
        />
        <div className="absolute inset-1 rounded-full" style={{
          background: "conic-gradient(from 225deg, var(--neon-cyan) 0deg, var(--neon-magenta) 270deg, transparent 270deg, transparent 360deg)",
          opacity: 0.5,
        }} />
        <div 
          className="relative w-10 h-10 rounded-full bg-background/80 border border-white/10 flex items-start justify-center pt-1 transition-transform duration-75 group-hover:bg-background"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="w-0.5 h-3 rounded-full bg-[var(--neon-cyan)]" />
        </div>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors">{label}</div>
    </div>
  );
}
