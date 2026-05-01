// Simple in-memory store (singleton) for sharing analyzed tracks & mix between routes.
import type { AnalyzedTrack, MixMode, MixResult } from "./audio-engine";

type Listener = () => void;

class MixStore {
  tracks: AnalyzedTrack[] = [];
  mode: MixMode = "Club";
  mix: MixResult | null = null;
  private listeners = new Set<Listener>();

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  private emit() { this.listeners.forEach((l) => l()); }

  setTracks(t: AnalyzedTrack[]) { this.tracks = t; this.mix = null; this.emit(); }
  addTracks(t: AnalyzedTrack[]) {
    this.tracks = [...this.tracks, ...t].slice(0, 20);
    this.mix = null;
    this.emit();
  }
  removeTrack(id: string) {
    this.tracks = this.tracks.filter((t) => t.id !== id);
    this.mix = null;
    this.emit();
  }
  clear() { this.tracks = []; this.mix = null; this.emit(); }
  setMode(m: MixMode) { this.mode = m; this.emit(); }
  setMix(m: MixResult) { this.mix = m; this.emit(); }
}

export const mixStore = new MixStore();

import { useSyncExternalStore } from "react";
export function useMixStore() {
  return useSyncExternalStore(
    (cb) => mixStore.subscribe(cb),
    () => ({ tracks: mixStore.tracks, mode: mixStore.mode, mix: mixStore.mix }),
    () => ({ tracks: [], mode: "Club" as MixMode, mix: null })
  );
}
