import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createGameState } from '$lib/gameState';

interface MockStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  data: Map<string, string>;
}

function mockStorage(): MockStorage {
  const data = new Map<string, string>();
  return {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => { data.set(k, v); },
    data,
  };
}

describe('createGameState', () => {
  it('starts with empty achievements when storage is empty', () => {
    const gs = createGameState(mockStorage());
    expect(get(gs.achievements)).toEqual([]);
  });

  it('unlock() adds a key to achievements', () => {
    const gs = createGameState(mockStorage());
    gs.unlock('dark_knight');
    expect(get(gs.achievements)).toContain('dark_knight');
  });

  it('unlock() is idempotent — duplicate keys are ignored', () => {
    const gs = createGameState(mockStorage());
    gs.unlock('dark_knight');
    gs.unlock('dark_knight');
    expect(get(gs.achievements).filter((k) => k === 'dark_knight')).toHaveLength(1);
  });

  it('persists achievements to storage as JSON', () => {
    const storage = mockStorage();
    const gs = createGameState(storage);
    gs.unlock('night_owl');
    expect(JSON.parse(storage.data.get('portfolio_achievements')!)).toContain('night_owl');
  });

  it('reads existing achievements from storage on creation', () => {
    const storage = mockStorage();
    storage.set('portfolio_achievements', JSON.stringify(['terminal_found']));
    const gs = createGameState(storage);
    expect(get(gs.achievements)).toContain('terminal_found');
  });

  it('survives storage read errors gracefully', () => {
    const broken = { get: () => { throw new Error('blocked'); }, set: () => {}, data: new Map() };
    const gs = createGameState(broken);
    expect(get(gs.achievements)).toEqual([]);
  });

  it('survives storage write errors gracefully', () => {
    const broken = { get: () => null, set: () => { throw new Error('quota'); }, data: new Map() };
    const gs = createGameState(broken);
    expect(() => gs.unlock('test')).not.toThrow();
    expect(get(gs.achievements)).toContain('test');
  });
});
