/**
 * Plugin registry.
 *
 * Built-ins register at module load. Third parties can call
 * `registry.register(plugin)` before the UI mounts, and the "Install from
 * URL" flow in Settings loads a module at runtime and registers it too.
 */

import { validatePlugin, type IntegrationPlugin } from './contract';

class PluginRegistry {
  private readonly plugins = new Map<string, IntegrationPlugin>();

  register(plugin: IntegrationPlugin, source = 'built-in'): void {
    validatePlugin(plugin, source);
    const existing = this.plugins.get(plugin.meta.id);
    if (existing && existing !== plugin) {
      // Re-registration is how a hot-reloaded plugin replaces itself; log
      // loudly so duplicate ids from two different authors are diagnosable.
      console.warn(
        `[nzb724] integration "${plugin.meta.id}" replaced (was ${existing.meta.name}, now ${plugin.meta.name})`,
      );
    }
    this.plugins.set(plugin.meta.id, plugin);
  }

  get(id: string): IntegrationPlugin | undefined {
    return this.plugins.get(id);
  }

  require(id: string): IntegrationPlugin {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`No integration registered for "${id}"`);
    return plugin;
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  list(): IntegrationPlugin[] {
    return [...this.plugins.values()].sort((a, b) => {
      if (a.meta.kind !== b.meta.kind) return a.meta.kind === 'media' ? -1 : 1;
      return a.meta.name.localeCompare(b.meta.name);
    });
  }

  byKind(kind: IntegrationPlugin['meta']['kind']): IntegrationPlugin[] {
    return this.list().filter((plugin) => plugin.meta.kind === kind);
  }
}

export const registry = new PluginRegistry();
