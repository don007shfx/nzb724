import { useEffect } from 'react';
import { formatRelative } from '../core/format';
import { useAppState, useViewport } from '../hooks';
import { dismissToast, hydrate, refresh, setView } from '../store/actions';
import type { Toast } from '../store/store';
import { Icon, type IconName } from './icons';
import { IconButton, Pill, StatusDot } from './primitives';
import { Dashboard } from './views/dashboard';
import { LibraryView } from './views/library';
import { QueueView } from './views/queue';
import { SearchView } from './views/search';
import { ServersView } from './views/servers';
import { SettingsView } from './views/settings';

interface ViewMeta {
  id: string;
  label: string;
  icon: IconName;
  title: string;
  subtitle: string;
  mobile: boolean;
}

const VIEWS: ViewMeta[] = [
  {
    id: 'dashboard',
    label: 'Control room',
    icon: 'dashboard',
    title: 'Control room',
    subtitle: 'Live state of every service',
    mobile: true,
  },
  {
    id: 'library',
    label: 'Library',
    icon: 'library',
    title: 'Library',
    subtitle: 'Everything your media managers track',
    mobile: true,
  },
  {
    id: 'queue',
    label: 'Queue',
    icon: 'queue',
    title: 'Queue',
    subtitle: 'Unified download activity',
    mobile: true,
  },
  {
    id: 'search',
    label: 'Search',
    icon: 'search',
    title: 'Search',
    subtitle: 'Look up and add new titles',
    mobile: true,
  },
  {
    id: 'servers',
    label: 'Services',
    icon: 'servers',
    title: 'Services',
    subtitle: 'Connections to your stack',
    mobile: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    title: 'Settings',
    subtitle: 'Monitoring, integrations and data',
    mobile: false,
  },
];

function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          <span className="toast-icon">
            <Icon
              name={toast.tone === 'ok' ? 'check' : toast.tone === 'error' ? 'alert' : 'bolt'}
              size={16}
            />
          </span>
          <span className="toast-text">{toast.text}</span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const state = useAppState();
  const { mobile } = useViewport();
  const active = VIEWS.find((view) => view.id === state.activeView) ?? VIEWS[0];

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const seconds = state.settings.refreshSeconds;
    if (!seconds) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [state.hydrated, state.settings.refreshSeconds]);

  const online = state.servers.filter((server) => state.health[server.id]?.ok).length;

  return (
    <div className={`shell ${state.settings.compact ? 'compact' : ''}`.trim()}>
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">7/24</div>
          <div className="brand-text">
            <span className="brand-name">NZB-7/24</span>
            <span className="brand-sub">control room</span>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          <span className="nav-label">Workspace</span>
          {VIEWS.map((view) => (
            <button
              key={view.id}
              type="button"
              className={`nav-item ${state.activeView === view.id ? 'active' : ''}`.trim()}
              onClick={() => setView(view.id)}
              aria-current={state.activeView === view.id ? 'page' : undefined}
            >
              <Icon name={view.icon} size={17} />
              <span>{view.label}</span>
              {view.id === 'queue' && state.queue.length > 0 ? (
                <span className="count">{state.queue.length}</span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="rail-stat">
            <span>Online</span>
            <span className="mono">
              {online}/{state.servers.length}
            </span>
          </div>
          <div className="rail-stat">
            <span>Last sweep</span>
            <span className="mono">{formatRelative(state.lastRefresh)}</span>
          </div>
          <div className="rail-version mono">v0.1.0 · local-first</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          {mobile ? (
            <div className="mobile-brand">
              <div className="brand-mark">7/24</div>
            </div>
          ) : null}
          <div className="topbar-title">
            <h1>{active.title}</h1>
            <span>{active.subtitle}</span>
          </div>
          <div className="topbar-actions">
            {state.issues.length > 0 ? (
              <Pill tone="warn">{state.issues.length} issue{state.issues.length > 1 ? 's' : ''}</Pill>
            ) : state.lastRefresh ? (
              <span className="pill pill-ok">
                <StatusDot ok />
                live
              </span>
            ) : null}
            <IconButton
              icon="refresh"
              label="Refresh now"
              disabled={state.refreshing}
              onClick={() => void refresh()}
            />
            {mobile ? (
              <IconButton icon="settings" label="Settings" onClick={() => setView('settings')} />
            ) : null}
          </div>
        </header>

        <div className="content">
          {state.activeView === 'dashboard' ? <Dashboard state={state} /> : null}
          {state.activeView === 'library' ? <LibraryView state={state} /> : null}
          {state.activeView === 'queue' ? <QueueView state={state} /> : null}
          {state.activeView === 'search' ? <SearchView state={state} /> : null}
          {state.activeView === 'servers' ? <ServersView state={state} /> : null}
          {state.activeView === 'settings' ? <SettingsView state={state} /> : null}
        </div>
      </main>

      {mobile ? (
        <nav className="tabbar" aria-label="Primary">
          {VIEWS.filter((view) => view.mobile).map((view) => (
            <button
              key={view.id}
              type="button"
              className={`tab ${state.activeView === view.id ? 'active' : ''}`.trim()}
              onClick={() => setView(view.id)}
            >
              <Icon name={view.icon} size={19} />
              <span>{view.label}</span>
            </button>
          ))}
        </nav>
      ) : null}

      <ToastStack toasts={state.toasts} />
    </div>
  );
}
