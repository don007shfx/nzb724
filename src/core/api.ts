/**
 * Service facade. Every network call the UI makes goes through here, so views
 * stay free of plugin lookup, error handling and fan-out logic.
 */

import { createContext, registry } from './integrations';
import type { IntegrationPlugin } from './integrations/contract';
import type {
  MediaItem,
  QueueItem,
  SearchResult,
  ServerConfig,
  ServerHealth,
} from './types';

export function pluginFor(server: ServerConfig): IntegrationPlugin {
  return registry.require(server.pluginId);
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function latencySince(started: number): number {
  return Math.max(0, Math.round(performance.now() - started));
}

export async function checkServer(server: ServerConfig): Promise<ServerHealth> {
  const started = performance.now();
  try {
    const plugin = pluginFor(server);
    const result = await plugin.test(createContext(plugin, server));
    return {
      serviceId: server.id,
      ok: result.ok,
      version: result.version,
      message: result.message,
      latencyMs: latencySince(started),
      checkedAt: Date.now(),
    };
  } catch (error) {
    return {
      serviceId: server.id,
      ok: false,
      message: describeError(error),
      latencyMs: latencySince(started),
      checkedAt: Date.now(),
    };
  }
}

export interface Collection<T> {
  items: T[];
  issues: string[];
}

export async function collectLibrary(servers: ServerConfig[]): Promise<Collection<MediaItem>> {
  const targets = servers.filter((server) => {
    const plugin = registry.get(server.pluginId);
    return server.enabled && plugin?.meta.capabilities.library;
  });

  const settled = await Promise.allSettled(
    targets.map(async (server) => {
      const plugin = pluginFor(server);
      const items = await plugin.library!(createContext(plugin, server));
      return { server, items };
    }),
  );

  const items: MediaItem[] = [];
  const issues: string[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      items.push(...outcome.value.items);
    } else {
      issues.push(`${targets[index].label}: ${describeError(outcome.reason)}`);
    }
  });

  return { items, issues };
}

export async function collectQueue(servers: ServerConfig[]): Promise<Collection<QueueItem>> {
  const targets = servers.filter((server) => {
    const plugin = registry.get(server.pluginId);
    return server.enabled && plugin?.meta.capabilities.queue;
  });

  const settled = await Promise.allSettled(
    targets.map(async (server) => {
      const plugin = pluginFor(server);
      const items = await plugin.queue!(createContext(plugin, server));
      return { server, items };
    }),
  );

  const items: QueueItem[] = [];
  const issues: string[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      items.push(...outcome.value.items);
    } else {
      issues.push(`${targets[index].label}: ${describeError(outcome.reason)}`);
    }
  });

  return { items, issues };
}

export interface SearchOutcome {
  results: SearchResult[];
  issues: string[];
}

export async function searchAll(
  servers: ServerConfig[],
  term: string,
): Promise<SearchOutcome> {
  const targets = servers.filter((server) => {
    const plugin = registry.get(server.pluginId);
    return server.enabled && plugin?.meta.capabilities.search;
  });

  const settled = await Promise.allSettled(
    targets.map(async (server) => {
      const plugin = pluginFor(server);
      return plugin.search!(createContext(plugin, server), term);
    }),
  );

  const results: SearchResult[] = [];
  const issues: string[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value);
    } else {
      issues.push(`${targets[index].label}: ${describeError(outcome.reason)}`);
    }
  });

  return { results, issues };
}

export async function addResult(
  servers: ServerConfig[],
  result: SearchResult,
): Promise<void> {
  const server = servers.find((candidate) => candidate.id === result.serviceId);
  if (!server) throw new Error('That server was removed');
  const plugin = pluginFor(server);
  if (!plugin.add) throw new Error(`${plugin.meta.name} cannot add titles`);
  await plugin.add(createContext(plugin, server), result);
}

export type QueueAction = 'pause' | 'resume' | 'delete';

export async function runQueueAction(
  servers: ServerConfig[],
  item: QueueItem,
  action: QueueAction,
): Promise<void> {
  const server = servers.find((candidate) => candidate.id === item.serviceId);
  if (!server) throw new Error('That server was removed');
  const plugin = pluginFor(server);
  const handler = plugin.queueActions?.[action];
  if (!handler) throw new Error(`${plugin.meta.name} cannot ${action} individual items`);
  await handler(createContext(plugin, server), item);
}

export async function runClientControl(
  servers: ServerConfig[],
  serverId: string,
  action: 'pause' | 'resume',
): Promise<void> {
  const server = servers.find((candidate) => candidate.id === serverId);
  if (!server) throw new Error('That server was removed');
  const plugin = pluginFor(server);
  const control = plugin.clientControl;
  if (!control) throw new Error(`${plugin.meta.name} has no whole-client control`);
  await control[action](createContext(plugin, server));
}

export function newServerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Suggests `http://host:port` from the plugin defaults. */
export function suggestedBaseUrl(pluginId: string): string {
  const plugin = registry.get(pluginId);
  if (!plugin) return '';
  const { scheme, port, path } = plugin.meta.defaults;
  return `${scheme}://localhost:${port}${path}`;
}
