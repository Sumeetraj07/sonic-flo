import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, Play, Pause, Plus, Check, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { mixStore } from "../lib/mix-store";
import type { AnalyzedTrack } from "../lib/audio-engine";
import {
  fetchRecommendationsForTracks,
  importTrackFromPreview,
  extractArtistAndTitle,
  type SongRecommendation,
} from "../lib/recommendations";

interface Props {
  tracks: AnalyzedTrack[];
  title?: string;
  subtitle?: string;
  limit?: number;
}

export function SongRecommendations({
  tracks,
  title = "AI Song Recommendations",
  subtitle = "Based on your current track selection and musical style",
  limit = 6,
}: Props) {
  const [recommendations, setRecommendations] = useState<SongRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Extract detected artists for header badge
  const detectedArtists = Array.from(
    new Set(
      tracks
        .map((t) => extractArtistAndTitle(t.name).artist)
        .filter((a) => Boolean(a && a.length > 2))
    )
  ).slice(0, 3);

  useEffect(() => {
    if (tracks.length === 0) {
      setRecommendations([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchRecommendationsForTracks(tracks);
        if (!cancelled) {
          setRecommendations(results.slice(0, limit));
        }
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tracks, limit]);

  const togglePreview = (song: SongRecommendation) => {
    if (!song.previewUrl) return;

    if (playingId === song.trackId) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(song.previewUrl);
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => setPlayingId(null));
      audioRef.current = audio;
      setPlayingId(song.trackId);
    }
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const handleAddSong = async (song: SongRecommendation) => {
    if (!song.previewUrl || addingId !== null) return;
    setAddingId(song.trackId);

    try {
      const analyzed = await importTrackFromPreview(song);
      mixStore.addTracks([analyzed]);
      setAddedIds((prev) => new Set(prev).add(song.trackId));
    } catch (err) {
      console.error("Error adding recommended song:", err);
      alert("Could not load preview audio for this track. Try another recommendation.");
    } finally {
      setAddingId(null);
    }
  };

  if (tracks.length === 0) return null;

  return (
    <section className="mt-8 mb-8" aria-label="Song Recommendations">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--neon-cyan)]" /> {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{subtitle}</span>
            {detectedArtists.length > 0 && (
              <span className="text-[var(--neon-cyan)] font-mono text-[11px] bg-[var(--neon-cyan)]/10 px-2 py-0.5 rounded-full border border-[var(--neon-cyan)]/20">
                Sounds like: {detectedArtists.join(", ")}
              </span>
            )}
          </p>
        </div>
        {loading && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--neon-cyan)]" /> Finding matches…
          </span>
        )}
      </div>

      {recommendations.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendations.map((song) => {
            const isPlaying = playingId === song.trackId;
            const isAdding = addingId === song.trackId;
            const isAdded = addedIds.has(song.trackId);

            return (
              <motion.div
                key={song.trackId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`glass rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all ${
                  isPlaying ? "ring-1 ring-[var(--neon-cyan)] shadow-[0_0_15px_oklch(0.78_0.18_195_/_0.2)]" : "hover:bg-white/[0.06]"
                }`}
              >
                {/* Artwork & Play button */}
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 group">
                  {song.artworkUrl100 ? (
                    <img
                      src={song.artworkUrl100}
                      alt={song.trackName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/5 flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}

                  {song.previewUrl && (
                    <button
                      onClick={() => togglePreview(song)}
                      className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title={isPlaying ? "Pause preview" : "Play 30s preview"}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 text-white" />
                      ) : (
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      )}
                    </button>
                  )}
                  {isPlaying && (
                    <div className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-[var(--neon-cyan)] animate-ping" />
                  )}
                </div>

                {/* Track details */}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate text-foreground">
                    {song.trackName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {song.artistName}
                  </div>
                  {song.primaryGenreName && (
                    <div className="text-[10px] text-[var(--neon-cyan)] font-mono mt-0.5 opacity-80">
                      {song.primaryGenreName}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleAddSong(song)}
                    disabled={isAdding || isAdded || !song.previewUrl}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      isAdded
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
                        : "bg-white/10 hover:bg-[var(--neon-cyan)] hover:text-black text-foreground disabled:opacity-50"
                    }`}
                    title={isAdded ? "Added to mix" : "Add to mix queue"}
                  >
                    {isAdding ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" /> Add
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <p className="glass rounded-xl px-4 py-3 text-xs text-muted-foreground">
            Select songs with recognized artist names to get instant AI recommendations tailored to your style.
          </p>
        )
      )}
    </section>
  );
}
