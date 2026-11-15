import type { IntegrationPlugin, PluginContext } from '../contract';
import { parseTimeLeft } from '../../format';
import type { QueueItem, QueueStatus } from '../../types';

interface SabSlot {
  nzo_id: string;
  filename: string;
  category?: string;
  mb?: string;
  mbleft?: string;
  percentage?: string;
  timeleft?: string;
  status?: string;
}

interface SabQueueResponse {
  queue?: {
    status?: string;
    speed?: string;
    kbpersec?: string;
    mb?: string;
    mbleft?: string;
    timeleft?: string;
    slots?: SabSlot[];
  };
}

function mapSabStatus(status?: string): QueueStatus {
  switch ((status ?? '').toLowerCase()) {
    case 'downloading':
      return 'downloading';
    case 'paused':
      return 'paused';
    case 'queued':
      return 'queued';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'error';
    default:
      return 'queued';
  }
}

/**
 * SABnzbd carries the key in the query string, so every call goes through
 * `call()` rather than the shared header based transport.
 */
function call<T>(
  ctx: PluginContext,
  mode: string,
  extra: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  return ctx.get<T>('/api', {
    query: {
      mode,
      output: 'json',
      apikey: ctx.apiKey,
      ...extra,
    },
  });
}

const MB = 1024 * 1024;

export const sabnzbd: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'sabnzbd',
    name: 'SABnzbd',
    kind: 'download',
    description: 'Usenet download queue, speed and history.',
    defaults: { scheme: 'http', port: 8080, path: '' },
    accent: '#ffb020',
    docsUrl: 'https://sabnzbd.org',
    capabilities: { library: false, queue: true, search: false, add: false },
    configFields: [
      {
        key: 'category',
        label: 'Default category',
        placeholder: 'tv',
        help: 'Categories are applied when a job is added through a *arr app.',
      },
    ],
  },

  // The key travels in the query string; sending X-Api-Key would be ignored.
  auth: () => ({}),

  async test(ctx) {
    const result = await call<{ version?: string }>(ctx, 'version');
    return { ok: true, version: result.version, message: 'Connected' };
  },

  async queue(ctx) {
    const response = await call<SabQueueResponse>(ctx, 'queue');
    const queue = response.queue ?? {};
    const speed = Number(queue.kbpersec ?? 0) * 1024;

    return (queue.slots ?? []).map((slot) => {
      const sizeMb = Number(slot.mb ?? 0);
      const leftMb = Number(slot.mbleft ?? 0);
      const percentage = Number(slot.percentage ?? 0) / 100;

      return {
        id: slot.nzo_id,
        serviceId: ctx.id,
        pluginId: 'sabnzbd',
        title: slot.filename,
        subtitle: slot.category,
        progress: Number.isFinite(percentage)
          ? Math.min(1, Math.max(0, percentage))
          : sizeMb > 0
            ? Math.min(1, Math.max(0, 1 - leftMb / sizeMb))
            : 0,
        status: mapSabStatus(slot.status),
        etaSeconds: parseTimeLeft(slot.timeleft),
        speedBytesPerSec: speed > 0 ? speed : undefined,
        sizeBytes: sizeMb > 0 ? sizeMb * MB : undefined,
        remainingBytes: leftMb > 0 ? leftMb * MB : undefined,
        category: slot.category,
      } satisfies QueueItem;
    });
  },

  queueActions: {
    async delete(ctx, item) {
      await call(ctx, 'queue', { name: 'delete', value: item.id, del_files: 1 });
    },
  },

  // SABnzbd pauses the whole queue; per-item pause is not part of its API.
  clientControl: {
    async pause(ctx) {
      await call(ctx, 'queue', { name: 'pause' });
    },
    async resume(ctx) {
      await call(ctx, 'queue', { name: 'resume' });
    },
  },
};
