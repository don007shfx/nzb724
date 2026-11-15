import type { IntegrationPlugin, PluginContext } from '../contract';
import { requestRpc, HttpError } from '../../http';
import { buildUrl } from '../../http';
import type { QueueItem, QueueStatus } from '../../types';

interface NzbGroup {
  NZBID: number;
  NZBName: string;
  FileSizeMB?: number;
  RemainingSizeMB?: number;
  DownloadedSizeMB?: number;
  Status?: string;
  Category?: string;
}

interface NzbStatus {
  DownloadRate?: number;
  RemainingSizeMB?: number;
  DownloadPaused?: boolean;
}

function mapStatus(status?: string): QueueStatus {
  switch ((status ?? '').toUpperCase()) {
    case 'DOWNLOADING':
      return 'downloading';
    case 'PAUSED':
      return 'paused';
    case 'QUEUED':
      return 'queued';
    case 'FETCHING':
    case 'PPQUEUED':
      return 'postprocessing';
    case 'SUCCESS':
      return 'completed';
    case 'FAILURE':
    case 'DELETED':
      return 'error';
    default:
      return 'queued';
  }
}

const MB = 1024 * 1024;

/** NZBGet uses JSON-RPC over POST with HTTP basic auth. */
function rpc<T>(ctx: PluginContext, method: string, params: unknown[] = []): Promise<T> {
  const username = ctx.options.username ?? '';
  const password = ctx.options.password ?? '';
  const credentials =
    typeof btoa === 'function'
      ? btoa(`${username}:${password}`)
      : '';

  return requestRpc<T>(
    buildUrl(ctx.baseUrl, '/jsonrpc'),
    method,
    params,
    { Authorization: `Basic ${credentials}` },
  );
}

export const nzbget: IntegrationPlugin = {
  apiVersion: 1,
  meta: {
    id: 'nzbget',
    name: 'NZBGet',
    kind: 'download',
    description: 'Usenet queue with per-item pause and resume.',
    defaults: { scheme: 'http', port: 6789, path: '' },
    accent: '#4ade80',
    docsUrl: 'https://nzbget.com',
    capabilities: { library: false, queue: true, search: false, add: false },
    configFields: [
      {
        key: 'username',
        label: 'Username',
        defaultValue: 'nzbget',
        required: true,
      },
      { key: 'password', label: 'Password', secret: true, required: true },
    ],
  },

  // Basic auth is supplied per request inside `rpc`.
  auth: () => ({}),

  async test(ctx) {
    const version = await rpc<string>(ctx, 'version');
    return { ok: true, version: String(version), message: 'Connected' };
  },

  async queue(ctx) {
    const [groups, status] = await Promise.all([
      rpc<NzbGroup[]>(ctx, 'listgroups'),
      rpc<NzbStatus>(ctx, 'status').catch(
        () => ({}) as NzbStatus,
      ),
    ]);

    const rateKb = Number(status.DownloadRate ?? 0);

    return (groups ?? []).map((group) => {
      const sizeMb = Number(group.FileSizeMB ?? 0);
      const leftMb = Number(group.RemainingSizeMB ?? 0);
      const progress = sizeMb > 0 ? Math.min(1, Math.max(0, 1 - leftMb / sizeMb)) : 0;
      const speed = rateKb * 1024;
      const eta =
        speed > 0 && leftMb > 0 ? (leftMb * MB) / speed : undefined;

      return {
        id: String(group.NZBID),
        serviceId: ctx.id,
        pluginId: 'nzbget',
        title: group.NZBName,
        subtitle: group.Category,
        progress,
        status: mapStatus(group.Status),
        etaSeconds: eta,
        speedBytesPerSec: speed > 0 ? speed : undefined,
        sizeBytes: sizeMb > 0 ? sizeMb * MB : undefined,
        remainingBytes: leftMb > 0 ? leftMb * MB : undefined,
        category: group.Category,
      } satisfies QueueItem;
    });
  },

  async add() {
    throw new HttpError('NZBGet does not accept library additions', 0, '');
  },

  queueActions: {
    async pause(ctx, item) {
      await rpc(ctx, 'editqueue', ['GroupPause', 0, [Number(item.id)]]);
    },
    async resume(ctx, item) {
      await rpc(ctx, 'editqueue', ['GroupResume', 0, [Number(item.id)]]);
    },
    async delete(ctx, item) {
      await rpc(ctx, 'editqueue', ['GroupDelete', 0, [Number(item.id)]]);
    },
  },

  clientControl: {
    async pause(ctx) {
      await rpc(ctx, 'pausedownload');
    },
    async resume(ctx) {
      await rpc(ctx, 'resumedownload');
    },
  },
};
