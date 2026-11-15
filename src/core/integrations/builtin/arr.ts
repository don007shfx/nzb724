/**
 * Shared mapping for the Sonarr / Radarr / Lidarr family. They all speak the
 * same shape, only the resource path and the "add" payload differ.
 */

import { parseTimeLeft } from '../../format';
import type { QueueStatus } from '../../types';
import type { QueueItem } from '../../types';

export interface ArrImage {
  coverType?: string;
  remoteUrl?: string;
  url?: string;
}

export interface ArrQueueRecord {
  id: number;
  title: string;
  status?: string;
  trackedDownloadState?: string;
  size?: number;
  sizeleft?: number;
  timeleft?: string;
  series?: { title?: string };
  movie?: { title?: string };
  artist?: { artistName?: string };
  album?: { title?: string };
  protocol?: string;
  downloadClient?: string;
}

export interface ArrQueueResponse {
  page?: number;
  pageSize?: number;
  totalRecords?: number;
  records?: ArrQueueRecord[];
}

export interface ArrStats {
  episodeFileCount?: number;
  episodeCount?: number;
  totalEpisodeCount?: number;
  movieFileCount?: number;
  trackFileCount?: number;
  trackCount?: number;
  totalTrackCount?: number;
  albumCount?: number;
  sizeOnDisk?: number;
}

export function pickPoster(images?: ArrImage[]): string | undefined {
  if (!images?.length) return undefined;
  const poster = images.find((image) => image.coverType === 'poster');
  return poster?.remoteUrl ?? poster?.url;
}

export function mapQueueStatus(
  status?: string,
  trackedDownloadState?: string,
): QueueStatus {
  const state = (trackedDownloadState ?? '').toLowerCase();
  if (state === 'importpending' || state === 'importing') return 'postprocessing';
  if (state === 'importfailed' || state === 'failedpending') return 'error';

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
    case 'failedpending':
      return 'error';
    case 'delay':
      return 'queued';
    default:
      return 'queued';
  }
}

export function mapQueue(
  response: ArrQueueResponse | ArrQueueRecord[] | undefined,
  serviceId: string,
  pluginId: string,
): QueueItem[] {
  const records = Array.isArray(response) ? response : (response?.records ?? []);
  return records.map((record) => {
    const size = Number(record.size ?? 0);
    const left = Number(record.sizeleft ?? 0);
    const progress = size > 0 ? Math.min(1, Math.max(0, 1 - left / size)) : 0;
    const subtitle =
      record.series?.title ??
      record.movie?.title ??
      record.artist?.artistName ??
      record.downloadClient;

    return {
      id: String(record.id),
      serviceId,
      pluginId,
      title: record.title,
      subtitle,
      progress,
      status: mapQueueStatus(record.status, record.trackedDownloadState),
      etaSeconds: parseTimeLeft(record.timeleft),
      sizeBytes: size > 0 ? size : undefined,
      remainingBytes: left > 0 ? left : undefined,
    } satisfies QueueItem;
  });
}

export interface ArrProfile {
  id: number;
  name: string;
}

export interface ArrRootFolder {
  path: string;
}

/** First root folder + first quality profile: enough to add without extra UI. */
export async function firstAddTargets(
  get: <T>(path: string) => Promise<T>,
  apiPath: string,
): Promise<{ rootFolderPath: string; qualityProfileId: number }> {
  const [folders, profiles] = await Promise.all([
    get<ArrRootFolder[]>(`${apiPath}/rootfolder`),
    get<ArrProfile[]>(`${apiPath}/qualityprofile`),
  ]);
  const rootFolderPath = folders?.[0]?.path;
  const qualityProfileId = profiles?.[0]?.id;
  if (!rootFolderPath || qualityProfileId === undefined) {
    throw new Error(
      'This server has no root folder or quality profile configured yet',
    );
  }
  return { rootFolderPath, qualityProfileId };
}
