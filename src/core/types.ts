/**
 * Shared domain model. Every integration maps its own API payloads onto these
 * types so the UI never needs to know which service it is talking to.
 */

export type ServiceKind = 'media' | 'download';

export type MediaKind = 'series' | 'movie' | 'artist' | 'album';

export type QueueStatus =
  | 'downloading'
  | 'queued'
  | 'paused'
  | 'completed'
  | 'postprocessing'
  | 'error';

export interface ServerConfig {
  /** Stable local id, generated when the server is added. */
  id: string;
  /** Integration plugin id, e.g. `sonarr`. */
  pluginId: string;
  /** User-facing name. Defaults to the plugin name. */
  label: string;
  /** Origin only, no trailing slash, no API path. */
  baseUrl: string;
  apiKey: string;
  /** Plugin specific extras (username/password for NZBGet, categories, ...). */
  options: Record<string, string>;
  enabled: boolean;
  createdAt: number;
}

export interface ServerHealth {
  serviceId: string;
  ok: boolean;
  version?: string;
  message?: string;
  latencyMs?: number;
  checkedAt: number;
}

export interface MediaItem {
  id: string;
  serviceId: string;
  pluginId: string;
  kind: MediaKind;
  title: string;
  year?: number;
  overview?: string;
  posterUrl?: string;
  monitored?: boolean;
  status?: string;
  stats?: {
    have?: number;
    total?: number;
    sizeOnDisk?: number;
  };
  addedAt?: string;
}

export interface QueueItem {
  id: string;
  serviceId: string;
  pluginId: string;
  title: string;
  subtitle?: string;
  /** 0..1 */
  progress: number;
  status: QueueStatus;
  etaSeconds?: number;
  speedBytesPerSec?: number;
  sizeBytes?: number;
  remainingBytes?: number;
  category?: string;
}

export interface SearchResult {
  id: string;
  serviceId: string;
  pluginId: string;
  kind: MediaKind;
  title: string;
  year?: number;
  overview?: string;
  posterUrl?: string;
  /** Present when the title is already in the library. */
  alreadyAdded?: boolean;
  /** Opaque handle passed back to `add`. */
  payload?: unknown;
}

export interface TestResult {
  ok: boolean;
  version?: string;
  message?: string;
}
