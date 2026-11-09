// Simple in-memory store (singleton) for sharing analyzed tracks & mix between routes.
import type { AnalyzedTrack, MixEQ, MixMode, MixResult } from "./audio-engine";

type Listener = () => void;

export type MixState = {
  tracks: AnalyzedTrack[];
  mode: MixMode;
  mix: MixResult | null;
  mixHistory: MixResult[];
  trackEQs: Record<string, MixEQ>;
  selectedTrackId: string | null;
};

class MixStore {
  tracks: AnalyzedTrack[] = [];
  mode: MixMode = "Club";
  mix: MixResult | null = null;
  mixHistory: MixResult[] = [];
  trackEQs: Record<string, MixEQ> = {};
  selectedTrackId: string | null = null;
  
  snapshot: MixState = {
    tracks: this.tracks,
    mode: this.mode,
    mix: this.mix,
    mixHistory: this.mixHistory,
    trackEQs: this.trackEQs,
    selectedTrackId: this.selectedTrackId,
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
      trackEQs: { ...this.trackEQs },
      selectedTrackId: this.selectedTrackId,
    };
  }

  private emit() { 
    this.updateSnapshot();
    this.listeners.forEach((l) => l()); 
  }

  setTracks(t: AnalyzedTrack[]) { 
    this.tracks = t; 
    this.mix = null; 
    if (this.selectedTrackId && !t.some(track => track.id === this.selectedTrackId)) {
      this.selectedTrackId = t[0]?.id || null;
    }
    this.emit(); 
  }

  addTracks(t: AnalyzedTrack[]) {
    this.tracks = [...this.tracks, ...t].slice(0, 20);
    this.mix = null;
    if (!this.selectedTrackId && this.tracks.length > 0) {
      this.selectedTrackId = this.tracks[0].id;
    }
    this.emit();
  }

  removeTrack(id: string) {
    this.tracks = this.tracks.filter((t) => t.id !== id);
    const { [id]: _, ...rest } = this.trackEQs;
    this.trackEQs = rest;
    if (this.selectedTrackId === id) {
      this.selectedTrackId = this.tracks[0]?.id || null;
    }
    this.mix = null;
    this.emit();
  }

  renameTrack(id: string, name: string) {
    this.tracks = this.tracks.map(t => t.id === id ? { ...t, name } : t);
    this.mix = null;
    this.emit();
  }

  clear() { 
    this.tracks = []; 
    this.trackEQs = {};
    this.selectedTrackId = null;
    this.mix = null; 
    this.emit(); 
  }

  setMode(m: MixMode) { this.mode = m; this.emit(); }

  setSelectedTrackId(id: string | null) {
    this.selectedTrackId = id;
    this.emit();
  }

  setTrackEQ(id: string, eq: MixEQ) {
    this.trackEQs[id] = eq;
    this.tracks = this.tracks.map(t => t.id === id ? { ...t, eq } : t);
    this.emit();
  }

  getTrackEQ(id?: string | null): MixEQ {
    if (!id) return { bass: 0, mid: 0, high: 0 };
    return this.trackEQs[id] || { bass: 0, mid: 0, high: 0 };
  }

  setAllTracksEQ(eq: MixEQ) {
    const nextEQs: Record<string, MixEQ> = {};
    this.tracks.forEach(t => {
      nextEQs[t.id] = { ...eq };
    });
    this.trackEQs = nextEQs;
    this.tracks = this.tracks.map(t => ({ ...t, eq: { ...eq } }));
    this.emit();
  }

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
