import { useEffect, useMemo, useState } from "react";
import api from "./api";

const TARGET_TYPES = [
  {
    key: "facebook",
    label: "Facebook",
    protocol: "RTMPS",
    oauth: true,
    hint: "Connect a Page or use a manual stream key.",
  },
  {
    key: "facebook_profile_manual",
    label: "Facebook Personal Profile (Manual RTMPS)",
    protocol: "RTMPS",
    urlRequired: true,
    hint: "Use the RTMPS Server URL and Stream Key from Facebook Live Producer. This is a manual connection, not Facebook Page OAuth. Your Facebook account must be eligible for live streaming.",
  },
  {
    key: "youtube",
    label: "YouTube",
    protocol: "RTMP",
    oauth: true,
    hint: "Connect a YouTube channel or use a manual stream key.",
  },
  {
    key: "instagram",
    label: "Instagram",
    protocol: "RTMPS",
    hint: "Use the Stream Key issued by Instagram Live Producer.",
  },
  {
    key: "twitch",
    label: "Twitch",
    protocol: "RTMPS",
    urlRequired: true,
    hint: "Enter the ingest/server URL and stream key from Twitch.",
  },
  {
    key: "linkedin",
    label: "LinkedIn Live",
    protocol: "RTMPS",
    urlRequired: true,
    hint: "Enter the server URL and stream key provided by LinkedIn Live.",
  },
  {
    key: "x",
    label: "X / Custom Social",
    protocol: "RTMPS",
    urlRequired: true,
    hint: "Use the RTMP/RTMPS credentials provided by the destination.",
  },
  {
    key: "custom_rtmp",
    label: "Custom RTMP",
    protocol: "RTMP",
    urlRequired: true,
    hint: "Any RTMP server or compatible media platform.",
  },
  {
    key: "custom_rtmps",
    label: "Custom RTMPS",
    protocol: "RTMPS",
    urlRequired: true,
    hint: "Any TLS-secured RTMP destination.",
  },
  {
    key: "srt",
    label: "SRT Destination",
    protocol: "SRT",
    urlRequired: true,
    hint: "Use a complete srt:// destination URL, including query parameters.",
  },
  {
    key: "nlm_server",
    label: "Another NLM Server",
    protocol: "RTMP",
    urlRequired: true,
    hint: "Push the live program to another NLM Streaming ingest server.",
  },
  {
    key: "cdn_origin",
    label: "CDN / Origin",
    protocol: "RTMP",
    urlRequired: true,
    hint: "Push to a CDN or origin ingest endpoint.",
  },
];

const TYPE_MAP = Object.fromEntries(
  TARGET_TYPES.map((item) => [item.key, item]),
);

function canonicalTargetPayload(form, targetType) {
  const config = TYPE_MAP[targetType] || {};
  return {
    target_type: targetType,
    name: String(form.name || config.label || "").trim(),
    destination_url: String(form.destination_url || "").trim(),
    stream_key: String(form.stream_key || "").trim(),
    protocol: String(form.protocol || config.protocol || "rtmp").toLowerCase(),
    enabled: form.enabled !== false,
    auto_start: Boolean(form.auto_start),
    auto_reconnect: form.auto_reconnect !== false,
  };
}

function validateTargetPayload(payload) {
  const protocol = String(payload.protocol || "").toLowerCase();
  const url = String(payload.destination_url || "").trim();
  const key = String(payload.stream_key || "").trim();
  const name = String(payload.name || "").trim();

  if (payload.target_type === "facebook_profile_manual") {
    if (protocol !== "rtmps")
      return "Facebook Personal Profile requires RTMPS.";
    if (!key) return "Enter the Stream Key provided by Facebook Live Producer.";
  }

  if (!url) return "Destination URL is required.";

  if (protocol === "srt") {
    if (!url.toLowerCase().startsWith("srt://"))
      return "SRT targets require an srt:// destination URL.";
    return "";
  }

  if (protocol === "rtmp" && !url.toLowerCase().startsWith("rtmp://"))
    return "RTMP targets require an rtmp:// destination URL.";

  if (protocol === "rtmps" && !url.toLowerCase().startsWith("rtmps://"))
    return "RTMPS targets require an rtmps:// destination URL.";

  if (key && name && key.toLowerCase() === name.toLowerCase())
    return "The Stream Key cannot be the same as the target Name. Recheck the two fields.";

  return "";
}

