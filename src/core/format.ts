/** Display helpers. Kept dependency-free and locale-stable. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes?: number, fractionDigits = 1): string {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes)) return '--';
  if (bytes <= 0) return '0 B';
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  const digits = value >= 100 || exponent === 0 ? 0 : fractionDigits;
  return `${value.toFixed(digits)} ${UNITS[exponent]}`;
}

export function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond || !Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return '--';
  }
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '--';
  if (seconds > 60 * 60 * 24 * 30) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export function formatRelative(timestamp?: number | null): string {
  if (!timestamp) return 'never';
  const delta = Math.round((Date.now() - timestamp) / 1000);
  if (delta < 5) return 'just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.round(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h ago`;
  return `${Math.round(delta / 86400)}d ago`;
}

export function formatPercent(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

/** Deterministic hue so a title always gets the same placeholder colour. */
export function hashHue(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 360;
}

export function monogram(title: string): string {
  const trimmed = title.replace(/^(the|a|an)\s+/i, '').trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function mediaKindLabel(kind: string): string {
  switch (kind) {
    case 'series':
      return 'Series';
    case 'movie':
      return 'Movie';
    case 'artist':
      return 'Artist';
    case 'album':
      return 'Album';
    default:
      return kind;
  }
}

export function parseTimeLeft(value?: string): number | undefined {
  // *arr and SABnzbd both use HH:MM:SS, sometimes with a leading day count.
  if (!value || !/^\d+:\d{2}:\d{2}$/.test(value.trim())) return undefined;
  const [hours, minutes, seconds] = value.trim().split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}
