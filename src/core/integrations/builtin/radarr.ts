import type { IntegrationPlugin } from '../contract';
import { mapQueue, pickPoster, firstAddTargets, type ArrStats, type ArrImage } from './arr';

interface RadarrMovie {
  id: number;
  title: string;
  year?: number;
  overview?: string;
  monitored?: boolean;
  status?: string;
  added?: string;
  tmdbId?: number;
  hasFile?: boolean;
  images?: ArrImage[];
  sizeOnDisk?: number;
  statistics?: ArrStats;
}

interface RadarrLookup {
  title: string;
  year?: number;
  overview?: string;
  tmdbId?: number;
  images?: ArrImage[];
}

const API = '/api/v3';

export const radarr: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'radarr',
    name: 'Radarr',
    kind: 'media',
    description: 'Movie library, upgrades and release search.',
    defaults: { scheme: 'http', port: 7878, path: '' },
    accent: '#ffd166',
    docsUrl: 'https://radarr.video',
    capabilities: { library: true, queue: true, search: true, add: true },
  },

  async test(ctx) {
    const status = await ctx.get<{ version?: string }>(`${API}/system/status`);
    return { ok: true, version: status.version, message: 'Connected' };
  },

  async library(ctx, query) {
    const movies = await ctx.get<RadarrMovie[]>(`${API}/movie`);
    const term = query?.term?.trim().toLowerCase();
    return movies
      .filter((item) => !term || item.title.toLowerCase().includes(term))
      .map((item) => ({
        id: String(item.id),
        serviceId: ctx.id,
        pluginId: 'radarr',
        kind: 'movie' as const,
        title: item.title,
        year: item.year,
        overview: item.overview,
        posterUrl: pickPoster(item.images),
        monitored: item.monitored,
        status: item.hasFile ? 'downloaded' : item.status,
        addedAt: item.added,
        stats: {
          have: item.hasFile ? 1 : 0,
          total: 1,
          sizeOnDisk: item.sizeOnDisk ?? item.statistics?.sizeOnDisk,
        },
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async queue(ctx) {
    const page = await ctx.get<Parameters<typeof mapQueue>[0]>(`${API}/queue`, {
      query: { page: 1, pageSize: 200, includeUnknownMovieItems: true },
    });
    return mapQueue(page, ctx.id, 'radarr');
  },

  async search(ctx, term) {
    const results = await ctx.get<RadarrLookup[]>(`${API}/movie/lookup`, {
      query: { term },
    });
    return (results ?? []).map((item) => ({
      id: item.tmdbId ? `tmdb:${item.tmdbId}` : `title:${item.title}`,
      serviceId: ctx.id,
      pluginId: 'radarr',
      kind: 'movie' as const,
      title: item.title,
      year: item.year,
      overview: item.overview,
      posterUrl: pickPoster(item.images),
      alreadyAdded: !item.tmdbId,
      payload: { tmdbId: item.tmdbId },
    }));
  },

  async add(ctx, result) {
    const payload = result.payload as { tmdbId?: number } | undefined;
    if (!payload?.tmdbId) throw new Error('Radarr needs a TMDB id to add a movie');
    const targets = await firstAddTargets(ctx.get, API);
    await ctx.post(`${API}/movie`, {
      tmdbId: payload.tmdbId,
      title: result.title,
      year: result.year,
      monitored: true,
      ...targets,
      addOptions: { searchForMovie: true },
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
