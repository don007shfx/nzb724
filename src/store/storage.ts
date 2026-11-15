import type { ServerConfig } from '../core/types';

const KEY = 'nzb724.state.v1';

export interface PersistedState {
  servers: ServerConfig[];
  settings: {
    refreshSeconds: number;
    demoMode: boolean;
    compact: boolean;
  };
}

export const DEFAULT_SETTINGS: PersistedState['settings'] = {
  refreshSeconds: 30,
  demoMode: false,
  compact: false,
};

export function loadPersisted(): PersistedState {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return { servers: [], settings: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      servers: Array.isArray(parsed.servers) ? parsed.servers : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { servers: [], settings: { ...DEFAULT_SETTINGS } };
  }
}

export function savePersisted(state: PersistedState): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private browsing or a full quota: the app keeps working in memory.
  }
}

export function clearPersisted(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
