import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import api from "./api";

function getStoredOrganization() {
  try {
    return JSON.parse(localStorage.getItem("nlm_current_organization") || "{}");
  } catch {
    return {};
  }
}

/* ─────────────────────────────────────────────
   Small formatting helpers
───────────────────────────────────────────── */
function formatBytes(bytes = 0) {
  if (!bytes) return "0 GB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(gb >= 100 ? 0 : 1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(1)} MB`;
}

function formatUptime(seconds = 0) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatHeartbeatAge(seconds) {
  if (seconds == null) return "never";
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return `${s}s ago`;
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function mediaNodeStatusStyle(status) {
  const styles = {
    online: {
      color: "#86efac",
      border: "1px solid rgba(74,222,128,0.3)",
      background: "rgba(74,222,128,0.08)",
    },
    degraded: {
      color: "#fcd34d",
      border: "1px solid rgba(251,191,36,0.35)",
      background: "rgba(251,191,36,0.08)",
    },
    draining: {
      color: "#93c5fd",
      border: "1px solid rgba(96,165,250,0.35)",
      background: "rgba(96,165,250,0.08)",
    },
    offline: {
      color: "#fca5a5",
      border: "1px solid rgba(248,113,113,0.35)",
      background: "rgba(248,113,113,0.08)",
    },
    disabled: {
      color: "#94a3b8",
      border: "1px solid rgba(148,163,184,0.25)",
      background: "rgba(148,163,184,0.06)",
    },
  };

  return styles[status] || styles.offline;
}

/* ─────────────────────────────────────────────
   Animated radial gauge (CPU / memory / disk)
   Pure SVG + CSS, no charting dependency.
───────────────────────────────────────────── */
const SAD_GAUGE_ACCENT_COLORS = {
  blue: "#4d9fff",
  purple: "#a78bfa",
  green: "#4ade80",
  orange: "#fd9d00",
  red: "#f87171",
};

function RadialGauge({ label, percent = 0, accent = "blue", detail = "" }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const data = [{ name: label, value: clamped }];
  const accentColor =
    SAD_GAUGE_ACCENT_COLORS[accent] || SAD_GAUGE_ACCENT_COLORS.blue;

  return (
    <div className="sad-gauge">
      <ResponsiveContainer
        width="100%"
        height={100}
        className="sad-gauge-chart"
      >
        <RadialBarChart
          innerRadius="76%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
          barSize={8}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            dataKey="value"
            cornerRadius={8}
            background={{ fill: "rgba(255, 255, 255, 0.07)" }}
            fill={accentColor}
            className={`sad-gauge-fill sad-gauge-fill--${accent}`}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="sad-gauge-center">
        <strong>{clamped}%</strong>
        <span>{label}</span>
      </div>
      {detail && <small className="sad-gauge-detail">{detail}</small>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Animated bar (used for the bitrate / viewers strip)
───────────────────────────────────────────── */
function StatBar({ label, value, max, accent = "blue", suffix = "" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="sad-statbar">
      <div className="sad-statbar-top">
        <span>{label}</span>
        <strong>
          {value}
          {suffix}
        </strong>
      </div>
      <div className="sad-statbar-track">
        <div
          className={`sad-statbar-fill sad-statbar-fill--${accent}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Combined trend chart (server metrics history) — CPU/Memory/Disk/Live
   Viewers as overlaid series in one chart, built on Recharts. CPU/Memory/
   Disk share a genuine 0-100% left axis; Live Viewers gets its own real
   secondary (right) axis, hidden but auto-scaled — no more eyeballed
   min/max scaling hack like the hand-rolled version had.
───────────────────────────────────────────── */
const TREND_SERIES = [
  { key: "cpu_percent", label: "CPU", color: "#4d9fff", unit: "%" },
  { key: "mem_used_percent", label: "Memory", color: "#a78bfa", unit: "%" },
  { key: "disk_used_percent", label: "Disk", color: "#fd9d00", unit: "%" },
  {
    key: "live_viewer_count",
    label: "Live Viewers",
    color: "#4ade80",
    unit: "",
  },
];

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="sad-trend-tooltip">
      <div className="sad-trend-tooltip-time">
        {new Date(label).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
      {TREND_SERIES.map((s) => {
        const entry = payload.find((p) => p.dataKey === s.key);
        if (!entry) return null;
        return (
          <div key={s.key} className="sad-trend-tooltip-row">
            <span
              className="sad-trend-legend-dot"
              style={{ background: s.color }}
            />
            <span>{s.label}</span>
            <strong>
              {entry.value}
              {s.unit}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

function CombinedTrendChart({ points = [] }) {
  const hasEnoughData = points.length >= 2;
  const latestPoint = points[points.length - 1];

  return (
    <div className="sad-trend-combined">
      <div className="sad-trend-legend">
        {TREND_SERIES.map((s) => (
          <div key={s.key} className="sad-trend-legend-item">
            <span
              className="sad-trend-legend-dot"
              style={{ background: s.color }}
            />
            <span className="sad-trend-legend-label">{s.label}</span>
            {latestPoint && (
              <strong>
                {latestPoint[s.key] ?? 0}
                {s.unit}
              </strong>
            )}
          </div>
        ))}
      </div>

      {hasEnoughData ? (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              {TREND_SERIES.filter((s) => s.key !== "live_viewer_count").map(
                (s) => (
                  <linearGradient
                    key={s.key}
                    id={`sad-grad-${s.key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ),
              )}
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="recorded_at"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })
              }
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              yAxisId="pct"
              domain={[0, 100]}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              hide
              domain={[0, "dataMax + 1"]}
            />
            <Tooltip content={<TrendTooltip />} />
            {TREND_SERIES.filter((s) => s.key !== "live_viewer_count").map(
              (s) => (
                <Area
                  key={s.key}
                  yAxisId="pct"
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#sad-grad-${s.key})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ),
            )}
            <Line
              yAxisId="count"
              type="monotone"
              dataKey="live_viewer_count"
              stroke="#4ade80"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="sad-trend-chart-empty">
          Not enough data yet — check back shortly.
        </div>
      )}
    </div>
  );
}

function SuperAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [mediaNodes, setMediaNodes] = useState([]);
  const [mediaNodeSummary, setMediaNodeSummary] = useState(null);
  const [mediaNodeStaleAfter, setMediaNodeStaleAfter] = useState(null);
  const [mediaNodeDrafts, setMediaNodeDrafts] = useState({});
  const [mediaNodeActionId, setMediaNodeActionId] = useState(null);
  const [mediaNodeNotice, setMediaNodeNotice] = useState("");
  const [mediaNodeError, setMediaNodeError] = useState("");
  const [errorLog, setErrorLog] = useState([]);
  const [errorLogTotal, setErrorLogTotal] = useState(0);
  const [planAlerts, setPlanAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(getStoredOrganization);
  const [refreshingOrg, setRefreshingOrg] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [refreshError, setRefreshError] = useState("");
  const pollRef = useRef(null);
  const loadInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  // Trend History (Server Health graphs) — polled separately from the main
  // 15s dashboard cycle above, since the underlying data only changes every
  // 5 minutes server-side (see collectServerMetricsSnapshot in server.js).
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [metricsRange, setMetricsRange] = useState("24h");

  // Danger Zone: gated backend/SRS restart
  const [dangerAction, setDangerAction] = useState(null); // null | 'backend' | 'srs'
  const [dangerSnapshot, setDangerSnapshot] = useState(null);
  const [dangerConfirmText, setDangerConfirmText] = useState("");
  const [dangerReason, setDangerReason] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);
  const [dangerError, setDangerError] = useState("");
  const [dangerResult, setDangerResult] = useState(null);
  const [auditLog, setAuditLog] = useState([]);

  // AI Support Assistant
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState("");

  useEffect(() => {
    const handleOrgChange = (e) => {
      setSelectedOrg(e.detail?.organization || getStoredOrganization());
      setRefreshResult(null);
      setRefreshError("");
    };
    window.addEventListener("nlm-organization-changed", handleOrgChange);
    return () =>
      window.removeEventListener("nlm-organization-changed", handleOrgChange);
  }, []);

  const loadAll = useCallback(async () => {
    // setInterval previously allowed a second refresh to start while a slow
    // Railway request was still pending. Skip overlapping cycles entirely.
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    try {
      const errorLogParams = selectedOrg?.id
        ? { organization_id: selectedOrg.id }
        : {};

      const [
        overviewResult,
        statusResult,
        mediaNodesResult,
        errorsResult,
        alertsResult,
      ] = await Promise.allSettled([
        api.get("/api/admin/overview"),
        api.get("/api/admin/server-status"),
        api.get("/api/admin/media-nodes"),
        api.get("/api/admin/error-log", { params: errorLogParams }),
        api.get("/api/admin/plan-alerts"),
      ]);

      if (!mountedRef.current) return;

      let successfulSections = 0;
      const failedSections = [];

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value.data);
        successfulSections += 1;
      } else {
        failedSections.push(
          overviewResult.reason?.response?.data?.message || "platform overview",
        );
      }

      if (statusResult.status === "fulfilled") {
        setServerStatus(statusResult.value.data);
        successfulSections += 1;
      } else {
        failedSections.push("server health");
      }

      if (mediaNodesResult.status === "fulfilled") {
        const nextMediaNodes = mediaNodesResult.value.data.nodes || [];
        setMediaNodes(nextMediaNodes);
        setMediaNodeSummary(mediaNodesResult.value.data.summary || null);
        setMediaNodeStaleAfter(
          mediaNodesResult.value.data.stale_after_seconds ?? null,
        );
        setMediaNodeDrafts((prev) => {
          const next = { ...prev };
          nextMediaNodes.forEach((node) => {
            if (!Object.prototype.hasOwnProperty.call(next, node.id)) {
              next[node.id] =
                Number(node.max_streams || 0) > 0
                  ? String(node.max_streams)
                  : "";
            }
          });
          return next;
        });
        successfulSections += 1;
      } else {
        failedSections.push("media nodes");
      }

      if (errorsResult.status === "fulfilled") {
        setErrorLog(errorsResult.value.data.errors || []);
        setErrorLogTotal(errorsResult.value.data.total_unfiltered ?? 0);
        successfulSections += 1;
      } else {
        failedSections.push("recent errors");
      }

      if (alertsResult.status === "fulfilled") {
        setPlanAlerts(alertsResult.value.data.alerts || []);
        successfulSections += 1;
      } else {
        failedSections.push("plan alerts");
      }

      if (successfulSections > 0) setLastUpdated(new Date());

      if (failedSections.length === 0) {
        setError("");
      } else if (successfulSections > 0) {
        setError(
          `Some dashboard sections could not refresh (${failedSections.join(", ")}). Showing the latest available data.`,
        );
      } else {
        setError(
          "Failed to refresh the platform dashboard. Retrying automatically.",
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      loadInFlightRef.current = false;
    }
  }, [selectedOrg?.id]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const poll = async () => {
      await loadAll();
      if (!cancelled) {
        pollRef.current = setTimeout(poll, 15000);
      }
    };

    poll();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [loadAll]);

  useEffect(() => {
    let cancelled = false;

    const loadMetricsHistory = async () => {
      try {
        const res = await api.get("/api/admin/server-metrics-history", {
          params: { range: metricsRange },
        });
        if (!cancelled) setMetricsHistory(res.data.points || []);
      } catch {
        // Non-fatal — TrendChart falls back to its "not enough data" state
        // and the rest of the dashboard is unaffected either way.
      }
    };

    loadMetricsHistory();
    const interval = setInterval(loadMetricsHistory, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [metricsRange]);

  const handleForceRefresh = async () => {
    if (!selectedOrg?.id) return;
    setRefreshingOrg(true);
    setRefreshError("");
    try {
      const res = await api.post(
        `/api/admin/organizations/${selectedOrg.id}/refresh`,
      );
      setRefreshResult(res.data);
      await loadAll();
    } catch (err) {
      setRefreshError(
        err.response?.data?.message || "Failed to refresh organization.",
      );
    } finally {
      setRefreshingOrg(false);
    }
  };

  const updateMediaNodeSettings = async (node, patch, successMessage) => {
    if (!node?.id || mediaNodeActionId) return;

    try {
      setMediaNodeActionId(node.id);
      setMediaNodeNotice("");
      setMediaNodeError("");

      const res = await api.patch(
        `/api/admin/media-nodes/${node.id}/settings`,
        patch,
      );

      if (Object.prototype.hasOwnProperty.call(patch, "max_streams")) {
        setMediaNodeDrafts((prev) => ({
          ...prev,
          [node.id]: String(patch.max_streams),
        }));
      }

      setMediaNodeNotice(
        successMessage || res.data?.message || `${node.name} settings updated.`,
      );
      await loadAll();
    } catch (err) {
      setMediaNodeError(
        err.response?.data?.message || "Failed to update media node settings.",
      );
    } finally {
      setMediaNodeActionId(null);
    }
  };

  const saveMediaNodeCapacity = async (node) => {
    const raw = String(mediaNodeDrafts[node.id] ?? "").trim();
    const value = Number(raw);

    if (!Number.isInteger(value) || value < 1 || value > 10000) {
      setMediaNodeError("Max Streams must be an integer between 1 and 10000.");
      return;
    }

    await updateMediaNodeSettings(
      node,
      { max_streams: value },
      `${node.name} capacity updated to ${value} streams.`,
    );
  };

  const toggleMediaNodeDrain = async (node) => {
    const nextDraining = !node.is_draining;

    if (
      nextDraining &&
      !window.confirm(
        `Put "${node.name}" into Drain Mode? Existing streams and channel assignments will stay in place, but new placement on this node will be blocked.`,
      )
    ) {
      return;
    }

    await updateMediaNodeSettings(
      node,
      { is_draining: nextDraining },
      nextDraining
        ? `${node.name} is now draining. Existing streams remain untouched.`
        : `${node.name} is accepting new placement again.`,
    );
  };

  const toggleMediaNodeEnabled = async (node) => {
    const nextEnabled = !node.is_enabled;

    if (
      !nextEnabled &&
      !window.confirm(
        `Disable "${node.name}"? This prevents the node from being used for placement. The backend will reject this action if streams are still active.`,
      )
    ) {
      return;
    }

    await updateMediaNodeSettings(
      node,
      { is_enabled: nextEnabled },
      nextEnabled ? `${node.name} enabled.` : `${node.name} disabled.`,
    );
  };

  const loadAuditLog = async () => {
    try {
      const res = await api.get("/api/admin/restart-audit-log");
      setAuditLog(res.data.entries || []);
    } catch {
      // non-critical — the Danger Zone still works without history visible
    }
  };

  useEffect(() => {
    loadAuditLog();
  }, []);

  const openDangerDialog = async (action) => {
    setDangerAction(action);
    setDangerConfirmText("");
    setDangerReason("");
    setDangerError("");
    setDangerResult(null);
    setDangerSnapshot(null);
    try {
      const res = await api.get("/api/admin/active-streams-snapshot");
      setDangerSnapshot(res.data);
    } catch {
      setDangerSnapshot({ srsAvailable: false, count: 0, activeStreams: [] });
    }
  };

  const closeDangerDialog = () => {
    setDangerAction(null);
    setDangerSnapshot(null);
    setDangerConfirmText("");
    setDangerReason("");
    setDangerError("");
  };

  const requiredConfirmText = () => {
    if (!dangerSnapshot) return "";
    const hasActive = dangerSnapshot.count > 0;
    if (dangerAction === "backend") {
      return hasActive ? "bscapi54" : "RESTART BACKEND";
    }
    if (dangerAction === "srs") {
      return hasActive ? "bscapi54" : "RESTART SRS";
    }
    return "";
  };

  const submitDangerAction = async () => {
    if (!dangerAction) return;
    setDangerBusy(true);
    setDangerError("");
    try {
      const res = await api.post(`/api/admin/restart-${dangerAction}`, {
        confirm_text: dangerConfirmText,
        reason: dangerReason,
      });
      setDangerResult({ action: dangerAction, message: res.data.message });
      await loadAuditLog();
      closeDangerDialog();
    } catch (err) {
      setDangerError(
        err.response?.data?.message ||
          `Failed to restart ${dangerAction === "srs" ? "SRS" : "backend"}.`,
      );
    } finally {
      setDangerBusy(false);
    }
  };

  const submitAssistantQuestion = async () => {
    const question = assistantQuestion.trim();
    if (!question || assistantBusy) return;

    setAssistantBusy(true);
    setAssistantError("");
    const askedOrgName = selectedOrg?.name || null;

    try {
      const res = await api.post("/api/admin/support-assistant", {
        question,
        organizationId: selectedOrg?.id || null,
      });
      setAssistantMessages((prev) => [
        ...prev,
        { question, answer: res.data.answer, organizationName: askedOrgName },
      ]);
      setAssistantQuestion("");
    } catch (err) {
      setAssistantError(
        err.response?.data?.message ||
          "Failed to get a response from the assistant.",
      );
    } finally {
      setAssistantBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="sad-loading">
        <div className="sad-loading-spinner" />
        <span>Loading platform overview…</span>
      </div>
    );
  }

  const totals = overview?.totals || {};
  const orgs = overview?.organizations || {};
  const channels = overview?.channels || {};
  const storage = overview?.storage || {};
  const liveStreams = overview?.live_streams || [];
  const recentRecordings = overview?.recent_recordings || [];
  const adminsByRole = overview?.admins_by_role || [];

  const mem = serverStatus?.memory || {};
  const disk = serverStatus?.disk;
  const loadAvg = serverStatus?.load_avg || {};
  const cpuCount = serverStatus?.cpu_count || 1;
  const cpuPercent = Math.min(
    100,
    Math.round(((loadAvg["1m"] || 0) / cpuCount) * 100),
  );

  const nodeSummary = mediaNodeSummary || {
    total: mediaNodes.length,
    enabled: mediaNodes.filter((n) => n.is_enabled).length,
    online: mediaNodes.filter((n) => n.effective_status === "online").length,
    degraded: mediaNodes.filter((n) => n.effective_status === "degraded")
      .length,
    offline: mediaNodes.filter((n) => n.effective_status === "offline").length,
    draining: mediaNodes.filter((n) => n.effective_status === "draining")
      .length,
    placement_eligible: mediaNodes.filter((n) => n.placement_eligible).length,
    at_capacity: mediaNodes.filter((n) => n.at_capacity).length,
    total_capacity: mediaNodes.reduce(
      (sum, n) => sum + Number(n.max_streams || 0),
      0,
    ),
    active_streams: mediaNodes.reduce(
      (sum, n) => sum + Number(n.active_streams || 0),
      0,
    ),
    ffmpeg_processes: mediaNodes.reduce(
      (sum, n) => sum + Number(n.ffmpeg_processes || 0),
      0,
    ),
  };

  return (
    <div className="sad-page">
      {/* ── Header ── */}
      <div className="sad-page-header">
        <div className="sad-page-header-left">
          <div className="sad-page-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div>
            <h1 className="sad-page-title">Platform Overview</h1>
            <p className="sad-page-sub">
              Cross-organization visibility — live streams, server health,
              storage, and recent activity across every tenant.
            </p>
          </div>
        </div>
        <div className="sad-header-right">
          {overview?.srs_available === false && (
            <span className="sad-warn-pill">SRS unreachable</span>
          )}
          <span className="sad-live-pill">
            <span className="sad-live-dot" />
            Auto-refreshing
          </span>
          {lastUpdated && (
            <span className="sad-updated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="sad-banner sad-banner--error">
          {error}
          {lastUpdated &&
            ` Last successful update: ${lastUpdated.toLocaleTimeString()}.`}
        </div>
      )}

      {/* ── Per-organization Force Refresh (Support Mode only) ── */}
      {selectedOrg?.id && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "10px",
            border: "1px solid rgba(148,163,184,0.18)",
            background: "rgba(148,163,184,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontSize: "11px",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              Support Mode
            </span>
            <strong style={{ color: "#e2e8f0" }}>{selectedOrg.name}</strong>
            <span style={{ color: "#64748b", fontSize: "13px" }}>
              — re-checks this org's live/simulcast status against the actual
              server state
            </span>
          </div>
          <button
            onClick={handleForceRefresh}
            disabled={refreshingOrg}
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(96,165,250,0.4)",
              background: refreshingOrg
                ? "rgba(96,165,250,0.08)"
                : "rgba(96,165,250,0.16)",
              color: "#93c5fd",
              fontSize: "13px",
              fontWeight: 600,
              cursor: refreshingOrg ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {refreshingOrg ? "Refreshing…" : "Force Refresh"}
          </button>
        </div>
      )}

      {refreshError && (
        <div className="sad-banner sad-banner--error">{refreshError}</div>
      )}

      {refreshResult && (
        <div
          style={{
            marginBottom: "16px",
            borderRadius: "10px",
            border: `1px solid ${
              refreshResult.corrections_made > 0
                ? "rgba(251,191,36,0.35)"
                : "rgba(74,222,128,0.3)"
            }`,
            background:
              refreshResult.corrections_made > 0
                ? "rgba(251,191,36,0.08)"
                : "rgba(74,222,128,0.06)",
            padding: "12px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                color:
                  refreshResult.corrections_made > 0 ? "#fcd34d" : "#86efac",
                fontSize: "13px",
              }}
            >
              {refreshResult.message}
            </span>
            <button
              onClick={() => setRefreshResult(null)}
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          {refreshResult.corrections_made > 0 && (
            <ul
              style={{
                margin: "8px 0 0",
                paddingLeft: "18px",
                color: "#cbd5e1",
                fontSize: "13px",
              }}
            >
              {refreshResult.channel_corrections?.map((c) => (
                <li key={`ch-${c.channel_id}`}>
                  <strong>{c.channel_name}</strong>: was{" "}
                  {c.was_live ? "live" : "offline"}, corrected to{" "}
                  {c.now_live ? "live" : "offline"}
                </li>
              ))}
              {refreshResult.social_corrections?.map((c) => (
                <li key={`sd-${c.destination_id}`}>
                  <strong>{c.channel_name}</strong> → {c.platform}: was{" "}
                  {c.was_running ? "running" : "stopped"}, corrected to{" "}
                  {c.now_running ? "running" : "stopped"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Top KPI row ── */}
      <div className="sad-kpi-grid">
        <div className="sad-kpi sad-kpi--blue">
          <span className="sad-kpi-label">Organizations</span>
          <strong className="sad-kpi-value">{orgs.total ?? 0}</strong>
          <small className="sad-kpi-sub">{orgs.active ?? 0} active</small>
        </div>
        <div className="sad-kpi sad-kpi--purple">
          <span className="sad-kpi-label">Channels</span>
          <strong className="sad-kpi-value">{channels.total ?? 0}</strong>
          <small className="sad-kpi-sub">across all tenants</small>
        </div>
        <div className="sad-kpi sad-kpi--green">
          <span className="sad-kpi-label">Live Streams</span>
          <strong className="sad-kpi-value">
            {totals.active_streams ?? 0}
          </strong>
          <small className="sad-kpi-sub">right now</small>
        </div>
        <div className="sad-kpi sad-kpi--orange">
          <span className="sad-kpi-label">Live Viewers</span>
          <strong className="sad-kpi-value">{totals.live_viewers ?? 0}</strong>
          <small className="sad-kpi-sub">across all streams</small>
        </div>
        <div className="sad-kpi sad-kpi--blue">
          <span className="sad-kpi-label">Incoming Bitrate</span>
          <strong className="sad-kpi-value">{totals.incoming_kbps ?? 0}</strong>
          <small className="sad-kpi-sub">kbps total</small>
        </div>
        <div className="sad-kpi sad-kpi--purple">
          <span className="sad-kpi-label">Storage Used</span>
          <strong className="sad-kpi-value">
            {formatBytes(storage.total_bytes)}
          </strong>
          <small className="sad-kpi-sub">
            {storage.total_recordings ?? 0} recordings
          </small>
        </div>
      </div>

      <div className="sad-main-grid">
        {/* ── Server health ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2>Server Health</h2>
            <span className="sad-card-sub">
              Uptime {formatUptime(serverStatus?.uptime_seconds)}
            </span>
          </div>
          <div className="sad-gauge-row">
            <RadialGauge
              label="CPU"
              percent={cpuPercent}
              accent="blue"
              detail={`load ${loadAvg["1m"]?.toFixed(2) ?? "—"} / ${cpuCount} cores`}
            />
            <RadialGauge
              label="Memory"
              percent={mem.used_percent ?? 0}
              accent="purple"
              detail={`${formatBytes(mem.used_bytes)} / ${formatBytes(mem.total_bytes)}`}
            />
            <RadialGauge
              label="Disk"
              percent={disk?.used_percent ?? 0}
              accent={
                (disk?.used_percent ?? 0) > 85
                  ? "red"
                  : (disk?.used_percent ?? 0) > 65
                    ? "orange"
                    : "green"
              }
              detail={
                disk
                  ? `${formatBytes(disk.used_bytes)} / ${formatBytes(disk.total_bytes)}`
                  : "unavailable"
              }
            />
          </div>
        </section>

        {/* ── Media node registry / cluster health ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <div>
              <h2>Media Nodes</h2>
              <span className="sad-card-sub">
                Capacity, placement eligibility, drain mode, and heartbeat
                health
                {mediaNodeStaleAfter
                  ? ` · offline after ${mediaNodeStaleAfter}s without a heartbeat`
                  : ""}
              </span>
            </div>
            <span className="status-pill">
              {nodeSummary.online}/{nodeSummary.total} online
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            {[
              ["Nodes", nodeSummary.total, "#93c5fd"],
              ["Online", nodeSummary.online, "#86efac"],
              ["Eligible", nodeSummary.placement_eligible ?? 0, "#4ade80"],
              ["Draining", nodeSummary.draining ?? 0, "#93c5fd"],
              ["At Capacity", nodeSummary.at_capacity ?? 0, "#fcd34d"],
              ["Streams", nodeSummary.active_streams, "#c4b5fd"],
              [
                "Capacity",
                Number(nodeSummary.total_capacity || 0) > 0
                  ? nodeSummary.total_capacity
                  : "Not set",
                "#fdba74",
              ],
              ["FFmpeg", nodeSummary.ffmpeg_processes, "#fdba74"],
            ].map(([label, value, color]) => (
              <div
                key={label}
                style={{
                  padding: "10px 12px",
                  borderRadius: "9px",
                  border: "1px solid rgba(148,163,184,0.16)",
                  background: "rgba(148,163,184,0.05)",
                }}
              >
                <div
                  style={{
                    color: "#64748b",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {label}
                </div>
                <strong
                  style={{
                    display: "block",
                    marginTop: "4px",
                    fontSize: "20px",
                    color,
                  }}
                >
                  {value ?? 0}
                </strong>
              </div>
            ))}
          </div>

          {mediaNodeNotice && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(74,222,128,0.3)",
                background: "rgba(74,222,128,0.08)",
                color: "#86efac",
                fontSize: "12.5px",
              }}
            >
              {mediaNodeNotice}
            </div>
          )}

          {mediaNodeError && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(248,113,113,0.35)",
                background: "rgba(248,113,113,0.08)",
                color: "#fca5a5",
                fontSize: "12.5px",
              }}
            >
              {mediaNodeError}
            </div>
          )}

          {mediaNodes.length === 0 ? (
            <div className="sad-empty">No media nodes are registered yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="sad-table">
                <thead>
                  <tr>
                    <th>Node</th>
                    <th>Status</th>
                    <th>Placement</th>
                    <th>Channels</th>
                    <th>Streams</th>
                    <th>Capacity</th>
                    <th>CPU</th>
                    <th>Memory</th>
                    <th>SRS</th>
                    <th>API</th>
                    <th>Heartbeat</th>
                    <th>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaNodes.map((node) => {
                    const busy = mediaNodeActionId === node.id;
                    const maxStreams = Number(node.max_streams || 0);
                    const activeStreams = Number(node.active_streams || 0);
                    const draftCapacity = mediaNodeDrafts[node.id] ?? "";
                    const draftCapacityNumber = Number(draftCapacity);
                    const capacityValid =
                      Number.isInteger(draftCapacityNumber) &&
                      draftCapacityNumber >= 1 &&
                      draftCapacityNumber <= 10000;
                    const capacityChanged =
                      capacityValid && draftCapacityNumber !== maxStreams;

                    const placementLabel = node.is_draining
                      ? "Draining"
                      : node.at_capacity
                        ? "At Capacity"
                        : node.placement_eligible
                          ? "Eligible"
                          : "Blocked";

                    const placementStyle =
                      placementLabel === "Eligible"
                        ? {
                            color: "#86efac",
                            border: "1px solid rgba(74,222,128,0.3)",
                            background: "rgba(74,222,128,0.08)",
                          }
                        : placementLabel === "Draining"
                          ? mediaNodeStatusStyle("draining")
                          : placementLabel === "At Capacity"
                            ? {
                                color: "#fcd34d",
                                border: "1px solid rgba(251,191,36,0.35)",
                                background: "rgba(251,191,36,0.08)",
                              }
                            : mediaNodeStatusStyle("disabled");

                    return (
                      <tr key={node.id}>
                        <td>
                          <strong>{node.name || `Node ${node.id}`}</strong>
                          <div
                            style={{
                              marginTop: "2px",
                              color: "#64748b",
                              fontSize: "11px",
                            }}
                          >
                            {node.hostname || node.public_ip || "—"}
                          </div>
                          {node.region && (
                            <div
                              style={{
                                marginTop: "2px",
                                color: "#64748b",
                                fontSize: "11px",
                              }}
                            >
                              {node.region}
                            </div>
                          )}
                        </td>

                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: "999px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              textTransform: "capitalize",
                              ...mediaNodeStatusStyle(node.effective_status),
                            }}
                          >
                            {node.effective_status || "unknown"}
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              borderRadius: "999px",
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              ...placementStyle,
                            }}
                          >
                            {placementLabel}
                          </span>
                        </td>

                        <td>{node.assigned_channels ?? 0}</td>

                        <td>{activeStreams}</td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              minWidth: "165px",
                            }}
                          >
                            <input
                              type="number"
                              min="1"
                              max="10000"
                              step="1"
                              value={draftCapacity}
                              placeholder={
                                maxStreams > 0
                                  ? String(maxStreams)
                                  : "Set limit"
                              }
                              onChange={(e) =>
                                setMediaNodeDrafts((prev) => ({
                                  ...prev,
                                  [node.id]: e.target.value,
                                }))
                              }
                              disabled={busy}
                              title="Maximum concurrent streams used by placement eligibility"
                              style={{
                                width: "82px",
                                padding: "6px 7px",
                                borderRadius: "7px",
                                border: "1px solid rgba(148,163,184,0.25)",
                                background: "#0f172a",
                                color: "#e2e8f0",
                                fontSize: "12px",
                              }}
                            />
                            <button
                              type="button"
                              disabled={busy || !capacityChanged}
                              onClick={() => saveMediaNodeCapacity(node)}
                              style={{
                                padding: "6px 8px",
                                borderRadius: "7px",
                                border: "1px solid rgba(96,165,250,0.35)",
                                background:
                                  busy || !capacityChanged
                                    ? "rgba(96,165,250,0.05)"
                                    : "rgba(96,165,250,0.12)",
                                color:
                                  busy || !capacityChanged
                                    ? "#64748b"
                                    : "#93c5fd",
                                cursor:
                                  busy || !capacityChanged
                                    ? "default"
                                    : "pointer",
                                fontSize: "11px",
                                fontWeight: 600,
                              }}
                            >
                              Save
                            </button>
                          </div>
                          <div
                            style={{
                              marginTop: "4px",
                              color: "#64748b",
                              fontSize: "10.5px",
                            }}
                          >
                            {maxStreams > 0
                              ? `${activeStreams}/${maxStreams} active · ${
                                  node.remaining_capacity ?? 0
                                } remaining`
                              : "Capacity limit not configured"}
                          </div>
                        </td>

                        <td>{node.cpu_percent ?? 0}%</td>
                        <td>{node.memory_percent ?? 0}%</td>

                        <td>
                          <span
                            style={{
                              color: node.srs_healthy ? "#86efac" : "#fca5a5",
                            }}
                          >
                            {node.srs_healthy ? "Healthy" : "Down"}
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              color: node.api_healthy ? "#86efac" : "#fca5a5",
                            }}
                          >
                            {node.api_healthy ? "Healthy" : "Down"}
                          </span>
                        </td>

                        <td>
                          <span
                            title={
                              node.last_heartbeat_at
                                ? new Date(
                                    node.last_heartbeat_at,
                                  ).toLocaleString()
                                : "No heartbeat received"
                            }
                          >
                            {formatHeartbeatAge(node.heartbeat_age_seconds)}
                          </span>
                          {node.last_error && (
                            <div
                              style={{
                                marginTop: "3px",
                                maxWidth: "220px",
                                color: "#fca5a5",
                                fontSize: "11px",
                                whiteSpace: "normal",
                              }}
                            >
                              {node.last_error}
                            </div>
                          )}
                        </td>

                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                              minWidth: "125px",
                            }}
                          >
                            <button
                              type="button"
                              disabled={busy || !node.is_enabled}
                              onClick={() => toggleMediaNodeDrain(node)}
                              title={
                                node.is_draining
                                  ? "End Drain Mode and allow new placement"
                                  : "Block new placement without stopping existing streams"
                              }
                              style={{
                                padding: "6px 9px",
                                borderRadius: "7px",
                                border: "1px solid rgba(96,165,250,0.35)",
                                background: node.is_draining
                                  ? "rgba(74,222,128,0.08)"
                                  : "rgba(96,165,250,0.10)",
                                color: node.is_draining ? "#86efac" : "#93c5fd",
                                cursor:
                                  busy || !node.is_enabled
                                    ? "default"
                                    : "pointer",
                                fontSize: "11px",
                                fontWeight: 600,
                                opacity: busy || !node.is_enabled ? 0.5 : 1,
                              }}
                            >
                              {busy
                                ? "Updating…"
                                : node.is_draining
                                  ? "End Drain"
                                  : "Start Drain"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                busy || (node.is_enabled && activeStreams > 0)
                              }
                              onClick={() => toggleMediaNodeEnabled(node)}
                              title={
                                node.is_enabled && activeStreams > 0
                                  ? "Drain the node and wait for active streams to finish before disabling"
                                  : node.is_enabled
                                    ? "Disable this media node"
                                    : "Enable this media node"
                              }
                              style={{
                                padding: "6px 9px",
                                borderRadius: "7px",
                                border: node.is_enabled
                                  ? "1px solid rgba(248,113,113,0.35)"
                                  : "1px solid rgba(74,222,128,0.30)",
                                background: node.is_enabled
                                  ? "rgba(248,113,113,0.08)"
                                  : "rgba(74,222,128,0.08)",
                                color: node.is_enabled ? "#fca5a5" : "#86efac",
                                cursor:
                                  busy || (node.is_enabled && activeStreams > 0)
                                    ? "default"
                                    : "pointer",
                                fontSize: "11px",
                                fontWeight: 600,
                                opacity:
                                  busy || (node.is_enabled && activeStreams > 0)
                                    ? 0.5
                                    : 1,
                              }}
                            >
                              {node.is_enabled ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Trend history — same metrics as the gauges above, over time ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2>Trend History</h2>
            <div className="sad-range-toggle">
              {["24h", "7d", "30d"].map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`sad-range-btn ${
                    metricsRange === r ? "sad-range-btn--active" : ""
                  }`}
                  onClick={() => setMetricsRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <CombinedTrendChart points={metricsHistory} />
        </section>

        {/* ── Live streams across all orgs ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2>Live Streams</h2>
            <span className="status-pill">{liveStreams.length} active</span>
          </div>
          {liveStreams.length === 0 ? (
            <div className="sad-empty">No active live streams right now.</div>
          ) : (
            <div className="sad-stream-list">
              {liveStreams.map((s) => (
                <div key={s.stream_key} className="sad-stream-row">
                  <div className="sad-stream-row-left">
                    <span className="sad-live-dot" />
                    <div>
                      <strong>{s.channel_name || s.stream_key}</strong>
                      <p>{s.organization_name}</p>
                    </div>
                  </div>
                  <div className="sad-stream-row-stats">
                    <span>{s.viewers} viewers</span>
                    <span>{s.kbps} kbps</span>
                    <span>{formatUptime(s.uptime_seconds)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Admin accounts breakdown ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2>Accounts</h2>
          </div>
          <div className="sad-bars">
            {adminsByRole.map((r) => (
              <StatBar
                key={r.role}
                label={r.role.replace("_", " ")}
                value={r.count}
                max={Math.max(...adminsByRole.map((x) => x.count), 1)}
                accent={
                  r.role === "super_admin"
                    ? "orange"
                    : r.role === "admin"
                      ? "blue"
                      : "green"
                }
              />
            ))}
          </div>
        </section>

        {/* ── Recent recordings across all orgs ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2>Recent Recordings</h2>
            <span className="sad-card-sub">across all organizations</span>
          </div>
          {recentRecordings.length === 0 ? (
            <div className="sad-empty">No recordings yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="sad-table">
                <thead>
                  <tr>
                    <th>Organization</th>
                    <th>Channel</th>
                    <th>Size</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRecordings.map((r) => (
                    <tr key={r.id}>
                      <td>{r.organization_name || "—"}</td>
                      <td>{r.channel_name || "—"}</td>
                      <td>{formatBytes(r.file_size_bytes)}</td>
                      <td>{timeAgo(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Plan-limit alerts across all organizations ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2>Plan Alerts</h2>
            <span className="sad-card-sub">
              Bitrate cap warnings and kicks across every organization
            </span>
          </div>
          {planAlerts.length === 0 ? (
            <div className="sad-empty sad-empty--good">
              No plan violations logged. All clear.
            </div>
          ) : (
            <div className="sad-error-list">
              {planAlerts.slice(0, 15).map((a) => (
                <div key={a.id} className="sad-error-row">
                  <span className="sad-error-time">
                    {timeAgo(a.created_at)}
                  </span>
                  <span
                    className="sad-error-msg"
                    style={
                      a.alert_type === "bitrate_kick"
                        ? { color: "#fca5a5" }
                        : undefined
                    }
                  >
                    <strong>{a.organization_name}</strong> — {a.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Recent errors ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2>Recent Errors</h2>
            <span className="sad-card-sub">
              {selectedOrg?.id
                ? `filtered to ${selectedOrg.name} · ${errorLog.length} of ${errorLogTotal} total`
                : `since last server restart · ${errorLogTotal} logged`}
            </span>
          </div>
          {errorLog.length === 0 ? (
            <div className="sad-empty sad-empty--good">
              No errors logged. All clear.
            </div>
          ) : (
            <div className="sad-error-list">
              {errorLog.slice(0, 15).map((e, i) => (
                <div
                  key={
                    e.id || `${e.at || "unknown"}-${e.message || "error"}-${i}`
                  }
                  className="sad-error-row"
                >
                  <span className="sad-error-time">{timeAgo(e.at)}</span>
                  <span className="sad-error-msg">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Danger Zone: gated server / SRS restart ── */}
        <section className="card sad-card sad-card--wide">
          <div className="sad-card-header">
            <h2 style={{ color: "#fca5a5" }}>Danger Zone</h2>
            <span className="sad-card-sub">
              Restart actions — logged, and gated behind typed confirmation when
              streams are active
            </span>
          </div>

          {dangerResult && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(74,222,128,0.3)",
                background: "rgba(74,222,128,0.08)",
                color: "#86efac",
                fontSize: "13px",
              }}
            >
              {dangerResult.message}
            </div>
          )}

          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <button
              onClick={() => openDangerDialog("backend")}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(251,191,36,0.4)",
                background: "rgba(251,191,36,0.1)",
                color: "#fcd34d",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Restart Backend Service
            </button>
            <button
              onClick={() => openDangerDialog("srs")}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(248,113,113,0.4)",
                background: "rgba(248,113,113,0.1)",
                color: "#fca5a5",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Restart SRS Media Server
            </button>
          </div>

          <div
            style={{ color: "#94a3b8", fontSize: "12px", marginBottom: "8px" }}
          >
            Recent restart history
          </div>
          {auditLog.length === 0 ? (
            <div className="sad-empty">No restarts logged yet.</div>
          ) : (
            <div className="sad-error-list">
              {auditLog.map((entry) => {
                const isAuto = entry.action === "srs-auto";
                return (
                  <div key={entry.id} className="sad-error-row">
                    <span className="sad-error-time">
                      {timeAgo(entry.created_at)}
                    </span>
                    <span className="sad-error-msg">
                      {isAuto ? (
                        <>
                          <strong style={{ color: "#fcd34d" }}>
                            Auto-recovery
                          </strong>{" "}
                          restarted <strong>SRS</strong> after repeated failed
                          health checks
                        </>
                      ) : (
                        <>
                          <strong>{entry.admin_email || "unknown"}</strong>{" "}
                          restarted{" "}
                          <strong>
                            {entry.action === "srs" ? "SRS" : "backend"}
                          </strong>
                          {entry.active_streams_at_time > 0
                            ? ` while ${entry.active_streams_at_time} stream(s) were live (${entry.affected_organizations || "—"})`
                            : " with no active streams"}
                        </>
                      )}
                      {entry.reason ? ` — "${entry.reason}"` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── AI Support Assistant: floating widget, bottom-right ── */}
      <button
        type="button"
        className="sad-assistant-fab"
        onClick={() => setAssistantOpen((prev) => !prev)}
        aria-label={
          assistantOpen
            ? "Close AI Support Assistant"
            : "Open AI Support Assistant"
        }
        aria-expanded={assistantOpen}
      >
        {assistantOpen ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>

      {assistantOpen && (
        <div className="sad-assistant-panel">
          <div className="sad-assistant-header">
            <div>
              <h2>AI Support Assistant</h2>
              <p>
                {selectedOrg?.id
                  ? `Scoped to ${selectedOrg.name}`
                  : "Platform-wide — select an org in Support Mode to scope"}
              </p>
            </div>
            <button
              type="button"
              className="sad-assistant-close"
              onClick={() => setAssistantOpen(false)}
              aria-label="Close AI Support Assistant"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="sad-assistant-messages">
            {assistantMessages.length === 0 && (
              <div className="sad-empty">
                Ask something like "why isn't{" "}
                {selectedOrg?.name || "Test Church"}'s stream showing up" or "is
                anything wrong with the server right now".
              </div>
            )}
            {assistantMessages.map((msg, i) => (
              <div key={i}>
                <div className="sad-assistant-q">
                  {msg.question}
                  {msg.organizationName && (
                    <span> ({msg.organizationName})</span>
                  )}
                </div>
                <div className="sad-assistant-a">{msg.answer}</div>
              </div>
            ))}
          </div>

          {assistantError && (
            <div className="sad-assistant-error">{assistantError}</div>
          )}

          <div className="sad-assistant-input-row">
            <input
              type="text"
              value={assistantQuestion}
              onChange={(e) => setAssistantQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !assistantBusy)
                  submitAssistantQuestion();
              }}
              placeholder="Ask about server health, errors, or a specific org's stream..."
              autoFocus
            />
            <button
              onClick={submitAssistantQuestion}
              disabled={assistantBusy || !assistantQuestion.trim()}
            >
              {assistantBusy ? "Thinking…" : "Ask"}
            </button>
          </div>
        </div>
      )}

      {/* ── Danger Zone confirm dialog ── */}
      {dangerAction && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "440px",
              maxWidth: "90vw",
              borderRadius: "12px",
              border: "1px solid rgba(248,113,113,0.35)",
              background: "#0f172a",
              padding: "20px",
            }}
          >
            <h3 style={{ margin: "0 0 8px", color: "#fca5a5" }}>
              {dangerAction === "srs"
                ? "Restart SRS Media Server"
                : "Restart Backend Service"}
            </h3>

            {!dangerSnapshot ? (
              <div style={{ color: "#94a3b8", fontSize: "13px" }}>
                Checking active streams…
              </div>
            ) : (
              <>
                {dangerSnapshot.srsAvailable === false && (
                  <div
                    style={{
                      color: "#fcd34d",
                      fontSize: "13px",
                      marginBottom: "10px",
                    }}
                  >
                    Couldn't reach SRS to confirm active streams — proceed with
                    extra caution.
                  </div>
                )}
                {dangerSnapshot.count > 0 ? (
                  <div
                    style={{
                      color: "#fca5a5",
                      fontSize: "13px",
                      marginBottom: "12px",
                    }}
                  >
                    <strong>
                      {dangerSnapshot.count} stream(s) are currently live
                    </strong>
                    {dangerAction === "srs"
                      ? " and will be dropped immediately if you continue: "
                      : " — the backend restart won't stop them, but chat/reactions will briefly disconnect for: "}
                    {dangerSnapshot.activeStreams
                      .map((s) => s.organization_name)
                      .join(", ")}
                  </div>
                ) : (
                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: "13px",
                      marginBottom: "12px",
                    }}
                  >
                    No active streams right now — low risk.
                  </div>
                )}

                <div
                  style={{
                    color: "#cbd5e1",
                    fontSize: "13px",
                    marginBottom: "6px",
                  }}
                >
                  Type <strong>{requiredConfirmText()}</strong> to confirm:
                </div>
                <input
                  type="text"
                  value={dangerConfirmText}
                  onChange={(e) => setDangerConfirmText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(148,163,184,0.3)",
                    background: "rgba(148,163,184,0.06)",
                    color: "#e2e8f0",
                    marginBottom: "10px",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="text"
                  placeholder="Reason (optional, but shows up in the audit log)"
                  value={dangerReason}
                  onChange={(e) => setDangerReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(148,163,184,0.3)",
                    background: "rgba(148,163,184,0.06)",
                    color: "#e2e8f0",
                    marginBottom: "14px",
                    boxSizing: "border-box",
                  }}
                />

                {dangerError && (
                  <div
                    style={{
                      color: "#fca5a5",
                      fontSize: "12px",
                      marginBottom: "10px",
                    }}
                  >
                    {dangerError}
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                  }}
                >
                  <button
                    onClick={closeDangerDialog}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(148,163,184,0.3)",
                      background: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDangerAction}
                    disabled={
                      dangerBusy || dangerConfirmText !== requiredConfirmText()
                    }
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(248,113,113,0.4)",
                      background:
                        dangerConfirmText === requiredConfirmText()
                          ? "rgba(248,113,113,0.2)"
                          : "rgba(248,113,113,0.06)",
                      color: "#fca5a5",
                      cursor:
                        dangerBusy ||
                        dangerConfirmText !== requiredConfirmText()
                          ? "default"
                          : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {dangerBusy ? "Restarting…" : "Confirm Restart"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperAdminDashboard;
