import { useState } from 'react';
import type { CSSProperties } from 'react';
import { suggestedBaseUrl } from '../../core/api';
import { registry } from '../../core/integrations';
import type { ServerConfig } from '../../core/types';
import { formatRelative } from '../../core/format';
import {
  addServer,
  makeServer,
  removeServer,
  testServer,
  updateServer,
} from '../../store/actions';
import type { AppState } from '../../store/store';
import {
  Button,
  EmptyState,
  Field,
  IconButton,
  Modal,
  Panel,
  Pill,
  ServiceBadge,
  StatusDot,
  Toggle,
} from '../primitives';

type Editor =
  | { mode: 'new'; pluginId: string }
  | { mode: 'edit'; server: ServerConfig }
  | null;

function CapabilityChips({ pluginId }: { pluginId: string }) {
  const caps = registry.get(pluginId)?.meta.capabilities;
  if (!caps) return null;
  return (
    <span className="cap-row">
      {caps.library ? <span className="cap">library</span> : null}
      {caps.queue ? <span className="cap">queue</span> : null}
      {caps.search ? <span className="cap">search</span> : null}
      {caps.add ? <span className="cap">add</span> : null}
    </span>
  );
}

function ServerForm({
  editor,
  onClose,
}: {
  editor: Exclude<Editor, null>;
  onClose: () => void;
}) {
  const plugin = registry.require(
    editor.mode === 'new' ? editor.pluginId : editor.server.pluginId,
  );
  const existing = editor.mode === 'edit' ? editor.server : null;

  const [label, setLabel] = useState(existing?.label ?? plugin.meta.name);
  const [baseUrl, setBaseUrl] = useState(
    existing?.baseUrl ?? suggestedBaseUrl(plugin.meta.id),
  );
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? '');
  const [options, setOptions] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = { ...(existing?.options ?? {}) };
    for (const field of plugin.meta.configFields ?? []) {
      if (seed[field.key] === undefined && field.defaultValue !== undefined) {
        seed[field.key] = field.defaultValue;
      }
    }
    return seed;
  });

  // Services that authenticate with a secret config field (username/password)
  // do not need the API-key input.
  const usesPasswordAuth = Boolean(
    plugin.meta.configFields?.some((field) => field.secret),
  );
  const needsKey = !usesPasswordAuth;

  function submit() {
    if (existing) {
      updateServer(existing.id, { label, baseUrl, apiKey, options });
      void testServer(existing.id);
    } else {
      addServer(
        makeServer({
          pluginId: plugin.meta.id,
          label,
          baseUrl,
          apiKey,
          options,
        }),
      );
    }
    onClose();
  }

  return (
    <Modal
      title={existing ? `Edit ${existing.label}` : `Add ${plugin.meta.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" onClick={submit} disabled={!baseUrl.trim()}>
            {existing ? 'Save' : 'Add service'}
          </Button>
        </>
      }
    >
      <div className="picker-item selected" style={{ cursor: 'default' }}>
        <span
          className="picker-mark"
          style={{ ['--svc' as string]: plugin.meta.accent } as CSSProperties}
        >
          {plugin.meta.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="picker-body">
          <span className="picker-name">{plugin.meta.name}</span>
          <span className="picker-desc">{plugin.meta.description}</span>
        </div>
        <CapabilityChips pluginId={plugin.meta.id} />
      </div>

      <div className="form-grid">
        <div className="span-2">
          <Field label="Name" hint="How it appears in the app">
            <input
              className="input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={plugin.meta.name}
            />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Address" hint="Include the port. Do not add /api.">
            <input
              className="input mono"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder={suggestedBaseUrl(plugin.meta.id)}
              spellCheck={false}
              autoCapitalize="off"
            />
          </Field>
        </div>
        {needsKey ? (
          <div className="span-2">
            <Field label="API key" hint="Settings → General → API Key in the service">
              <input
                className="input mono"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste the API key"
                spellCheck={false}
                autoCapitalize="off"
              />
            </Field>
          </div>
        ) : null}

        {(plugin.meta.configFields ?? []).map((field) => (
          <div key={field.key} className={field.key === 'category' ? 'span-2' : undefined}>
            <Field label={field.label} hint={field.help}>
              <input
                className="input"
                type={field.secret ? 'password' : 'text'}
                value={options[field.key] ?? ''}
                placeholder={field.placeholder}
                onChange={(event) =>
                  setOptions((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            </Field>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function ServicePicker({ onPick, onClose }: { onPick: (pluginId: string) => void; onClose: () => void }) {
  return (
    <Modal title="Add a service" onClose={onClose} wide>
      <p className="muted" style={{ fontSize: 12.5 }}>
        These are the integrations registered in this build. Adding another is a
        single file plus one line in the registry.
      </p>
      <div className="picker">
        {registry.list().map((plugin) => (
          <button
            key={plugin.meta.id}
            type="button"
            className="picker-item"
            onClick={() => onPick(plugin.meta.id)}
          >
            <span
              className="picker-mark"
              style={{ ['--svc' as string]: plugin.meta.accent } as CSSProperties}
            >
              {plugin.meta.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="picker-body">
              <span className="picker-name">{plugin.meta.name}</span>
              <span className="picker-desc">{plugin.meta.description}</span>
            </div>
            <CapabilityChips pluginId={plugin.meta.id} />
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ServersView({ state }: { state: AppState }) {
  const [editor, setEditor] = useState<Editor>(null);
  const [picking, setPicking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<ServerConfig | null>(null);

  return (
    <div className="view-switch">
      <Panel
        title="Services"
        subtitle="API endpoints this app is allowed to talk to"
        actions={
          <Button variant="primary" size="sm" icon="plus" onClick={() => setPicking(true)}>
            Add service
          </Button>
        }
        flush
      >
        {state.servers.length === 0 ? (
          <EmptyState
            icon="servers"
            title="Nothing connected"
            body="Add your first service. Credentials stay on this device and are only sent to the address you enter."
            action={
              <Button variant="primary" icon="plus" onClick={() => setPicking(true)}>
                Add a service
              </Button>
            }
          />
        ) : (
          <div className="list" style={{ padding: '0 18px 14px' }}>
            {state.servers.map((server) => {
              const plugin = registry.get(server.pluginId);
              const health = state.health[server.id];
              const accent = plugin?.meta.accent ?? '#c9f74a';

              return (
                <div className="list-row" key={server.id}>
                  <div className="row-lead">
                    <StatusDot ok={Boolean(health?.ok)} pulse />
                  </div>
                  <div className="row-main">
                    <div className="row-title">
                      <span>{server.label}</span>
                      {plugin && plugin.meta.name !== server.label ? (
                        <ServiceBadge name={plugin.meta.name} accent={accent} />
                      ) : (
                        <ServiceBadge
                          name={plugin?.meta.kind === 'download' ? 'download client' : 'media manager'}
                          accent={accent}
                        />
                      )}
                      {!server.enabled ? <Pill tone="warn">paused</Pill> : null}
                    </div>
                    <div className="row-sub">
                      <span className="mono">{server.baseUrl}</span>
                      {health?.version ? <span className="mono">{health.version}</span> : null}
                      {health?.latencyMs !== undefined ? (
                        <span className="mono">{health.latencyMs} ms</span>
                      ) : null}
                      <span>checked {formatRelative(health?.checkedAt)}</span>
                    </div>
                    {!health?.ok && health?.message ? (
                      <div className="row-sub" style={{ color: 'var(--bad)' }}>
                        {health.message}
                      </div>
                    ) : null}
                  </div>
                  <div className="row-actions">
                    <IconButton
                      icon="refresh"
                      label={`Test ${server.label}`}
                      onClick={() => void testServer(server.id)}
                    />
                    <IconButton
                      icon="settings"
                      label={`Edit ${server.label}`}
                      onClick={() => setEditor({ mode: 'edit', server })}
                    />
                    <IconButton
                      icon="trash"
                      label={`Remove ${server.label}`}
                      className="danger"
                      onClick={() => setConfirmRemove(server)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Per-service behaviour" subtitle="Toggle a service without deleting it">
        {state.servers.length === 0 ? (
          <p className="muted" style={{ fontSize: 12.5 }}>
            Add a service to control it here.
          </p>
        ) : (
          state.servers.map((server) => (
            <Toggle
              key={server.id}
              checked={server.enabled}
              onChange={(next) => updateServer(server.id, { enabled: next })}
              label={server.label}
              description={
                server.enabled
                  ? 'Polled on every refresh'
                  : 'Ignored until you switch it back on'
              }
            />
          ))
        )}
      </Panel>

      {picking ? (
        <ServicePicker
          onClose={() => setPicking(false)}
          onPick={(pluginId) => {
            setPicking(false);
            setEditor({ mode: 'new', pluginId });
          }}
        />
      ) : null}

      {editor ? <ServerForm editor={editor} onClose={() => setEditor(null)} /> : null}

      {confirmRemove ? (
        <Modal
          title={`Remove ${confirmRemove.label}?`}
          onClose={() => setConfirmRemove(null)}
          footer={
            <>
              <Button variant="quiet" onClick={() => setConfirmRemove(null)}>
                Keep it
              </Button>
              <Button
                variant="danger"
                icon="trash"
                onClick={() => {
                  removeServer(confirmRemove.id);
                  setConfirmRemove(null);
                }}
              >
                Remove service
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 13 }}>
            This only removes the connection from NZB-7/24. Nothing is deleted on{' '}
            {confirmRemove.baseUrl}.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
