/**
 * Builds the `PluginContext` handed to adapters: URL assembly, credential
 * injection and JSON transport. Adapters stay declarative.
 */

import { buildUrl, requestJson, type RequestOptions } from '../http';
import type { ServerConfig } from '../types';
import type { PluginContext, IntegrationPlugin } from './contract';

function authHeaders(
  plugin: IntegrationPlugin,
  config: ServerConfig,
): Record<string, string> {
  if (plugin.auth) return plugin.auth(config);
  return config.apiKey ? { 'X-Api-Key': config.apiKey } : {};
}

export function createContext(
  plugin: IntegrationPlugin,
  config: ServerConfig,
): PluginContext {
  return {
    ...config,
    get: <T>(path: string, options?: RequestOptions) =>
      requestJson<T>(buildUrl(config.baseUrl, path, options?.query), {
        ...options,
        headers: { ...authHeaders(plugin, config), ...options?.headers },
      }),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      requestJson<T>(buildUrl(config.baseUrl, path, options?.query), {
        ...options,
        method: 'POST',
        body,
        headers: { ...authHeaders(plugin, config), ...options?.headers },
      }),
    del: <T>(path: string, options?: RequestOptions) =>
      requestJson<T>(buildUrl(config.baseUrl, path, options?.query), {
        ...options,
        method: 'DELETE',
        headers: { ...authHeaders(plugin, config), ...options?.headers },
      }),
  };
}
