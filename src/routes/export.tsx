import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Share2, RotateCcw, Check, Trash2, History, Edit2 } from "lucide-react";
import { useMixStore, mixStore } from "../lib/mix-store";
import { fmtTime } from "../lib/audio-engine";
import { Waveform } from "../components/Waveform";
import { EmptyState } from "./analyze";

export const Route = createFileRoute("/export")({
  head: () => ({
    meta: [
      { title: "Export Mix — NARCOTICS.dj" },
      { name: "description", content: "Preview and download your AI-generated DJ mix as WAV." },
    ],
  }),
  component: ExportView,
});

function ExportView() {
  const { mix, mode, mixHistory } = useMixStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [mixName, setMixName] = useState("");

  useEffect(() => {
    if (mix) {
      setMixName(mix.name || `NARCOTICS.dj - ${mode} Set`);
    }
  }, [mix]);

  useEffect(() => {
    if (!mix) return;
    // Build peaks from final mix buffer
    const data = mix.buffer.getChannelData(0);
    const N = 360;
    const block = Math.floor(data.length / N);
    let max = 0;
    const arr: number[] = [];
    for (let i = 0; i < N; i++) {
      let p = 0;
      const start = i * block;
      for (let j = 0; j < block; j += 64) {
        const v = Math.abs(data[start + j] || 0);
        if (v > p) p = v;
      }
      arr.push(p);
      if (p > max) max = p;
    }
    setPeaks(arr.map((p) => (max ? p / max : 0)));
  }, [mix]);

  if (!mix) {
    return <EmptyState title="No mix rendered yet" body="Render your mix in the console first." cta={{ to: "/mix", label: "Open Console" }} />;
  }

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = mix.url;
    const name = mix.name || `NARCOTICS.dj - ${mode} Set`;
    const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    a.download = `${filename}.wav`;
    a.click();
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "My NARCOTICS.dj mix", text: `Check out my ${mode} mix made with NARCOTICS.dj` });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {}
  };

  const progress = mix.duration > 0 ? time / mix.duration : 0;

  return (
    <div className="px-4 sm:px-8 pt-10 pb-24">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.25em] text-[var(--neon-cyan)]">Step 04 — Export</div>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold">Your mix is ready</h1>
          <p className="mt-2 text-muted-foreground">{mode} mix · {mix.order.length} tracks · {fmtTime(mix.duration)}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-8 glass-strong rounded-3xl p-6 sm:p-10 relative overflow-hidden"
        >
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-40" style={{ background: "radial-gradient(circle, oklch(0.7 0.25 195 / 0.5), transparent 70%)" }} />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-40" style={{ background: "radial-gradient(circle, oklch(0.7 0.27 330 / 0.5), transparent 70%)" }} />

          <div className="relative flex items-center gap-5 sm:gap-7">
            <button
              onClick={toggle}
              className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-magenta)] flex items-center justify-center glow-cyan hover:scale-105 active:scale-95 transition-transform"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="w-9 h-9 text-background" /> : <Play className="w-9 h-9 text-background ml-1" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Final Mix</div>
              {isEditingName ? (
                <input
                  autoFocus
                  type="text"
                  value={mixName}
                  onChange={(e) => setMixName(e.target.value)}
                  onBlur={() => {
                    setIsEditingName(false);
                    const finalName = mixName.trim() || `NARCOTICS.dj - ${mode} Set`;
                    setMixName(finalName);
                    mixStore.renameMix(mix.url, finalName);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsEditingName(false);
                      const finalName = mixName.trim() || `NARCOTICS.dj - ${mode} Set`;
                      setMixName(finalName);
                      mixStore.renameMix(mix.url, finalName);
                    }
                  }}
                  className="font-display text-2xl sm:text-3xl font-bold bg-transparent border-b border-[var(--neon-cyan)] outline-none w-full text-foreground"
                />
              ) : (
                <div 
                  className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-3 group cursor-pointer"
                  onClick={() => setIsEditingName(true)}
                  title="Click to rename"
                >
                  <span className="truncate">{mix.name || `NARCOTICS.dj - ${mode} Set`}</span>
                  <Edit2 className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              <div className="mt-1 text-sm text-muted-foreground font-mono">
                {fmtTime(time)} / {fmtTime(mix.duration)}
              </div>
            </div>
          </div>

          <div className="relative mt-8">
            <Waveform peaks={peaks} progress={progress} height={88} />
            <audio
              ref={audioRef}
              src={mix.url}
              onTimeUpdate={(e) => setTime((e.target as HTMLAudioElement).currentTime)}
              onEnded={() => setPlaying(false)}
              className="hidden"
            />
          </div>

          <div className="relative mt-8 flex flex-wrap gap-3">
            <button onClick={handleDownload} className="btn-neon inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
              <Download className="w-4 h-4" /> Download WAV
            </button>
            <button onClick={handleShare} className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition">
              {copied ? <><Check className="w-4 h-4 text-[var(--neon-lime)]" /> Copied</> : <><Share2 className="w-4 h-4" /> Share</>}
            </button>
            <Link to="/upload" className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition ml-auto">
              <RotateCcw className="w-4 h-4" /> Make another
            </Link>
          </div>
        </motion.div>

        {/* Tracklist */}
        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold mb-3">Tracklist</h2>
          <div className="glass rounded-2xl divide-y divide-white/5">
            {mix.order.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="text-xs font-mono text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</div>
                <div className="min-w-0 flex-1 font-medium text-sm truncate">{t.name}</div>
                <div className="text-xs font-mono text-[var(--neon-cyan)] hidden sm:block">{t.key}</div>
                <div className="text-xs font-mono text-muted-foreground">{t.bpm.toFixed(1)} BPM</div>
                <div className="text-xs font-mono text-muted-foreground">{fmtTime(t.duration)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground text-center">
            Crossfade: {mix.crossfadeSec}s · Format: 16-bit WAV @ 44.1kHz
          </p>
        </div>

        {/* Mix History */}
        {mixHistory && mixHistory.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-[var(--neon-cyan)]" /> Mix History
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {mixHistory.map((m) => {
                const isActive = mix.url === m.url;
                return (
                  <div 
                    key={m.url} 
                    className={`glass rounded-2xl p-5 relative border transition-colors ${isActive ? 'border-[var(--neon-cyan)]/50 bg-[var(--neon-cyan)]/5' : 'border-white/5 hover:border-white/20'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div 
                        className="cursor-pointer flex-1"
                        onClick={() => mixStore.loadMix(m)}
                      >
                        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">
                          {isActive ? <span className="text-[var(--neon-cyan)]">Currently Viewing</span> : "Archived Mix"}
                        </div>
                        <div className="font-display font-semibold text-lg">{m.name || `NARCOTICS.dj - Set`}</div>
                        <div className="text-sm text-[var(--neon-cyan)] mt-1">{m.order.length} Tracks — {fmtTime(m.duration)}</div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {m.order.map(t => t.name).join(", ")}
                        </div>
                      </div>
                      <button
                        onClick={() => mixStore.deleteMix(m.url)}
                        className="text-muted-foreground hover:text-destructive p-2 -mr-2 -mt-2 transition-colors ml-2 shrink-0"
                        title="Delete Mix"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
