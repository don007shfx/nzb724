# Writing an integration

An integration is a plain object that maps one service's HTTP API onto the shared
domain types in `src/core/types.ts`. The UI only reads `meta.capabilities` and
calls the methods you provide, so nothing else in the app needs to change.

## The contract

```ts
export interface IntegrationPlugin {
  apiVersion: 1;
  meta: PluginMeta;
  auth?: (config: ServerConfig) => Record<string, string>;
  test(ctx: PluginContext): Promise<TestResult>;
  library?(ctx: PluginContext, query?: LibraryQuery): Promise<MediaItem[]>;
  queue?(ctx: PluginContext): Promise<QueueItem[]>;
  search?(ctx: PluginContext, term: string): Promise<SearchResult[]>;
  add?(ctx: PluginContext, result: SearchResult): Promise<void>;
  queueActions?: { delete?; pause?; resume? };
  clientControl?: { pause(ctx); resume(ctx) };
}
```

### `meta`

```ts
{
  id: 'readarr',                    // lowercase, dashes only, stable
  name: 'Readarr',
  kind: 'media',                    // or 'download'
  description: 'Shown in the picker',
  defaults: { scheme: 'http', port: 8787, path: '' },
  accent: '#f0a6ca',                // badge colour
  capabilities: { library: true, queue: true, search: true, add: true },
  configFields: [                   // optional extra form inputs
    { key: 'rootFolder', label: 'Root folder', placeholder: '/books' },
  ],
}
```

`capabilities` is a promise: if you set `library: true`, the registry refuses to
register a plugin without a `library` method. Mark only what you implement.

### `ctx`

Every call gets a context with the resolved base URL, the server id, the API key
and the raw options:

```ts
ctx.get<T>(path, { query?, headers?, timeoutMs? }): Promise<T>
ctx.post<T>(path, body?, options?): Promise<T>
ctx.del<T>(path, options?): Promise<T>
ctx.id, ctx.baseUrl, ctx.apiKey, ctx.options
```

Auth defaults to `X-Api-Key`. Override `auth` for basic auth, and if a service
takes its key in the query string, return `{}` from `auth` and append it
yourself (see `builtin/sabnzbd.ts`).

## Example: a media manager

```ts
// src/core/integrations/builtin/readarr.ts
import type { IntegrationPlugin } from '../contract';
import { pickPoster } from './arr';

const API = '/api/v1';

export const readarr: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'readarr',
    name: 'Readarr',
    kind: 'media',
    description: 'Book library and author monitoring.',
    defaults: { scheme: 'http', port: 8787, path: '' },
    accent: '#f0a6ca',
    capabilities: { library: true, queue: false, search: true, add: true },
  },

  async test(ctx) {
    const status = await ctx.get<{ version?: string }>(`${API}/system/status`);
    return { ok: true, version: status.version };
  },

  async library(ctx) {
    const authors = await ctx.get<Array<{ id: number; authorName: string; images?: never[] }>>(
      `${API}/author`,
    );
    return authors.map((author) => ({
      id: String(author.id),
      serviceId: ctx.id,
      pluginId: 'readarr',
      kind: 'artist',
      title: author.authorName,
      posterUrl: pickPoster(author.images),
    }));
  },

  async search(ctx, term) {
    const results = await ctx.get<Array<{ foreignAuthorId?: string; authorName: string }>>(
      `${API}/author/lookup`,
      { query: { term } },
    );
    return (results ?? []).map((item) => ({
      id: item.foreignAuthorId ?? item.authorName,
      serviceId: ctx.id,
      pluginId: 'readarr',
      kind: 'artist',
      title: item.authorName,
      payload: item,
    }));
  },

  async add(ctx, result) {
    await ctx.post(`${API}/author`, { foreignAuthorId: result.id, monitored: true });
  },
};
```

Register it once:

```ts
// src/core/integrations/index.ts
import { readarr } from './builtin/readarr';
...
for (const plugin of [sonarr, radarr, lidarr, readarr, sabnzbd, nzbget, ...]) {
  registry.register(plugin);
}
```

## Example: a download client

```ts
export const transmission: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'transmission',
    name: 'Transmission',
    kind: 'download',
    description: 'Torrent queue over the RPC interface.',
    defaults: { scheme: 'http', port: 9091, path: '/transmission/rpc' },
    accent: '#ef4444',
    capabilities: { library: false, queue: true, search: false, add: false },
    configFields: [
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },

  auth: (config) => ({
    Authorization: `Basic ${btoa(`${config.options.username ?? ''}:${config.options.password ?? ''}`)}`,
  }),

  async test(ctx) {
    const result = await ctx.post<{ result?: string }>('', {
      method: 'session-get',
    });
    return { ok: true, version: result.result };
  },

  async queue(ctx) {
    const payload = await ctx.post<{ arguments?: { torrents?: Array<Record<string, unknown>> } }>('', {
      method: 'torrent-get',
      arguments: { fields: ['id', 'name', 'percentDone', 'rateDownload', 'eta', 'totalSize'] },
    });
    const torrents = payload.arguments?.torrents ?? [];
    return torrents.map((torrent) => ({
      id: String(torrent.id),
      serviceId: ctx.id,
      pluginId: 'transmission',
      title: String(torrent.name),
      progress: Number(torrent.percentDone ?? 0),
      status: 'downloading' as const,
      speedBytesPerSec: Number(torrent.rateDownload ?? 0),
      etaSeconds: Number(torrent.eta ?? 0),
      sizeBytes: Number(torrent.totalSize ?? 0),
    }));
  },

  queueActions: {
    async delete(ctx, item) {
      await ctx.post('', { method: 'torrent-remove', arguments: { ids: [Number(item.id)] } });
    },
  },
};
```

Transmission also needs its `X-Transmission-Session-Id` handshake; a real
implementation would cache that header in a module-level map keyed by
`ctx.baseUrl`.

## Rules of thumb

1. **Never invent capabilities.** Declare only what you implement; the registry
   rejects mismatches.
2. **Always set `serviceId: ctx.id` and `pluginId` on every item.** The UI groups
   on them.
3. **Normalise, don't leak.** Services disagree on units (MB vs bytes), status
   strings and progress direction. Convert in the adapter.
4. **One failure must not blank the screen.** The fan-out uses
   `Promise.allSettled`; throwing is correct and shows up as a per-service issue.
5. **Keep `ctx` stateless.** Anything cached (session ids, tokens) belongs in a
   module-level `Map` keyed by `ctx.baseUrl`.
6. **Timeouts:** the default is 15s. Pass `timeoutMs` for known-slow calls.

## Testing a plugin quickly

1. Turn on demo mode to confirm the UI still renders.
2. Add the real server in **Services**; the row shows the exact error the adapter
   threw.
3. `npm run typecheck` catches contract drift; the registry catches capability
   drift at runtime.
