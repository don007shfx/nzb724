import { formatBytes, formatRelative, formatSpeed, mediaKindLabel } from '../../core/format';
import { registry } from '../../core/integrations';
import { setView } from '../../store/actions';
import type { AppState } from '../../store/store';
import { Button, EmptyState, Panel, Pill, Poster, ServiceBadge, StatusDot } from '../primitives';
import { QueueRow } from '../queue-row';

function ServerCard({
  serverId,
  state,
}: {
  serverId: string;
  state: AppState;
}) {
  const server = state.servers.find((item) => item.id === serverId);
  if (!server) return null;
  const health = state.health[server.id];
  const plugin = registry.get(server.pluginId);
  const accent = plugin?.meta.accent ?? '#c9f74a';
  const queueCount = state.queue.filter((item) => item.serviceId === server.id).length;

  return (
    <button
      type="button"
      className="server-card"
      style={{ ['--svc' as string]: accent }}
      onClick={() => setView('servers')}
    >
      <div className="server-top">
        <StatusDot ok={Boolean(health?.ok)} pulse />
        <span className="server-name">{server.label}</span>
        {plugin && plugin.meta.name !== server.label ? (
          <span className="server-kind">{plugin.meta.name}</span>
        ) : null}
      </div>
      <div className="server-meta">
        <span className="mono">{health?.version ?? 'unknown'}</span>
        {health?.latencyMs !== undefined ? (
          <span className="mono">{health.latencyMs} ms</span>
        ) : null}
        {queueCount > 0 ? <span className="mono">{queueCount} in queue</span> : null}
      </div>
      <div className="server-detail">
        {health?.ok
          ? health.message ?? 'Connected'
          : health?.message ?? 'Not checked yet'}
      </div>
    </button>
  );
}

