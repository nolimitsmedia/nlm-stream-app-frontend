import { useEffect, useMemo, useState } from "react";
import api from "./api";

const DEFAULT_PROTOCOLS = ["rtmp", "rtmps", "rtsp", "srt", "hls", "http_flv"];

const PROTOCOL_LABELS = {
  rtmp: "RTMP",
  rtmps: "RTMPS",
  rtsp: "RTSP",
  srt: "SRT",
  hls: "HLS",
  http_flv: "HTTP-FLV",
};

const SOURCE_PLACEHOLDERS = {
  rtmp: "rtmp://source.example.com/live/stream",
  rtmps: "rtmps://source.example.com/live/stream",
  rtsp: "rtsp://camera.example.com:554/stream",
  srt: "srt://source.example.com:10080?mode=caller",
  hls: "https://source.example.com/live/index.m3u8",
  http_flv: "https://source.example.com/live/stream.flv",
};

function IconInput({ size = 18 }) {
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
      aria-hidden="true"
    >
      <path d="M4 12h12" />
      <path d="m12 6 6 6-6 6" />
      <rect x="18" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function statusTone(status) {
  const value = String(status || "stopped").toLowerCase();
  if (value === "streaming") return "good";
  if (["starting", "reconnecting", "waiting"].includes(value)) return "warn";
  if (value === "failed") return "bad";
  return "muted";
}

function healthTone(status) {
  const value = String(status || "unknown").toLowerCase();
  if (["healthy", "ready"].includes(value)) return "good";
  if (["unhealthy", "failed"].includes(value)) return "bad";
  return "muted";
}

function formatStatus(status) {
  const value = String(status || "stopped").replaceAll("_", " ");
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatBitrate(kbps) {
  const value = Number(kbps || 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000)
    return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} Mbps`;
  return `${Math.round(value)} Kbps`;
}

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatFps(value) {
  if (!value) return "—";
  if (typeof value === "number")
    return Number.isFinite(value) ? `${value.toFixed(2)} fps` : "—";
  const text = String(value);
  if (text.includes("/")) {
    const [a, b] = text.split("/").map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) {
      const fps = a / b;
      return `${Number.isInteger(fps) ? fps : fps.toFixed(2)} fps`;
    }
  }
  return `${text} fps`;
}

const HA_FILTERS = {
  all: null,
  failures: new Set([
    "primary_failed",
    "active_source_failed",
    "switch_failed",
  ]),
  failovers: new Set([
    "failover_started",
    "backup_activated",
    "failback_started",
    "primary_restored",
  ]),
  recoveries: new Set(["source_recovered", "backend_restart_recovery"]),
};

function haEventLabel(eventType) {
  const labels = {
    primary_failed: "Primary Failed",
    active_source_failed: "Active Source Failed",
    failover_started: "Failover Started",
    backup_activated: "Backup Activated",
    failback_started: "Failback Started",
    primary_restored: "Primary Restored",
    source_recovered: "Source Recovered",
    backend_restart_recovery: "Backend Restart Recovery",
    switch_failed: "Switch Failed",
    source_activated: "Source Activated",
  };
  return labels[eventType] || formatStatus(eventType || "event");
}

function haEventTone(event) {
  const type = String(event?.event_type || "").toLowerCase();
  const status = String(event?.status || "").toLowerCase();
  if (
    ["primary_failed", "active_source_failed", "switch_failed"].includes(
      type,
    ) ||
    status === "failed"
  )
    return "bad";
  if (
    ["failover_started", "failback_started"].includes(type) ||
    status === "started" ||
    status === "detected"
  )
    return "warn";
  if (
    [
      "backup_activated",
      "primary_restored",
      "source_recovered",
      "backend_restart_recovery",
      "source_activated",
    ].includes(type) ||
    status === "completed"
  )
    return "good";
  return "muted";
}

function formatHaTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatHaReason(reason) {
  return reason ? formatStatus(reason) : "—";
}

function sourceDisplayName(event, kind) {
  if (kind === "previous") {
    return (
      event?.previous_source_name ||
      (event?.previous_source_id ? `Source #${event.previous_source_id}` : null)
    );
  }
  if (kind === "new") {
    return (
      event?.new_source_name ||
      (event?.new_source_id ? `Source #${event.new_source_id}` : null)
    );
  }
  return (
    event?.source_name ||
    (event?.source_id ? `Source #${event.source_id}` : "Unknown source")
  );
}

function formatRelativeTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : date.toLocaleDateString();
}

function formatDurationMs(value) {
  if (value == null) return "—";
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms >= 10000 ? 1 : 2)}s`;
}

function haSuccessRate(metrics) {
  const successful = Number(metrics?.successful_failovers || 0);
  const incomplete = Number(metrics?.incomplete_failovers || 0);
  const total = successful + incomplete;
  if (!total) return "—";
  return `${Math.round((successful / total) * 100)}%`;
}

function haSystemTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "healthy") return "good";
  if (value === "degraded") return "warn";
  if (["unavailable", "failed"].includes(value)) return "bad";
  return "muted";
}

function HAHealth({ channelId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHealth = async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setRefreshing(true);
      setError("");
      const response = await api.get(`/api/channels/${channelId}/ha-health`);
      setData(response.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load HA health.");
    } finally {
      setLoading(false);
      if (!quiet) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!channelId) return undefined;
    loadHealth();
    const timer = setInterval(() => loadHealth({ quiet: true }), 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const health = data?.health || {};
  const metrics = data?.metrics || {};
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const activeSource = health.active_source || null;
  const primarySource =
    sources.find((source) => source.role === "primary") || null;
  const backupSources = sources.filter((source) => source.role !== "primary");

  const renderSourceHealth = (source) => {
    if (!source) return null;
    const sourceHealth = source.health_status || "unknown";
    const sourceStatus = source.runtime_status || source.status || "stopped";
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        <span className={`st-pill st-pill--${healthTone(sourceHealth)}`}>
          {formatStatus(sourceHealth)}
        </span>
        <span className={`st-pill st-pill--${statusTone(sourceStatus)}`}>
          {formatStatus(sourceStatus)}
        </span>
      </div>
    );
  };

  return (
    <div className="st-add-form ps-form">
      <div className="st-add-head">
        <div>
          <span className="st-kicker">OBSERVABILITY</span>
          <h5>HA System Health</h5>
          <p>
            Current high-availability state, active input, source health, and
            switching metrics.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!loading ? (
            <span className={`st-pill st-pill--${haSystemTone(health.status)}`}>
              {formatStatus(health.status || "unknown")}
            </span>
          ) : null}
          <button
            type="button"
            className="st-btn st-btn--ghost"
            onClick={() => loadHealth()}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <div className="st-inline-error">{error}</div> : null}

      {loading ? (
        <div className="st-form-note">Loading HA system health…</div>
      ) : (
        <>
          <div
            className="ps-preflight ps-preflight--ok"
            style={{ marginBottom: 14 }}
          >
            <div className="ps-preflight-head">
              <div>
                <strong>
                  Active source: {activeSource?.name || "No active source"}
                </strong>
                <div className="st-form-note" style={{ marginTop: 4 }}>
                  {activeSource
                    ? `${formatStatus(activeSource.role || "source")} · ${formatStatus(activeSource.status || "unknown")} · ${formatStatus(activeSource.health_status || "unknown")}`
                    : "No Pull Source currently owns the channel."}
                </div>
              </div>
              <span
                className={`st-pill st-pill--${haSystemTone(health.status)}`}
              >
                {String(health.status || "unknown").toUpperCase()}
              </span>
            </div>
          </div>

          <div
            className="st-metrics ps-runtime-grid"
            style={{ marginBottom: 14 }}
          >
            <div>
              <span>Primary Failures</span>
              <strong>{Number(metrics.primary_failures || 0)}</strong>
            </div>
            <div>
              <span>Failovers</span>
              <strong>{Number(metrics.backup_activations || 0)}</strong>
            </div>
            <div>
              <span>Failbacks</span>
              <strong>{Number(metrics.primary_restorations || 0)}</strong>
            </div>
            <div>
              <span>Failed Switches</span>
              <strong>{Number(metrics.failed_switches || 0)}</strong>
            </div>
          </div>

          <div
            className="st-metrics ps-runtime-grid"
            style={{ marginBottom: 14 }}
          >
            <div>
              <span>Failover Success</span>
              <strong>{haSuccessRate(metrics)}</strong>
            </div>
            <div>
              <span>Last Failover</span>
              <strong>
                {formatDurationMs(metrics.last_failover_incident_ms)}
              </strong>
            </div>
            <div>
              <span>Last Switch</span>
              <strong>{formatDurationMs(metrics.last_switch_ms)}</strong>
            </div>
            <div>
              <span>Last Failback</span>
              <strong>{formatDurationMs(metrics.last_failback_ms)}</strong>
            </div>
          </div>

          <div
            className="st-metrics ps-runtime-grid"
            style={{ marginBottom: 14 }}
          >
            <div>
              <span>Average Failover</span>
              <strong>
                {formatDurationMs(metrics.avg_failover_incident_ms)}
              </strong>
            </div>
            <div>
              <span>Worst Failover</span>
              <strong>
                {formatDurationMs(metrics.worst_failover_incident_ms)}
              </strong>
            </div>
            <div>
              <span>Average Switch</span>
              <strong>{formatDurationMs(metrics.avg_switch_ms)}</strong>
            </div>
            <div>
              <span>Incomplete Failovers</span>
              <strong>{Number(metrics.incomplete_failovers || 0)}</strong>
            </div>
          </div>

          <div className="st-form-grid" style={{ marginBottom: 14 }}>
            <div>
              <span className="st-form-note">Last failover</span>
              <strong style={{ display: "block", marginTop: 4 }}>
                {formatRelativeTime(metrics.last_failover)}
              </strong>
              <span className="st-form-note">
                {formatHaTime(metrics.last_failover)}
              </span>
            </div>
            <div>
              <span className="st-form-note">Last failback</span>
              <strong style={{ display: "block", marginTop: 4 }}>
                {formatRelativeTime(metrics.last_failback)}
              </strong>
              <span className="st-form-note">
                {formatHaTime(metrics.last_failback)}
              </span>
            </div>
            <div>
              <span className="st-form-note">Last HA event</span>
              <strong style={{ display: "block", marginTop: 4 }}>
                {formatRelativeTime(metrics.last_ha_event)}
              </strong>
              <span className="st-form-note">
                {formatHaTime(metrics.last_ha_event)}
              </span>
            </div>
            <div>
              <span className="st-form-note">Last switch reason</span>
              <strong style={{ display: "block", marginTop: 4 }}>
                {formatHaReason(health.last_switch_reason)}
              </strong>
              <span className="st-form-note">
                {formatHaTime(health.last_switch_at)}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {primarySource ? (
              <div
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.22)",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>{primarySource.name || "Primary Source"}</strong>
                    <div className="st-form-note" style={{ marginTop: 4 }}>
                      Primary · Priority {primarySource.priority || 1}
                    </div>
                    {renderSourceHealth(primarySource)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="st-form-note">Bitrate</div>
                    <strong>{formatBitrate(primarySource.bitrate_kbps)}</strong>
                    <div className="st-form-note" style={{ marginTop: 6 }}>
                      Uptime {formatUptime(primarySource.uptime_seconds)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {backupSources.map((source) => (
              <div
                key={source.id}
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.22)",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>{source.name || "Backup Source"}</strong>
                    <div className="st-form-note" style={{ marginTop: 4 }}>
                      Backup · Priority {source.priority || 2}
                    </div>
                    {renderSourceHealth(source)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="st-form-note">Bitrate</div>
                    <strong>{formatBitrate(source.bitrate_kbps)}</strong>
                    <div className="st-form-note" style={{ marginTop: 6 }}>
                      Reconnects {Number(source.reconnect_count || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="st-form-note" style={{ marginTop: 12 }}>
            Auto-refreshes every 5 seconds.
          </div>
        </>
      )}
    </div>
  );
}

function HAHistory({ channelId }) {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setRefreshing(true);
      setError("");
      const response = await api.get(
        `/api/channels/${channelId}/ha-events?limit=100`,
      );
      setEvents(
        Array.isArray(response.data?.events) ? response.data.events : [],
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load HA / failover history.",
      );
    } finally {
      setLoading(false);
      if (!quiet) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!channelId) return undefined;
    loadHistory();
    const timer = setInterval(() => loadHistory({ quiet: true }), 10000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const visibleEvents = useMemo(() => {
    const allowed = HA_FILTERS[filter];
    return allowed
      ? events.filter((event) => allowed.has(event.event_type))
      : events;
  }, [events, filter]);

  return (
    <div className="st-add-form ps-form">
      <div className="st-add-head">
        <div>
          <span className="st-kicker">OBSERVABILITY</span>
          <h5>HA / Failover History</h5>
          <p>
            Recent source failures, automatic failovers, failbacks, and recovery
            events for this channel.
          </p>
        </div>
        <button
          type="button"
          className="st-btn st-btn--ghost"
          onClick={() => loadHistory()}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}
      >
        {[
          ["all", "All Events"],
          ["failures", "Failures"],
          ["failovers", "Failovers"],
          ["recoveries", "Recoveries"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={
              filter === value
                ? "st-btn st-btn--primary"
                : "st-btn st-btn--ghost"
            }
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="st-inline-error">{error}</div> : null}

      {loading ? (
        <div className="st-form-note">Loading HA history…</div>
      ) : !visibleEvents.length ? (
        <div className="st-empty ps-empty">
          <strong>No HA events found</strong>
          <p>
            Failover, failback, and recovery activity will appear here as it is
            recorded.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visibleEvents.map((event) => {
            const previousName = sourceDisplayName(event, "previous");
            const newName = sourceDisplayName(event, "new");
            const sourceName = sourceDisplayName(event);
            const hasTransition =
              event.previous_source_id &&
              event.new_source_id &&
              event.previous_source_id !== event.new_source_id;

            return (
              <div
                key={event.id}
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.22)",
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <strong>{haEventLabel(event.event_type)}</strong>
                      <span
                        className={`st-pill st-pill--${haEventTone(event)}`}
                      >
                        {formatStatus(event.status || "completed")}
                      </span>
                    </div>
                    <div className="st-form-note" style={{ marginTop: 6 }}>
                      {hasTransition
                        ? `${previousName} → ${newName}`
                        : sourceName}
                    </div>
                    <div className="st-form-note" style={{ marginTop: 3 }}>
                      {formatHaReason(event.reason)}
                    </div>
                  </div>
                  <div
                    className="st-form-note"
                    style={{
                      flexShrink: 0,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatHaTime(event.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading ? (
        <div className="st-form-note" style={{ marginTop: 12 }}>
          Showing {visibleEvents.length} of {events.length} recent events.
          Auto-refreshes every 10 seconds.
        </div>
      ) : null}
    </div>
  );
}

function SourceForm({ source, protocols, defaultRole, onSaved, onCancel }) {
  const editing = Boolean(source?.id);
  const [form, setForm] = useState({
    name:
      source?.name ||
      (defaultRole === "backup" ? "Backup Source" : "Primary Source"),
    protocol: source?.protocol || protocols[0] || "rtmp",
    source_url: "",
    role: source?.role || defaultRole || "backup",
    priority: Number(source?.priority || (defaultRole === "backup" ? 2 : 1)),
    enabled: source?.enabled !== false,
    auto_start: Boolean(source?.auto_start),
    auto_reconnect: source?.auto_reconnect !== false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const name = String(form.name || "").trim();
    const sourceUrl = String(form.source_url || "").trim();

    if (!name) return setError("Source name is required.");
    if (!editing && !sourceUrl) return setError("Source URL is required.");

    const payload = {
      name,
      protocol: form.protocol,
      role: form.role,
      priority: Math.max(1, Number(form.priority || 1)),
      enabled: form.enabled,
      auto_start: form.auto_start,
      auto_reconnect: form.auto_reconnect,
    };
    if (sourceUrl) payload.source_url = sourceUrl;

    try {
      setSaving(true);
      setError("");
      if (editing) {
        await api.put(
          `/api/channels/${source.channel_id}/pull-source/${source.id}`,
          payload,
        );
      } else {
        await api.post(
          `/api/channels/${source.channel_id}/pull-source`,
          payload,
        );
      }
      await onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save Pull Source.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="st-add-form ps-form" onSubmit={submit}>
      <div className="st-add-head">
        <div>
          <span className="st-kicker">
            {editing ? "SOURCE SETTINGS" : "NEW INPUT"}
          </span>
          <h5>{editing ? "Edit Pull Source" : "Add Pull Source"}</h5>
        </div>
        <button
          type="button"
          className="st-btn st-btn--ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>

      <div className="st-form-grid">
        <label>
          Role
          <select
            value={form.role}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                role: event.target.value,
                priority:
                  event.target.value === "primary"
                    ? 1
                    : Math.max(2, Number(current.priority || 2)),
              }))
            }
            disabled={saving}
          >
            <option value="primary">Primary</option>
            <option value="backup">Backup</option>
          </select>
        </label>

        <label>
          Priority
          <input
            type="number"
            min="1"
            max="999"
            value={form.priority}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                priority: event.target.value,
              }))
            }
            disabled={saving || form.role === "primary"}
          />
        </label>

        <label>
          Protocol
          <select
            value={form.protocol}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                protocol: event.target.value,
              }))
            }
            disabled={saving}
          >
            {protocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {PROTOCOL_LABELS[protocol] || String(protocol).toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label>
          Source name
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Main Encoder"
            disabled={saving}
          />
        </label>

        <label className="st-span-2">
          Source URL
          <input
            type="password"
            autoComplete="off"
            value={form.source_url}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                source_url: event.target.value,
              }))
            }
            placeholder={
              editing
                ? "Leave blank to keep the existing protected URL"
                : SOURCE_PLACEHOLDERS[form.protocol] || "Protocol source URL"
            }
            disabled={saving}
          />
        </label>

        {editing && source?.source_url_display ? (
          <div className="st-form-note st-span-2">
            Current protected URL: <code>{source.source_url_display}</code>
          </div>
        ) : null}

        <label className="st-check">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                enabled: event.target.checked,
              }))
            }
            disabled={saving}
          />
          Enabled
        </label>
        <label className="st-check">
          <input
            type="checkbox"
            checked={form.auto_start}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                auto_start: event.target.checked,
              }))
            }
            disabled={saving}
          />
          Auto-start after backend restart
        </label>
        <label className="st-check">
          <input
            type="checkbox"
            checked={form.auto_reconnect}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                auto_reconnect: event.target.checked,
              }))
            }
            disabled={saving}
          />
          Automatic reconnect
        </label>
      </div>

      {error ? <div className="st-inline-error">{error}</div> : null}

      <button
        type="submit"
        className="st-btn st-btn--primary"
        disabled={saving}
      >
        {saving ? "Saving…" : editing ? "Save Source" : "Create Source"}
      </button>
    </form>
  );
}

function PreflightResult({ result }) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <div className="st-inline-error ps-preflight">
        <strong>Source test failed</strong>
        <span>
          {result.message ||
            result.code ||
            "The source could not be validated."}
        </span>
      </div>
    );
  }

  const video = result.video || {};
  const audio = result.audio || {};
  return (
    <div className="ps-preflight ps-preflight--ok">
      <div className="ps-preflight-head">
        <strong>Source test passed</strong>
        <span className="st-pill st-pill--good">READY</span>
      </div>
      <div className="st-metrics ps-preflight-metrics">
        <div>
          <span>Video</span>
          <strong>{String(video.codec_name || "—").toUpperCase()}</strong>
        </div>
        <div>
          <span>Resolution</span>
          <strong>
            {video.width && video.height
              ? `${video.width} × ${video.height}`
              : "—"}
          </strong>
        </div>
        <div>
          <span>Frame rate</span>
          <strong>{formatFps(video.avg_frame_rate)}</strong>
        </div>
        <div>
          <span>Audio</span>
          <strong>
            {audio.codec_name ? String(audio.codec_name).toUpperCase() : "None"}
          </strong>
        </div>
      </div>
    </div>
  );
}

function FailoverSettings({ settings, disabled, onSaved }) {
  const [form, setForm] = useState({
    enabled: Boolean(settings?.enabled),
    failure_threshold_seconds: Number(settings?.failure_threshold_seconds || 5),
    failback_enabled: settings?.failback_enabled !== false,
    failback_stability_seconds: Number(
      settings?.failback_stability_seconds || 15,
    ),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({
      enabled: Boolean(settings?.enabled),
      failure_threshold_seconds: Number(
        settings?.failure_threshold_seconds || 5,
      ),
      failback_enabled: settings?.failback_enabled !== false,
      failback_stability_seconds: Number(
        settings?.failback_stability_seconds || 15,
      ),
    });
  }, [settings]);

  const save = async () => {
    try {
      setSaving(true);
      setError("");
      await onSaved(form);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to save failover settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="st-add-form ps-form">
      <div className="st-add-head">
        <div>
          <span className="st-kicker">AUTOMATION</span>
          <h5>Input Failover</h5>
          <p>
            Warm-standby Primary → Backup switching with optional automatic
            failback.
          </p>
        </div>
      </div>
      <div className="st-form-grid">
        <label className="st-check">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                enabled: event.target.checked,
              }))
            }
            disabled={disabled || saving}
          />
          Automatic failover
        </label>
        <label>
          Fail after
          <input
            type="number"
            min="1"
            max="120"
            value={form.failure_threshold_seconds}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                failure_threshold_seconds: event.target.value,
              }))
            }
            disabled={disabled || saving}
          />
          <span className="st-form-note">seconds</span>
        </label>
        <label className="st-check">
          <input
            type="checkbox"
            checked={form.failback_enabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                failback_enabled: event.target.checked,
              }))
            }
            disabled={disabled || saving || !form.enabled}
          />
          Automatic failback
        </label>
        <label>
          Failback after primary is stable
          <input
            type="number"
            min="3"
            max="600"
            value={form.failback_stability_seconds}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                failback_stability_seconds: event.target.value,
              }))
            }
            disabled={disabled || saving || !form.failback_enabled}
          />
          <span className="st-form-note">seconds</span>
        </label>
      </div>
      {error ? <div className="st-inline-error">{error}</div> : null}
      {!disabled ? (
        <button
          type="button"
          className="st-btn st-btn--primary"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Failover Settings"}
        </button>
      ) : null}
    </div>
  );
}

function PullSources({ channelId, canManage = true }) {
  const [sources, setSources] = useState([]);
  const [failover, setFailover] = useState(null);
  const [protocols, setProtocols] = useState(DEFAULT_PROTOCOLS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingSource, setEditingSource] = useState(null);
  const [addingRole, setAddingRole] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [preflightById, setPreflightById] = useState({});

  const refresh = async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoadError("");
      const response = await api.get(`/api/channels/${channelId}/pull-source`);
      const nextSources = Array.isArray(response.data.sources)
        ? response.data.sources
        : response.data.source
          ? [response.data.source]
          : [];
      setSources(
        nextSources.map((item) => ({ ...item, channel_id: channelId })),
      );
      setFailover(response.data.failover || null);
      const supported = response.data.supported_protocols;
      if (Array.isArray(supported) && supported.length) setProtocols(supported);
      else if (supported && typeof supported === "object") {
        const keys = Object.keys(supported);
        if (keys.length) setProtocols(keys);
      }
    } catch (err) {
      if (!quiet)
        setLoadError(
          err.response?.data?.message || "Failed to load Pull Sources.",
        );
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(() => refresh({ quiet: true }), 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  const sortedSources = useMemo(
    () =>
      [...sources].sort((a, b) => {
        if (a.role !== b.role) return a.role === "primary" ? -1 : 1;
        return Number(a.priority || 999) - Number(b.priority || 999);
      }),
    [sources],
  );

  const primary = sortedSources.find((source) => source.role === "primary");
  const active = sortedSources.find((source) => source.is_active_source);

  const action = async (source, name) => {
    if (!source?.id || busyAction) return;
    const key = `${source.id}:${name}`;
    try {
      setBusyAction(key);
      setActionError("");
      if (name === "preflight") {
        const response = await api.post(
          `/api/channels/${channelId}/pull-source/${source.id}/preflight`,
        );
        setPreflightById((current) => ({
          ...current,
          [source.id]: response.data.preflight || response.data,
        }));
      } else {
        await api.post(
          `/api/channels/${channelId}/pull-source/${source.id}/${name}`,
        );
      }
      await refresh({ quiet: true });
    } catch (err) {
      if (name === "preflight") {
        const failure =
          err.response?.data?.preflight || err.response?.data || {};
        setPreflightById((current) => ({
          ...current,
          [source.id]: {
            ok: false,
            code: failure.code || null,
            message: failure.message || "The source could not be validated.",
          },
        }));
      } else {
        setActionError(
          err.response?.data?.message || `Failed to ${name} Pull Source.`,
        );
      }
      await refresh({ quiet: true });
    } finally {
      setBusyAction("");
    }
  };

  const remove = async (source) => {
    if (!source?.id || busyAction) return;
    if (
      !window.confirm(`Remove Pull Source "${source.name || "Pull Source"}"?`)
    )
      return;
    try {
      setBusyAction(`${source.id}:remove`);
      setActionError("");
      await api.delete(`/api/channels/${channelId}/pull-source/${source.id}`);
      setPreflightById((current) => {
        const next = { ...current };
        delete next[source.id];
        return next;
      });
      await refresh({ quiet: true });
    } catch (err) {
      setActionError(
        err.response?.data?.message || "Failed to remove Pull Source.",
      );
    } finally {
      setBusyAction("");
    }
  };

  const saveFailover = async (payload) => {
    await api.patch(`/api/channels/${channelId}/pull-source/failover`, payload);
    await refresh({ quiet: true });
  };

  if (loading)
    return (
      <div className="st-shell st-shell--loading">Loading Pull Sources…</div>
    );

  return (
    <section className="st-shell ps-shell">
      <div className="st-header">
        <div>
          <span className="st-kicker">INGEST</span>
          <h4>Source Failover</h4>
          <p>
            Configure a Primary Pull Source and warm-standby Backup sources.
            Only one managed source publishes to the channel at a time.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="st-btn st-btn--primary"
            onClick={() => setAddingRole(primary ? "backup" : "primary")}
            disabled={Boolean(addingRole || editingSource)}
          >
            <IconPlus />
            {primary ? "Add Backup" : "Add Primary"}
          </button>
        ) : null}
      </div>

      {loadError ? <div className="st-inline-error">{loadError}</div> : null}
      {actionError ? (
        <div className="st-inline-error">{actionError}</div>
      ) : null}

      {active ? (
        <div className="ps-preflight ps-preflight--ok">
          <div className="ps-preflight-head">
            <strong>Active source: {active.name}</strong>
            <span className="st-pill st-pill--good">
              {String(active.role || "source").toUpperCase()}
            </span>
          </div>
        </div>
      ) : sources.length ? (
        <div className="st-form-note">
          No Pull Source currently owns the channel. Normal OBS/SRT push ingest
          can still publish directly.
        </div>
      ) : null}

      {addingRole ? (
        <SourceForm
          source={{ channel_id: channelId }}
          protocols={protocols}
          defaultRole={addingRole}
          onCancel={() => setAddingRole("")}
          onSaved={async () => {
            setAddingRole("");
            await refresh();
          }}
        />
      ) : null}

      {editingSource ? (
        <SourceForm
          source={{ ...editingSource, channel_id: channelId }}
          protocols={protocols}
          defaultRole={editingSource.role}
          onCancel={() => setEditingSource(null)}
          onSaved={async () => {
            setEditingSource(null);
            await refresh();
          }}
        />
      ) : null}

      {!sources.length && !addingRole ? (
        <div className="st-empty ps-empty">
          <IconInput size={26} />
          <strong>No Pull Sources configured</strong>
          <p>
            This channel can still receive normal RTMP/SRT push ingest. Add a
            Primary when NLM should pull from an external source, then add a
            Backup for failover.
          </p>
        </div>
      ) : null}

      {sortedSources.map((source) => {
        const status = String(source.status || "stopped").toLowerCase();
        const transitionActive = [
          "starting",
          "reconnecting",
          "waiting",
        ].includes(status);
        const isBusy = busyAction.startsWith(`${source.id}:`);
        const isActive = Boolean(source.is_active_source);
        const canStart =
          source.enabled !== false && !source.is_running && !transitionActive;
        const canStop = source.is_running || transitionActive;
        const flags = [
          source.role === "primary"
            ? "Primary"
            : `Backup P${source.priority || 2}`,
          source.enabled !== false ? "Enabled" : "Disabled",
          source.auto_start ? "Auto Start" : "Manual Start",
          source.auto_reconnect !== false ? "Auto Reconnect" : "Reconnect Off",
        ];

        return (
          <article className="st-target-card ps-card" key={source.id}>
            <div className="st-target-head">
              <div className="st-target-identity">
                <div className="st-target-icon">
                  <IconInput />
                </div>
                <div>
                  <strong>{source.name || "Pull Source"}</strong>
                  <span>
                    {PROTOCOL_LABELS[source.protocol] ||
                      String(source.protocol || "").toUpperCase()}{" "}
                    · {source.source_url_display || "Protected source URL"}
                  </span>
                </div>
              </div>
              <div className="st-target-actions">
                {isActive ? (
                  <span className="st-pill st-pill--good">ACTIVE</span>
                ) : (
                  <span className="st-pill st-pill--muted">STANDBY</span>
                )}
                <span className={`st-pill st-pill--${statusTone(status)}`}>
                  {formatStatus(status)}
                </span>
                <span
                  className={`st-pill st-pill--${healthTone(source.health_status)}`}
                >
                  {formatStatus(source.health_status || "unknown")}
                </span>
              </div>
            </div>

            <div className="st-metrics ps-runtime-grid">
              <div>
                <span>Bitrate</span>
                <strong>{formatBitrate(source.bitrate_kbps)}</strong>
              </div>
              <div>
                <span>Uptime</span>
                <strong>{formatUptime(source.uptime_seconds)}</strong>
              </div>
              <div>
                <span>Reconnects</span>
                <strong>{Number(source.reconnect_count || 0)}</strong>
              </div>
              <div>
                <span>Priority</span>
                <strong>
                  {source.role === "primary"
                    ? "1 / Primary"
                    : source.priority || 2}
                </strong>
              </div>
            </div>

            <div className="st-flags">
              {flags.map((flag) => (
                <span key={flag}>{flag}</span>
              ))}
            </div>

            {source.last_error ? (
              <div className="st-target-error">
                <strong>{source.last_error_code || "source_error"}</strong>
                <span>{source.last_error}</span>
              </div>
            ) : null}

            <PreflightResult result={preflightById[source.id]} />

            <div className="st-card-footer ps-actions">
              <div>
                {canManage ? (
                  <>
                    <button
                      type="button"
                      className="st-btn st-btn--ghost"
                      onClick={() => action(source, "preflight")}
                      disabled={isBusy}
                    >
                      {busyAction === `${source.id}:preflight`
                        ? "Testing…"
                        : "Test Source"}
                    </button>
                    {canStart ? (
                      <button
                        type="button"
                        className="st-btn st-btn--primary"
                        onClick={() => action(source, "start")}
                        disabled={isBusy}
                      >
                        {busyAction === `${source.id}:start`
                          ? "Starting…"
                          : isActive
                            ? "Restart"
                            : "Make Active"}
                      </button>
                    ) : null}
                    {canStop ? (
                      <button
                        type="button"
                        className="st-btn st-btn--danger"
                        onClick={() => action(source, "stop")}
                        disabled={isBusy}
                      >
                        {busyAction === `${source.id}:stop`
                          ? "Stopping…"
                          : "Stop"}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
              {canManage ? (
                <div>
                  <button
                    type="button"
                    className="st-btn st-btn--ghost"
                    onClick={() => setEditingSource(source)}
                    disabled={
                      isBusy ||
                      source.is_running ||
                      transitionActive ||
                      Boolean(addingRole || editingSource)
                    }
                    title={
                      source.is_running || transitionActive
                        ? "Stop the Pull Source before editing it."
                        : "Edit Pull Source"
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="st-btn st-btn--ghost st-btn--danger-text"
                    onClick={() => remove(source)}
                    disabled={isBusy}
                  >
                    {busyAction === `${source.id}:remove`
                      ? "Removing…"
                      : "Remove"}
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}

      {sources.length ? (
        <FailoverSettings
          settings={failover}
          disabled={!canManage || sources.length < 2}
          onSaved={saveFailover}
        />
      ) : null}

      {sources.length ? <HAHealth channelId={channelId} /> : null}

      {sources.length ? <HAHistory channelId={channelId} /> : null}

      {sources.length === 1 ? (
        <div className="st-form-note">
          Add at least one Backup source before enabling automatic failover.
        </div>
      ) : null}
    </section>
  );
}

export default PullSources;
