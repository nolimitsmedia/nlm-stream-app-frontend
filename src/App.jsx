// src/App.jsx
import { useEffect, useState } from "react";
import api from "./api";
import "./App.css";

import LivePlayer from "./LivePlayer";
import EmbedPlayer from "./EmbedPlayer";
import ChannelsPanel from "./ChannelsPanel";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import DashboardCards from "./DashboardCards";
import LiveMonitor from "./LiveMonitor";
import TranscodeButton from "./TranscodeButton";
import AdminsPage from "./AdminsPage";
import ScheduledStreamsPage from "./ScheduledStreamsPage";
import OrganizationsPage from "./OrganizationsPage";
import ClientDashboard from "./ClientDashboard";
import SuperAdminDashboard from "./SuperAdminDashboard";
import ClientOnboardingPage from "./ClientOnboardingPage";
import SubscriptionPage from "./SubscriptionPage";
import AnalyticsPage from "./AnalyticsPage";
import SettingsPage from "./SettingsPage";
import FileBroadcastPage from "./FileBroadcastPage";
import RecordingsPage from "./RecordingsPage";
import ApiKeysPage from "./ApiKeysPage";
import SystemStatusPage from "./SystemStatusPage";
import SuperAdminGuidePage from "./SuperAdminGuidePage";
import { useSubscription } from "./SubscriptionContext.jsx";

