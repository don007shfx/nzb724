/**
 * Demo stack.
 *
 * Registered like any other integration and selected with "Demo mode" in
 * Settings. It exists so the UI can be explored, screenshotted and tested
 * without a live Sonarr or SABnzbd, and it doubles as the reference
 * implementation for plugin authors.
 */

import type { IntegrationPlugin } from './contract';
import type { MediaItem, QueueItem, SearchResult } from '../types';

const MEDIA: Array<Omit<MediaItem, 'serviceId' | 'pluginId'>> = [
  {
    id: 'd1',
    kind: 'series',
    title: 'Northern Relay',
    year: 2024,
    overview:
      'A signals engineer keeps a coastal radio station on the air through a winter of outages.',
    monitored: true,
    status: 'continuing',
    stats: { have: 18, total: 20, sizeOnDisk: 46_137_000_000 },
    addedAt: '2025-11-02T10:12:00Z',
  },
  {
    id: 'd2',
    kind: 'series',
    title: 'Static Bloom',
    year: 2023,
    overview: 'Two archivists restore a tape library and find a broadcast that never aired.',
    monitored: true,
    status: 'ended',
    stats: { have: 12, total: 12, sizeOnDisk: 28_004_000_000 },
    addedAt: '2025-10-18T18:40:00Z',
  },
  {
    id: 'd3',
    kind: 'series',
    title: 'Harbour Nine',
    year: 2025,
    overview: 'Night shift at a container port, told across nine interlocking stories.',
    monitored: true,
    status: 'continuing',
    stats: { have: 4, total: 9, sizeOnDisk: 9_880_000_000 },
    addedAt: '2026-01-05T09:00:00Z',
  },
  {
    id: 'd4',
    kind: 'movie',
    title: 'The Long Uplink',
    year: 2021,
    overview: 'A satellite operator has one orbit left to correct a twenty-year-old mistake.',
    monitored: true,
    status: 'downloaded',
    stats: { have: 1, total: 1, sizeOnDisk: 12_400_000_000 },
    addedAt: '2025-09-21T20:05:00Z',
  },
  {
    id: 'd5',
    kind: 'movie',
    title: 'Copper Sky',
    year: 2019,
    overview: 'Two surveyors map a valley that is about to disappear under water.',
    monitored: false,
    status: 'downloaded',
    stats: { have: 1, total: 1, sizeOnDisk: 8_100_000_000 },
    addedAt: '2025-08-11T14:30:00Z',
  },
  {
    id: 'd6',
    kind: 'movie',
    title: 'Signal Garden',
    year: 2026,
    overview: 'A botanist grows antennae. It escalates.',
    monitored: true,
    status: 'missing',
    stats: { have: 0, total: 1 },
    addedAt: '2026-02-14T11:20:00Z',
  },
  {
    id: 'd7',
    kind: 'artist',
    title: 'Vesper Loop',
    overview: 'Ambient hardware duo from the coast.',
    monitored: true,
    stats: { have: 6, total: 7, sizeOnDisk: 3_200_000_000 },
    addedAt: '2025-12-01T08:15:00Z',
  },
  {
    id: 'd8',
    kind: 'artist',
    title: 'Marlowe Static',
    overview: 'Tape-saturated shoegaze.',
    monitored: true,
    stats: { have: 3, total: 5, sizeOnDisk: 1_700_000_000 },
    addedAt: '2026-01-22T16:45:00Z',
  },
];

const SEARCHABLE: Array<Omit<SearchResult, 'serviceId' | 'pluginId'>> = [
  {
    id: 's1',
    kind: 'series',
    title: 'Twenty-Four Hours of Rain',
    year: 2022,
    overview: 'A weather station crew quarantined for a single storm.',
  },
  {
    id: 's2',
    kind: 'movie',
    title: 'Night Carrier',
    year: 2024,
    overview: 'A late shift courier discovers the city runs on a schedule nobody set.',
  },
  {
    id: 's3',
    kind: 'series',
    title: 'Sparrow Line',
    year: 2020,
    overview: 'A rural railway kept open by three people and a rota.',
  },
  {
    id: 's4',
    kind: 'movie',
    title: 'Quiet Hour',
    year: 2018,
    overview: 'One hour of a city, recorded from a single balcony.',
  },
  {
    id: 's5',
    kind: 'artist',
    title: 'Ferry Lights',
    overview: 'Slowcore recorded in a ferry terminal.',
  },
];

/** Progress advances with wall-clock time so the queue looks live. */
function tidalProgress(offsetSeconds: number, cycleSeconds: number): number {
  const now = Date.now() / 1000;
  return ((now + offsetSeconds) % cycleSeconds) / cycleSeconds;
}

export const demoMedia: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'demo-media',
    name: 'Demo Library',
    kind: 'media',
    description: 'Sample series, movies and artists. No server required.',
    defaults: { scheme: 'http', port: 8989, path: '' },
    accent: '#c9f74a',
    capabilities: { library: true, queue: false, search: true, add: true },
  },

  async test() {
    return { ok: true, version: 'demo-1.0', message: 'Sample data' };
  },

  async library(ctx) {
    return MEDIA.map((item) => ({
      ...item,
      serviceId: ctx.id,
      pluginId: 'demo-media',
    }));
  },

  async search(ctx, term) {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return [];
    return SEARCHABLE.filter((item) =>
      `${item.title} ${item.overview ?? ''}`.toLowerCase().includes(normalized),
    ).map((item) => ({
      ...item,
      serviceId: ctx.id,
      pluginId: 'demo-media',
      alreadyAdded: false,
    }));
  },

  async add() {
    // Nothing to persist in demo mode.
  },
};

export const demoDownload: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'demo-download',
    name: 'Demo Downloader',
    kind: 'download',
    description: 'Simulated SABnzbd queue for trying the queue controls.',
    defaults: { scheme: 'http', port: 8080, path: '' },
    accent: '#7dd3fc',
    capabilities: { library: false, queue: true, search: false, add: false },
  },

  async test() {
    return { ok: true, version: 'demo-1.0', message: 'Sample queue' };
  },

  async queue(ctx) {
    const items: Array<[string, string, string, number, number, number, QueueItem['status']]> = [
      ['Harbour Nine - S01E05', 'tv', 'harbour.nine.s01e05', 0.62, 1_400_000_000, 45, 'downloading'],
      ['Signal Garden (2026) 2160p', 'movies', 'signal.garden.2160p', 0.28, 8_200_000_000, 120, 'downloading'],
      ['Vesper Loop - Low Tide', 'music', 'vesper.loop.low.tide', 0.91, 640_000_000, 210, 'queued'],
      ['Northern Relay - S02E19', 'tv', 'northern.relay.s02e19', 0.05, 1_100_000_000, 300, 'paused'],
    ];

    return items.map(([title, category, safeName, base, size, offset, status], index) => {
      const progress = status === 'downloading' ? tidalProgress(offset, 600) : base;
      return {
        id: `${safeName}-${index}`,
        serviceId: ctx.id,
        pluginId: 'demo-download',
        title,
        subtitle: category,
        progress: status === 'downloading' ? Math.max(0.03, progress) : progress,
        status,
        speedBytesPerSec: status === 'downloading' ? 18_400_000 : undefined,
        sizeBytes: size,
        remainingBytes: size * (1 - progress),
        etaSeconds: status === 'downloading' ? Math.round((1 - progress) * 2600) : undefined,
        category,
      } satisfies QueueItem;
    });
  },

  queueActions: {
    async pause() {},
    async resume() {},
    async delete() {},
  },

  clientControl: {
    async pause() {},
    async resume() {},
  },
};
