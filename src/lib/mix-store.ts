// Simple in-memory store (singleton) for sharing analyzed tracks & mix between routes.
import type { AnalyzedTrack, MixMode, MixResult } from "./audio-engine";

type Listener = () => void;

export type MixState = {
  tracks: AnalyzedTrack[];
  mode: MixMode;
  mix: MixResult | null;
  mixHistory: MixResult[];
};

class MixStore {
  tracks: AnalyzedTrack[] = [];
  mode: MixMode = "Club";
  mix: MixResult | null = null;
  mixHistory: MixResult[] = [];
  
  snapshot: MixState = {
    tracks: this.tracks,
    mode: this.mode,
    mix: this.mix,
    mixHistory: this.mixHistory,
  };

  private listeners = new Set<Listener>();

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  
  private updateSnapshot() {
    this.snapshot = {
      tracks: this.tracks,
      mode: this.mode,
      mix: this.mix,
      mixHistory: this.mixHistory,
    };
  }

  private emit() { 
    this.updateSnapshot();
    this.listeners.forEach((l) => l()); 
  }

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
  renameTrack(id: string, name: string) {
    this.tracks = this.tracks.map(t => t.id === id ? { ...t, name } : t);
    this.mix = null;
    this.emit();
  }
  clear() { this.tracks = []; this.mix = null; this.emit(); }
  setMode(m: MixMode) { this.mode = m; this.emit(); }
  setMix(m: MixResult) { 
    this.mix = m; 
    this.mixHistory = [m, ...this.mixHistory];
    this.emit(); 
  }
  loadMix(m: MixResult) {
    this.mix = m;
    this.emit();
  }
  renameMix(url: string, name: string) {
    if (this.mix?.url === url) {
      this.mix = { ...this.mix, name };
    }
    this.mixHistory = this.mixHistory.map(m => m.url === url ? { ...m, name } : m);
    this.emit();
  }

  deleteMix(url: string) {
    this.mixHistory = this.mixHistory.filter(m => m.url !== url);
    if (this.mix?.url === url) {
      this.mix = this.mixHistory[0] || null;
    }
    this.emit();
  }
}

export const mixStore = new MixStore();

import { useSyncExternalStore } from "react";
export function useMixStore() {
  return useSyncExternalStore(
    (cb) => mixStore.subscribe(cb),
    () => mixStore.snapshot,
    () => mixStore.snapshot
  );
}