function formatUptime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function targetStatus(target) {
  if (!target.enabled) return { text: "Disabled", tone: "muted" };

  const healthStatus = String(target.health?.status || "").toLowerCase();

  if (healthStatus === "healthy") return { text: "Healthy", tone: "good" };
  if (healthStatus === "starting") return { text: "Starting", tone: "warn" };
  if (healthStatus === "recovering")
    return { text: "Recovering", tone: "warn" };
  if (healthStatus === "degraded") return { text: "Degraded", tone: "warn" };
  if (healthStatus === "failed") return { text: "Failed", tone: "bad" };
  if (healthStatus === "stopped") return { text: "Stopped", tone: "muted" };
  if (healthStatus === "unknown") return { text: "Unknown", tone: "muted" };

  // Compatibility fallback for older backend responses.
  if (target.is_running || target.runtime_status === "streaming")
    return { text: "Streaming", tone: "good" };
  if (target.status === "reconnecting")
    return { text: "Reconnecting", tone: "warn" };
  if (
    target.status === "failed" ||
    target.status === "disconnected" ||
    target.status === "error"
  )
    return { text: "Failed", tone: "bad" };

  return { text: "Stopped", tone: "muted" };
}

function IconTarget({ size = 17 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function IconPlus({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function OAuthConnector({
  channelId,
  platform,
  target,
  oauthAccounts,
  refresh,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connected =
    target?.automation_mode === "oauth" && target?.oauth_account_id
      ? oauthAccounts.find((a) => a.id === target.oauth_account_id)
      : null;

  const connect = async () => {
    setBusy(true);
    setError("");
    let popup = null;
    let settled = false;

    const cleanup = () => window.removeEventListener("message", onMessage);
    const onMessage = async (event) => {
      if (
        settled ||
        event.data?.type !== "social-oauth-result" ||
        event.data?.platform !== platform
      )
        return;
      if (popup && event.source !== popup) return;
      if (
        event.origin !==
        new URL(
          import.meta.env.VITE_API_URL ||
            api.defaults.baseURL ||
            window.location.origin,
          window.location.origin,
        ).origin
      )
        return;
      settled = true;
      cleanup();
      if (!event.data.ok) {
        setError("Connection was not completed.");
        setBusy(false);
        return;
      }
      try {
        const accountsRes = await api.get(
          "/api/organizations/current/oauth-accounts",
        );
        const accounts = (accountsRes.data.accounts || []).filter(
          (a) => a.platform === platform,
        );
        const newest = accounts.find(
          (a) => String(a.id) === String(event.data.accountId),
        );
        if (!newest) {
          if (
            platform === "facebook" &&
            event.data.identityOnly &&
            (accountsRes.data.accounts || []).some(
              (a) => a.platform === "facebook_user",
            )
          ) {
            await refresh();
            return;
          }
          throw new Error("Connected account not found");
        }

        let targetId = target?.id;
        if (!targetId) {
          const created = await api.post(
            `/api/channels/${channelId}/stream-targets`,
            {
              target_type: platform,
              name: TYPE_MAP[platform]?.label || platform,
              automation_mode: "oauth",
              stream_key: "oauth-managed",
              enabled: true,
              auto_start: true,
              auto_reconnect: true,
            },
          );
          targetId = created.data.target?.id || created.data.destination?.id;
        }
        await api.post(
          `/api/channels/${channelId}/stream-targets/${targetId}/link-oauth`,
          {
            oauthAccountId: newest.id,
          },
        );
        await refresh();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to finish connection.",
        );
      } finally {
        setBusy(false);
      }
    };

    window.addEventListener("message", onMessage);
    try {
      const res = await api.post(
        `/api/channels/${channelId}/oauth/${platform}/init`,
      );
      popup = window.open(
        res.data.authUrl,
        `nlm-${platform}-oauth`,
        "width=620,height=760",
      );
      if (!popup)
        throw new Error(
          "Popup blocked. Allow popups for this site and try again.",
        );
    } catch (err) {
      cleanup();
      setBusy(false);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to start connection.",
      );
    }
  };

  const disconnect = async () => {
    if (!connected) return;
    if (
      !window.confirm(
        `Disconnect ${connected.external_account_name || platform}? This OAuth account may be used by other channels.`,
      )
    )
      return;
    try {
      setBusy(true);
      setError("");
      await api.delete(
        `/api/organizations/current/oauth-accounts/${connected.id}`,
      );
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to disconnect account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="st-oauth-card">
      <div>
        <span className="st-kicker">AUTOMATED TARGET</span>
        <strong>{TYPE_MAP[platform]?.label}</strong>
        <small>
          {connected
            ? `Connected: ${connected.external_account_name}`
            : "OAuth connection creates each platform broadcast automatically."}
        </small>
      </div>
      <div className="st-oauth-actions">
        {connected ? (
          <>
            <span className="st-pill st-pill--good">Connected</span>
            <button
              type="button"
              className="st-btn st-btn--ghost"
              onClick={disconnect}
              disabled={busy}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            className="st-btn st-btn--primary"
            onClick={connect}
            disabled={busy}
          >
            {busy ? "Connecting…" : `Connect ${TYPE_MAP[platform]?.label}`}
          </button>
        )}
      </div>
      {error ? <div className="st-inline-error">{error}</div> : null}
    </div>
  );
}

function TargetCard({ channelId, target, refresh }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const type =
    target.target_type ||
    (TYPE_MAP[target.platform] ? target.platform : "custom_rtmp");
  const config = TYPE_MAP[type] || {
    label: type || "Stream Target",
    protocol: target.protocol || "RTMP",
  };
  const status = targetStatus(target);
  const health = target.health || {};
  const workerAlive =
    health.worker_alive ?? target.worker_running ?? target.is_running ?? false;
  const deliveryVerified =
    health.delivery_verified ?? target.delivery_verified ?? false;
  const isStale = Boolean(health.stale);
  const isRetrying = Boolean(health.retrying);
  const failure = health.failure || target.failure || null;
  const failureMessage =
    failure?.message ||
    target.last_error ||
    (health.failure_code ? String(health.failure_code) : "");
  const execution = health.execution || target.execution || "";
  const [form, setForm] = useState({
    name: target.name || config.label,
    destination_url: target.destination_url || "",
    stream_key:
      target.automation_mode === "oauth" ? "" : target.stream_key || "",
    protocol: target.protocol || config.protocol?.toLowerCase() || "rtmp",
    enabled: target.enabled !== false,
    auto_start: Boolean(target.auto_start),
    auto_reconnect: target.auto_reconnect !== false,
  });

  useEffect(() => {
    setForm({
      name: target.name || config.label,
      destination_url: target.destination_url || "",
      stream_key:
        target.automation_mode === "oauth" ? "" : target.stream_key || "",
      protocol: target.protocol || config.protocol?.toLowerCase() || "rtmp",
      enabled: target.enabled !== false,
      auto_start: Boolean(target.auto_start),
      auto_reconnect: target.auto_reconnect !== false,
    });
  }, [
    target.id,
    target.updated_at,
    target.enabled,
    target.auto_start,
    target.auto_reconnect,
  ]);

  const action = async (kind) => {
    try {
      setBusy(true);
      setError("");
      await api.post(
        `/api/channels/${channelId}/stream-targets/${target.id}/${kind}`,
      );
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${kind} target.`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      setBusy(true);
      setError("");
      const payload = canonicalTargetPayload(form, type);
      if (type === "facebook_profile_manual") payload.protocol = "rtmps";
      const validationError = validateTargetPayload(payload);
      if (validationError) {
        setError(validationError);
        return;
      }
      await api.put(
        `/api/channels/${channelId}/stream-targets/${target.id}`,
        payload,
      );
      setEditing(false);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update target.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (
      !window.confirm(`Remove stream target "${target.name || config.label}"?`)
    )
      return;
    try {
      setBusy(true);
      setError("");
      await api.delete(
        `/api/channels/${channelId}/stream-targets/${target.id}`,
      );
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove target.");
    } finally {
      setBusy(false);
    }
  };

  const toggleEnabled = async () => {
    try {
      setBusy(true);
      await api.put(`/api/channels/${channelId}/stream-targets/${target.id}`, {
        enabled: !target.enabled,
      });
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change target state.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="st-target-card">
      <div className="st-target-head">
        <div className="st-target-identity">
          <div className="st-target-icon">
            <IconTarget />
          </div>
          <div>
            <strong>{target.name || config.label}</strong>
            <span>
              {config.label} ·{" "}
              {(target.protocol || config.protocol || "RTMP").toUpperCase()}
            </span>
          </div>
        </div>
        <div className="st-target-actions">
          <span className={`st-pill st-pill--${status.tone}`}>
            {status.text}
          </span>
          <button
            type="button"
            className="st-switch"
            aria-pressed={target.enabled !== false}
            onClick={toggleEnabled}
            disabled={busy}
            title="Enable or disable target"
          >
            <span
              className={
                target.enabled !== false
                  ? "st-switch-knob st-switch-knob--on"
                  : "st-switch-knob"
              }
            />
          </button>
        </div>
      </div>

      <div className="st-metrics">
        <div>
          <span>Bitrate</span>
          <strong>
            {Number(target.current_bitrate_kbps || 0).toLocaleString()} kbps
          </strong>
        </div>
        <div>
          <span>Dropped frames</span>
          <strong>{Number(target.dropped_frames || 0).toLocaleString()}</strong>
        </div>
        <div>
          <span>Reconnects</span>
          <strong>{Number(target.reconnect_count || 0)}</strong>
        </div>
        <div>
          <span>Uptime</span>
          <strong>{formatUptime(target.uptime_seconds)}</strong>
        </div>
      </div>

      <div className="st-flags">
        <span>{target.auto_start ? "✓" : "○"} Auto-start</span>
        <span>{target.auto_reconnect ? "✓" : "○"} Auto-reconnect</span>
        <span>
          {target.automation_mode === "oauth"
            ? "✓ OAuth managed"
            : "Manual credentials"}
        </span>
        <span>{workerAlive ? "✓ Worker active" : "○ Worker inactive"}</span>
        <span>
          {deliveryVerified ? "✓ Delivery verified" : "○ Delivery unverified"}
        </span>
        {isRetrying ? <span>↻ Retry in progress</span> : null}
        {isStale ? <span>⚠ Worker stale</span> : null}
        {execution ? (
          <span>{String(execution).toUpperCase()} execution</span>
        ) : null}
      </div>

      {failureMessage ? (
        <div className="st-target-error">
          <strong>
            {health.failure_code || failure?.code ? "Failure:" : "Last error:"}
          </strong>{" "}
          {failureMessage}
          {health.failure_code || failure?.code ? (
            <div>
              <small>
                Code: {health.failure_code || failure?.code}
                {health.failure_category || failure?.category
                  ? ` · Category: ${health.failure_category || failure?.category}`
                  : ""}
                {(health.failure_retryable ?? failure?.retryable) === true
                  ? " · Retryable"
                  : ""}
              </small>
            </div>
          ) : null}
        </div>
      ) : null}

      {editing ? (
        <div className="st-edit-grid">
          <label>
            Name
            <input
              value={form.name}
              onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
            />
          </label>
          {target.automation_mode !== "oauth" ? (
            <>
              <label className="st-span-2">
                Destination URL
                <input
                  value={form.destination_url}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, destination_url: e.target.value }))
                  }
                  placeholder={
                    type === "srt"
                      ? "srt://host:port?..."
                      : form.protocol === "rtmps"
                        ? "rtmps://server/app"
                        : "rtmp://server/app"
                  }
                />
              </label>
              <label className="st-span-2">
                Stream key
                <input
                  type="password"
                  value={form.stream_key}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, stream_key: e.target.value }))
                  }
                  placeholder="Optional when already included in the URL"
                />
              </label>
            </>
          ) : null}
          {type === "facebook_profile_manual" ? (
            <div className="st-form-note st-span-2">{config.hint}</div>
          ) : null}
          <label className="st-check">
            <input
              type="checkbox"
              checked={form.auto_start}
              onChange={(e) =>
                setForm((v) => ({ ...v, auto_start: e.target.checked }))
              }
            />
            Auto-start with source
          </label>
          <label className="st-check">
            <input
              type="checkbox"
              checked={form.auto_reconnect}
              onChange={(e) =>
                setForm((v) => ({ ...v, auto_reconnect: e.target.checked }))
              }
            />
            Automatic reconnect
          </label>
          <div className="st-edit-actions st-span-2">
            <button
              type="button"
              className="st-btn st-btn--primary"
              onClick={save}
              disabled={busy}
            >
              Save
            </button>
            <button
              type="button"
              className="st-btn st-btn--ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="st-card-footer">
          <div>
            {workerAlive ? (
              <button
                type="button"
                className="st-btn st-btn--danger"
                onClick={() => action("stop")}
                disabled={busy}
              >
                {busy ? "Stopping…" : "Stop"}
              </button>
            ) : (
              <button
                type="button"
                className="st-btn st-btn--primary"
                onClick={() => action("start")}
                disabled={busy || target.enabled === false}
              >
                {busy ? "Starting…" : "Start Target"}
              </button>
            )}
          </div>
          <div>
            <button
              type="button"
              className="st-btn st-btn--ghost"
              onClick={() => setEditing(true)}
              disabled={busy}
            >
              Edit
            </button>
            <button
              type="button"
              className="st-btn st-btn--ghost st-btn--danger-text"
              onClick={remove}
              disabled={busy}
            >
              Remove
            </button>
          </div>
        </div>
      )}
      {error ? <div className="st-inline-error">{error}</div> : null}
    </article>
  );
}

function AddTargetForm({ channelId, onCreated, onCancel }) {
  const [form, setForm] = useState({
    target_type: "custom_rtmp",
    name: "Custom RTMP",
    destination_url: "",
    stream_key: "",
    protocol: "rtmp",
    enabled: true,
    auto_start: false,
    auto_reconnect: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const config = TYPE_MAP[form.target_type];

  const setType = (key) => {
    const next = TYPE_MAP[key];
    setForm((old) => ({
      ...old,
      target_type: key,
      name: next.label,
      protocol: next.protocol.toLowerCase(),
      destination_url: "",
      stream_key: "",
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError("");
      const payload = canonicalTargetPayload(form, form.target_type);
      const validationError = validateTargetPayload(payload);
      if (validationError) {
        setError(validationError);
        return;
      }
      await api.post(`/api/channels/${channelId}/stream-targets`, payload);
      await onCreated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create target.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="st-add-form" onSubmit={submit}>
      <div className="st-add-head">
        <div>
          <span className="st-kicker">NEW OUTPUT</span>
          <h5>Add Stream Target</h5>
        </div>
        <button
          type="button"
          className="st-btn st-btn--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
      <div className="st-form-grid">
        <label>
          Target type
          <select
            value={form.target_type}
            onChange={(e) => setType(e.target.value)}
          >
            {TARGET_TYPES.filter((t) => !t.oauth).map((t) => (
              <option value={t.key} key={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input
            value={form.name}
            onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          />
        </label>
        <label className="st-span-2">
          Destination URL
          <input
            value={form.destination_url}
            onChange={(e) =>
              setForm((v) => ({ ...v, destination_url: e.target.value }))
            }
            placeholder={
              form.target_type === "srt"
                ? "srt://host:port?mode=caller"
                : form.protocol === "rtmps"
                  ? "rtmps://server.example.com/app"
                  : "rtmp://server.example.com/app"
            }
          />
        </label>
        {form.target_type !== "srt" ? (
          <label className="st-span-2">
            Stream key
            <input
              type="password"
              value={form.stream_key}
              onChange={(e) =>
                setForm((v) => ({ ...v, stream_key: e.target.value }))
              }
              placeholder="Stream key (leave blank if already included in URL)"
            />
          </label>
        ) : null}
        <div className="st-form-note st-span-2">{config.hint}</div>
        <label className="st-check">
          <input
            type="checkbox"
            checked={form.auto_start}
            onChange={(e) =>
              setForm((v) => ({ ...v, auto_start: e.target.checked }))
            }
          />
          Auto-start with source
        </label>
        <label className="st-check">
          <input
            type="checkbox"
            checked={form.auto_reconnect}
            onChange={(e) =>
              setForm((v) => ({ ...v, auto_reconnect: e.target.checked }))
            }
          />
          Automatic reconnect
        </label>
      </div>
      {error ? <div className="st-inline-error">{error}</div> : null}
      <button
        className="st-btn st-btn--primary"
        type="submit"
        disabled={saving}
      >
        <IconPlus />
        {saving ? "Creating…" : "Create Target"}
      </button>
    </form>
  );
}

function StreamTargets({ channelId }) {
  const [targets, setTargets] = useState([]);
  const [oauthAccounts, setOauthAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [loadError, setLoadError] = useState("");

  const refresh = async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoadError("");
      const [targetRes, accountRes] = await Promise.all([
        api.get(`/api/channels/${channelId}/stream-targets`),
        api.get("/api/organizations/current/oauth-accounts"),
      ]);
      setTargets(targetRes.data.targets || targetRes.data.destinations || []);
      setOauthAccounts(accountRes.data.accounts || []);
    } catch (err) {
      if (!quiet)
        setLoadError(
          err.response?.data?.message || "Failed to load stream targets.",
        );
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(() => refresh({ quiet: true }), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const oauthTargets = useMemo(
    () => ({
      facebook: targets.find(
        (t) => (t.target_type || t.platform) === "facebook",
      ),
      youtube: targets.find((t) => (t.target_type || t.platform) === "youtube"),
    }),
    [targets],
  );

  if (loading)
    return (
      <div className="st-shell st-shell--loading">Loading stream targets…</div>
    );

  return (
    <section className="st-shell">
      <div className="st-header">
        <div>
          <span className="st-kicker">DISTRIBUTION</span>
          <h4>Stream Targets</h4>
          <p>
            Publish this channel to social platforms, another NLM server, SRT
            receivers, or any RTMP/RTMPS origin.
          </p>
        </div>
        <button
          type="button"
          className="st-btn st-btn--primary"
          onClick={() => setShowAdd((v) => !v)}
        >
          <IconPlus />
          Add Target
        </button>
      </div>

      {loadError ? <div className="st-inline-error">{loadError}</div> : null}

      {oauthAccounts
        .filter((account) => account.platform === "facebook_user")
        .map((account) => (
          <div className="st-oauth-card" key={`facebook-user-${account.id}`}>
            <div>
              <span className="st-kicker">META AUTHENTICATED IDENTITY</span>
              <strong>
                Facebook personal account: {account.external_account_name}
              </strong>
              <small>
                Connected via Meta OAuth. Personal timeline publishing is not
                supported through the Page API. For personal streaming,
                configure a separate manual RTMPS target.
              </small>
            </div>
            <div className="st-oauth-actions">
              <span className="st-pill st-pill--good">Connected</span>
              <button
                type="button"
                className="st-btn st-btn--ghost"
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Disconnect ${account.external_account_name}?`,
                    )
                  )
                    return;
                  try {
                    await api.delete(
                      `/api/organizations/current/oauth-accounts/${account.id}`,
                    );
                    await refresh();
                  } catch (err) {
                    window.alert(
                      err.response?.data?.message ||
                        "Failed to disconnect Facebook identity.",
                    );
                  }
                }}
              >
                Disconnect
              </button>
            </div>
          </div>
        ))}

      <div className="st-oauth-grid">
        <OAuthConnector
          channelId={channelId}
          platform="facebook"
          target={oauthTargets.facebook}
          oauthAccounts={oauthAccounts}
          refresh={refresh}
        />
        <OAuthConnector
          channelId={channelId}
          platform="youtube"
          target={oauthTargets.youtube}
          oauthAccounts={oauthAccounts}
          refresh={refresh}
        />
      </div>

      {showAdd ? (
        <AddTargetForm
          channelId={channelId}
          onCancel={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      ) : null}

      <div className="st-summary-row">
        <span>
          {targets.length} target{targets.length === 1 ? "" : "s"}
        </span>
        <span>
          {
            targets.filter(
              (t) =>
                t.health?.status === "healthy" ||
                t.health?.worker_alive === true ||
                t.is_running,
            ).length
          }{" "}
          active
        </span>
        <span>
          {targets.filter((t) => t.enabled !== false && t.auto_start).length}{" "}
          auto-start
        </span>
      </div>

      {targets.length === 0 ? (
        <div className="st-empty">
          <IconTarget size={26} />
          <strong>No stream targets yet</strong>
          <p>
            Connect Facebook or YouTube above, or add a generic RTMP, RTMPS,
            SRT, NLM server, or CDN target.
          </p>
        </div>
      ) : (
        <div className="st-target-list">
          {targets.map((target) => (
            <TargetCard
              key={target.id}
              channelId={channelId}
              target={target}
              refresh={refresh}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default StreamTargets;
