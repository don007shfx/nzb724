import type { QueueItem } from '../core/types';
import { formatBytes, formatEta, formatPercent, formatSpeed } from '../core/format';
import { registry } from '../core/integrations';
import { queueAction } from '../store/actions';
import { IconButton, Pill, Progress, ServiceBadge } from './primitives';

function statusTone(status: QueueItem['status']): 'accent' | 'sky' | 'warn' | 'bad' {
  switch (status) {
    case 'downloading':
      return 'accent';
    case 'paused':
      return 'warn';
    case 'error':
      return 'bad';
    default:
      return 'sky';
  }
}

function statusLabel(status: QueueItem['status']): string {
  switch (status) {
    case 'postprocessing':
      return 'Processing';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

const PILL_TONE = {
  downloading: 'accent',
  queued: 'neutral',
  paused: 'warn',
  completed: 'ok',
  postprocessing: 'neutral',
  error: 'bad',
} as const;

export function QueueRow({ item }: { item: QueueItem }) {
  const plugin = registry.get(item.pluginId);
  const canPause = Boolean(plugin?.queueActions?.pause);
  const canResume = Boolean(plugin?.queueActions?.resume);
  const canDelete = Boolean(plugin?.queueActions?.delete);
  const server = plugin?.meta;

  return (
    <div className="list-row">
      <div className="row-main">
        <div className="row-title">
          <span>{item.title}</span>
          <Pill tone={PILL_TONE[item.status]}>{statusLabel(item.status)}</Pill>
        </div>
        <Progress value={item.progress} tone={statusTone(item.status)} />
        <div className="row-sub">
          {server ? <ServiceBadge name={server.name} accent={server.accent} /> : null}
          <span className="mono">{formatPercent(item.progress)}</span>
          {item.sizeBytes ? (
            <span className="mono">
              {formatBytes(item.sizeBytes - (item.remainingBytes ?? 0))} / {formatBytes(item.sizeBytes)}
            </span>
          ) : null}
          {item.speedBytesPerSec ? (
            <span className="mono">{formatSpeed(item.speedBytesPerSec)}</span>
          ) : null}
          {item.etaSeconds !== undefined ? (
            <span className="mono">{formatEta(item.etaSeconds)} left</span>
          ) : null}
          {item.subtitle ? <span>{item.subtitle}</span> : null}
        </div>
      </div>
      <div className="row-actions">
        {item.status === 'downloading' && canPause ? (
          <IconButton
            icon="pause"
            label={`Pause ${item.title}`}
            onClick={() => void queueAction(item, 'pause')}
          />
        ) : null}
        {(item.status === 'paused' || item.status === 'queued') && canResume ? (
          <IconButton
            icon="play"
            label={`Resume ${item.title}`}
            onClick={() => void queueAction(item, 'resume')}
          />
        ) : null}
        {canDelete ? (
          <IconButton
            icon="trash"
            label={`Remove ${item.title}`}
            className="danger"
            onClick={() => void queueAction(item, 'delete')}
          />
        ) : null}
      </div>
    </div>
  );
}
