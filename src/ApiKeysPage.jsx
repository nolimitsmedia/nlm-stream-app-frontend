import { useEffect, useState } from "react";
import api from "./api";

function PanelHeader({ title, sub, badge }) {
  return (
    <div className="ak-panel-header">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {badge && <span className="ak-badge">{badge}</span>}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ApiKeysPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newKey, setNewKey] = useState(null);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/organizations/current/api-keys");
      setKeys(res.data.keys || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load API keys.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError("");
      setNotice("");
      const res = await api.post("/api/organizations/current/api-keys", {
        label: label.trim() || null,
      });
      setNewKey(res.data.api_key);
      setLabel("");
      await loadKeys();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create API key.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key) => {
    if (
      !window.confirm(
        `Revoke the API key "${key.label || key.key_prefix}"? Anything using it will immediately stop working — this can't be undone.`,
      )
    )
      return;

    try {
      setRevokingId(key.id);
      setError("");
      await api.delete(`/api/organizations/current/api-keys/${key.id}`);
      setNotice("API key revoked.");
      await loadKeys();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to revoke API key.");
    } finally {
      setRevokingId(null);
    }
  };

  const activeKeys = keys.filter((k) => !k.revoked_at);
  const revokedKeys = keys.filter((k) => k.revoked_at);

  return (
    <div className="ak-page">
      <div className="ak-page-header">
        <div className="ak-page-header-left">
          <div className="ak-page-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div>
            <h2 className="ak-page-title">API Keys</h2>
            <p className="ak-page-sub">
              Read-only programmatic access to your streams, recordings, and
              analytics — for integrating with your own systems.
            </p>
          </div>
        </div>
      </div>

      {error && <div className="ak-error">{error}</div>}
      {notice && <div className="ak-notice">{notice}</div>}

      {newKey && (
        <div className="ak-new-key-box">
          <strong>Copy this key now</strong>
          <p>It will not be shown again after you leave this page.</p>
          <code>{newKey}</code>
          <button
            type="button"
            className="ak-btn ak-btn--ghost"
            onClick={() => {
              navigator.clipboard?.writeText(newKey);
              setNotice("Copied to clipboard.");
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="ak-btn ak-btn--ghost"
            onClick={() => setNewKey(null)}
          >
            Done
          </button>
        </div>
      )}

      <section className="ak-panel">
        <PanelHeader
          title="Create a new key"
          sub="Give it a label so you remember what it's for later."
        />
        <div className="ak-create-row">
          <input
            type="text"
            className="ak-input"
            placeholder="e.g. Church management system sync"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={255}
          />
          <button
            type="button"
            className="ak-btn ak-btn--primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? "Creating…" : "Generate Key"}
          </button>
        </div>
      </section>

      <section className="ak-panel">
        <PanelHeader
          title="Active Keys"
          sub="Keys currently able to authenticate."
          badge={`${activeKeys.length} Active`}
        />

        {loading ? (
          <p className="ak-loading">Loading…</p>
        ) : activeKeys.length === 0 ? (
          <div className="ak-empty">
            <p>No active API keys yet.</p>
          </div>
        ) : (
          <div className="ak-key-list">
            {activeKeys.map((key) => (
              <div key={key.id} className="ak-key-row">
                <div>
                  <strong>{key.label || "Unlabeled key"}</strong>
                  <code>{key.key_prefix}…</code>
                  <span className="ak-key-meta">
                    Created {formatDate(key.created_at)} · Last used{" "}
                    {formatDate(key.last_used_at)}
                  </span>
                </div>
                <button
                  type="button"
                  className="ak-btn ak-btn--danger"
                  onClick={() => handleRevoke(key)}
                  disabled={revokingId === key.id}
                >
                  {revokingId === key.id ? "Revoking…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {revokedKeys.length > 0 && (
        <section className="ak-panel">
          <PanelHeader
            title="Revoked Keys"
            badge={`${revokedKeys.length} Revoked`}
          />
          <div className="ak-key-list">
            {revokedKeys.map((key) => (
              <div key={key.id} className="ak-key-row ak-key-row--revoked">
                <div>
                  <strong>{key.label || "Unlabeled key"}</strong>
                  <code>{key.key_prefix}…</code>
                  <span className="ak-key-meta">
                    Revoked {formatDate(key.revoked_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ak-panel ak-docs-panel">
        <PanelHeader title="Using your key" />
        <p className="ak-docs-text">
          Send it as a bearer token on every request:
        </p>
        <code className="ak-docs-code">
          Authorization: Bearer nlmapi_your_key_here
        </code>
        <p className="ak-docs-text" style={{ marginTop: 12 }}>
          Available endpoints:
        </p>
        <ul className="ak-docs-list">
          <li>
            <code>GET /api/v1/streams</code> — list your streams
          </li>
          <li>
            <code>GET /api/v1/streams/:id</code> — single stream detail
          </li>
          <li>
            <code>GET /api/v1/recordings</code> — list recordings
          </li>
          <li>
            <code>GET /api/v1/recordings/:id</code> — single recording detail
          </li>
          <li>
            <code>GET /api/v1/analytics/:streamId</code> — viewer stats
          </li>
        </ul>
      </section>
    </div>
  );
}

export default ApiKeysPage;
