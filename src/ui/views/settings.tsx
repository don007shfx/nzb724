import { useState } from 'react';
import { registry } from '../../core/integrations';
import {
  exportConfig,
  importConfig,
  resetAll,
  setDemoMode,
  setSettings,
} from '../../store/actions';
import type { AppState } from '../../store/store';
import { Button, Field, Modal, Panel, Toggle } from '../primitives';

const REFRESH_CHOICES = [0, 15, 30, 60, 120];

export function SettingsView({ state }: { state: AppState }) {
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [importText, setImportText] = useState('');
  const [copied, setCopied] = useState(false);

  const plugins = registry.list();

  return (
    <div className="view-switch">
      <Panel title="Monitoring" subtitle="How often the app polls your services">
        <div className="form-grid">
          <Field label="Refresh interval" hint="Zero disables the automatic sweep">
            <select
              className="input select"
              value={state.settings.refreshSeconds}
              onChange={(event) =>
                setSettings({ refreshSeconds: Number(event.target.value) })
              }
            >
              {REFRESH_CHOICES.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {seconds === 0 ? 'Manual only' : `Every ${seconds} seconds`}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 8 }}>
          <Toggle
            checked={state.settings.compact}
            onChange={(next) => setSettings({ compact: next })}
            label="Compact density"
            description="Tighter rows, more on screen"
          />
        </div>
      </Panel>

      <Panel title="Demo mode" subtitle="Explore the app with sample data">
        <Toggle
          checked={state.settings.demoMode}
          onChange={(next) => void setDemoMode(next)}
          label="Load the demo stack"
          description="Adds a sample library and a simulated download queue. Removing them is safe."
        />
      </Panel>

      <Panel
        title="Integrations"
        subtitle={`${plugins.length} registered in this build`}
        flush
      >
        <div className="list" style={{ padding: '0 18px 14px' }}>
          {plugins.map((plugin) => (
            <div className="list-row" key={plugin.meta.id}>
              <div className="row-main">
                <div className="row-title">
                  <span>{plugin.meta.name}</span>
                  <span className="cap-row">
                    {plugin.meta.capabilities.library ? <span className="cap">library</span> : null}
                    {plugin.meta.capabilities.queue ? <span className="cap">queue</span> : null}
                    {plugin.meta.capabilities.search ? <span className="cap">search</span> : null}
                    {plugin.meta.capabilities.add ? <span className="cap">add</span> : null}
                    {plugin.queueActions?.pause ? <span className="cap">pause</span> : null}
                    {plugin.queueActions?.delete ? <span className="cap">remove</span> : null}
                    {plugin.clientControl ? <span className="cap">client control</span> : null}
                  </span>
                </div>
                <div className="row-sub">
                  <span className="mono">{plugin.meta.id}</span>
                  <span>{plugin.meta.kind}</span>
                  <span>api v{plugin.apiVersion}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Data" subtitle="Everything lives on this device">
        <div className="toolbar">
          <Button icon="external" onClick={() => setShowExport(true)}>
            Export configuration
          </Button>
          <Button icon="plus" onClick={() => setShowImport(true)}>
            Import configuration
          </Button>
          <Button variant="danger" icon="trash" onClick={() => setShowReset(true)}>
            Reset everything
          </Button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
          Exports include API keys, so treat the file like a password. Nothing is sent
          anywhere except to the service addresses you configure.
        </p>
      </Panel>

      <Panel title="About">
        <div className="kv">
          <div className="kv-item">
            <span className="kv-key">App</span>
            <span className="kv-val">NZB-7/24 0.1.0</span>
          </div>
          <div className="kv-item">
            <span className="kv-key">Stack</span>
            <span className="kv-val">React + Electron / Capacitor</span>
          </div>
          <div className="kv-item">
            <span className="kv-key">Services</span>
            <span className="kv-val">{state.servers.length} connected</span>
          </div>
          <div className="kv-item">
            <span className="kv-key">Storage</span>
            <span className="kv-val">Local only</span>
          </div>
        </div>
      </Panel>

      {showExport ? (
        <Modal
          title="Export configuration"
          onClose={() => setShowExport(false)}
          footer={
            <>
              <Button variant="quiet" onClick={() => setShowExport(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                icon="check"
                onClick={() => {
                  void navigator.clipboard?.writeText(exportConfig());
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 12.5 }}>
            Contains API keys in plain text. Keep it somewhere safe.
          </p>
          <textarea
            className="input mono"
            readOnly
            rows={12}
            value={exportConfig()}
            onFocus={(event) => event.currentTarget.select()}
          />
        </Modal>
      ) : null}

      {showImport ? (
        <Modal
          title="Import configuration"
          onClose={() => setShowImport(false)}
          footer={
            <>
              <Button variant="quiet" onClick={() => setShowImport(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon="check"
                onClick={() => {
                  if (importConfig(importText)) {
                    setImportText('');
                    setShowImport(false);
                  }
                }}
              >
                Import
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 12.5 }}>
            Paste a file produced by Export. It replaces the current service list.
          </p>
          <textarea
            className="input mono"
            rows={12}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='{ "version": 1, "servers": [ ... ] }'
            spellCheck={false}
          />
        </Modal>
      ) : null}

      {showReset ? (
        <Modal
          title="Reset everything?"
          onClose={() => setShowReset(false)}
          footer={
            <>
              <Button variant="quiet" onClick={() => setShowReset(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon="trash"
                onClick={() => {
                  resetAll();
                  setShowReset(false);
                }}
              >
                Delete local data
              </Button>
            </>
          }
        >
          <p className="muted" style={{ fontSize: 13 }}>
            Removes every service, setting and cached library entry from this device.
            Your Sonarr, Radarr and download clients are untouched.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
