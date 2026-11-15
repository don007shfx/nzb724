/**
 * Integration contract.
 *
 * A plugin is a plain object. Adding a service means writing one file that
 * implements this interface and registering it in `builtin/index.ts` (or from
 * outside the app at runtime). Nothing in the UI is service-specific: views
 * read `meta.capabilities` and call the optional methods.
 */

import type { RequestOptions } from '../http';
import type {
  MediaItem,
  QueueItem,
  SearchResult,
  ServerConfig,
  ServiceKind,
  TestResult,
} from '../types';

/** Per-server connection settings plus a pre-configured transport. */
export interface PluginContext extends ServerConfig {
  /**
   * Resolves `path` against `baseUrl`, adds the plugin's credentials and
   * parses JSON. Adapters never touch `fetch` directly.
   */
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  del<T>(path: string, options?: RequestOptions): Promise<T>;
}

export interface Capabilities {
  /** Can enumerate the library. */
  library: boolean;
  /** Can enumerate an active download queue. */
  queue: boolean;
  /** Can search for new titles that are not in the library yet. */
  search: boolean;
  /** Can add a search result to the library. */
  add: boolean;
}

export interface ConfigField {
  key: string;
  label: string;
  /** Rendered as a password field when true. */
  secret?: boolean;
  placeholder?: string;
  help?: string;
  required?: boolean;
  defaultValue?: string;
}

export interface PluginMeta {
  id: string;
  name: string;
  kind: ServiceKind;
  description: string;
  /** Suggested URL; the form composes `${scheme}://${host}:${port}${path}`. */
  defaults: {
    scheme: 'http' | 'https';
    port: number;
    path: string;
  };
  /** CSS colour used for the service badge. */
  accent: string;
  capabilities: Capabilities;
  /** Extra fields beyond host + API key (username, category, ...). */
  configFields?: ConfigField[];
  /** Shown in the plugin catalog. */
  docsUrl?: string;
}

export interface LibraryQuery {
  /** Free-text filter applied server-side when the API supports it. */
  term?: string;
  limit?: number;
}

export interface QueueActions {
  delete?: (ctx: PluginContext, item: QueueItem) => Promise<void>;
  pause?: (ctx: PluginContext, item: QueueItem) => Promise<void>;
  resume?: (ctx: PluginContext, item: QueueItem) => Promise<void>;
}

/** Whole-client controls, used when an API only pauses everything. */
export interface ClientControl {
  pause(ctx: PluginContext): Promise<void>;
  resume(ctx: PluginContext): Promise<void>;
}

export interface IntegrationPlugin {
  meta: PluginMeta;
  /** Contract version the plugin was written against. */
  apiVersion: 1;
  /**
   * Extra headers sent with every request. Defaults to `X-Api-Key` for the
   * *arr family; override for basic auth or to opt out entirely.
   */
  auth?: (config: ServerConfig) => Record<string, string>;
  test(ctx: PluginContext): Promise<TestResult>;
  library?(ctx: PluginContext, query?: LibraryQuery): Promise<MediaItem[]>;
  queue?(ctx: PluginContext): Promise<QueueItem[]>;
  search?(ctx: PluginContext, term: string): Promise<SearchResult[]>;
  add?(ctx: PluginContext, result: SearchResult): Promise<void>;
  queueActions?: QueueActions;
  clientControl?: ClientControl;
}

/** What a plugin is allowed to return before the registry accepts it. */
export function validatePlugin(candidate: IntegrationPlugin, source = 'unknown'): void {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(`Integration from ${source} is not an object`);
  }
  const { meta } = candidate;
  if (!meta || typeof meta.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(meta.id)) {
    throw new Error(
      `Integration from ${source} needs a lowercase id using letters, digits or dashes`,
    );
  }
  if (meta.kind !== 'media' && meta.kind !== 'download') {
    throw new Error(`Integration "${meta.id}" must be a media or download provider`);
  }
  if (typeof candidate.test !== 'function') {
    throw new Error(`Integration "${meta.id}" must implement test()`);
  }
  const capabilities = meta.capabilities;
  if (!capabilities) {
    throw new Error(`Integration "${meta.id}" must declare capabilities`);
  }
  const pairs: Array<[boolean, keyof IntegrationPlugin]> = [
    [capabilities.library, 'library'],
    [capabilities.queue, 'queue'],
    [capabilities.search, 'search'],
    [capabilities.add, 'add'],
  ];
  for (const [declared, method] of pairs) {
    if (declared && typeof candidate[method] !== 'function') {
      throw new Error(
        `Integration "${meta.id}" declares ${String(method)} support but does not implement it`,
      );
    }
  }
}
