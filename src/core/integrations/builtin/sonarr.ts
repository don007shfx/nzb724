import type { IntegrationPlugin } from '../contract';
import { mapQueue, pickPoster, firstAddTargets, type ArrStats, type ArrImage } from './arr';
import type { LibraryQuery } from '../contract';

interface SonarrSeries {
  id: number;
  title: string;
  year?: number;
  overview?: string;
  monitored?: boolean;
  status?: string;
  added?: string;
  tvdbId?: number;
  images?: ArrImage[];
  statistics?: ArrStats;
}

interface SonarrLookup {
  title: string;
  year?: number;
  overview?: string;
  tvdbId?: number;
  images?: ArrImage[];
}

const API = '/api/v3';

export const sonarr: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'sonarr',
    name: 'Sonarr',
    kind: 'media',
    description: 'TV series library, missing episodes and release search.',
    defaults: { scheme: 'http', port: 8989, path: '' },
    accent: '#5cc8ff',
    docsUrl: 'https://sonarr.tv',
    capabilities: { library: true, queue: true, search: true, add: true },
  },

  async test(ctx) {
    const status = await ctx.get<{ version?: string }>(`${API}/system/status`);
    return { ok: true, version: status.version, message: 'Connected' };
  },

  async library(ctx, query?: LibraryQuery) {
    const series = await ctx.get<SonarrSeries[]>(`${API}/series`);
    const term = query?.term?.trim().toLowerCase();
    return series
      .filter((item) => !term || item.title.toLowerCase().includes(term))
      .map((item) => ({
        id: String(item.id),
        serviceId: ctx.id,
        pluginId: 'sonarr',
        kind: 'series' as const,
        title: item.title,
        year: item.year,
        overview: item.overview,
        posterUrl: pickPoster(item.images),
        monitored: item.monitored,
        status: item.status,
        addedAt: item.added,
        stats: {
          have: item.statistics?.episodeFileCount ?? 0,
          total: item.statistics?.episodeCount ?? 0,
          sizeOnDisk: item.statistics?.sizeOnDisk,
        },
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async queue(ctx) {
    const page = await ctx.get<Parameters<typeof mapQueue>[0]>(
      `${API}/queue`,
      { query: { page: 1, pageSize: 200, includeUnknownSeriesItems: true } },
    );
    return mapQueue(page, ctx.id, 'sonarr');
  },

  async search(ctx, term) {
    const results = await ctx.get<SonarrLookup[]>(`${API}/series/lookup`, {
      query: { term },
    });
    return (results ?? []).map((item) => ({
      id: item.tvdbId ? `tvdb:${item.tvdbId}` : `title:${item.title}`,
      serviceId: ctx.id,
      pluginId: 'sonarr',
      kind: 'series' as const,
      title: item.title,
      year: item.year,
      overview: item.overview,
      posterUrl: pickPoster(item.images),
      alreadyAdded: !item.tvdbId,
      payload: { tvdbId: item.tvdbId },
    }));
  },

  async add(ctx, result) {
    const payload = result.payload as { tvdbId?: number } | undefined;
    if (!payload?.tvdbId) throw new Error('Sonarr needs a TVDB id to add a series');
    const targets = await firstAddTargets(ctx.get, API);
    await ctx.post(
      `${API}/series`,
      {
        tvdbId: payload.tvdbId,
        title: result.title,
        monitored: true,
        ...targets,
        addOptions: { searchForMissingEpisodes: true },
      },
      // Sonarr answers with the created series, but we only need success.
    );
  },

  queueActions: {
    async delete(ctx, item) {
      await ctx.del(`${API}/queue/${item.id}`, {
        query: { removeFromClient: true, blocklisted: false },
      });
    },
  },
};
