/**
 * Built-in integrations. Add a line here to ship a new service.
 */

import { registry } from './registry';
import { sonarr } from './builtin/sonarr';
import { radarr } from './builtin/radarr';
import { lidarr } from './builtin/lidarr';
import { sabnzbd } from './builtin/sabnzbd';
import { nzbget } from './builtin/nzbget';
import { demoMedia, demoDownload } from './demo';

let registered = false;

export function registerBuiltins(): void {
  if (registered) return;
  registered = true;

  for (const plugin of [sonarr, radarr, lidarr, sabnzbd, nzbget, demoMedia, demoDownload]) {
    registry.register(plugin);
  }
}

export { registry } from './registry';
export { createContext } from './context';
export type { IntegrationPlugin, PluginContext, PluginMeta } from './contract';
