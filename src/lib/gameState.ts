import { writable } from 'svelte/store';

const STORAGE_KEY = 'portfolio_achievements';

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const localStorageAdapter: StorageAdapter = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* silently degrade */ }
  },
};

export function createGameState(storage: StorageAdapter = localStorageAdapter) {
  let initial: string[] = [];
  try {
    const stored = storage.get(STORAGE_KEY);
    if (stored) initial = JSON.parse(stored);
  } catch { /* malformed JSON — start fresh */ }

  const achievements = writable<string[]>(initial);

  function unlock(key: string): void {
    achievements.update((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      try {
        storage.set(STORAGE_KEY, JSON.stringify(next));
      } catch { /* silently degrade */ }
      return next;
    });
  }

  return { achievements, unlock };
}

export const gameState = createGameState();
