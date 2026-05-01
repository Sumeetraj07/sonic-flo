import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Disc3, Sparkles, Loader2, ArrowRight, Wand2 } from "lucide-react";
import { useMixStore, mixStore } from "../lib/mix-store";
import { renderMix, orderTracks, fmtTime } from "../lib/audio-engine";
import { Waveform } from "../components/Waveform";
import { EmptyState } from "./analyze";

export const Route = createFileRoute("/mix")({
  head: () => ({
    meta: [
      { title: "Mixing Console — AURA.dj" },
      { name: "description", content: "Live dual-deck mixing console. Render your seamless AI DJ mix." },
    ],
  }),
  component: MixConsole,
});

function MixConsole() {
  const { tracks, mode, mix } = useMixStore();
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  if (tracks.length < 2) {
    return <EmptyState title="Need more tracks" body="Add at least 2 tracks before mixing." cta={{ to: "/upload", label: "Upload tracks" }} />;
  }

  const ordered = orderTracks(tracks, mode);
  const deckA = ordered[0];
  const deckB = ordered[1];

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
          <Deck label="DECK A" track={deckA} hue="195" />
          <Deck label="DECK B" track={deckB} hue="330" reverse />
        </div>

        {/* Crossfader & controls */}
        <div className="mt-5 glass-strong rounded-3xl p-6">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
            <span>Crossfader</span>
            <span>Auto · {mode}</span>
          </div>
          <div className="relative h-12 flex items-center">
            <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/5" />
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
              <motion.div
                animate={{ x: ["-30%", "30%", "-30%"] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-magenta)] shadow-[0_0_30px_oklch(0.78_0.18_195_/_0.6)] flex items-center justify-center"
              >
                <div className="w-2 h-6 rounded-full bg-background/40" />
              </motion.div>
            </div>
            <div className="absolute left-0 text-xs font-mono text-muted-foreground">A</div>
            <div className="absolute right-0 text-xs font-mono text-muted-foreground">B</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <Knob label="Bass" />
            <Knob label="Mid" />
            <Knob label="High" />
          </div>
        </div>

        {/* Queue */}
        <div className="mt-8">
          <h2 className="font-display text-xl font-semibold mb-3">Mix Order</h2>
          <div className="glass rounded-2xl divide-y divide-white/5">
            {ordered.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="text-xs font-mono text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{t.name}</div>
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

function Deck({ label, track, hue, reverse }: { label: string; track: any; hue: string; reverse?: boolean }) {
  return (
    <div className="glass-strong rounded-3xl p-6 relative overflow-hidden">
      <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full opacity-30" style={{ background: `radial-gradient(circle, oklch(0.7 0.25 ${hue} / 0.6), transparent 70%)` }} />
      <div className="relative flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>{label}</span>
        <span style={{ color: `oklch(0.85 0.2 ${hue})` }}>● CUED</span>
      </div>
      <div className="relative mt-4 flex items-center gap-4">
        <div
          className="relative w-24 h-24 rounded-full animate-spin-slow flex items-center justify-center shrink-0"
          style={{ background: `conic-gradient(oklch(0.7 0.25 ${hue}), oklch(0.18 0.04 280), oklch(0.7 0.25 ${hue}))` }}
        >
          <div className="absolute inset-2 rounded-full bg-background flex items-center justify-center">
            <Disc3 className="w-8 h-8" style={{ color: `oklch(0.85 0.2 ${hue})` }} />
          </div>
        </div>
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

function Knob({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto relative w-16 h-16 rounded-full glass border border-white/10 flex items-center justify-center">
        <div className="absolute inset-1 rounded-full" style={{
          background: "conic-gradient(from 225deg, var(--neon-cyan) 0deg, var(--neon-magenta) 270deg, transparent 270deg, transparent 360deg)",
          opacity: 0.5,
        }} />
        <div className="relative w-10 h-10 rounded-full bg-background/80 border border-white/10 flex items-end justify-center pb-1">
          <div className="w-0.5 h-3 rounded-full bg-[var(--neon-cyan)]" />
        </div>
      </div>
      <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
    </div>
  );
}
