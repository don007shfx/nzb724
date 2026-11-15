import type { IntegrationPlugin } from '../contract';
import { mapQueue, pickPoster, firstAddTargets, type ArrStats, type ArrImage } from './arr';

interface LidarrArtist {
  id: number;
  artistName: string;
  overview?: string;
  monitored?: boolean;
  added?: string;
  foreignArtistId?: string;
  images?: ArrImage[];
  statistics?: ArrStats;
}

interface LidarrLookup {
  artistName: string;
  overview?: string;
  foreignArtistId?: string;
  images?: ArrImage[];
}

/** Lidarr still exposes its API under v1. */
const API = '/api/v1';

export const lidarr: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'lidarr',
    name: 'Lidarr',
    kind: 'media',
    description: 'Music library and album monitoring.',
    defaults: { scheme: 'http', port: 8686, path: '' },
    accent: '#a78bfa',
    docsUrl: 'https://lidarr.audio',
    capabilities: { library: true, queue: true, search: true, add: true },
  },

  async test(ctx) {
    const status = await ctx.get<{ version?: string }>(`${API}/system/status`);
    return { ok: true, version: status.version, message: 'Connected' };
  },

  async library(ctx, query) {
    const artists = await ctx.get<LidarrArtist[]>(`${API}/artist`);
    const term = query?.term?.trim().toLowerCase();
    return artists
      .filter((item) => !term || item.artistName.toLowerCase().includes(term))
      .map((item) => ({
        id: String(item.id),
        serviceId: ctx.id,
        pluginId: 'lidarr',
        kind: 'artist' as const,
        title: item.artistName,
        overview: item.overview,
        posterUrl: pickPoster(item.images),
        monitored: item.monitored,
        addedAt: item.added,
        stats: {
          have: item.statistics?.albumCount ?? 0,
          total: item.statistics?.albumCount ?? 0,
          sizeOnDisk: item.statistics?.sizeOnDisk,
        },
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async queue(ctx) {
    const page = await ctx.get<Parameters<typeof mapQueue>[0]>(`${API}/queue`, {
      query: { page: 1, pageSize: 200 },
    });
    return mapQueue(page, ctx.id, 'lidarr');
  },

  async search(ctx, term) {
    const results = await ctx.get<LidarrLookup[]>(`${API}/artist/lookup`, {
      query: { term },
    });
    return (results ?? []).map((item) => ({
      id: item.foreignArtistId ?? `name:${item.artistName}`,
      serviceId: ctx.id,
      pluginId: 'lidarr',
      kind: 'artist' as const,
      title: item.artistName,
      overview: item.overview,
      posterUrl: pickPoster(item.images),
      alreadyAdded: !item.foreignArtistId,
      payload: { foreignArtistId: item.foreignArtistId },
    }));
  },

  async add(ctx, result) {
    const payload = result.payload as { foreignArtistId?: string } | undefined;
    if (!payload?.foreignArtistId) {
      throw new Error('Lidarr needs a MusicBrainz id to add an artist');
    }
    const profile = await ctx.get<Array<{ id: number }>>(`${API}/metadataprofile`);
    const targets = await firstAddTargets(ctx.get, API);
    await ctx.post(`${API}/artist`, {
      foreignArtistId: payload.foreignArtistId,
      artistName: result.title,
      metadataProfileId: profile?.[0]?.id ?? 1,
      monitored: true,
      ...targets,
      addOptions: { searchForMissingAlbums: true },
    });
  },

  queueActions: {
    async delete(ctx, item) {
      await ctx.del(`${API}/queue/${item.id}`, {
        query: { removeFromClient: true, blocklisted: false },
      });
    },
  },
};
