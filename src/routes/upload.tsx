import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useRef, useState, useEffect } from "react";
import { UploadCloud, X, Music, ArrowRight, Loader2, FileAudio, HardDrive, Music2, Info, ExternalLink, Pencil } from "lucide-react";
import { mixStore, useMixStore } from "../lib/mix-store";
import { analyzeFile } from "../lib/audio-engine";
import { SongRecommendations } from "../components/SongRecommendations";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Studio — NARCOTICS.dj" },
      { name: "description", content: "Drop up to 20 audio tracks or import an Apple Music playlist." },
    ],
  }),
  component: UploadStudio,
});

const ACCEPT = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"];
const MAX = 80;

type SourceTab = "files" | "apple";

function UploadStudio() {
  const { tracks } = useMixStore();
  const [tab, setTab] = useState<SourceTab>("files");

  return (
    <div className="px-4 sm:px-8 pt-10 pb-24">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.25em] text-primary">Step 01 — Upload</div>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold">Bring your music in</h1>
          <p className="mt-2 text-muted-foreground">Two ways to get started — upload your files or search Apple Music previews.</p>
        </motion.div>

        {/* Source tabs */}
        <div className="mt-8 glass-strong rounded-2xl p-1.5 inline-flex flex-wrap gap-1">
          <TabBtn active={tab === "files"} onClick={() => setTab("files")} icon={<HardDrive className="w-4 h-4" />} label="Upload Files" />
          <TabBtn active={tab === "apple"} onClick={() => setTab("apple")} icon={<AppleIcon />} label="Apple Music" />
        </div>

        <div className="mt-6">
          <AnimatePresence mode="wait">
            {tab === "files" && (
              <motion.div key="files" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FilesPanel />
              </motion.div>
            )}

            {tab === "apple" && (
              <motion.div key="apple" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <ApplePanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Queue (always shown if any) */}
        {tracks.length > 0 && <Queue />}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
        active ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-card/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function useAudioUploader() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(`Failed to analyze "${f.name}". It might be blocked or an invalid audio format.`);
      }
    }
    if (analyzed.length > 0) {
      mixStore.addTracks(analyzed);
    }
    setProgress(null);
    setBusy(false);
  }, []);

  return { busy, progress, error, setError, handleFiles };
}

