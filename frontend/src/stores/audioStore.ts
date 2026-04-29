import { create } from 'zustand';

const STORAGE_KEY = 'mafia.audio.settings.v1';

interface AudioSettings {
  muted: boolean;
  volume: number; // 0..1
}

function loadSettings(): AudioSettings {
  if (typeof window === 'undefined') {
    return { muted: false, volume: 1 };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { muted: false, volume: 1 };
    const parsed = JSON.parse(raw);
    return {
      muted: !!parsed.muted,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 1,
    };
  } catch {
    return { muted: false, volume: 1 };
  }
}

function persist(s: AudioSettings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

interface AudioStore extends AudioSettings {
  toggleMute: () => void;
  setMuted: (next: boolean) => void;
  setVolume: (next: number) => void;
  /** Ключ announcement'а, активного в превью /ui. Гарантирует, что
   *  одновременно играет только одна карточка, если их несколько. В игровом
   *  NarratorScreen это поле не используется — там announcement один. */
  activePreviewKey: string | null;
  setActivePreviewKey: (key: string | null) => void;
}

const initial = loadSettings();

export const useAudioStore = create<AudioStore>((set, get) => ({
  muted: initial.muted,
  volume: initial.volume,
  activePreviewKey: null,
  toggleMute: () => {
    const next = !get().muted;
    set({ muted: next });
    persist({ muted: next, volume: get().volume });
  },
  setMuted: (next) => {
    set({ muted: next });
    persist({ muted: next, volume: get().volume });
  },
  setVolume: (next) => {
    const clamped = Math.max(0, Math.min(1, next));
    set({ volume: clamped });
    persist({ muted: get().muted, volume: clamped });
  },
  setActivePreviewKey: (key) => set({ activePreviewKey: key }),
}));