function DashboardApp() {
  const getCurrentAdmin = () => {
    try {
      return JSON.parse(localStorage.getItem("nlm_admin") || "{}");
    } catch {
      return {};
    }
  };

  const isPlatformAdmin = getCurrentAdmin().role === "super_admin";
  const {
    subscription,
    loading: subscriptionLoading,
    isActive: subscriptionIsActive,
    hasFeature,
  } = useSubscription();

  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState("Dashboard");
  const [organizationVersion, setOrganizationVersion] = useState(0);

  // Internal transcode variants (the 720p/480p ABR renditions, and the
  // live_capped bitrate-hard-cap output) republish under the same base
  // stream name and would otherwise double-count as separate "active
  // streams"/"live viewers" on dashboard summary cards. LiveMonitor keeps
  // the full unfiltered `streams` list below, since seeing the raw vs.
  // capped bitrate side-by-side there is genuinely useful — only the
  // summary-count consumers (ClientDashboard, DashboardCards) get this
  // cleaned-up version.
  // Real bug found 2026-08-03: this hardcoded list only ever covered
  // _720p/_480p — the same class of bug hit 3 times already in server.js
  // when the "top" rendition label was added for the Essential-tier ABR
  // fold. Correction (via second review pass): a regex doesn't actually
  // future-proof this — a new label like "_1080p" would still need this
  // list updated either way. Named list instead, so the next person
  // adding a rendition label has one obvious place to update rather than
  // hunting for a regex buried in a filter function. Ideally the backend
  // and frontend would derive this from shared config eventually.
  const INTERNAL_RENDITION_SUFFIXES = ["top", "720p", "480p"];
  const isInternalTranscodeVariant = (stream) => {
    const name = String(stream?.name || "");
    return (
      stream?.app === "live_capped" ||
      INTERNAL_RENDITION_SUFFIXES.some((label) => name.endsWith(`_${label}`))
    );
  };

  const realBroadcastStreams = streams
    .filter((s) => !isInternalTranscodeVariant(s))
    .map((rawStream) => {
      const cappedCounterpart = streams.find(
        (s) => s.app === "live_capped" && s.name === rawStream.name,
      );

      if (!cappedCounterpart) return rawStream;

      // Show the capped/delivered bitrate (what viewers actually receive)
      // instead of the raw source's — otherwise dashboard summary cards
      // look like enforcement isn't working, when it actually is. If no
      // capped counterpart exists (capping skipped due to load, crashed,
      // or not configured for this org), the raw bitrate is shown as-is,
      // since that genuinely is what's being delivered in that case.
      return { ...rawStream, kbps: cappedCounterpart.kbps };
    });

  const fetchStreams = async () => {
    try {
      const res = await api.get("/api/srs/streams");
      setStreams(res.data.streams || []);
    } catch (error) {
      console.error("Failed to fetch streams:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleOrganizationChange = () => {
      setOrganizationVersion((version) => version + 1);
    };

    window.addEventListener(
      "nlm-organization-changed",
      handleOrganizationChange,
    );

    return () => {
      window.removeEventListener(
        "nlm-organization-changed",
        handleOrganizationChange,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !isPlatformAdmin &&
      ["Organizations", "Client Onboarding", "Admins"].includes(activePage)
    ) {
      setActivePage("Dashboard");
    }
  }, [activePage, isPlatformAdmin]);

  useEffect(() => {
    setLoading(true);
    fetchStreams();

    const interval = setInterval(() => {
      fetchStreams();
    }, 3000);

    return () => clearInterval(interval);
  }, [organizationVersion]);

  const renderPlanGate = ({ featureKey, featureName, children }) => {
    const isPlatformView =
      isPlatformAdmin && !localStorage.getItem("nlm_organization_id");

    if (isPlatformView) return children;

    if (subscriptionLoading) {
      return (
        <section className="card">
          <p>Checking subscription access…</p>
        </section>
      );
    }

    if (!subscriptionIsActive) {
      return (
        <section className="card">
          <h2>Subscription inactive</h2>
          <p>
            This organization needs an active subscription before this page can
            be used.
          </p>
        </section>
      );
    }

    if (featureKey && !hasFeature(featureKey)) {
      return (
        <section className="card">
          <h2>{featureName} is not included</h2>
          <p>
            The {subscription?.plan_name || "current"} plan does not include
            this feature. Open Subscription to review available plans.
          </p>
        </section>
      );
    }

    return children;
  };

  const renderLiveStreams = () => (
    <section className="card">
      <div className="section-header">
        <h2>Live Streams</h2>

        <div className="status-pill">
          {realBroadcastStreams.filter((s) => s.publish?.active).length} Active
        </div>
      </div>

      {loading ? (
        <p>Loading streams...</p>
      ) : realBroadcastStreams.length === 0 ? (
        <p>No streams detected.</p>
      ) : (
        realBroadcastStreams.map((stream) => (
          <div key={stream.id} className="stream-row">
            <div className="stream-info">
              <div>
                <strong>{stream.name}</strong>
                <p>{stream.url}</p>

                <div className="stream-meta">
                  <span>Clients: {stream.clients || 0}</span>
                  <span>KBPS: {stream.kbps?.recv_30s || 0}</span>
                  <span>Frames: {stream.frames || 0}</span>
                </div>
              </div>

              <span className={stream.publish?.active ? "live" : "offline"}>
                {stream.publish?.active ? "LIVE" : "OFFLINE"}
              </span>
            </div>

            {stream.publish?.active && (
              <div className="player-wrapper">
                <LivePlayer
                  // Same /api/hls/ backend proxy WatchPage.jsx and
                  // LiveMonitor.jsx use — not SRS's raw output on port
                  // 8080 directly. See LiveMonitor.jsx for the reasoning.
                  src={`${
                    import.meta.env.VITE_API_BASE || "http://localhost:5000"
                  }/api/hls/${stream.name}.m3u8`}
                />
              </div>
            )}

            {!/_(top|720p|480p)$/.test(stream.name || "") && (
              <div className="stream-actions">
                <TranscodeButton streamName={stream.name} />
              </div>
            )}
          </div>
        ))
      )}
    </section>
  );

  return (
    <div className="layout">
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      <main className="main-content">
        <Topbar />

        <div key={organizationVersion}>
          {activePage === "Dashboard" &&
            (isPlatformAdmin ? (
              <SuperAdminDashboard />
            ) : (
              <ClientDashboard
                streams={realBroadcastStreams}
                loading={loading}
                setActivePage={setActivePage}
              />
            ))}

          {activePage === "Organizations" && isPlatformAdmin && (
            <OrganizationsPage />
          )}

          {activePage === "Client Onboarding" && isPlatformAdmin && (
            <ClientOnboardingPage setActivePage={setActivePage} />
          )}

          {activePage === "Channels" && <ChannelsPanel />}

          {activePage === "Subscription" && <SubscriptionPage />}

          {activePage === "Live Monitor" && (
            <>
              <DashboardCards streams={realBroadcastStreams} />
              <LiveMonitor streams={realBroadcastStreams} />
            </>
          )}

          {activePage === "Scheduled Streams" && <ScheduledStreamsPage />}

          {activePage === "Recordings" &&
            renderPlanGate({
              featureKey: "recording_enabled",
              featureName: "Recordings",
              children: <RecordingsPage />,
            })}

          {activePage === "File Broadcast" && <FileBroadcastPage />}

          {activePage === "Analytics" &&
            renderPlanGate({
              featureKey: "analytics_enabled",
              featureName: "Analytics",
              children: <AnalyticsPage />,
            })}

          {activePage === "Admins" && isPlatformAdmin && <AdminsPage />}

          {activePage === "Settings" && <SettingsPage />}

          {activePage === "API Keys" && <ApiKeysPage />}

          {activePage === "System Status" && isPlatformAdmin && (
            <SystemStatusPage />
          )}

          {activePage === "Super Admin Guide" && isPlatformAdmin && (
            <SuperAdminGuidePage />
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  const embedMatch = window.location.pathname.match(/\/embed\/([^/?#]+)\/?$/);

  if (embedMatch) {
    return <EmbedPlayer token={decodeURIComponent(embedMatch[1])} />;
  }

  return <DashboardApp />;
}

export default App;
