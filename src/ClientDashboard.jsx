import { useEffect, useMemo, useState } from "react";
import api from "./api";
import DashboardCards from "./DashboardCards";

function getStoredAdmin() {
  try {
    return JSON.parse(localStorage.getItem("nlm_admin") || "{}");
  } catch {
    return {};
  }
}

function getStoredOrganization() {
  try {
    return JSON.parse(localStorage.getItem("nlm_current_organization") || "{}");
  } catch {
    return {};
  }
}

function getPublicRoute(path) {
  const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${appBase}${path}`;
}

/* ── Tool shortcuts config ── */
const TOOLS = [
  {
    key: "Overlays",
    label: "Overlays",
    desc: "Lower thirds, Bible verses, announcements",
    icon: (
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
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    accent: "blue",
  },
  {
    key: "Prayer Requests",
    label: "Prayer Requests",
    desc: "Review and mark viewer requests",
    icon: (
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
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    accent: "purple",
  },
  {
    key: "Chat Moderation",
    label: "Chat Moderation",
    desc: "Pin, hide, and restore chat messages",
    icon: (
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    accent: "green",
  },
  {
    key: "CTA Links",
    label: "CTA Links",
    desc: "Donation and action links",
    icon: (
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
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
    accent: "orange",
  },
];

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
function ClientDashboard({ streams = [], loading = false, setActivePage }) {
  const [organization, setOrganization] = useState(getStoredOrganization);
  const [channels, setChannels] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");
  const [subscription, setSubscription] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [dismissingAlertId, setDismissingAlertId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const admin = useMemo(() => getStoredAdmin(), []);
  const isPlatformAdmin = admin.role === "super_admin";

  const nextSchedule = useMemo(() => {
    const now = Date.now();
    return schedules
      .filter((item) => {
        const start = item.scheduled_start
          ? new Date(item.scheduled_start).getTime()
          : 0;
        return item.status !== "cancelled" && start >= now - 1000 * 60 * 60 * 6;
      })
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() -
          new Date(b.scheduled_start).getTime(),
      )[0];
  }, [schedules]);

  const primaryChannel = channels[0];
  const liveCount = streams.filter((s) => s.publish?.active).length;

  const loadDashboardData = async () => {
    try {
      setLoadingData(true);
      setError("");
      const [channelsRes, schedulesRes, subscriptionRes] = await Promise.all([
        api.get("/api/channels"),
        api.get("/api/schedules"),
        api.get("/api/subscription/current"),
      ]);
      setChannels(channelsRes.data.channels || []);
      setSchedules(schedulesRes.data.schedules || []);
      setSubscription(subscriptionRes.data.subscription || null);

      // Fetched separately (not in the Promise.all above) so a failure here
      // can't take down the rest of the dashboard — this endpoint is newer
      // and less battle-tested than the others.
      try {
        const alertsRes = await api.get("/api/organization/alerts");
        setAlerts(alertsRes.data.alerts || []);
      } catch {
        setAlerts([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load dashboard data.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const handleOrgChange = (e) => {
      setOrganization(e.detail?.organization || getStoredOrganization());
      loadDashboardData();
    };
    window.addEventListener("nlm-organization-changed", handleOrgChange);
    loadDashboardData();
    return () =>
      window.removeEventListener("nlm-organization-changed", handleOrgChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyWatchLink = async (streamKey) => {
    if (!streamKey) return;
    await navigator.clipboard.writeText(getPublicRoute(`/watch/${streamKey}`));
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 1800);
  };

  const openWatchPage = (streamKey) => {
    if (!streamKey) return;
    window.open(
      getPublicRoute(`/watch/${streamKey}`),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      setDismissingAlertId(alertId);
      await api.post(`/api/organization/alerts/${alertId}/acknowledge`);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // Leave it in the list — the alert is still real even if the
      // dismiss request failed, so don't silently make it disappear.
    } finally {
      setDismissingAlertId(null);
    }
  };

  return (
    <div className="cd-page">
      {/* ── Hero banner ── */}
      <section className="cd-hero">
        <div className="cd-hero-glow" />
        <div className="cd-hero-content">
          <div className="cd-hero-left">
            <span className="cd-eyebrow">
              {isPlatformAdmin ? "Tenant Dashboard" : "Client Dashboard"}
            </span>
            <h2 className="cd-hero-title">
              {organization.name || "Streaming Dashboard"}
            </h2>
            <p className="cd-hero-sub">
              Manage livestreams, schedules, overlays, engagement, and watch
              links for this organization.
            </p>

            <div className="cd-hero-actions">
              <button
                type="button"
                className="cd-btn-primary"
                onClick={() => setActivePage("Channels")}
              >
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
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                Manage Channels
              </button>
              <button
                type="button"
                className="cd-btn-ghost"
                onClick={() => setActivePage("Scheduled Streams")}
              >
                Schedule Stream
              </button>
              <button
                type="button"
                className="cd-btn-ghost"
                onClick={() => setActivePage("Subscription")}
              >
                View Plan
              </button>
            </div>
          </div>

          {/* Live status indicators */}
          <div className="cd-hero-stats">
            <div className="cd-hero-stat">
              <div
                className={`cd-hero-stat-dot${liveCount > 0 ? " cd-dot--live" : ""}`}
              />
              <span className="cd-hero-stat-label">Live Now</span>
              <strong className="cd-hero-stat-value">{liveCount}</strong>
            </div>
            <div className="cd-hero-stat">
              <span className="cd-hero-stat-label">Channels</span>
              <strong className="cd-hero-stat-value">{channels.length}</strong>
            </div>
            <div className="cd-hero-stat">
              <span className="cd-hero-stat-label">Upcoming</span>
              <strong className="cd-hero-stat-value">
                {
                  schedules.filter(
                    (s) => s.status !== "cancelled" && s.status !== "ended",
                  ).length
                }
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stream cards from DashboardCards ── */}
      <DashboardCards streams={streams} />

      {/* ── Subscription banner ── */}
      {subscription && (
        <div className="cd-sub-banner">
          <div className="cd-sub-banner-left">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <strong>{subscription.plan_name} Plan</strong>
            <span
              className={`cd-sub-status cd-sub-status--${subscription.status}`}
            >
              {subscription.status}
            </span>
          </div>
          <div className="cd-sub-banner-right">
            <span>
              Channels:{" "}
              <b>
                {subscription.used_channels || channels.length} /{" "}
                {subscription.max_channels}
              </b>
            </span>
            <span className="cd-sub-sep">·</span>
            <span>
              Admins:{" "}
              <b>
                {subscription.used_admins || 0} / {subscription.max_admins}
              </b>
            </span>
            {subscription.max_storage_gb > 0 && (
              <>
                <span className="cd-sub-sep">·</span>
                <span>
                  Storage:{" "}
                  <b>
                    {(
                      Number(subscription.used_storage_bytes || 0) /
                      1024 ** 3
                    ).toFixed(1)}{" "}
                    / {subscription.max_storage_gb}GB
                  </b>
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Plan-limit alerts (bitrate violations, etc.) ── */}
      {alerts.length > 0 && (
        <div className="cd-alerts-stack">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`cd-alert-banner cd-alert-banner--${alert.alert_type === "bitrate_kick" ? "critical" : "warning"}`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="cd-alert-message">{alert.message}</span>
              <button
                type="button"
                className="cd-alert-dismiss"
                disabled={dismissingAlertId === alert.id}
                onClick={() => acknowledgeAlert(alert.id)}
              >
                {dismissingAlertId === alert.id ? "..." : "Dismiss"}
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="cd-error-banner">
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

      {/* ── Two-panel row: Quick Start + Next Broadcast ── */}
      <div className="cd-panels-grid">
        {/* Quick Start */}
        <section className="cd-panel card">
          <div className="cd-panel-header">
            <div className="cd-panel-icon cd-icon--blue">
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
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
            </div>
            <div>
              <h2 className="cd-panel-title">Quick Start</h2>
              <p className="cd-panel-sub">
                Use these links when preparing a broadcast.
              </p>
            </div>
          </div>

          {loadingData ? (
            <div className="cd-loading">
              <div className="cd-spinner" />
              <span>Loading channels…</span>
            </div>
          ) : !primaryChannel ? (
            <div className="cd-empty">
              <strong>No channel created yet.</strong>
              <p>Create a channel to generate stream and watch links.</p>
              <button
                type="button"
                className="cd-btn-primary cd-btn-sm"
                onClick={() => setActivePage("Channels")}
              >
                Create Channel
              </button>
            </div>
          ) : (
            <div className="cd-quick-stack">
              <div className="cd-quick-row">
                <span>Primary Channel</span>
                <strong>{primaryChannel.name}</strong>
              </div>
              <div className="cd-quick-row cd-quick-row--mono">
                <span>Stream Key</span>
                <strong>{primaryChannel.stream_key}</strong>
              </div>
              <div className="cd-quick-actions">
                <button
                  type="button"
                  className={`cd-btn-ghost cd-btn-sm${copiedKey ? " cd-btn--copied" : ""}`}
                  onClick={() =>
                    copyWatchLink(
                      primaryChannel.playback_id || primaryChannel.stream_key,
                    )
                  }
                >
                  {copiedKey ? (
                    <>
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
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Watch Link
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="cd-btn-primary cd-btn-sm"
                  onClick={() =>
                    openWatchPage(
                      primaryChannel.playback_id || primaryChannel.stream_key,
                    )
                  }
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
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open Watch Page
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Next Broadcast */}
        <section className="cd-panel card">
          <div className="cd-panel-header">
            <div className="cd-panel-icon cd-icon--orange">
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h2 className="cd-panel-title">Next Broadcast</h2>
              <p className="cd-panel-sub">
                Upcoming scheduled stream for this tenant.
              </p>
            </div>
          </div>

          {loadingData ? (
            <div className="cd-loading">
              <div className="cd-spinner" />
              <span>Loading schedules…</span>
            </div>
          ) : !nextSchedule ? (
            <div className="cd-empty">
              <strong>No upcoming stream.</strong>
              <p>Create a schedule to show countdowns on public watch pages.</p>
              <button
                type="button"
                className="cd-btn-ghost cd-btn-sm"
                onClick={() => setActivePage("Scheduled Streams")}
              >
                Add Schedule
              </button>
            </div>
          ) : (
            <div className="cd-broadcast-card">
              <div className="cd-broadcast-header">
                <span className={`schedule-status ${nextSchedule.status}`}>
                  {nextSchedule.status || "scheduled"}
                </span>
                {nextSchedule.status === "live" && (
                  <span className="cd-live-dot" />
                )}
              </div>
              <h3 className="cd-broadcast-title">{nextSchedule.title}</h3>
              <p className="cd-broadcast-desc">
                {nextSchedule.description || "No description added."}
              </p>
              <div className="cd-broadcast-meta">
                <span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  {nextSchedule.stream_key}
                </span>
                <span>
                  <svg
                    width="12"
                    height="12"
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
                  {new Date(nextSchedule.scheduled_start).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Tenant tools grid ── */}
      <section className="cd-tools-section card">
        <div className="cd-tools-header">
          <div className="cd-panel-icon cd-icon--purple">
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
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <div>
            <h2 className="cd-panel-title">Tenant Tools</h2>
            <p className="cd-panel-sub">
              Shortcuts for the most common client operations.
            </p>
          </div>
        </div>

        <div className="cd-tools-grid">
          {TOOLS.map((tool) => (
            <button
              key={tool.key}
              type="button"
              className={`cd-tool-btn cd-tool-btn--${tool.accent}`}
              onClick={() => setActivePage(tool.key)}
            >
              <div className={`cd-tool-icon cd-tool-icon--${tool.accent}`}>
                {tool.icon}
              </div>
              <strong>{tool.label}</strong>
              <span>{tool.desc}</span>
              <div className="cd-tool-arrow">
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
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ClientDashboard;
