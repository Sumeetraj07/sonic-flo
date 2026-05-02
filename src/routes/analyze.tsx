import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Zap, Music2, Volume2, Clock, ArrowRight, Sparkles } from "lucide-react";
import { useMixStore } from "../lib/mix-store";
import { fmtTime, type MixMode } from "../lib/audio-engine";
import { mixStore } from "../lib/mix-store";
import { Waveform } from "../components/Waveform";

export const Route = createFileRoute("/analyze")({
  head: () => ({
    meta: [
      { title: "Track Analysis — NARCOTICS.dj" },
      { name: "description", content: "AI intelligence for every track: BPM, key, energy, loudness, and recommended next track." },
    ],
  }),
  component: AnalyzeView,
});

const MODES: { id: MixMode; emoji: string; desc: string }[] = [
  { id: "Club", emoji: "🎛", desc: "Driving beats, building energy" },
  { id: "Festival", emoji: "🎉", desc: "Peak-time anthems, fast cuts" },
  { id: "House Party", emoji: "🥳", desc: "Crowd-pleasing arc" },
  { id: "Chill", emoji: "🌙", desc: "Smooth wind-down vibes" },
  { id: "Lounge", emoji: "🍸", desc: "Slow, ambient, sophisticated" },
];

function AnalyzeView() {
  const { tracks, mode } = useMixStore();
  const navigate = useNavigate();

  if (tracks.length === 0) {
    return (
      <EmptyState
        title="No tracks to analyze"
        body="Upload some audio first."
        cta={{ to: "/upload", label: "Go to Upload Studio" }}
      />
    );
  }

  const sorted = [...tracks];

  return (
    <div className="px-4 sm:px-8 pt-10 pb-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-[var(--neon-cyan)]">Step 02 — Analysis</div>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold">Track Intelligence</h1>
            <p className="mt-2 text-muted-foreground">{tracks.length} tracks scanned for BPM, key, energy and structure.</p>
          </div>
          <div className="flex items-center gap-2 glass rounded-full px-4 py-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-[var(--neon-lime)] animate-pulse-glow" />
            <span className="text-muted-foreground">Analysis complete</span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={<Music2 />} label="Tracks" value={String(tracks.length)} />
          <Stat icon={<Activity />} label="Avg BPM" value={(tracks.reduce((a, t) => a + t.bpm, 0) / tracks.length).toFixed(1)} />
          <Stat icon={<Zap />} label="Avg Energy" value={Math.round((tracks.reduce((a, t) => a + t.energy, 0) / tracks.length) * 100) + "%"} />
          <Stat icon={<Clock />} label="Total" value={fmtTime(tracks.reduce((a, t) => a + t.duration, 0))} />
        </div>

        {/* Mode selector */}
        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--neon-cyan)]" /> Choose Mix Mode
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => mixStore.setMode(m.id)}
                  className={`text-left rounded-2xl p-4 transition-all ${
                    active
                      ? "glass-strong ring-2 ring-[var(--neon-cyan)] glow-cyan"
                      : "glass hover:bg-white/[0.07] hover:-translate-y-0.5"
                  }`}
                >
                  <div className="text-2xl">{m.emoji}</div>
                  <div className="mt-1 font-display font-semibold">{m.id}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{m.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Track table */}
        <div className="mt-10 glass-strong rounded-3xl overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">
            <div className="col-span-4">Track</div>
            <div className="col-span-1 text-right">BPM</div>
            <div className="col-span-1">Key</div>
            <div className="col-span-2">Energy</div>
            <div className="col-span-1 text-right">Vol</div>
            <div className="col-span-1 text-right">Time</div>
            <div className="col-span-2">Next →</div>
          </div>
          <div className="divide-y divide-white/5">
            {sorted.map((t, i) => {
              const next = sorted[i + 1];
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="grid grid-cols-12 gap-3 px-5 py-4 items-center hover:bg-white/[0.03] transition"
                >
                  <div className="col-span-4 min-w-0 flex items-center gap-3">
                    <div className="text-xs font-mono text-muted-foreground w-6">{String(i + 1).padStart(2, "0")}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="mt-1.5 h-6 opacity-80">
                        <Waveform peaks={t.peaks.slice(0, 80)} height={24} />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-1 text-right font-mono text-sm">{t.bpm.toFixed(1)}</div>
                  <div className="col-span-1 font-mono text-sm text-[var(--neon-cyan)]">{t.key}</div>
                  <div className="col-span-2">
                    <EnergyBar value={t.energy} />
                  </div>
                  <div className="col-span-1 text-right font-mono text-xs text-muted-foreground">{t.loudness}dB</div>
                  <div className="col-span-1 text-right font-mono text-xs text-muted-foreground">{fmtTime(t.duration)}</div>
                  <div className="col-span-2 text-xs text-muted-foreground truncate">
                    {next ? next.name : <span className="text-[var(--neon-cyan)]">— Final —</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-between glass-strong rounded-2xl p-5">
          <div>
            <div className="font-medium">Mode: <span className="text-[var(--neon-cyan)]">{mode}</span></div>
            <div className="text-xs text-muted-foreground">Ready to render in the mixing console</div>
          </div>
          <div className="flex gap-2">
            <Link to="/upload" className="glass rounded-full px-5 py-2.5 text-sm hover:bg-white/10 transition">Add more</Link>
            <button
              onClick={() => navigate({ to: "/mix" })}
              className="btn-neon inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              Open Console <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[var(--neon-cyan)]">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
        <div className="font-display font-bold text-xl">{value}</div>
      </div>
    </div>
  );
}

function EnergyBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${value * 100}%`,
            background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-magenta))",
          }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{Math.round(value * 100)}</span>
    </div>
  );
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta: { to: string; label: string } }) {
  return (
    <div className="px-4 sm:px-8 pt-20 pb-24">
      <div className="max-w-md mx-auto glass-strong rounded-3xl p-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <Volume2 className="w-7 h-7 text-[var(--neon-cyan)]" />
        </div>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <Link to={cta.to as any} className="btn-neon inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold mt-6">
          {cta.label} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
