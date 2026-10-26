import { useCallback, useEffect, useState } from "react";
import api from "./api";
import LivePlayer from "./LivePlayer";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const formatUptime = (seconds = 0) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const formatCodec = (codec) => {
  if (!codec) return "Analyzing";
  const value = String(codec).toLowerCase();
  if (value === "h264") return "H.264";
  if (value === "hevc" || value === "h265") return "H.265 / HEVC";
  if (value === "aac") return "AAC";
  if (value === "opus") return "Opus";
  return String(codec).toUpperCase();
};

const statusLabel = (status) => {
  if (status === "healthy") return "Healthy";
  if (status === "critical") return "Critical";
  if (status === "warning") return "Warning";
  return "Analyzing";
};

const StatusDot = ({ status = "unknown" }) => (
  <span
    className={`lm-status-dot lm-status-dot--${status}`}
    aria-hidden="true"
  />
);

const DetailRow = ({ label, value, status }) => (
  <div className="lm-detail-row">
    <span className="lm-detail-label">{label}</span>
    <span className="lm-detail-value">
      {status ? <StatusDot status={status} /> : null}
      {value ?? "—"}
    </span>
  </div>
);

const formatHistoryTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const historyEventLabel = (eventType) => {
  const labels = {
    broadcast_observed: "Broadcast observed",
    broadcast_started: "Broadcast started",
    broadcast_stopped: "Broadcast stopped",
    health_changed: "Health changed",
    operational_state_changed: "Operational state changed",
    attention_required: "Attention required",
  };
  if (labels[eventType]) return labels[eventType];
  return String(eventType || "Health event")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const historyTone = (event) => {
  const severity = String(event?.operational_severity || "").toLowerCase();
  const status = String(event?.monitor_status || "").toLowerCase();

  if (severity === "critical" || status === "critical") return "critical";
  if (
    event?.attention_required ||
    severity === "warning" ||
    status === "warning" ||
    status === "degraded"
  ) {
    return "warning";
  }
  if (status === "healthy" || event?.operational_state === "healthy") {
    return "healthy";
  }
  return "unknown";
};

function StreamHealthHistory({ channelId, isLive }) {
  const [events, setEvents] = useState([]);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(
    async ({ quiet = false } = {}) => {
      if (!channelId) {
        setEvents([]);
        setLoading(false);
        return;
      }

      if (quiet) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await api.get(
          `/api/channels/${encodeURIComponent(channelId)}/stream-health-history`,
          {
            params: {
              limit: 50,
              ...(attentionOnly ? { attention: true } : {}),
            },
          },
        );

        const payload = response?.data;

        if (!payload?.ok) {
          throw new Error(payload?.message || "Health history request failed.");
        }

        setEvents(Array.isArray(payload.events) ? payload.events : []);
        setError("");
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            "Unable to load stream health history.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [channelId, attentionOnly],
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!isLive || !channelId) return undefined;
    const timer = window.setInterval(() => {
      loadHistory({ quiet: true });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [channelId, isLive, loadHistory]);

  return (
    <section className="lm-components">
      <div className="lm-section-title-row">
        <div>
          <span className="lm-section-kicker">HEALTH HISTORY</span>
          <h3>Broadcast & incident timeline</h3>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            className="lm-history-filter"
            aria-pressed={attentionOnly}
            onClick={() => setAttentionOnly((value) => !value)}
            style={{
              border: "1px solid currentColor",
              borderRadius: "999px",
              padding: "6px 10px",
              background: attentionOnly
                ? "rgba(255,255,255,.08)"
                : "transparent",
              color: "inherit",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            {attentionOnly ? "Attention only" : "All events"}
          </button>
          <button
            type="button"
            className="lm-history-refresh"
            onClick={() => loadHistory({ quiet: true })}
            disabled={refreshing}
            style={{
              border: "1px solid currentColor",
              borderRadius: "999px",
              padding: "6px 10px",
              background: "transparent",
              color: "inherit",
              cursor: refreshing ? "wait" : "pointer",
              font: "inherit",
              opacity: refreshing ? 0.65 : 1,
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="lm-analysis-message">
          Loading stream health history…
        </div>
      ) : error ? (
        <div className="lm-analysis-message">
          Health history is temporarily unavailable. {error}
        </div>
      ) : events.length === 0 ? (
        <div className="lm-analysis-message">
          {attentionOnly
            ? "No attention-required health events are recorded for this channel."
            : "No stream health history is recorded for this channel yet."}
        </div>
      ) : (
        <div className="lm-warning-list">
          {events.map((event) => {
            const tone = historyTone(event);
            const eventScore =
              event.monitor_score != null ? `${event.monitor_score}/100` : "—";
            const mediaScore =
              event.media_score != null ? `${event.media_score}/100` : "—";
            const counts = [
              Number(event.critical_count || 0) > 0
                ? `${event.critical_count} critical`
                : null,
              Number(event.warning_count || 0) > 0
                ? `${event.warning_count} warning`
                : null,
              Number(event.issue_count || 0) > 0
                ? `${event.issue_count} issue${Number(event.issue_count) === 1 ? "" : "s"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                className={`lm-warning-item lm-warning-item--${tone}`}
                key={event.id}
              >
                <div className="lm-warning-icon" aria-hidden="true">
                  {tone === "critical" ? "!" : tone === "warning" ? "⚠" : "•"}
                </div>
                <div style={{ minWidth: 0, width: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <strong>{historyEventLabel(event.event_type)}</strong>
                    <small>{formatHistoryTime(event.created_at)}</small>
                  </div>
                  <p>
                    Operational: {event.operational_state || "—"}
                    {" · "}
                    Overall: {event.monitor_status || "—"} ({eventScore}){" · "}
                    Media:{" "}
                    {event.media_status ||
                      (event.media_pending ? "pending" : "—")}{" "}
                    ({mediaScore})
                    {event.reason_code ? ` · ${event.reason_code}` : ""}
                    {counts ? ` · ${counts}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LiveMonitor({ streams = [] }) {
  const activeStreams = streams.filter((stream) => stream.publish?.active);

  const getUptime = (stream) =>
    stream.uptime_seconds ||
    stream.publish?.active_age ||
    stream.publish?.age ||
    stream.publish?.duration ||
    stream.duration ||
    stream.age ||
    0;

  return (
    <div className="lm-page">
      <div className="lm-page-header">
        <div className="lm-page-header-left">
          <div className="lm-page-icon">
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
              <path d="M3 12h4l2.5-7 5 14 2.5-7H21" />
            </svg>
          </div>
          <div>
            <h2 className="lm-page-title">Live Monitor</h2>
            <p className="lm-page-sub">
              Media input analysis, stream health, delivery checks, and realtime
              ingest telemetry.
            </p>
          </div>
        </div>
        <span
          className={`lm-active-pill${activeStreams.length > 0 ? " lm-active-pill--on" : ""}`}
        >
          <span className="lm-active-dot" />
          {activeStreams.length} Active
        </span>
      </div>

      {activeStreams.length === 0 ? (
        <div className="lm-empty">
          <div className="lm-empty-icon">
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
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </div>
          <strong>No active live streams.</strong>
          <p>
            Start OBS or SRT ingest and the analyzer will begin automatically.
          </p>
        </div>
      ) : (
        <div className="lm-grid">
          {activeStreams.map((stream) => {
            const bitrate = Number(stream.kbps?.recv_30s || 0);
            const uptime = getUptime(stream);
            const analysis = stream.mediaAnalysis || {};
            const monitorData = stream.monitor || {};
            const delivery = monitorData.delivery || {};
            const renditions = monitorData.renditions || [];
            const targets = monitorData.targets || [];
            const monitorIssues = monitorData.issues || [];
            const health = analysis.health;
            const healthStatus =
              monitorData.status ||
              health?.status ||
              (uptime < 35 ? "unknown" : bitrate > 0 ? "healthy" : "warning");
            const healthScore = monitorData.score ?? health?.score;
            // SRS already exposes codec/resolution immediately. Merge that
            // live telemetry underneath the deeper ffprobe analysis so the
            // operator does not stare at "Analyzing" during warm-up.
            const video = {
              ...(stream.video || {}),
              ...(analysis.video || {}),
            };
            const audio = {
              ...(stream.audio || {}),
              ...(analysis.audio || {}),
            };
            const keyframe = analysis.keyframe_interval || {};
            const hls = analysis.hls || {};
            const stability = analysis.bitrate_stability || {};
            const warnings = analysis.warnings || [];
            // Phase 2: preview via the playback ID so it keeps working once
            // legacy stream-key playback is switched off.
            const playbackUrl = `${API_BASE.replace(/\/$/, "")}/api/hls/${stream.playback_id || stream.name}.m3u8`;
            const isWithinStartupGrace = uptime < 20;

            const readyRenditions = renditions.filter((item) => item.live);
            const runningTargets = targets.filter((item) => item.is_running);
            const reconnectingTargets = targets.filter(
              (item) => item.status === "reconnecting",
            );
            const dvrMinutes = Math.round(
              Number(delivery.dvr_window_seconds || 0) / 60,
            );
            const abrSummary =
              delivery.planned_renditions > 0
                ? `${delivery.ready_renditions || 0}/${delivery.planned_renditions} ready`
                : "Single source";
            const targetSummary =
              targets.length > 0
                ? `${runningTargets.length}/${targets.length} streaming`
                : "No targets";

            const resolution =
              video.width && video.height
                ? `${video.width} × ${video.height}`
                : "Analyzing";
            const fps = video.fps ? `${video.fps} fps` : "Analyzing";
            const videoBitrate = video.bitrate_kbps
              ? `${video.bitrate_kbps} kbps`
              : `${Math.round(bitrate)} kbps ingest`;

            // Must be declared before any derived field uses it.
            // This prevents the active-stream render path from throwing
            // a temporal-dead-zone ReferenceError when OBS is publishing.
            const analysisPending = analysis.pending || !analysis.analyzed_at;

            const audioBitrate = audio.bitrate_kbps
              ? `${audio.bitrate_kbps} kbps`
              : analysisPending
                ? "Analyzing"
                : audio.codec
                  ? "Detected · bitrate unavailable"
                  : "Unavailable";
            const sampleRate = audio.sample_rate
              ? `${Math.round(audio.sample_rate / 100) / 10} kHz`
              : "Analyzing";
            const channels = audio.channels
              ? `${audio.channels}${audio.channel_layout ? ` (${audio.channel_layout})` : ""}`
              : "Analyzing";
            const keyframeText = keyframe.seconds
              ? `${keyframe.seconds} sec${keyframe.frames ? ` / ${keyframe.frames} frames` : ""}`
              : "Analyzing";
            const stabilityState =
              stability.state ||
              (stability.score != null ? "ready" : "collecting");
            const stabilitySummary =
              stabilityState === "warmup"
                ? `Analyzing${stability.warmup_remaining_seconds != null ? ` · ${stability.warmup_remaining_seconds}s` : ""}`
                : stabilityState === "collecting"
                  ? `Building${stability.sample_count != null ? ` · ${stability.sample_count} samples` : ""}`
                  : stability.score != null
                    ? `${stability.score}/100`
                    : "Analyzing";
            const stabilityDetail =
              stabilityState === "warmup"
                ? "Analyzer warm-up"
                : stabilityState === "collecting"
                  ? "Building rolling history"
                  : stability.variation_percent != null
                    ? `${stability.variation_percent}% rolling variation`
                    : "Analyzing";
            const stabilityStatus =
              stabilityState !== "ready" || stability.score == null
                ? "unknown"
                : stability.score >= 80
                  ? "healthy"
                  : stability.score >= 60
                    ? "warning"
                    : "critical";

            return (
              <div
                key={stream.id || `${stream.app}-${stream.name}`}
                className="lm-card"
              >
                <div className="lm-card-header">
                  <div className="lm-card-header-left">
                    <div className="lm-stream-avatar">
                      {(stream.name || "S")[0].toUpperCase()}
                    </div>
                    <div>
                      <strong className="lm-stream-name">{stream.name}</strong>
                      <p className="lm-stream-url">
                        {stream.url || playbackUrl}
                      </p>
                    </div>
                  </div>
                  <div className="lm-card-badges">
                    <span className="lm-live-badge">
                      <span className="lm-live-dot" />
                      LIVE
                    </span>
                    <span
                      className={`lm-health-badge lm-health--${healthStatus}`}
                    >
                      {healthScore != null
                        ? `${statusLabel(healthStatus)} · ${healthScore}/100`
                        : statusLabel(healthStatus)}
                    </span>
                  </div>
                </div>

                <div className="lm-health-overview">
                  <div
                    className={`lm-health-score lm-health-score--${healthStatus}`}
                  >
                    <span className="lm-health-score-number">
                      {healthScore ?? "—"}
                    </span>
                    <span className="lm-health-score-total">/100</span>
                    <strong>{statusLabel(healthStatus)}</strong>
                  </div>
                  <div className="lm-health-summary">
                    <span className="lm-section-kicker">
                      STREAM HEALTH ENGINE
                    </span>
                    <h3>
                      {analysisPending
                        ? "Analyzing live media…"
                        : `${statusLabel(healthStatus)} stream`}
                    </h3>
                    <p>
                      {analysisPending
                        ? "FFprobe is verifying the live source in the background. SRS telemetry remains available while analysis completes."
                        : warnings.length > 0
                          ? `${warnings.length} issue${warnings.length === 1 ? "" : "s"} detected. Review the recommendations below.`
                          : "Source, encoding, bitrate, keyframes, and HLS delivery are within expected ranges."}
                    </p>
                  </div>
                  <div className="lm-health-mini-grid">
                    <div>
                      <span>Bitrate stability</span>
                      <strong>{stabilitySummary}</strong>
                    </div>
                    <div>
                      <span>HLS delivery</span>
                      <strong>
                        {hls.reachable == null
                          ? "Analyzing"
                          : hls.fresh
                            ? "Fresh"
                            : hls.reachable
                              ? "Stale"
                              : "Unavailable"}
                      </strong>
                    </div>
                    <div>
                      <span>Analyzer</span>
                      <strong>
                        {analysis.probe_ok
                          ? "Verified"
                          : analysisPending
                            ? "Running"
                            : "SRS fallback"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="lm-player-wrap">
                  {isWithinStartupGrace ? (
                    <div className="live-player-box">
                      <div
                        className="player-overlay player-overlay--starting"
                        role="status"
                      >
                        <span className="player-pulse" aria-hidden="true">
                          <span className="player-pulse-ring" />
                          <span className="player-pulse-ring player-pulse-ring--delay" />
                          <span className="player-pulse-dot" />
                        </span>
                        <p className="player-overlay-title">Stream starting</p>
                        <p className="player-overlay-sub">
                          The broadcast will appear here in a moment
                        </p>
                      </div>
                    </div>
                  ) : (
                    <LivePlayer
                      // Keep the monitor player tied to the raw OBS broadcast
                      // session. A rendition/FFmpeg restart should update the
                      // health cards, not destroy and remount the operator's
                      // preview player.
                      key={`${stream.liveStartedAtMs ?? 0}`}
                      src={playbackUrl}
                      apiBase={API_BASE}
                    />
                  )}
                </div>

                <div className="lm-tiles">
                  <div className="lm-tile lm-tile--green">
                    <span>Viewers</span>
                    <strong>
                      {stream.viewerMetrics?.active_viewers ??
                        stream.clients ??
                        0}
                    </strong>
                  </div>
                  <div className="lm-tile lm-tile--blue">
                    <span>Ingest Bitrate</span>
                    <strong>{Math.round(bitrate)} kbps</strong>
                  </div>
                  <div className="lm-tile lm-tile--orange">
                    <span>Uptime</span>
                    <strong>{formatUptime(uptime)}</strong>
                  </div>
                  <div className="lm-tile lm-tile--purple">
                    <span>Frames</span>
                    <strong>{stream.frames || 0}</strong>
                  </div>
                </div>

                <section className="lm-components">
                  <div className="lm-section-title-row">
                    <div>
                      <span className="lm-section-kicker">
                        OPERATOR SNAPSHOT
                      </span>
                      <h3>Live delivery health</h3>
                    </div>
                    <span
                      className={`lm-health-badge lm-health--${healthStatus}`}
                    >
                      {statusLabel(healthStatus)}
                    </span>
                  </div>

                  <div className="lm-health-mini-grid">
                    <div>
                      <span>ABR ladder</span>
                      <strong>{abrSummary}</strong>
                    </div>
                    <div>
                      <span>HLS delivery</span>
                      <strong>
                        {delivery.hls_reachable == null
                          ? "Analyzing"
                          : delivery.hls_fresh
                            ? "Healthy"
                            : delivery.hls_reachable
                              ? "Stale"
                              : "Unavailable"}
                      </strong>
                    </div>
                    <div>
                      <span>Live DVR</span>
                      <strong>
                        {delivery.dvr_enabled
                          ? `${dvrMinutes || 30} min`
                          : "Not enabled"}
                      </strong>
                    </div>
                    <div>
                      <span>Stream targets</span>
                      <strong>{targetSummary}</strong>
                    </div>
                  </div>
                </section>

                {renditions.length ? (
                  <section className="lm-components">
                    <div className="lm-section-title-row">
                      <div>
                        <span className="lm-section-kicker">
                          ABR / TRANSCODER
                        </span>
                        <h3>Rendition health</h3>
                      </div>
                      <span className="lm-all-clear">
                        {readyRenditions.length}/{renditions.length} online
                      </span>
                    </div>

                    <div className="lm-component-grid">
                      {renditions.map((rendition) => {
                        const renditionStatus = rendition.live
                          ? "healthy"
                          : uptime < 35
                            ? "unknown"
                            : "warning";
                        const resolution =
                          rendition.video?.width && rendition.video?.height
                            ? `${rendition.video.width}×${rendition.video.height}`
                            : rendition.planned_resolution || "—";

                        return (
                          <div
                            className="lm-component"
                            key={rendition.label || rendition.name}
                          >
                            <div>
                              <StatusDot status={renditionStatus} />
                              <span>{rendition.label}</span>
                            </div>
                            <strong>
                              {rendition.live
                                ? rendition.hls_bitrate_kbps > 0
                                  ? `${Math.round(rendition.hls_bitrate_kbps)} kbps HLS`
                                  : `${Math.round(rendition.bitrate_kbps || 0)} kbps`
                                : "Offline"}
                            </strong>
                            <small>
                              {resolution}
                              {rendition.video?.codec
                                ? ` · ${formatCodec(rendition.video.codec)}`
                                : ""}
                              {rendition.transport_bitrate_kbps > 0
                                ? ` · Transport ${Math.round(
                                    rendition.transport_bitrate_kbps,
                                  )} kbps`
                                : ""}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                    <div className="lm-analysis-message">
                      HLS bitrate is the measured viewer-delivery rate.
                      Transport bitrate is SRS internal stream telemetry and may
                      be higher.
                    </div>
                  </section>
                ) : null}

                <section className="lm-components">
                  <div className="lm-section-title-row">
                    <div>
                      <span className="lm-section-kicker">DISTRIBUTION</span>
                      <h3>Stream target health</h3>
                    </div>
                    {targets.length ? (
                      <span className="lm-all-clear">
                        {runningTargets.length} streaming
                        {reconnectingTargets.length
                          ? ` · ${reconnectingTargets.length} reconnecting`
                          : ""}
                      </span>
                    ) : null}
                  </div>

                  {targets.length === 0 ? (
                    <div className="lm-analysis-message">
                      No stream targets are configured for this channel.
                    </div>
                  ) : (
                    <div className="lm-component-grid">
                      {targets.map((target) => {
                        const targetStatus =
                          target.status === "reconnecting"
                            ? "warning"
                            : target.is_running
                              ? "healthy"
                              : target.last_error
                                ? "warning"
                                : "unknown";

                        return (
                          <div className="lm-component" key={target.id}>
                            <div>
                              <StatusDot status={targetStatus} />
                              <span>{target.name}</span>
                            </div>
                            <strong>
                              {target.is_running
                                ? `${Math.round(target.bitrate_kbps || 0)} kbps`
                                : target.status || "Stopped"}
                            </strong>
                            <small>
                              {(
                                target.protocol ||
                                target.target_type ||
                                "target"
                              )
                                .toString()
                                .toUpperCase()}
                              {" · "}
                              {target.reconnect_count || 0} reconnects
                              {target.dropped_frames
                                ? ` · ${target.dropped_frames} dropped`
                                : ""}
                            </small>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {monitorIssues.length ? (
                  <section className="lm-alerts">
                    <div className="lm-section-title-row">
                      <div>
                        <span className="lm-section-kicker">
                          LIVE INCIDENTS
                        </span>
                        <h3>Needs operator attention</h3>
                      </div>
                    </div>

                    <div className="lm-warning-list">
                      {monitorIssues.map((issue) => (
                        <div
                          className={`lm-warning-item lm-warning-item--${issue.severity}`}
                          key={issue.code}
                        >
                          <div className="lm-warning-icon">
                            {issue.severity === "critical" ? "!" : "⚠"}
                          </div>
                          <div>
                            <strong>{issue.title}</strong>
                            <p>{issue.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {stream.channel_id ? (
                  <StreamHealthHistory
                    channelId={stream.channel_id}
                    isLive={Boolean(stream.publish?.active)}
                  />
                ) : null}

                <div className="lm-analyzer-grid">
                  <section className="lm-analyzer-panel">
                    <div className="lm-analyzer-heading">
                      <span>INPUT VIDEO</span>
                      <strong>{formatCodec(video.codec)}</strong>
                    </div>
                    <DetailRow
                      label="Protocol"
                      value={analysis.protocol || "RTMP / SRT"}
                    />
                    <DetailRow
                      label="Codec"
                      value={formatCodec(video.codec)}
                      status={video.codec ? "healthy" : "unknown"}
                    />
                    <DetailRow
                      label="H.264 profile"
                      value={video.profile || "Analyzing"}
                    />
                    <DetailRow
                      label="Resolution"
                      value={resolution}
                      status={
                        video.width && video.height ? "healthy" : "unknown"
                      }
                    />
                    <DetailRow
                      label="Frame rate"
                      value={fps}
                      status={
                        video.fps
                          ? video.fps >= 23 && video.fps <= 61
                            ? "healthy"
                            : "warning"
                          : "unknown"
                      }
                    />
                    <DetailRow label="Video bitrate" value={videoBitrate} />
                    <DetailRow
                      label="Keyframe interval"
                      value={keyframeText}
                      status={
                        keyframe.seconds
                          ? keyframe.seconds <= 2.5
                            ? "healthy"
                            : keyframe.seconds <= 4
                              ? "warning"
                              : "critical"
                          : "unknown"
                      }
                    />
                  </section>

                  <section className="lm-analyzer-panel">
                    <div className="lm-analyzer-heading">
                      <span>INPUT AUDIO</span>
                      <strong>{formatCodec(audio.codec)}</strong>
                    </div>
                    <DetailRow
                      label="Codec"
                      value={formatCodec(audio.codec)}
                      status={audio.codec ? "healthy" : "unknown"}
                    />
                    <DetailRow label="Audio bitrate" value={audioBitrate} />
                    <DetailRow
                      label="Sample rate"
                      value={sampleRate}
                      status={
                        audio.sample_rate
                          ? Number(audio.sample_rate) === 48000
                            ? "healthy"
                            : "warning"
                          : "unknown"
                      }
                    />
                    <DetailRow label="Channels" value={channels} />
                    <DetailRow
                      label="Bitrate stability"
                      value={stabilityDetail}
                      status={stabilityStatus}
                    />
                    <DetailRow
                      label="HLS playlist"
                      value={
                        hls.reachable == null
                          ? "Analyzing"
                          : hls.fresh
                            ? "Fresh"
                            : hls.reachable
                              ? "Reachable / stale"
                              : "Unavailable"
                      }
                      status={
                        hls.reachable == null
                          ? "unknown"
                          : hls.fresh
                            ? "healthy"
                            : hls.reachable
                              ? "warning"
                              : "critical"
                      }
                    />
                    <DetailRow
                      label="Playlist age"
                      value={
                        hls.seconds_since_playlist_change != null
                          ? `${hls.seconds_since_playlist_change}s since change`
                          : "Analyzing"
                      }
                    />
                  </section>
                </div>

                {health?.components?.length ? (
                  <section className="lm-components">
                    <div className="lm-section-title-row">
                      <div>
                        <span className="lm-section-kicker">
                          HEALTH COMPONENTS
                        </span>
                        <h3>Signal checks</h3>
                      </div>
                    </div>
                    <div className="lm-component-grid">
                      {health.components.map((component) => (
                        <div className="lm-component" key={component.key}>
                          <div>
                            <StatusDot status={component.status} />
                            <span>{component.label}</span>
                          </div>
                          <strong>
                            {component.score != null
                              ? `${component.score}/100`
                              : "Analyzing"}
                          </strong>
                          <small>{component.detail}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="lm-alerts">
                  <div className="lm-section-title-row">
                    <div>
                      <span className="lm-section-kicker">
                        AUTOMATIC ANALYSIS
                      </span>
                      <h3>Encoder recommendations</h3>
                    </div>
                    {!analysisPending && warnings.length === 0 ? (
                      <span className="lm-all-clear">All checks passed</span>
                    ) : null}
                  </div>
                  {analysisPending ? (
                    <div className="lm-analysis-message">
                      Media analysis is running. Detailed recommendations will
                      appear automatically.
                    </div>
                  ) : warnings.length === 0 ? (
                    <div className="lm-analysis-message lm-analysis-message--good">
                      No source or delivery warnings detected.
                    </div>
                  ) : (
                    <div className="lm-warning-list">
                      {warnings.map((warning) => (
                        <div
                          className={`lm-warning-item lm-warning-item--${warning.severity}`}
                          key={warning.code}
                        >
                          <div className="lm-warning-icon">
                            {warning.severity === "critical" ? "!" : "⚠"}
                          </div>
                          <div>
                            <strong>{warning.title}</strong>
                            <p>{warning.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="lm-meta">
                  <span>
                    Ingest:{" "}
                    {stream.publish?.active ? "Connected" : "Disconnected"}
                  </span>
                  <span>VHost: {stream.vhost || "default"}</span>
                  <span>App: {stream.app || "live"}</span>
                  <span>SRS: {stream.srs_clients ?? stream.clients ?? 0}</span>
                  <span>Analyzer: {analysis.analyzer_source || "pending"}</span>
                  <span>
                    ABR: {readyRenditions.length}/{renditions.length || 0}
                  </span>
                  <span>
                    Targets: {runningTargets.length}/{targets.length || 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LiveMonitor;
