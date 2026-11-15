import { formatBytes, formatSpeed } from '../../core/format';
import { registry } from '../../core/integrations';
import { clientControl } from '../../store/actions';
import type { AppState } from '../../store/store';
import { Button, EmptyState, Panel, ServiceBadge, StatusDot } from '../primitives';
import { QueueRow } from '../queue-row';

export function QueueView({ state }: { state: AppState }) {
  const speed = state.queue.reduce((sum, item) => sum + (item.speedBytesPerSec ?? 0), 0);
  const remaining = state.queue.reduce((sum, item) => sum + (item.remainingBytes ?? 0), 0);
  const active = state.queue.filter((item) => item.status === 'downloading').length;

  const groups = state.servers
    .map((server) => ({
      server,
      items: state.queue.filter((item) => item.serviceId === server.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="view-switch">
      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">Downloading</div>
          <div className="stat-value">{active}</div>
          <div className="stat-foot">
            <span>of</span>
            <span className="mono">{state.queue.length}</span>
            <span>jobs in queue</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Combined speed</div>
          <div className="stat-value">{speed > 0 ? formatSpeed(speed) : '--'}</div>
          <div className="stat-foot">
            <span>across all download clients</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Remaining</div>
          <div className="stat-value">{formatBytes(remaining)}</div>
          <div className="stat-foot">
            <span className="mono">{state.servers.length}</span>
            <span>services polled</span>
          </div>
        </div>
      </div>

      <Panel title="Unified queue" subtitle="Every client, one list" flush>
        {groups.length === 0 ? (
          <EmptyState
            icon="queue"
            title="Nothing in the queue"
            body="Jobs started by Sonarr, Radarr, Lidarr, SABnzbd or NZBGet show up here. Pause, resume and remove them without leaving the app."
            action={
              <Button icon="refresh" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            }
          />
        ) : (
          <div style={{ padding: '0 18px 16px' }}>
            {groups.map(({ server, items }) => {
              const plugin = registry.get(server.pluginId);
              const groupSpeed = items.reduce(
                (sum, item) => sum + (item.speedBytesPerSec ?? 0),
                0,
              );
              const health = state.health[server.id];

              return (
                <div className="queue-group" key={server.id}>
                  <div className="queue-group-head">
                    <div className="queue-group-title">
                      <StatusDot ok={Boolean(health?.ok)} />
                      <ServiceBadge
                        name={server.label}
                        accent={plugin?.meta.accent ?? '#c9f74a'}
                      />
                    </div>
                    <div className="queue-group-meta">
                      <span className="mono">{items.length}</span>
                      <span>jobs</span>
                      {groupSpeed > 0 ? <span className="mono">{formatSpeed(groupSpeed)}</span> : null}
                      {plugin?.clientControl ? (
                        <>
                          <Button
                            size="sm"
                            variant="quiet"
                            icon="pause"
                            onClick={() => void clientControl(server.id, 'pause')}
                          >
                            Pause all
                          </Button>
                          <Button
                            size="sm"
                            variant="quiet"
                            icon="play"
                            onClick={() => void clientControl(server.id, 'resume')}
                          >
                            Resume
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="list">
                    {items.map((item) => (
                      <QueueRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