function FilesPanel() {
  const [dragOver, setDragOver] = useState(false);
  const { progress, error, handleFiles } = useAudioUploader();
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  return (
    <>
      <motion.div
        layout
        className={`glass-strong rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden cursor-pointer transition-all ${
          dragOver ? "ring-2 ring-primary glow-cyan" : "hover:bg-card/60"
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
              background: "linear-gradient(180deg, transparent, oklch(0.58 0.22 27 / 0.18), transparent)",
            }} />
          </div>
        )}

        <div className="relative">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20 flex items-center justify-center mb-5">
            <UploadCloud className="w-9 h-9 text-primary" />
          </div>
          <h3 className="font-display text-2xl font-semibold">Drag &amp; drop audio files</h3>
          <p className="mt-2 text-sm text-muted-foreground">or click to browse — MP3, WAV, FLAC, M4A, AAC, OGG</p>
          <div className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="px-2 py-1 rounded-md bg-card/60 border">{mixStore.tracks.length} / {MAX}</span>
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
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="truncate">Analyzing <span className="text-foreground font-medium">{progress.name}</span>…</span>
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </motion.div>
      )}
    </>
  );
}


function ApplePanel() {
  const { busy, progress, error, handleFiles } = useAudioUploader();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Button / Enter-key search — same logic as original
  const search = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&entity=song&limit=20`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  // Preview import — identical to original
  const addPreview = async (track: any) => {
    if (!track.previewUrl) return;
    try {
      let res;
      try {
        // Try direct fetch first. Apple Music previews often have CORS headers.
        res = await fetch(track.previewUrl);
        if (!res.ok) throw new Error("Direct fetch not ok");
      } catch (directErr) {
        // Fallback to allorigins raw proxy
        res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(track.previewUrl)}`);
      }
      const blob = await res.blob();
      if (blob.type.includes("text/html")) {
        throw new Error("Proxy returned an HTML page instead of an audio file.");
      }
      const file = new File([blob], `${track.trackName} - ${track.artistName}.m4a`, { type: "audio/mp4" });
      await handleFiles([file]);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch preview. The connection was blocked.");
    }
  };

  return (
    <div className="glass-strong rounded-3xl p-6 sm:p-10">
      <div className="text-center mb-8">
        <div className="w-12 h-12 text-[oklch(0.62_0.22_0)] mx-auto mb-4 flex items-center justify-center">
          <AppleIcon large />
        </div>
        <h3 className="font-display text-xl font-bold mb-2">Apple Music Search</h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          Instantly search and import 30-second high-quality audio previews directly into your mix. No login required.
        </p>
        <div className="text-left">
          <AppleSearchBox
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            results={results}
            setResults={setResults}
            searching={searching}
            setSearching={setSearching}
            onSearch={search}
            onAdd={addPreview}
            busy={busy}
          />
        </div>
      </div>
      <div className="mt-8 pt-8 border-t border-white/10 text-center">
        <h4 className="font-semibold mb-3 text-sm">Have full downloaded tracks?</h4>
        <p className="text-xs text-muted-foreground mb-5">Upload them directly here to bypass the 30-second preview limit.</p>
        <label className="cursor-pointer inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold hover:opacity-90 transition">
          <UploadCloud className="w-4 h-4" /> Browse Files
          <input type="file" multiple accept=".mp3,.wav,.flac,.m4a" onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" />
        </label>
      </div>
      {error && <div className="mt-4 glass rounded-xl px-4 py-3 text-sm text-destructive border-destructive/30">{error}</div>}
      {progress && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 glass rounded-xl p-4">
          <div className="flex items-center gap-3 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="truncate">Analyzing <span className="text-foreground font-medium">{progress.name}</span>…</span>
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Live debounced search box for Apple Music ─────────────────────────────────
function AppleSearchBox({
  searchQuery, setSearchQuery,
  results, setResults,
  searching, setSearching,
  onSearch, onAdd, busy,
}: {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  results: any[];
  setResults: (v: any[]) => void;
  searching: boolean;
  setSearching: (v: boolean) => void;
  onSearch: () => void;
  onAdd: (track: any) => void;
  busy: boolean;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced live search — 400 ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const thisId = ++requestIdRef.current;
      setSearching(true);
      try {
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=20`
        );
        const data = await res.json();
        // Discard stale responses if a newer request has fired
        if (thisId === requestIdRef.current) {
          setResults(data.results || []);
          setShowDropdown(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (thisId === requestIdRef.current) setSearching(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (track: any) => {
    setShowDropdown(false);
    onAdd(track);
  };

  const handleSearchBtn = () => {
    setShowDropdown(true);
    onSearch();
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Input + Search button — same classes as original */}
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm outline-none focus:border-[oklch(0.62_0.22_0)] transition-colors"
          placeholder="Search for a song or artist..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value.trim()) { setShowDropdown(false); setResults([]); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearchBtn();
            if (e.key === "Escape") setShowDropdown(false);
          }}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
        />
        <button
          onClick={handleSearchBtn}
          disabled={searching}
          className="bg-[oklch(0.62_0.22_0)] text-white px-6 py-3 rounded-full font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition"
        >
          {searching ? <Loader2 className="animate-spin w-4 h-4" /> : "Search"}
        </button>
      </div>

      {/* Live dropdown — appears while typing */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            key="apple-dropdown"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-50 mt-1 glass-strong border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            {searching ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No results found</div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                {results.map((t) => (
                  <div key={t.trackId} className="flex items-center justify-between px-4 py-3 hover:bg-white/10 transition">
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      {t.artworkUrl100 && (
                        <img src={t.artworkUrl100} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="Album art" />
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{t.trackName}</div>
                        <div className="text-xs text-muted-foreground truncate">{t.artistName}</div>
                        {t.collectionName && (
                          <div className="text-[10px] text-muted-foreground/60 truncate">{t.collectionName}</div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSelect(t)}
                      disabled={!t.previewUrl || busy}
                      className="ml-3 shrink-0 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-full text-xs font-semibold transition"
                      title={!t.previewUrl ? "No preview available" : "Add to mix"}
                    >
                      {!t.previewUrl ? "No Audio" : "Add"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent list below input when dropdown is closed — matches original layout */}
      {!showDropdown && results.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar mt-4">
          {results.map((t) => (
            <div key={t.trackId} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition">
              <div className="flex items-center gap-3 overflow-hidden">
                {t.artworkUrl100 && <img src={t.artworkUrl100} className="w-10 h-10 rounded-md object-cover" alt="Album art" />}
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{t.trackName}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.artistName}</div>
                </div>
              </div>
              <button
                onClick={() => onAdd(t)}
                disabled={!t.previewUrl || busy}
                className="ml-3 shrink-0 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-full text-xs font-semibold transition"
                title={!t.previewUrl ? "No preview available" : "Add to mix"}
              >
                {!t.previewUrl ? "No Audio" : "Add"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function Queue() {
  const { tracks } = useMixStore();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) {
      mixStore.renameTrack(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
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
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/20 flex items-center justify-center text-xs font-mono text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                {editingId === t.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => saveEdit(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(t.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="w-full bg-transparent border-b border-primary/50 outline-none font-medium text-sm text-foreground focus:border-primary"
                  />
                ) : (
                  <div 
                    className="font-medium truncate flex items-center gap-2 group/edit cursor-text"
                    onClick={() => handleEdit(t.id, t.name)}
                    title="Click to rename"
                  >
                    <FileAudio className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    {t.name}
                    <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                  </div>
                )}
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  {t.bpm} BPM · {t.key} · {(t.size / 1024 / 1024).toFixed(1)}MB
                </div>
              </div>
              <button
                onClick={() => mixStore.removeTrack(t.id)}
                className="opacity-0 group-hover:opacity-100 transition w-8 h-8 rounded-lg hover:bg-destructive/15 hover:text-destructive flex items-center justify-center"
                aria-label="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      
      <SongRecommendations tracks={tracks} title="Recommended For Your Mix" subtitle="Based on songs currently in your queue" limit={6} />

      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-between glass-strong rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <Music className="w-5 h-5 text-primary" />
          <div>
            <div className="font-medium">{tracks.length} track{tracks.length === 1 ? "" : "s"} ready</div>
            <div className="text-xs text-muted-foreground">Continue to analysis dashboard</div>
          </div>
        </div>
        <button
          disabled={tracks.length < 4}
          onClick={() => navigate({ to: "/analyze" })}
          className="btn-neon inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
        >
          Analyze Tracks <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      {tracks.length < 4 && (
        <p className="mt-2 text-xs text-muted-foreground text-center">Add at least 4 tracks to build a mix.</p>
      )}
    </div>
  );
}



function AppleIcon({ large = false }: { large?: boolean }) {
  const s = large ? 28 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.997 6.124c0-.738-.065-1.47-.24-2.19-.317-1.31-1.062-2.31-2.18-3.043C21.003.517 20.373.285 19.7.164c-.517-.093-1.038-.135-1.564-.15-.04-.003-.083-.01-.124-.013H5.988c-.152.01-.303.017-.455.026C4.786.07 4.043.15 3.34.428 2.04.958 1.082 1.88.448 3.13.124 3.756.052 4.434.018 5.122-.005 5.7.001 6.282.001 6.86v10.27c0 .545-.006 1.09.014 1.636.034.812.114 1.617.41 2.378.531 1.353 1.461 2.299 2.81 2.793.625.227 1.273.317 1.933.351.834.041 1.668.045 2.503.046 3.392.005 6.784.005 10.176-.001.65-.001 1.302-.034 1.943-.143 1.027-.173 1.95-.572 2.733-1.262.886-.78 1.451-1.764 1.692-2.918.122-.583.179-1.175.18-1.769.001-3.621.001-7.243.001-10.864zm-7.077 11.32c-.198.144-.418.272-.643.378-.83.396-1.717.526-2.622.4-1.084-.149-1.97-.661-2.633-1.554-.547-.737-.769-1.572-.781-2.475-.011-.85-.013-1.7-.014-2.55-.003-1.764 0-3.528.001-5.293 0-.046-.003-.092 0-.138.025-.426.279-.726.681-.829.087-.022.18-.022.27-.022 1.32-.001 2.642-.001 3.962-.002.18 0 .36-.012.534-.058.39-.103.643-.395.652-.794.011-.483.001-.967.005-1.45.001-.121.04-.2.157-.247.082-.034.17-.038.255-.054 1.51-.275 3.02-.55 4.531-.823.05-.009.103-.019.155-.022.21-.013.347.085.36.295.005.078.002.157.002.235 0 5.063-.001 10.127.002 15.19 0 .264-.045.518-.156.755-.272.585-.717.97-1.34 1.151-.54.157-1.087.181-1.628.038-.882-.234-1.482-.797-1.671-1.71-.193-.93.176-1.886 1.001-2.48.453-.327.961-.522 1.49-.661.547-.144 1.099-.222 1.652-.301.044-.006.087-.018.12-.025.054-.058.04-.118.04-.173-.001-1.085 0-2.17-.005-3.255 0-.114-.029-.232-.066-.341-.057-.171-.187-.272-.371-.293-.179-.02-.357.014-.534.038-.61.083-1.213.196-1.815.32-1.317.273-2.633.546-3.95.821-.222.046-.418.137-.582.296-.213.207-.31.467-.314.756-.005.351-.001.703-.002 1.054-.001 1.654.001 3.308-.005 4.962-.001.255-.013.514-.06.764-.106.566-.394 1.02-.894 1.32z"/>
    </svg>
  );
}
