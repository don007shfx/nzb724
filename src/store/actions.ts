/**
 * Actions. The only place that mutates the store, calls the API facade and
 * persists. Views call these; they never touch fetch or localStorage.
 */

import {
  addResult,
  checkServer,
  collectLibrary,
  collectQueue,
  describeError,
  newServerId,
  runClientControl,
  runQueueAction,
  searchAll,
  suggestedBaseUrl,
  type QueueAction,
} from '../core/api';
import { registerBuiltins, registry } from '../core/integrations';
import type { SearchResult, ServerConfig, ServerHealth } from '../core/types';
import { clearPersisted, loadPersisted, savePersisted } from './storage';
import { initialState, store, type AppSettings, type Toast } from './store';

let toastSeq = 0;

export function toast(text: string, tone: Toast['tone'] = 'info'): void {
  const id = ++toastSeq;
  store.set((state) => ({ toasts: [...state.toasts, { id, text, tone }] }));
  setTimeout(() => {
    store.set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
  }, 4200);
}

export function dismissToast(id: number): void {
  store.set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
}

function persist(): void {
  const { servers, settings } = store.get();
  savePersisted({ servers, settings });
}

export function setView(activeView: string): void {
  store.set({ activeView });
}

function demoServer(pluginId: 'demo-media' | 'demo-download', label: string): ServerConfig {
  return {
    id: newServerId(),
    pluginId,
    label,
    baseUrl: suggestedBaseUrl(pluginId).replace('localhost', 'demo.local'),
    apiKey: '',
    options: {},
    enabled: true,
    createdAt: Date.now(),
  };
}

export function makeServer(input: {
  pluginId: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  options?: Record<string, string>;
}): ServerConfig {
  return {
    id: newServerId(),
    pluginId: input.pluginId,
    label: input.label.trim() || registry.get(input.pluginId)?.meta.name || 'Service',
    baseUrl: input.baseUrl.trim().replace(/\/+$/, ''),
    apiKey: input.apiKey.trim(),
    options: input.options ?? {},
    enabled: true,
    createdAt: Date.now(),
  };
}

let hydrationStarted = false;

export async function hydrate(): Promise<void> {
  // React StrictMode mounts effects twice; seeding twice would duplicate demos.
  if (hydrationStarted) return;
  hydrationStarted = true;

  registerBuiltins();
  const persisted = loadPersisted();
  store.set({
    ...initialState,
    hydrated: true,
    servers: persisted.servers,
    settings: { ...initialState.settings, ...persisted.settings },
  });

  if (persisted.settings.demoMode && persisted.servers.length === 0) {
    store.set({
      servers: [
        demoServer('demo-media', 'Demo Library'),
        demoServer('demo-download', 'Demo Downloader'),
      ],
      settings: { ...store.get().settings, demoSeeded: true },
    });
    persist();
  }

  await refresh();
}

export async function refresh(): Promise<void> {
  const state = store.get();
  if (state.refreshing) return;

  const servers = state.servers;
  store.set({ refreshing: true });

  const healthEntries = await Promise.all(servers.filter((s) => s.enabled).map(checkServer));
  const health: Record<string, ServerHealth> = { ...state.health };
  for (const entry of healthEntries) health[entry.serviceId] = entry;

  const [library, queue] = await Promise.all([
    collectLibrary(servers),
    collectQueue(servers),
  ]);

  store.set({
    health,
    library: library.items,
    queue: queue.items,
    issues: [...library.issues, ...queue.issues],
    refreshing: false,
    lastRefresh: Date.now(),
  });

  persist();
}

export async function testServer(serverId: string): Promise<ServerHealth | null> {
  const server = store.get().servers.find((item) => item.id === serverId);
  if (!server) return null;
  const health = await checkServer(server);
  store.set((state) => ({ health: { ...state.health, [serverId]: health } }));
  return health;
}

export function addServer(server: ServerConfig): void {
  store.set((state) => ({ servers: [...state.servers, server] }));
  persist();
  toast(`${server.label} added`, 'ok');
  void testServer(server.id).then((health) => {
    if (health && !health.ok) toast(`${server.label}: ${health.message ?? 'unreachable'}`, 'error');
  });
  void refresh();
}

