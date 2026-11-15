import type {
  MediaItem,
  QueueItem,
  SearchResult,
  ServerConfig,
  ServerHealth,
} from '../core/types';
import { DEFAULT_SETTINGS, type PersistedState } from './storage';

export type AppSettings = PersistedState['settings'] & {
  /** Set when the demo servers were auto-seeded, so removing them is sticky. */
  demoSeeded?: boolean;
};

export interface Toast {
  id: number;
  tone: 'ok' | 'error' | 'info';
  text: string;
}

export interface AppState {
  hydrated: boolean;
  servers: ServerConfig[];
  health: Record<string, ServerHealth>;
  library: MediaItem[];
  queue: QueueItem[];
  libraryLoading: boolean;
  refreshing: boolean;
  lastRefresh: number | null;
  /** Non-fatal problems from the last refresh, one per server. */
  issues: string[];
  settings: AppSettings;
  toasts: Toast[];
  activeView: string;
}

export const initialState: AppState = {
  hydrated: false,
  servers: [],
  health: {},
  library: [],
  queue: [],
  libraryLoading: false,
  refreshing: false,
  lastRefresh: null,
  issues: [],
  settings: { ...DEFAULT_SETTINGS },
  toasts: [],
  activeView: 'dashboard',
};

type Listener = () => void;

class Store {
  private state: AppState = initialState;
  private listeners = new Set<Listener>();

  getSnapshot = (): AppState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set = (patch: Partial<AppState> | ((state: AppState) => Partial<AppState>)): void => {
    const next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  };

  get = (): AppState => this.state;
}

export const store = new Store();
