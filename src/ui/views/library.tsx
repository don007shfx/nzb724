import { useMemo, useState } from 'react';
import { formatBytes, mediaKindLabel } from '../../core/format';
import { registry } from '../../core/integrations';
import type { MediaItem, MediaKind } from '../../core/types';
import type { AppState } from '../../store/store';
import {
  Button,
  EmptyState,
  Field,
  Modal,
  Panel,
  Pill,
  Poster,
  ServiceBadge,
} from '../primitives';
import { Icon } from '../icons';

type KindFilter = 'all' | MediaKind;

const KINDS: Array<{ id: KindFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'series', label: 'Series' },
  { id: 'movie', label: 'Movies' },
  { id: 'artist', label: 'Artists' },
];

function Detail({
  item,
  state,
  onClose,
}: {
  item: MediaItem;
  state: AppState;
  onClose: () => void;
}) {
  const server = state.servers.find((candidate) => candidate.id === item.serviceId);
  const plugin = registry.get(item.pluginId);

  return (
    <Modal title={item.title} onClose={onClose}>
      <div className="detail">
        <div className="detail-top">
          <Poster title={item.title} url={item.posterUrl} />
          <div>
            <div className="detail-title">
              {item.title}
              {item.year ? ` (${item.year})` : ''}
            </div>
            <div className="detail-meta">
              <Pill>{mediaKindLabel(item.kind)}</Pill>
              {item.monitored !== undefined ? (
                <Pill tone={item.monitored ? 'accent' : 'neutral'}>
                  {item.monitored ? 'Monitored' : 'Unmonitored'}
                </Pill>
              ) : null}
              {item.status ? <Pill>{item.status}</Pill> : null}
            </div>
            <div className="detail-meta">
              {plugin ? <ServiceBadge name={server?.label ?? plugin.meta.name} accent={plugin.meta.accent} /> : null}
            </div>
          </div>
        </div>

        {item.overview ? <p className="detail-overview">{item.overview}</p> : null}

        <div className="kv">
          <div className="kv-item">
            <span className="kv-key">Have</span>
            <span className="kv-val">
              {item.stats?.have ?? '--'}
              {item.stats?.total !== undefined ? ` / ${item.stats.total}` : ''}
            </span>
          </div>
          <div className="kv-item">
            <span className="kv-key">On disk</span>
            <span className="kv-val">{formatBytes(item.stats?.sizeOnDisk)}</span>
          </div>
          <div className="kv-item">
            <span className="kv-key">Added</span>
            <span className="kv-val">
              {item.addedAt ? new Date(item.addedAt).toLocaleDateString() : '--'}
            </span>
          </div>
          <div className="kv-item">
            <span className="kv-key">Service</span>
            <span className="kv-val">{plugin?.meta.name ?? item.pluginId}</span>
          </div>
        </div>

        {server ? (
          <Button
            icon="external"
            onClick={() => window.open(server.baseUrl, '_blank', 'noopener')}
          >
            Open {server.label}
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

export function LibraryView({ state }: { state: AppState }) {
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [serviceId, setServiceId] = useState<string>('all');

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return state.library
      .filter((item) => (kind === 'all' ? true : item.kind === kind))
      .filter((item) => (serviceId === 'all' ? true : item.serviceId === serviceId))
      .filter((item) => !needle || item.title.toLowerCase().includes(needle))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [state.library, kind, serviceId, term]);

  return (
    <div className="view-switch">
      <Panel flush>
        <div style={{ padding: '16px 18px' }}>
          <div className="toolbar">
            <div className="search-field">
              <Icon name="search" size={16} />
              <input
                className="input"
                type="search"
                placeholder="Filter the library"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                aria-label="Filter the library"
              />
            </div>
            {state.servers.length > 1 ? (
              <Field label="">
                <select
                  className="input select"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  aria-label="Filter by service"
                >
                  <option value="all">All services</option>
                  {state.servers.map((server) => (
                    <option key={server.id} value={server.id}>
                      {server.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>
          <div className="chips" style={{ marginTop: 12 }}>
            {KINDS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`chip ${kind === entry.id ? 'active' : ''}`.trim()}
                onClick={() => setKind(entry.id)}
              >
                {entry.label}
              </button>
            ))}
            <span className="muted mono" style={{ marginLeft: 'auto', fontSize: 12 }}>
              {filtered.length} titles
            </span>
          </div>
        </div>

        {state.library.length === 0 ? (
          <EmptyState
            icon="library"
            title="No library yet"
            body="Connect Sonarr, Radarr or Lidarr and their catalogues land here, searchable and filterable in one place."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nothing matches"
            body="Try a shorter search, or clear the filters."
            action={
              <Button
                onClick={() => {
                  setTerm('');
                  setKind('all');
                  setServiceId('all');
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="poster-grid" style={{ padding: '4px 18px 18px' }}>
            {filtered.map((item) => (
              <button
                key={`${item.serviceId}-${item.id}`}
                type="button"
                className="poster-card"
                onClick={() => setSelected(item)}
              >
                <Poster title={item.title} url={item.posterUrl} />
                <span className="poster-title">{item.title}</span>
                <span className="poster-sub">
                  <span className="mono">{item.year ?? '----'}</span>
                  {item.stats?.total !== undefined ? (
                    <span className="mono">
                      {item.stats.have ?? 0}/{item.stats.total}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      {selected ? <Detail item={selected} state={state} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
