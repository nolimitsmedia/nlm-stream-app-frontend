import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import api from "./api";
import { useSubscription } from "./SubscriptionContext.jsx";

const SOCKET_URL = import.meta.env.VITE_API_BASE;

/* ── Chart palette ── */
const CHART_COLORS = {
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a78bfa",
  orange: "#fb923c",
};

const AXIS_TICK = { fill: "#64748b", fontSize: 11 };
const AXIS_LINE = { stroke: "rgba(255,255,255,0.08)" };
const GRID_STROKE = "rgba(255,255,255,0.06)";

/* ── Helpers ── */
function formatDuration(seconds) {
  const s = Math.max(0, Number(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function getStoredOrganizationId() {
  return localStorage.getItem("nlm_organization_id") || "";
}

function truncateLabel(label, max = 22) {
  const text = String(label || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/* ── Sub-components ── */
function MetricCard({ label, value, icon, accent = "blue" }) {
  return (
    <div className={`an-metric-card an-metric--${accent}`}>
      {icon && <div className="an-metric-icon">{icon}</div>}
      <span className="an-metric-label">{label}</span>
      <strong className="an-metric-value">{value}</strong>
    </div>
  );
}

function PanelHeader({ title, sub, badge }) {
  return (
    <div className="an-panel-header">
      <div>
        <h3 className="an-panel-title">{title}</h3>
        {sub && <p className="an-panel-sub">{sub}</p>}
      </div>
      {badge != null && <span className="an-panel-badge">{badge}</span>}
    </div>
  );
}

function EmptyState({ title, sub }) {
  return (
    <div className="an-empty">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 3h18v18H3z" opacity=".2" />
        <path d="M9 9h6M9 12h6M9 15h4" />
      </svg>
      <strong>{title}</strong>
      {sub && <p>{sub}</p>}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="an-skeleton-wrap">
      <div className="an-skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="an-skeleton-tile" />
        ))}
      </div>
      <div className="an-skeleton-panel" />
      <div className="an-skeleton-panel" />
    </div>
  );
}

/* ── Chart tooltip ── */
function ChartTooltip({ active, payload, label, formatValue, formatLabel }) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="an-chart-tooltip">
      <div className="an-chart-tooltip-label">
        {formatLabel ? formatLabel(label, point.payload) : label}
      </div>
      <div className="an-chart-tooltip-row">
        <span
          className="an-chart-tooltip-dot"
          style={{ background: point.color || point.fill }}
        />
        <strong>
          {formatValue ? formatValue(point.value, point.payload) : point.value}
        </strong>
      </div>
    </div>
  );
}