export function updateServer(serverId: string, patch: Partial<ServerConfig>): void {
  store.set((state) => ({
    servers: state.servers.map((server) =>
      server.id === serverId ? { ...server, ...patch } : server,
    ),
  }));
  persist();
}

export function removeServer(serverId: string): void {
  const server = store.get().servers.find((item) => item.id === serverId);
  store.set((state) => ({
    servers: state.servers.filter((item) => item.id !== serverId),
    health: Object.fromEntries(
      Object.entries(state.health).filter(([key]) => key !== serverId),
    ),
    library: state.library.filter((item) => item.serviceId !== serverId),
    queue: state.queue.filter((item) => item.serviceId !== serverId),
  }));
  persist();
  if (server) toast(`${server.label} removed`, 'info');
}

export function setSettings(patch: Partial<AppSettings>): void {
  store.set((state) => ({ settings: { ...state.settings, ...patch } }));
  persist();
}

export async function setDemoMode(enabled: boolean): Promise<void> {
  const state = store.get();
  setSettings({ demoMode: enabled });

  if (enabled && state.servers.length === 0) {
    store.set({
      servers: [
        demoServer('demo-media', 'Demo Library'),
        demoServer('demo-download', 'Demo Downloader'),
      ],
    });
    persist();
    toast('Demo stack loaded', 'ok');
    await refresh();
    return;
  }

  if (!enabled) {
    const demos = state.servers.filter((server) => server.pluginId.startsWith('demo-'));
    if (demos.length) {
      for (const server of demos) removeServer(server.id);
    }
  }
  await refresh();
}

export interface SearchState {
  term: string;
  loading: boolean;
  results: SearchResult[];
  issues: string[];
  error: string | null;
}

export const emptySearch: SearchState = {
  term: '',
  loading: false,
  results: [],
  issues: [],
  error: null,
};

export async function search(term: string): Promise<SearchState> {
  const trimmed = term.trim();
  if (!trimmed) return emptySearch;
  try {
    const outcome = await searchAll(store.get().servers, trimmed);
    return {
      term: trimmed,
      loading: false,
      results: outcome.results,
      issues: outcome.issues,
      error: null,
    };
  } catch (error) {
    return { term: trimmed, loading: false, results: [], issues: [], error: describeError(error) };
  }
}

export async function addSearchResult(result: SearchResult): Promise<boolean> {
  try {
    await addResult(store.get().servers, result);
    toast(`${result.title} added`, 'ok');
    void refresh();
    return true;
  } catch (error) {
    toast(describeError(error), 'error');
    return false;
  }
}

export async function queueAction(item: Parameters<typeof runQueueAction>[1], action: QueueAction): Promise<void> {
  try {
    await runQueueAction(store.get().servers, item, action);
    toast(`${action === 'delete' ? 'Removed' : action === 'pause' ? 'Paused' : 'Resumed'}: ${item.title}`, 'ok');
    void refresh();
  } catch (error) {
    toast(describeError(error), 'error');
  }
}

export async function clientControl(serverId: string, action: 'pause' | 'resume'): Promise<void> {
  try {
    await runClientControl(store.get().servers, serverId, action);
    toast(`Queue ${action === 'pause' ? 'paused' : 'resumed'}`, 'ok');
    void refresh();
  } catch (error) {
    toast(describeError(error), 'error');
  }
}

export function exportConfig(): string {
  const { servers, settings } = store.get();
  return JSON.stringify({ version: 1, servers, settings }, null, 2);
}

export function importConfig(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { servers?: ServerConfig[]; settings?: AppSettings };
    if (!Array.isArray(parsed.servers)) throw new Error('Missing servers array');
    store.set({
      servers: parsed.servers,
      settings: { ...store.get().settings, ...(parsed.settings ?? {}) },
    });
    persist();
    toast('Configuration imported', 'ok');
    void refresh();
    return true;
  } catch (error) {
    toast(`Import failed: ${describeError(error)}`, 'error');
    return false;
  }
}

export function resetAll(): void {
  clearPersisted();
  store.set({ ...initialState, hydrated: true });
  void refresh();
  toast('Everything reset', 'info');
}
