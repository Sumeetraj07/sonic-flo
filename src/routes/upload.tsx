import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { UploadCloud, X, Music, ArrowRight, Loader2, FileAudio } from "lucide-react";
import { mixStore, useMixStore } from "../lib/mix-store";
import { analyzeFile } from "../lib/audio-engine";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Studio — AURA.dj" },
      { name: "description", content: "Drop up to 20 audio tracks. We analyze them and prep your DJ mix." },
    ],
  }),
  component: UploadStudio,
});

const ACCEPT = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"];
const MAX = 20;

function UploadStudio() {
  const { tracks } = useMixStore();
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    const valid = arr.filter((f) => {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      return ACCEPT.includes(ext) && f.size < 80 * 1024 * 1024;
    });
    if (valid.length === 0) {
      setError("No valid audio files. Use MP3, WAV, FLAC, M4A, AAC or OGG (max 80MB each).");
      return;
    }
    const remaining = MAX - mixStore.tracks.length;
    const toProcess = valid.slice(0, remaining);
    if (toProcess.length === 0) {
      setError(`Maximum ${MAX} tracks reached.`);
      return;
    }
    setBusy(true);
    const analyzed = [];
    for (let i = 0; i < toProcess.length; i++) {
      const f = toProcess[i];
      setProgress({ name: f.name, pct: (i / toProcess.length) * 100 });
      try {
        const t = await analyzeFile(f);
        analyzed.push(t);
      } catch (e) {
        console.error("Failed to analyze", f.name, e);
      }
    }
    mixStore.addTracks(analyzed);
    setProgress(null);
    setBusy(false);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="px-4 sm:px-8 pt-10 pb-24">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.25em] text-[var(--neon-cyan)]">Step 01 — Upload</div>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold">Drop your tracks</h1>
          <p className="mt-2 text-muted-foreground">Up to {MAX} files. We'll analyze each one as soon as you drop them.</p>
        </motion.div>

        {/* Dropzone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
          className={`mt-8 glass-strong rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden cursor-pointer transition-all ${
            dragOver ? "ring-2 ring-[var(--neon-cyan)] glow-cyan" : "hover:bg-white/[0.06]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT.join(",")}
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          {dragOver && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-0 h-32 animate-scan" style={{
                background: "linear-gradient(180deg, transparent, oklch(0.85 0.18 195 / 0.25), transparent)",
              }} />
            </div>
          )}

          <div className="relative">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-magenta)]/20 border border-white/10 flex items-center justify-center mb-5">
              <UploadCloud className="w-9 h-9 text-[var(--neon-cyan)]" />
            </div>
            <h3 className="font-display text-2xl font-semibold">Drag &amp; drop audio files</h3>
            <p className="mt-2 text-sm text-muted-foreground">or click to browse — MP3, WAV, FLAC, M4A, AAC, OGG</p>
            <div className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="px-2 py-1 rounded-md bg-white/5">{tracks.length} / {MAX}</span>
              <span>•</span>
              <span>Max 80MB per file</span>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="mt-4 glass rounded-xl px-4 py-3 text-sm text-destructive border-destructive/30">{error}</div>
        )}

        {progress && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 glass rounded-xl p-4">
            <div className="flex items-center gap-3 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--neon-cyan)]" />
              <span className="truncate">Analyzing <span className="text-foreground font-medium">{progress.name}</span>…</span>
            </div>
            <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[var(--neon-cyan)] to-[var(--neon-magenta)] transition-all" style={{ width: `${progress.pct}%` }} />
            </div>
          </motion.div>
        )}

        {/* Queue */}
        {tracks.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-xl font-semibold">Track Queue</h2>
              <button
                onClick={() => mixStore.clear()}
                className="text-xs text-muted-foreground hover:text-destructive transition"
              >
                Clear all
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {tracks.map((t, i) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="glass rounded-2xl p-4 flex items-center gap-3 group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--neon-cyan)]/20 to-[var(--neon-magenta)]/20 border border-white/10 flex items-center justify-center text-xs font-mono text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate flex items-center gap-2">
                        <FileAudio className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        {t.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {t.bpm} BPM · {t.key} · {(t.size / 1024 / 1024).toFixed(1)}MB
                      </div>
                    </div>
                    <button
                      onClick={() => mixStore.removeTrack(t.id)}
                      className="opacity-0 group-hover:opacity-100 transition w-8 h-8 rounded-lg hover:bg-destructive/20 hover:text-destructive flex items-center justify-center"
                      aria-label="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-between glass-strong rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-[var(--neon-cyan)]" />
                <div>
                  <div className="font-medium">{tracks.length} track{tracks.length === 1 ? "" : "s"} ready</div>
                  <div className="text-xs text-muted-foreground">Continue to analysis dashboard</div>
                </div>
              </div>
              <button
                disabled={busy || tracks.length < 2}
                onClick={() => navigate({ to: "/analyze" })}
                className="btn-neon inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
              >
                Analyze Tracks <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {tracks.length < 2 && (
              <p className="mt-2 text-xs text-muted-foreground text-center">Add at least 2 tracks to build a mix.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
