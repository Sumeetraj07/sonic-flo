import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Disc3, Sparkles, Loader2, ArrowRight, Wand2, Play, Pause, ChevronUp, ChevronDown, Sliders, RotateCcw, Copy } from "lucide-react";
import { useMixStore, mixStore } from "../lib/mix-store";
import { renderMix, orderTracks, fmtTime, getMixEQ, type MixEQ, type MixMode } from "../lib/audio-engine";
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
  trackEQs: Record<string, MixEQ>,
  mode: MixMode,
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

  // Apply track-specific EQ in real time
  useEffect(() => {
    if (bassFilterRef.current && midFilterRef.current && highFilterRef.current && audioCtxRef.current && playingId) {
      const currentTrackEQ = trackEQs[playingId] || { bass: 0, mid: 0, high: 0 };
      const mixEQ = getMixEQ(mode, currentTrackEQ);
      const time = audioCtxRef.current.currentTime;
      bassFilterRef.current.gain.setTargetAtTime(mixEQ.bass, time, 0.05);
      midFilterRef.current.gain.setTargetAtTime(mixEQ.mid, time, 0.05);
      highFilterRef.current.gain.setTargetAtTime(mixEQ.high, time, 0.05);
    }
  }, [trackEQs, mode, playingId]);

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
      
      // Initialize states for new play with track's specific EQ
      const currentTrackEQ = trackEQs[id] || { bass: 0, mid: 0, high: 0 };
      const mixEQ = getMixEQ(mode, currentTrackEQ);
      bassFilterRef.current!.gain.value = mixEQ.bass;
      midFilterRef.current!.gain.value = mixEQ.mid;
      highFilterRef.current!.gain.value = mixEQ.high;

      const angle = ((crossfader + 1) / 2) * (Math.PI / 2);
      let vol = 1;
      if (id === deckAId) {
        vol = Math.cos(angle);
      } else if (id === deckBId) {
        vol = Math.sin(angle);
      }
      gainRef.current!.gain.value = vol;
      
      if (ctx.state === "suspended") ctx.resume();

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
  const { tracks, mode, mix, trackEQs, selectedTrackId } = useMixStore();
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  const [crossfader, setCrossfader] = useState(0);

  const ordered = tracks.length >= 2 ? orderTracks(tracks, mode) : [];
  const deckA = ordered[0];
  const deckB = ordered[1];

  // Fallback to deckA if no track is explicitly selected
  const activeTrackId = (selectedTrackId && ordered.some(t => t.id === selectedTrackId)) 
    ? selectedTrackId 
    : (deckA?.id || null);
  const activeTrack = ordered.find(t => t.id === activeTrackId) || deckA;
  const currentEQ = mixStore.getTrackEQ(activeTrackId);

  const { playingId, togglePlay, audioData, audioRef } = useAudioPreview(
    trackEQs,
    mode,
    crossfader,
    deckA?.id,
    deckB?.id
  );

  if (tracks.length < 2) {
    return <EmptyState title="Need more tracks" body="Add at least 2 tracks before mixing." cta={{ to: "/upload", label: "Upload tracks" }} />;
  }

  const handleSelectTrack = (id: string) => {
    mixStore.setSelectedTrackId(id);
  };

  const handleEQChange = (band: keyof MixEQ, value: number) => {
    if (!activeTrackId) return;
    const updated: MixEQ = {
      ...currentEQ,
      [band]: value,
    };
    mixStore.setTrackEQ(activeTrackId, updated);
  };

  const handleResetCurrentEQ = () => {
    if (!activeTrackId) return;
    mixStore.setTrackEQ(activeTrackId, { bass: 0, mid: 0, high: 0 });
  };

  const handleApplyEQToAll = () => {
    mixStore.setAllTracksEQ(currentEQ);
  };

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
      const result = await renderMix(tracks, mode, (p) => setProgress(p), trackEQs);
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
          <Deck 
            label="DECK A" 
            track={deckA} 
            hue={deckA ? KEY_HUES[deckA.key] || "195" : "195"} 
            playingId={playingId} 
            togglePlay={togglePlay} 
            audioData={audioData} 
            audioRef={audioRef}
            isSelected={activeTrackId === deckA?.id}
            onSelect={() => deckA && handleSelectTrack(deckA.id)}
            trackEQ={deckA ? mixStore.getTrackEQ(deckA.id) : undefined}
          />
          <Deck 
            label="DECK B" 
            track={deckB} 
            hue={deckB ? KEY_HUES[deckB.key] || "330" : "330"} 
            reverse 
            playingId={playingId} 
            togglePlay={togglePlay} 
            audioData={audioData} 
            audioRef={audioRef}
            isSelected={activeTrackId === deckB?.id}
            onSelect={() => deckB && handleSelectTrack(deckB.id)}
            trackEQ={deckB ? mixStore.getTrackEQ(deckB.id) : undefined}
          />
        </div>

        {/* Crossfader & per-song EQ controls */}
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

          {/* Song selector for EQ adjustment */}
          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-[var(--neon-cyan)]" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Song EQ Tuning:</span>
                <span className="text-sm font-medium text-foreground bg-white/10 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 max-w-xs truncate">
                  <span className="w-2 h-2 rounded-full bg-[var(--neon-cyan)] animate-pulse shrink-0" />
                  <span className="truncate">{activeTrack?.name || "Selected Track"}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetCurrentEQ}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition"
                  title="Reset EQ for this song"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button
                  onClick={handleApplyEQToAll}
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10 px-3 py-1.5 rounded-lg border border-[var(--neon-cyan)]/20 transition"
                  title="Apply current EQ to all tracks in mix"
                >
                  <Copy className="w-3 h-3" /> Apply to all
                </button>
              </div>
            </div>

            {/* Quick deck selector tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {deckA && (
                <button
                  onClick={() => handleSelectTrack(deckA.id)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition ${
                    activeTrackId === deckA.id
                      ? "bg-[var(--neon-cyan)] text-black font-semibold shadow-[0_0_15px_oklch(0.78_0.18_195_/_0.4)]"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  Deck A: {deckA.name}
                </button>
              )}
              {deckB && (
                <button
                  onClick={() => handleSelectTrack(deckB.id)}
                  className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition ${
                    activeTrackId === deckB.id
                      ? "bg-[var(--neon-magenta)] text-white font-semibold shadow-[0_0_15px_oklch(0.7_0.27_330_/_0.4)]"
                      : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  Deck B: {deckB.name}
                </button>
              )}
            </div>

            {/* Knobs */}
            <div className="grid grid-cols-3 gap-4">
              <Knob 
                label="Bass" 
                value={currentEQ.bass} 
                onChange={(v) => handleEQChange("bass", v)} 
              />
              <Knob 
                label="Mid" 
                value={currentEQ.mid} 
                onChange={(v) => handleEQChange("mid", v)} 
              />
              <Knob 
                label="High" 
                value={currentEQ.high} 
                onChange={(v) => handleEQChange("high", v)} 
              />
            </div>
          </div>
        </div>

        {/* Queue / Mix Order */}
        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold mb-3 flex items-center justify-between">
            <span>Mix Order &amp; Track EQ</span>
            {mode === "Custom" && <span className="text-xs text-[var(--neon-cyan)] font-mono uppercase">Custom Order</span>}
          </h2>
          <div className="glass rounded-2xl divide-y divide-white/5">
            {ordered.map((t, i) => {
              const isSelected = activeTrackId === t.id;
              const eq = mixStore.getTrackEQ(t.id);
              const hasCustomEQ = eq.bass !== 0 || eq.mid !== 0 || eq.high !== 0;

              return (
                <div 
                  key={t.id} 
                  className={`flex items-center gap-3 px-4 py-3 group cursor-pointer transition-colors ${
                    isSelected ? "bg-white/[0.08]" : "hover:bg-white/[0.03]"
                  }`}
                  onClick={() => handleSelectTrack(t.id)}
                >
                  <div className="flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveTrack(i, -1); }} 
                      disabled={i === 0} 
                      className="hover:text-[var(--neon-cyan)] disabled:opacity-30"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveTrack(i, 1); }} 
                      disabled={i === ordered.length - 1} 
                      className="hover:text-[var(--neon-cyan)] disabled:opacity-30"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground w-6 text-center">{String(i + 1).padStart(2, "0")}</div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePlay(t.id, t.url); }}
                    className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-[var(--neon-cyan)] hover:text-black transition shrink-0"
                  >
                    {playingId === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate flex items-center gap-2" style={{ color: playingId === t.id ? "var(--neon-cyan)" : "inherit" }}>
                      <span className="truncate">{t.name}</span>
                      {isSelected && (
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30 shrink-0">
                          EQ Active
                        </span>
                      )}
                      {hasCustomEQ && !isSelected && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground shrink-0" title={`Bass: ${eq.bass.toFixed(2)}, Mid: ${eq.mid.toFixed(2)}, High: ${eq.high.toFixed(2)}`}>
                          EQ Mod
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground hidden sm:block">{t.bpm.toFixed(1)} BPM</div>
                  <div className="text-xs font-mono text-[var(--neon-cyan)] hidden sm:block">{t.key}</div>
                  <div className="text-xs font-mono text-muted-foreground">{fmtTime(t.duration)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Render Final Mix */}
        <div className="mt-8 glass-strong rounded-3xl p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full opacity-30" style={{ background: "radial-gradient(circle, oklch(0.7 0.27 330 / 0.6), transparent 70%)" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl font-bold flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-[var(--neon-magenta)]" />
                Render Final Mix
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                AI will master your set in <span className="text-[var(--neon-cyan)] font-medium">{mode}</span> mode with custom track EQ.
              </p>
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
                <div className="mt-2 text-xs text-muted-foreground font-mono">{Math.round(progress * 100)}% — {progress < 0.4 ? "Applying track EQ & beat alignment" : progress < 0.95 ? `Mastering ${mode} dynamics` : "Finalizing WAV"}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Deck({ 
  label, 
  track, 
  hue, 
  reverse, 
  playingId, 
  togglePlay, 
  audioData, 
  audioRef,
  isSelected,
  onSelect,
  trackEQ
}: { 
  label: string; 
  track: any; 
  hue: string; 
  reverse?: boolean; 
  playingId: string | null; 
  togglePlay: (id: string, url: string) => void; 
  audioData?: Uint8Array; 
  audioRef?: React.MutableRefObject<HTMLAudioElement | null>;
  isSelected?: boolean;
  onSelect?: () => void;
  trackEQ?: MixEQ;
}) {
  const isPlaying = playingId === track?.id;
  
  // Audio reactive glow based on bass (first few bins)
  const bass = isPlaying && audioData && audioData.length > 0 ? audioData[1] / 255 : 0;
  const pulseScale = 1 + bass * 0.25;
  const pulseOpacity = 0.3 + bass * 0.4;

  if (!track) return null;

  return (
    <div 
      onClick={onSelect}
      className={`glass-strong rounded-3xl p-6 relative overflow-hidden transition-all cursor-pointer ${
        isSelected 
          ? "ring-2 ring-[var(--neon-cyan)] shadow-[0_0_25px_oklch(0.78_0.18_195_/_0.3)]" 
          : "hover:bg-white/[0.04]"
      }`} 
      style={{ borderColor: isPlaying ? `oklch(0.7 0.25 ${hue} / 0.4)` : "" }}
    >
      <motion.div 
        className="absolute -top-20 -left-20 w-64 h-64 rounded-full pointer-events-none" 
        style={{ background: `radial-gradient(circle, oklch(0.7 0.25 ${hue} / ${pulseOpacity}), transparent 70%)` }} 
        animate={{ scale: pulseScale }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      />
      <div className="relative flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {isSelected && (
            <span className="text-[10px] text-[var(--neon-cyan)] font-mono font-bold bg-[var(--neon-cyan)]/10 px-2 py-0.5 rounded-full border border-[var(--neon-cyan)]/30">
              EDITING EQ
            </span>
          )}
        </div>
        <span style={{ color: `oklch(0.85 0.2 ${hue})` }}>● CUED</span>
      </div>
      <div className="relative mt-4 flex items-center gap-4">
        <motion.button
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.1}
          onDrag={(e, info) => {
            if (isPlaying && audioRef?.current) {
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
            e.stopPropagation();
            if (Math.abs((e as any).clientX) > 0) togglePlay(track.id, track.url);
          }}
          className={`relative w-24 h-24 rounded-full transition-transform hover:scale-105 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing shadow-lg ${isPlaying ? "animate-spin-slow glow-cyan" : ""}`}
          style={{ 
            background: `conic-gradient(oklch(0.7 0.25 ${hue}), oklch(0.18 0.04 280), oklch(0.7 0.25 ${hue}))`,
            boxShadow: isPlaying ? `0 0 30px oklch(0.7 0.25 ${hue} / 0.5)` : ""
          }}
        >
          <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center pointer-events-none">
            {isPlaying ? <Pause className="w-8 h-8" style={{ color: `oklch(0.85 0.2 ${hue})` }} /> : <Play className="w-8 h-8 ml-1" style={{ color: `oklch(0.85 0.2 ${hue})` }} />}
          </div>
        </motion.button>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-lg truncate">{track.name}</div>
          <div className="mt-1 text-xs font-mono text-muted-foreground">{track.bpm.toFixed(1)} BPM · {track.key} · {fmtTime(track.duration)}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
            <Pill label="Energy" value={Math.round(track.energy * 100) + "%"} />
            <Pill label="Vol" value={`${track.loudness}dB`} />
            {trackEQ && (trackEQ.bass !== 0 || trackEQ.mid !== 0 || trackEQ.high !== 0) && (
              <div className="glass rounded-md px-2 py-1 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/20 font-mono">
                EQ: B{trackEQ.bass > 0 ? `+${trackEQ.bass.toFixed(1)}` : trackEQ.bass.toFixed(1)} M{trackEQ.mid > 0 ? `+${trackEQ.mid.toFixed(1)}` : trackEQ.mid.toFixed(1)} H{trackEQ.high > 0 ? `+${trackEQ.high.toFixed(1)}` : trackEQ.high.toFixed(1)}
              </div>
            )}
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
  const displayVal = value > 0 ? `+${(value * 8).toFixed(1)}dB` : value < 0 ? `${(value * 24).toFixed(1)}dB` : "0dB";

  return (
    <div className="text-center group relative select-none">
      <div className="mx-auto relative w-16 h-16 rounded-full glass border border-white/10 flex items-center justify-center">
        <input 
          type="range" 
          min="-1" max="1" step="0.01" 
          value={value} 
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          title={`${label}: ${displayVal}`}
        />
        <div className="absolute inset-1 rounded-full pointer-events-none" style={{
          background: "conic-gradient(from 225deg, var(--neon-cyan) 0deg, var(--neon-magenta) 270deg, transparent 270deg, transparent 360deg)",
          opacity: 0.5,
        }} />
        <div 
          className="relative w-10 h-10 rounded-full bg-background/80 border border-white/10 flex items-start justify-center pt-1 transition-transform duration-75 group-hover:bg-background pointer-events-none"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="w-0.5 h-3 rounded-full bg-[var(--neon-cyan)] shadow-[0_0_8px_var(--neon-cyan)]" />
        </div>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground transition-colors font-medium">
        {label}
      </div>
      <div className="text-[10px] font-mono text-[var(--neon-cyan)] opacity-70 group-hover:opacity-100 transition-opacity">
        {displayVal}
      </div>
    </div>
  );
}