export function Dashboard({ state }: { state: AppState }) {
  const enabled = state.servers.filter((server) => server.enabled);
  const online = enabled.filter((server) => state.health[server.id]?.ok).length;
  const speed = state.queue.reduce((sum, item) => sum + (item.speedBytesPerSec ?? 0), 0);
  const active = state.queue.filter((item) => item.status === 'downloading').length;
  const mediaCount = state.library.length;
  const recent = [...state.library]
    .filter((item) => item.addedAt)
    .sort((a, b) => (b.addedAt ?? '').localeCompare(a.addedAt ?? ''))
    .slice(0, 10);
  const queuePreview = state.queue
    .slice()
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5);

  return (
    <div className="view-switch">
      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">Services online</div>
          <div className="stat-value">
            {online}
            <small> / {enabled.length}</small>
          </div>
          <div className="stat-foot">
            <span className="mono">{formatRelative(state.lastRefresh)}</span>
            <span>last sweep</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Throughput</div>
          <div className="stat-value">{speed > 0 ? formatSpeed(speed) : '--'}</div>
          <div className="stat-foot">
            <span className="mono">{active}</span>
            <span>downloading</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Library</div>
          <div className="stat-value">{mediaCount}</div>
          <div className="stat-foot">
            <span>titles across</span>
            <span className="mono">{state.servers.length}</span>
            <span>services</span>
          </div>
        </div>
      </div>

      {state.issues.length > 0 ? (
        <div className="notice" role="status">
          <div>
            <strong>{state.issues.length} service issue{state.issues.length > 1 ? 's' : ''}.</strong>{' '}
            {state.issues[0]}
            {state.issues.length > 1 ? ` (+${state.issues.length - 1} more)` : ''}
          </div>
        </div>
      ) : null}

      <Panel
        title="Services"
        subtitle="Everything NZB-7/24 is watching right now"
        actions={
          <Button size="sm" icon="plus" onClick={() => setView('servers')}>
            Add
          </Button>
        }
      >
        {state.servers.length === 0 ? (
          <EmptyState
            icon="servers"
            title="No services connected yet"
            body="Point NZB-7/24 at your Sonarr, Radarr, Lidarr, SABnzbd or NZBGet instance. It only ever talks to the APIs you already run."
            action={
              <>
                <Button variant="primary" icon="plus" onClick={() => setView('servers')}>
                  Connect a service
                </Button>
                <Button icon="bolt" onClick={() => setView('settings')}>
                  Try demo mode
                </Button>
              </>
            }
          />
        ) : (
          <div className="server-grid">
            {state.servers.map((server) => (
              <ServerCard key={server.id} serverId={server.id} state={state} />
            ))}
          </div>
        )}
      </Panel>

      <div className="split">
        <Panel
          title="Queue"
          subtitle={state.queue.length ? `${state.queue.length} active jobs` : 'Nothing downloading'}
          actions={
            <Button size="sm" variant="quiet" onClick={() => setView('queue')}>
              Open
            </Button>
          }
          flush
        >
          {queuePreview.length === 0 ? (
            <EmptyState
              icon="queue"
              title="Queue is clear"
              body="Downloads started by your services show up here with live progress, speed and ETA."
            />
          ) : (
            <div style={{ padding: '0 18px 12px' }}>
              {queuePreview.map((item) => (
                <QueueRow key={`${item.serviceId}-${item.id}`} item={item} />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Recently added"
          subtitle="Latest arrivals in your library"
          actions={
            <Button size="sm" variant="quiet" onClick={() => setView('library')}>
              Library
            </Button>
          }
        >
          {recent.length === 0 ? (
            <EmptyState
              icon="library"
              title="Library is empty"
              body="Once a media service is connected, everything it manages appears here."
            />
          ) : (
            <div className="mini-row">
              {recent.map((item) => (
                <button
                  key={`${item.serviceId}-${item.id}`}
                  type="button"
                  className="poster-card"
                  onClick={() => setView('library')}
                >
                  <Poster title={item.title} url={item.posterUrl} />
                  <span className="poster-title">{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="At a glance" flush>
        <div style={{ padding: '0 18px 16px' }}>
          {state.servers.length === 0 ? (
            <EmptyState
              icon="bolt"
              title="Nothing to summarise yet"
              body="Connect a service, or switch on demo mode in Settings to explore the app with sample data."
            />
          ) : (
            <div className="list">
              {state.servers.map((server) => {
                const health = state.health[server.id];
                const plugin = registry.get(server.pluginId);
                return (
                  <div className="list-row" key={server.id}>
                    <div className="row-lead">
                      <StatusDot ok={Boolean(health?.ok)} />
                      <ServiceBadge
                        name={server.label}
                        accent={plugin?.meta.accent ?? '#c9f74a'}
                      />
                    </div>
                    <div className="row-main">
                      <div className="row-sub">
                        <span>{plugin?.meta.kind === 'media' ? 'Media manager' : 'Download client'}</span>
                        {plugin ? (
                          <span className="cap-row">
                            {plugin.meta.capabilities.library ? <span className="cap">library</span> : null}
                            {plugin.meta.capabilities.queue ? <span className="cap">queue</span> : null}
                            {plugin.meta.capabilities.search ? <span className="cap">search</span> : null}
                            {plugin.meta.capabilities.add ? <span className="cap">add</span> : null}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="row-actions">
                      {health?.ok ? (
                        <Pill tone="ok">online</Pill>
                      ) : (
                        <Pill tone="bad">offline</Pill>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Panel>

      {state.library.length > 0 ? (
        <p className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          {state.library.filter((item) => item.kind === 'series').length} series ·{' '}
          {state.library.filter((item) => item.kind === 'movie').length} movies ·{' '}
          {state.library.filter((item) => item.kind === 'artist').length} artists ·{' '}
          {formatBytes(
            state.library.reduce((sum, item) => sum + (item.stats?.sizeOnDisk ?? 0), 0),
          )}{' '}
          tracked ({mediaKindLabel('series')} and friends)
        </p>
      ) : null}
    </div>
  );
}
