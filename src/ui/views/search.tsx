import { useState } from 'react';
import type { FormEvent } from 'react';
import { mediaKindLabel } from '../../core/format';
import { registry } from '../../core/integrations';
import type { SearchResult } from '../../core/types';
import { addSearchResult, search as runSearch } from '../../store/actions';
import type { AppState } from '../../store/store';
import { Button, EmptyState, Panel, Pill, Poster, ServiceBadge } from '../primitives';
import { Icon } from '../icons';

interface ResultState {
  loading: boolean;
  ran: boolean;
  results: SearchResult[];
  issues: string[];
  error: string | null;
}

const INITIAL: ResultState = {
  loading: false,
  ran: false,
  results: [],
  issues: [],
  error: null,
};

export function SearchView({ state }: { state: AppState }) {
  const [term, setTerm] = useState('');
  const [outcome, setOutcome] = useState<ResultState>(INITIAL);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Record<string, boolean>>({});

  const searchable = state.servers.filter((server) => {
    const plugin = registry.get(server.pluginId);
    return server.enabled && Boolean(plugin?.meta.capabilities.search);
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const query = term.trim();
    if (!query) return;
    setOutcome({ ...INITIAL, loading: true, ran: true });
    const result = await runSearch(query);
    setOutcome({
      loading: false,
      ran: true,
      results: result.results,
      issues: result.issues,
      error: result.error,
    });
  }

  async function add(result: SearchResult) {
    const key = `${result.serviceId}-${result.id}`;
    setPending((current) => ({ ...current, [key]: true }));
    const ok = await addSearchResult(result);
    setPending((current) => ({ ...current, [key]: false }));
    if (ok) setAdded((current) => ({ ...current, [key]: true }));
  }

  return (
    <div className="view-switch">
      <Panel
        title="Search"
        subtitle="Look up titles across every media manager at once"
      >
        <form className="toolbar" onSubmit={submit}>
          <div className="search-field">
            <Icon name="search" size={16} />
            <input
              className="input"
              type="search"
              placeholder="Series, film or artist"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoFocus
              aria-label="Search for a title"
            />
          </div>
          <Button type="submit" variant="primary" icon="search" disabled={outcome.loading}>
            {outcome.loading ? 'Searching' : 'Search'}
          </Button>
        </form>

        <div className="chips" style={{ marginTop: 12 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Searching {searchable.length} service{searchable.length === 1 ? '' : 's'}
          </span>
        </div>
      </Panel>

      {outcome.error ? (
        <div className="notice">
          <Icon name="alert" size={16} />
          <span>{outcome.error}</span>
        </div>
      ) : null}

      {outcome.issues.length > 0 ? (
        <div className="notice">
          <Icon name="alert" size={16} />
          <span>{outcome.issues.join(' · ')}</span>
        </div>
      ) : null}

      <Panel
        title="Results"
        subtitle={
          outcome.ran
            ? `${outcome.results.length} ${outcome.results.length === 1 ? 'match' : 'matches'}`
            : 'Nothing searched yet'
        }
        flush
      >
        {!outcome.ran ? (
          <EmptyState
            icon="search"
            title="Find something to add"
            body="Search hits the lookup API of each connected media manager, so results depend on what those services can see."
          />
        ) : outcome.loading ? (
          <div style={{ padding: 18, display: 'grid', gap: 10 }}>
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton" style={{ height: 56 }} />
            ))}
          </div>
        ) : outcome.results.length === 0 ? (
          <EmptyState
            icon="search"
            title="No matches"
            body="Try a different spelling, or add another media manager so the search has more sources."
          />
        ) : (
          <div className="list" style={{ padding: '0 18px 14px' }}>
            {outcome.results.map((result) => {
              const key = `${result.serviceId}-${result.id}`;
              const server = state.servers.find((item) => item.id === result.serviceId);
              const isAdded = added[key] || result.alreadyAdded;

              return (
                <div className="list-row" key={key}>
                  <Poster
                    title={result.title}
                    url={result.posterUrl}
                    ratio="2 / 3"
                    className="result-poster"
                  />
                  <div className="row-main">
                    <div className="row-title">
                      <span>{result.title}</span>
                      <Pill>{mediaKindLabel(result.kind)}</Pill>
                    </div>
                    <div className="row-sub">
                      {server ? <ServiceBadge name={server.label} accent="#7dd3fc" /> : null}
                      <span className="mono">{result.year ?? '----'}</span>
                      {result.overview ? (
                        <span className="row-clip">{result.overview}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="row-actions">
                    {isAdded ? (
                      <Pill tone="ok">in library</Pill>
                    ) : (
                      <Button
                        size="sm"
                        icon="plus"
                        variant="primary"
                        disabled={pending[key]}
                        onClick={() => void add(result)}
                      >
                        {pending[key] ? 'Adding' : 'Add'}
                      </Button>
                    )}
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