function ChartEmpty({ title, sub, height = 220 }) {
  return (
    <div style={{ height }} className="an-chart-empty-wrap">
      <EmptyState title={title} sub={sub} />
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
function AnalyticsPage() {
  const {
    subscription,
    loading: subscriptionLoading,
    isActive,
    hasFeature,
  } = useSubscription();
  const analyticsAllowed = hasFeature("analytics_enabled");

  const [days, setDays] = useState(7);
  const [organizationId, setOrganizationId] = useState(getStoredOrganizationId);
  const [summary, setSummary] = useState(null);
  const [streams, setStreams] = useState([]);
  const [daily, setDaily] = useState([]);
  const [activeStreams, setActiveStreams] = useState([]);
  const [viewerTimeline, setViewerTimeline] = useState([]);
  const [watchTimeTrend, setWatchTimeTrend] = useState([]);
  const [retention, setRetention] = useState([]);
  const [devices, setDevices] = useState([]);
  const [geography, setGeography] = useState([]);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const loadAnalytics = async () => {
    if (subscriptionLoading || !isActive || !analyticsAllowed) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const orgId = organizationId || getStoredOrganizationId();

      if (!orgId) {
        setSummary(null);
        setStreams([]);
        setDaily([]);
        setActiveStreams([]);
        setViewerTimeline([]);
        setWatchTimeTrend([]);
        setRetention([]);
        setDevices([]);
        setGeography([]);
        setError("Please select a tenant before loading analytics.");
        return;
      }

      const res = await api.get(
        `/api/analytics/summary?days=${days}&organization_id=${orgId}`,
      );
      setSummary(res.data.summary || null);
      setStreams(res.data.streams || []);
      setDaily(res.data.daily || []);
      setActiveStreams(res.data.active_streams || []);
      setViewerTimeline(res.data.viewer_timeline || []);
      setWatchTimeTrend(res.data.watch_time_trend || []);
      setRetention(res.data.retention || []);
      setDevices(res.data.devices || []);
      setGeography(res.data.geography || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      setOrganizationId(e.detail?.organizationId || getStoredOrganizationId());
    };
    window.addEventListener("nlm-organization-changed", handler);
    return () =>
      window.removeEventListener("nlm-organization-changed", handler);
  }, []);

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, organizationId]);

  useEffect(() => {
    const orgId = organizationId || getStoredOrganizationId();
    if (!orgId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    const applyPayload = (payload = {}) => {
      if (!payload?.ok) return;
      setSummary(payload.summary || null);
      setStreams(payload.streams || []);
      setDaily(payload.daily || []);
      setActiveStreams(payload.active_streams || []);
      setViewerTimeline(payload.viewer_timeline || []);
      setWatchTimeTrend(payload.watch_time_trend || []);
      setRetention(payload.retention || []);
      setDevices(payload.devices || []);
      setGeography(payload.geography || []);
      setLoading(false);
    };

    socket.on("connect", () => {
      setRealtimeConnected(true);
      socket.emit("analytics:join", {
        organizationId: orgId,
        days: Number(days || 7),
      });
    });
    socket.on("disconnect", () => setRealtimeConnected(false));
    socket.on("analytics:update", applyPayload);
    socket.on("analytics:error", (p = {}) => {
      if (p.message) setError(p.message);
    });

    return () => {
      socket.disconnect();
      setRealtimeConnected(false);
    };
  }, [organizationId, days]);

  /* Derived summary values */
  const totalSessions = Number(summary?.total_sessions || 0);
  const uniqueViewers = Number(summary?.unique_viewers || 0);
  const totalWatchSeconds = Number(summary?.total_watch_seconds || 0);
  const avgWatchSeconds = Number(summary?.avg_watch_seconds || 0);
  const currentActiveViewers = activeStreams.reduce(
    (t, s) => t + Number(s.active_viewers || 0),
    0,
  );
  const highestPeak = Math.max(
    ...streams.map((s) => Number(s.peak_viewers || 0)),
    0,
  );

  /* CSV exports */
  const exportCsv = async () => {
    try {
      setExporting(true);
      setError("");
      const orgId = organizationId || getStoredOrganizationId();
      if (!orgId) {
        setError("Please select a tenant before exporting.");
        return;
      }
      const res = await api.get(
        `/api/analytics/export.csv?days=${days}&organization_id=${orgId}`,
        { responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `viewer-analytics-${days}d.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export CSV.");
    } finally {
      setExporting(false);
    }
  };

  /* ── Render ── */
  if (subscriptionLoading) {
    return <LoadingSkeleton />;
  }

  if (!isActive || !analyticsAllowed) {
    return (
      <section className="card analytics-page an-page">
        <div className="an-empty">
          <strong>
            {!isActive ? "Subscription inactive" : "Analytics not included"}
          </strong>
          <p>
            {!isActive
              ? "Activate this organization’s subscription to access analytics."
              : `The ${subscription?.plan_name || "current"} plan does not include analytics.`}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card analytics-page an-page">
      {/* ── Toolbar ── */}
      <div className="an-toolbar">
        <div className="an-toolbar-left">
          <div className="an-page-icon">
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
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <div>
            <h2 className="an-page-title">Analytics</h2>
            <p className="an-page-sub">
              Track viewer sessions, watch time, peak viewers, and stream
              performance.
            </p>
          </div>
        </div>

        <div className="an-toolbar-right">
          {/* Realtime badge */}
          <span
            className={`an-realtime-badge${realtimeConnected ? " an-realtime-badge--on" : ""}`}
          >
            <span className="an-realtime-dot" />
            {realtimeConnected ? "Live" : "Offline"}
          </span>

          {/* Day selector */}
          <div className="an-select-wrap">
            <svg
              className="an-select-icon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <select
              className="an-select"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>

          <button
            className="an-btn an-btn--ghost"
            onClick={loadAnalytics}
            disabled={loading}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={loading ? "an-spin" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button
            className="an-btn an-btn--primary"
            onClick={exportCsv}
            disabled={exporting}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="an-banner an-banner--error">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !summary ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* ── Live summary metrics ── */}
          <div className="an-metrics-grid">
            <MetricCard
              label="Active Viewers"
              value={currentActiveViewers}
              accent="green"
              icon={
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
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              }
            />
            <MetricCard
              label="Total Sessions"
              value={totalSessions}
              accent="blue"
              icon={
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
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
            <MetricCard
              label="Unique Viewers"
              value={uniqueViewers}
              accent="purple"
              icon={
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
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />
            <MetricCard
              label="Peak Viewers"
              value={highestPeak}
              accent="orange"
              icon={
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
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              }
            />
            <MetricCard
              label="Total Watch Time"
              value={formatDuration(totalWatchSeconds)}
              accent="blue"
              icon={
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
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <MetricCard
              label="Avg. Watch Time"
              value={formatDuration(avgWatchSeconds)}
              accent="green"
              icon={
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
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              }
            />
          </div>

          {/* ── Realtime timeline + Watch-time trend ── */}
          <div className="analytics-layout-grid an-layout-grid">
            <section className="analytics-panel an-panel">
              <PanelHeader
                title="Realtime Viewer Timeline"
                sub="Hourly viewer presence based on session overlap."
              />
              {viewerTimeline.length === 0 ? (
                <ChartEmpty
                  title="No timeline data yet."
                  sub="Open a public watch page to start building viewer history."
                />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={viewerTimeline.slice(-24)}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="an-grad-timeline"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.blue}
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.blue}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tickFormatter={(v) =>
                        new Date(v).toLocaleTimeString([], { hour: "numeric" })
                      }
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.12)" }}
                      content={
                        <ChartTooltip
                          formatLabel={(label) =>
                            new Date(label).toLocaleTimeString([], {
                              hour: "numeric",
                            })
                          }
                          formatValue={(v) => `${v} viewer${v === 1 ? "" : "s"}`}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="active_viewers"
                      stroke={CHART_COLORS.blue}
                      strokeWidth={2.5}
                      fill="url(#an-grad-timeline)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="analytics-panel an-panel">
              <PanelHeader
                title="Watch-Time Trend"
                sub="Total watch time by day."
              />
              {watchTimeTrend.length === 0 ? (
                <ChartEmpty
                  title="No watch-time trend yet."
                  sub="Viewer duration will appear after public watch activity."
                />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart
                    data={watchTimeTrend}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="an-grad-watchtime"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.purple}
                          stopOpacity={0.4}
                        />
                        <stop
                          offset="95%"
                          stopColor={CHART_COLORS.purple}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={(v) => formatDuration(v)}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.12)" }}
                      content={
                        <ChartTooltip
                          formatLabel={(label) =>
                            new Date(label).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })
                          }
                          formatValue={(v) => formatDuration(v)}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="total_watch_seconds"
                      stroke={CHART_COLORS.purple}
                      strokeWidth={2.5}
                      fill="url(#an-grad-watchtime)"
                      dot={{ r: 3, fill: CHART_COLORS.purple, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          {/* ── Daily sessions + Active streams ── */}
          <div className="analytics-layout-grid an-layout-grid">
            <section className="analytics-panel an-panel">
              <PanelHeader
                title="Daily Viewer Sessions"
                sub="Session volume by day."
              />
              {daily.length === 0 ? (
                <ChartEmpty
                  title="No daily data yet."
                  sub="Open a public watch page to start recording sessions."
                />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={daily}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(v) =>
                        new Date(v).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={
                        <ChartTooltip
                          formatLabel={(label) =>
                            new Date(label).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })
                          }
                          formatValue={(v) =>
                            `${v} session${v === 1 ? "" : "s"}`
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="total_sessions"
                      fill={CHART_COLORS.orange}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={44}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="analytics-panel an-panel">
              <PanelHeader
                title="Active Streams"
                sub="Current public viewers by stream."
              />
              {activeStreams.length === 0 ? (
                <ChartEmpty
                  title="No active public viewers."
                  sub="Current sessions will appear here while viewers are live."
                />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, activeStreams.length * 42)}
                >
                  <BarChart
                    data={activeStreams.map((s) => ({
                      label: s.stream_key,
                      value: Number(s.active_viewers || 0),
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={130}
                      tickFormatter={truncateLabel}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={
                        <ChartTooltip
                          formatValue={(v) => `${v} live viewer${v === 1 ? "" : "s"}`}
                        />
                      }
                    />
                    <Bar
                      dataKey="value"
                      fill={CHART_COLORS.green}
                      radius={[0, 6, 6, 0]}
                      maxBarSize={22}
                      isAnimationActive
                    >
                      <LabelList
                        dataKey="value"
                        position="right"
                        fill="#e2e8f0"
                        fontSize={11}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          {/* ── Device breakdown + Geography ── */}
          <div className="analytics-layout-grid an-layout-grid">
            <section className="analytics-panel an-panel">
              <PanelHeader
                title="Device Breakdown"
                sub="Sessions by device, browser, and OS."
                badge={`${devices.length} Type(s)`}
              />
              {devices.length === 0 ? (
                <ChartEmpty
                  title="No device data yet."
                  sub="Device analytics appear after public watch activity."
                />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, devices.length * 42)}
                >
                  <BarChart
                    data={devices.map((item) => ({
                      label: `${item.device_type} · ${item.browser_name} · ${item.os_name}`,
                      value: Number(item.sessions || 0),
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={150}
                      tickFormatter={truncateLabel}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={
                        <ChartTooltip
                          formatValue={(v) => `${v} session${v === 1 ? "" : "s"}`}
                        />
                      }
                    />
                    <Bar
                      dataKey="value"
                      fill={CHART_COLORS.blue}
                      radius={[0, 6, 6, 0]}
                      maxBarSize={22}
                    >
                      <LabelList
                        dataKey="value"
                        position="right"
                        fill="#e2e8f0"
                        fontSize={11}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="analytics-panel an-panel">
              <PanelHeader
                title="Geographic Analytics"
                sub="Viewer location based on request headers / CDN data."
                badge={`${geography.length} Location(s)`}
              />
              {geography.length === 0 ? (
                <ChartEmpty
                  title="No geographic data yet."
                  sub="Local testing will show as Local / Unknown."
                />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(180, geography.length * 42)}
                >
                  <BarChart
                    data={geography.map((item) => ({
                      label: item.country_name || item.country_code,
                      value: Number(item.sessions || 0),
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={130}
                      tickFormatter={truncateLabel}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={
                        <ChartTooltip
                          formatValue={(v) => `${v} session${v === 1 ? "" : "s"}`}
                        />
                      }
                    />
                    <Bar
                      dataKey="value"
                      fill={CHART_COLORS.green}
                      radius={[0, 6, 6, 0]}
                      maxBarSize={22}
                    >
                      <LabelList
                        dataKey="value"
                        position="right"
                        fill="#e2e8f0"
                        fontSize={11}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          {/* ── Retention buckets ── */}
          <section className="analytics-panel an-panel analytics-table-panel">
            <PanelHeader
              title="Retention Buckets"
              sub="How long viewers stayed during the selected range."
              badge={`${retention.length} Bucket(s)`}
            />
            {retention.length === 0 ? (
              <ChartEmpty
                title="No retention data yet."
                sub="Retention buckets appear after completed viewer sessions."
              />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={retention.map((item) => ({
                    label: item.bucket,
                    value: Number(item.sessions || 0),
                  }))}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    axisLine={AXIS_LINE}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={
                      <ChartTooltip
                        formatValue={(v) => `${v} session${v === 1 ? "" : "s"}`}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={54}>
                    {retention.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS.orange}
                        fillOpacity={1 - i * 0.13}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* ── Stream performance ── */}
          <section className="analytics-panel an-panel analytics-table-panel">
            <PanelHeader
              title="Stream Performance"
              sub="Top streams by viewer sessions in the selected range."
              badge={`${streams.length} Stream(s)`}
            />
            {streams.length === 0 ? (
              <EmptyState
                title="No stream analytics yet."
                sub="Viewer sessions will appear after public watch activity."
              />
            ) : (
              <>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(200, streams.length * 50)}
                >
                  <BarChart
                    data={streams.map((s) => ({
                      label: s.stream_key,
                      sessions: Number(s.total_sessions || 0),
                      unique: Number(s.unique_viewers || 0),
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                    barGap={4}
                  >
                    <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={150}
                      tickFormatter={truncateLabel}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="an-chart-tooltip">
                            <div className="an-chart-tooltip-label">
                              {label}
                            </div>
                            {payload.map((p) => (
                              <div key={p.dataKey} className="an-chart-tooltip-row">
                                <span
                                  className="an-chart-tooltip-dot"
                                  style={{ background: p.fill }}
                                />
                                <span>
                                  {p.dataKey === "sessions"
                                    ? "Sessions"
                                    : "Unique viewers"}
                                </span>
                                <strong>{p.value}</strong>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="sessions"
                      name="Sessions"
                      fill={CHART_COLORS.blue}
                      radius={[0, 6, 6, 0]}
                      maxBarSize={16}
                    />
                    <Bar
                      dataKey="unique"
                      name="Unique viewers"
                      fill={CHART_COLORS.purple}
                      radius={[0, 6, 6, 0]}
                      maxBarSize={16}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="an-chart-legend">
                  <span>
                    <i style={{ background: CHART_COLORS.blue }} />
                    Sessions
                  </span>
                  <span>
                    <i style={{ background: CHART_COLORS.purple }} />
                    Unique viewers
                  </span>
                </div>
              </>
            )}
            {streams.length > 0 && (
              <div className="table-wrap">
                <table className="analytics-table an-table">
                  <thead>
                    <tr>
                      <th>Stream</th>
                      <th>Sessions</th>
                      <th>Unique Viewers</th>
                      <th>Peak</th>
                      <th>Total Watch</th>
                      <th>Avg. Watch</th>
                      <th>Last Viewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {streams.map((s) => (
                      <tr key={s.stream_key}>
                        <td>
                          <span className="an-stream-key">{s.stream_key}</span>
                        </td>
                        <td>{s.total_sessions}</td>
                        <td>{s.unique_viewers}</td>
                        <td>{s.peak_viewers || 0}</td>
                        <td>{formatDuration(s.total_watch_seconds)}</td>
                        <td>{formatDuration(s.avg_watch_seconds)}</td>
                        <td>{formatDate(s.last_viewed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export default AnalyticsPage;
