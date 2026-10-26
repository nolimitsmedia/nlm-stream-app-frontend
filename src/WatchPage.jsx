import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import LivePlayer from "./LivePlayer";
import WhepPlayer from "./WhepPlayer";

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;

function WatchPage() {
  const { streamName } = useParams();

  const [watchStatus, setWatchStatus] = useState({
    loading: true,
    isLive: false,
    schedule: null,
    stream: null,
    organization: null,
    branding: null,
    viewerMetrics: null,
    hlsBaseUrl: null,
    rtcBaseUrl: null,
    hlsAuthQs: "",
    cmafReady: false,
    cmafAuthQs: "",
    transcodingEnabled: false,
    reducedLatencyEnabled: false,
    rewindEnabled: false,
    rewindWindowSeconds: 0,
    // Phase 2: public playback identifier and display name from the API.
    playbackId: null,
    channelName: null,
  });
  const [now, setNow] = useState(Date.now());
  // Opt-in WebRTC (WHEP) playback — defaults to the proven HLS path.
  // "off" | "trying" | "active". "trying"/"active" both render
  // WhepPlayer; the distinction is only for the status label shown to
  // the viewer. Any WHEP failure (see WhepPlayer's onFallback) resets
  // this back to "off", silently returning to LivePlayer.
  const [lowLatencyMode, setLowLatencyMode] = useState("off");

  // Phase 5B.8c-f — CMAF is the preferred live-edge HLS presentation when
  // the backend says it is ready. Once this flag is set for the current
  // broadcast, stay on the proven TS-HLS/ABR path so a failing CMAF source
  // cannot cause source oscillation. DVR also deliberately uses TS-HLS/ABR
  // because the CMAF presentation has only a short live-edge window.
  const [forceStandardPlayback, setForceStandardPlayback] = useState(false);

  const [viewerMetrics, setViewerMetrics] = useState(null);
  const [abrReady, setAbrReady] = useState(false);
  const viewerSessionRef = useRef({ token: null, ended: false });

  const API_BASE_URL = API_BASE;
  // Phase 2: every playback URL uses the public playback ID returned by the
  // watch-status API. The URL value is only a fallback until that first
  // response arrives (for legacy links it is the stream key, which must never
  // be used once the playback ID is known).
  const playbackRef = watchStatus.playbackId || streamName;
  // Orgs with their own dedicated Bunny pull zone (see per-org zone
  // provisioning) route through it instead of the shared platform CDN —
  // same backend /api/hls/ proxy either way, just a different front door.
  // watchStatus.hlsBaseUrl is null for orgs without one, falling back to
  // the shared default.
  const hlsBase = watchStatus.hlsBaseUrl || API_BASE_URL;
  // Orgs on a transcoding-enabled plan already have real 720p/480p
  // transcodes running (see server.js on_publish handler) — request the
  // ABR master playlist so viewers actually get adaptive quality
  // switching, matching what their plan is paying for. Orgs without it
  // get the plain single-rendition manifest, same as before.
  // hlsAuthQs (from getPublicWatchStatus) carries the signed token/expires
  // for whichever zone hlsBase resolves to — "" (no-op) until Bunny Token
  // Authentication is actually configured server-side.
  const playbackBase = hlsBase.replace(/\/$/, "");
  const playbackAuthQuery = watchStatus.hlsAuthQs || "";

  const abrPlaybackUrl =
    `${playbackBase}/api/abr/${playbackRef}/master.m3u8` + playbackAuthQuery;

  const rawPlaybackUrl =
    `${playbackBase}/api/hls/${playbackRef}.m3u8` + playbackAuthQuery;

  const shouldUseAbr = watchStatus.transcodingEnabled;

  const standardPlaybackUrl = shouldUseAbr ? abrPlaybackUrl : rawPlaybackUrl;

  const cmafPlaybackUrl =
    `${playbackBase}/api/cmaf/${playbackRef}/index.m3u8` +
    (watchStatus.cmafAuthQs || "");

  const shouldUseCmaf =
    watchStatus.reducedLatencyEnabled &&
    watchStatus.cmafReady &&
    !forceStandardPlayback;

  const playbackUrl = shouldUseCmaf ? cmafPlaybackUrl : standardPlaybackUrl;
  // WHEP (WebRTC) signaling endpoint, proxied through nginx's /rtc/
  // location block (added specifically for this) so it rides the same
  // HTTPS front door as everything else — no mixed-content issue, no
  // separate cert/port for viewers to reach directly.
  // Deliberately uses rtcBaseUrl, NOT hlsBase: hlsBase now defaults to the
  // Token-Authentication-protected HLS CDN zone, and WHEP signing isn't
  // signed (out of scope for this pass) — using hlsBase here would get
  // WHEP connect attempts 403'd by Bunny. rtcBaseUrl only ever points at
  // an org's own dedicated zone (or null -> general API host), same as
  // hlsBase always behaved before this change.
  const rtcBase = watchStatus.rtcBaseUrl || API_BASE_URL;
  // Phase 2: WebRTC signaling goes through the backend WHEP proxy, which
  // resolves the playback ID server-side; the stream key never appears in
  // the browser.
  const whepUrl = `${rtcBase.replace(/\/$/, "")}/api/whep/${encodeURIComponent(playbackRef)}`;

  const branding = watchStatus.branding || {};
  const brandTitle = branding.title || branding.name || "NLM Streaming";
  const brandName = branding.name || brandTitle;
  const brandLogo = branding.logo_url || "";
  const primaryColor = branding.primary_color || "#0d6efd";
  const secondaryColor = branding.secondary_color || "#fd9d00";
  const customCss = branding.custom_css || "";
  const currentViewerMetrics = viewerMetrics || watchStatus.viewerMetrics || {};
  const activeViewers = Number(currentViewerMetrics.active_viewers || 0);
  const peakViewers = Number(currentViewerMetrics.peak_viewers || 0);

  const formattedTitle = useMemo(() => {
    const scheduleTitle = watchStatus.schedule?.title;

    if (scheduleTitle) return scheduleTitle;

    // Phase 2: never fall back to the URL identifier. For legacy links it is
    // the stream key (the ingest credential), which used to be shown as the
    // page heading.
    return watchStatus.channelName || "Live Stream";
  }, [watchStatus.channelName, watchStatus.schedule]);

  const countdown = useMemo(() => {
    if (!watchStatus.schedule?.scheduled_start) return null;

    const startTime = new Date(watchStatus.schedule.scheduled_start).getTime();
    const distance = startTime - now;

    if (distance <= 0) return null;

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((distance / (1000 * 60)) % 60);
    const seconds = Math.floor((distance / 1000) % 60);

    return { days, hours, minutes, seconds };
  }, [now, watchStatus.schedule]);

  const loadWatchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/watch/${streamName}`);
      const data = await res.json();

      setWatchStatus((previous) => {
        const nextIsLive = Boolean(data.isLive);
        const nextHlsBaseUrl = data.hlsBaseUrl || null;
        const previousGeneration =
          previous.stream?.liveStartedAtMs ??
          previous.stream?.live_started_at_ms ??
          null;
        const nextGeneration =
          data.stream?.liveStartedAtMs ??
          data.stream?.live_started_at_ms ??
          null;

        const sameBroadcast =
          previous.isLive &&
          nextIsLive &&
          previous.hlsBaseUrl === nextHlsBaseUrl &&
          previousGeneration === nextGeneration;

        return {
          loading: false,
          isLive: nextIsLive,
          playbackId: data.playbackId || previous.playbackId || null,
          channelName: data.channelName || previous.channelName || null,
          schedule: data.schedule || null,
          stream: data.stream || null,
          organization: data.organization || null,
          branding: data.branding || null,
          viewerMetrics: data.viewerMetrics || null,
          hlsBaseUrl: nextHlsBaseUrl,
          rtcBaseUrl: data.rtcBaseUrl || null,
          // Phase 2: playback-ID URLs need the playback-ID-signed tokens.
          hlsAuthQs:
            sameBroadcast && previous.hlsAuthQs
              ? previous.hlsAuthQs
              : (data.playbackId
                  ? data.playbackHlsAuthQs || data.hlsAuthQs
                  : data.hlsAuthQs) || "",
          cmafReady: Boolean(data.cmafReady),
          cmafAuthQs:
            sameBroadcast && previous.cmafAuthQs
              ? previous.cmafAuthQs
              : (data.playbackId
                  ? data.playbackCmafAuthQs || data.cmafAuthQs
                  : data.cmafAuthQs) || "",
          transcodingEnabled: Boolean(data.transcodingEnabled),
          reducedLatencyEnabled: Boolean(data.reducedLatencyEnabled),

          // Phase 4.2 — preserve the public DVR entitlement on EVERY
          // 10-second watch-status refresh. These fields already exist in the
          // initial state and are passed to LivePlayer below; omitting them
          // here caused them to become undefined after the first API response,
          // which made LivePlayer fall back to the reduced-latency HLS preset
          // and automatically jump DVR viewers back near the live edge.
          rewindEnabled: Boolean(data.rewindEnabled),
          rewindWindowSeconds: Number(data.rewindWindowSeconds || 0),
        };
      });

      // Phase 2: a legacy /watch/<stream_key> address is replaced in place
      // with /watch/<playback_id>, so the key leaves the address bar and is
      // not copied onward when the viewer shares the page.
      if (
        data.playbackId &&
        data.playbackId !== streamName &&
        typeof window !== "undefined" &&
        window.history?.replaceState
      ) {
        const legacySegment = `/watch/${streamName}`;
        const { pathname, search, hash } = window.location;
        if (pathname.includes(legacySegment)) {
          window.history.replaceState(
            window.history.state,
            "",
            pathname.replace(legacySegment, `/watch/${data.playbackId}`) +
              search +
              hash,
          );
        }
      }
      if (Boolean(data.isLive) && Boolean(data.transcodingEnabled)) {
        setAbrReady(Boolean(data.abrReady || data.playbackReady));
      } else {
        setAbrReady(Boolean(data.isLive));
      }
    } catch (error) {
      console.error("Failed to load watch status:", error);

      setWatchStatus((prev) => ({
        ...prev,
        loading: false,
      }));
    }
  }, [streamName]);

  useEffect(() => {
    loadWatchStatus();

    const statusInterval = setInterval(loadWatchStatus, 10000);
    const clockInterval = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(clockInterval);
    };
  }, [loadWatchStatus]);

  // Poll a lightweight JSON endpoint that always returns HTTP 200 while
  // the bounded rendition initializes. Do not probe master.m3u8 directly:
  // its intentional startup 503 is correct for an HLS client but appears as
  // a red browser-console error when used as a readiness check.
  useEffect(() => {
    if (!watchStatus.isLive || !shouldUseAbr) {
      setAbrReady(false);
      return undefined;
    }

    let cancelled = false;
    let retryTimer = null;
    const controller = new AbortController();

    const statusUrl =
      `${API_BASE_URL.replace(/\/$/, "")}/api/abr/` +
      `${encodeURIComponent(playbackRef)}/status`;

    const pollAbrStatus = async () => {
      try {
        const response = await fetch(statusUrl, {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await response.json().catch(() => null);

        if (
          !cancelled &&
          response.ok &&
          data?.ok &&
          data?.isLive &&
          data?.abrReady
        ) {
          setAbrReady(true);
          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
      }

      if (!cancelled) {
        retryTimer = setTimeout(pollAbrStatus, 2000);
      }
    };

    pollAbrStatus();

    return () => {
      cancelled = true;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    API_BASE_URL,
    shouldUseAbr,
    playbackRef,
    watchStatus.isLive,
    watchStatus.stream?.liveStartedAtMs,
    watchStatus.stream?.broadcastGeneration,
  ]);

  const endCurrentViewerSession = () => {
    const { token, ended } = viewerSessionRef.current;

    if (!token || ended) return;

    viewerSessionRef.current.ended = true;

    const payload = JSON.stringify({
      session_token: token,
      event_type: "end",
      page_url: window.location.href,
    });
    const url = `${API_BASE}/api/public/viewers/end`;

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        url,
        new Blob([payload], { type: "application/json" }),
      );
    } else {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  };

  useEffect(() => {
    if (!streamName) return;

    if (!watchStatus.isLive) {
      endCurrentViewerSession();
      setViewerMetrics(null);
      return;
    }

    const storageKey = `nlm_viewer_session_${streamName}`;
    let viewerId = sessionStorage.getItem(storageKey);

    if (!viewerId) {
      viewerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(storageKey, viewerId);
    }

    let heartbeatInterval = null;
    viewerSessionRef.current = { token: null, ended: false };

    const startViewerSession = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/viewers/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stream_key: streamName,
            viewer_id: viewerId,
            event_type: "start",
            page_url: window.location.href,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.message || "Failed to start viewer session");
        }

        viewerSessionRef.current.token = data.session?.session_token || null;
        setViewerMetrics(data.metrics || null);

        heartbeatInterval = setInterval(async () => {
          if (!viewerSessionRef.current.token || viewerSessionRef.current.ended)
            return;

          try {
            const heartbeatRes = await fetch(
              `${API_BASE}/api/public/viewers/heartbeat`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  session_token: viewerSessionRef.current.token,
                  event_type: "heartbeat",
                  page_url: window.location.href,
                }),
              },
            );

            const heartbeatData = await heartbeatRes.json();

            if (heartbeatData?.metrics) {
              setViewerMetrics(heartbeatData.metrics);
            }
          } catch (error) {
            console.warn("Viewer heartbeat failed:", error);
          }
        }, 15000);
      } catch (error) {
        console.warn("Viewer tracking unavailable:", error);
      }
    };

    const endViewerSession = endCurrentViewerSession;

    startViewerSession();

    /*
     * End only on real page close/navigation. Do not end during React effect
     * cleanup because development StrictMode and component remounts can call
     * cleanup without the viewer actually leaving the watch page.
     */
    window.addEventListener("pagehide", endViewerSession);
    window.addEventListener("beforeunload", endViewerSession);

    return () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      window.removeEventListener("pagehide", endViewerSession);
      window.removeEventListener("beforeunload", endViewerSession);
    };
  }, [streamName, watchStatus.isLive]);

  const isLive = watchStatus.isLive;
  const schedule = watchStatus.schedule;

  // Same gate LiveMonitor.jsx already applies: during the first ~20s of a
  // broadcast the backend's /api/hls/ proxy can legitimately 503 (waiting
  // on live_capped, or deferring per the sticky-race fix) — genuinely
  // expected, not a fault. LiveMonitor never mounts its player during this
  // window, so it never actually hits those 503s. WatchPage previously
  // mounted LivePlayer immediately on isLive, so its hls.js instance hit
  // those 503s directly and tore itself down/recreated a new MediaSource
  // roughly every 2.5s (see LivePlayer.jsx's fatal-error retry) until the
  // proxy settled — repeatedly destroying/reattaching MediaSource on the
  // same <video> element in quick succession is a known trigger for a
  // bufferAppendError, and matches the timing-dependent (3rd-of-4-tries)
  // failure actually observed. Gating this the same way LiveMonitor does
  // removes that churn entirely.
  const HLS_STARTUP_GRACE_SECONDS = 20;

  const explicitUptimeSeconds = Number(
    watchStatus.stream?.uptime_seconds ??
      watchStatus.stream?.publish?.active_age ??
      watchStatus.stream?.publish?.age ??
      watchStatus.stream?.publish?.duration ??
      watchStatus.stream?.duration ??
      watchStatus.stream?.age ??
      0,
  );

  const liveStartedAtMs = Number(
    watchStatus.stream?.liveStartedAtMs ??
      watchStatus.stream?.live_started_at_ms ??
      0,
  );

  const derivedUptimeSeconds =
    liveStartedAtMs > 0 ? Math.max(0, (now - liveStartedAtMs) / 1000) : 0;

  const liveUptimeSeconds =
    explicitUptimeSeconds > 0 ? explicitUptimeSeconds : derivedUptimeSeconds;

  // Startup grace must never hide a player after the backend has already
  // confirmed that the ABR ladder is ready. The previous condition could stay
  // true forever when the public stream object omitted explicit uptime fields.
  const isWithinStartupGrace =
    isLive && !abrReady && liveUptimeSeconds < HLS_STARTUP_GRACE_SECONDS;

  // Called by WhepPlayer if the WebRTC connection never establishes, or
  // drops mid-stream without recovering. Silently returns the viewer to
  // the proven HLS path — no error state shown, since from the
  // viewer's point of view "Beta" toggle failing just means they're
  // back to normal playback, not a broken page.
  const handleWhepFallback = (_reason) => {
    setLowLatencyMode("off");
  };

  const handleWhepConnected = () => {
    setLowLatencyMode("active");
  };

  const handleHlsStreamUnavailable = useCallback(() => {
    // LivePlayer's fast session poll can detect OBS shutdown several seconds
    // before this page's 10-second public-status poll. Move the page offline
    // immediately so React unmounts the player and no stale HLS retry can
    // request a master playlist after the broadcast has ended.
    setAbrReady(false);
    setLowLatencyMode("off");
    setWatchStatus((previous) => ({
      ...previous,
      loading: false,
      isLive: false,
      stream: null,
    }));
  }, []);

  useEffect(() => {
    setForceStandardPlayback(false);
  }, [watchStatus.stream?.liveStartedAtMs]);

  const handlePreferredPlaybackFailure = useCallback(() => {
    // One-way fallback for this broadcast. The 10-second Watch status poll may
    // continue to report CMAF ready, but the viewer should remain on the
    // compatibility path after an actual player failure.
    setForceStandardPlayback(true);
  }, []);

  const handleDvrPlaybackRequest = useCallback(() => {
    // Full rewind lives on the long TS-HLS/ABR rolling window, not the short
    // CMAF live-edge presentation.
    setForceStandardPlayback(true);
  }, []);

  const renderPlayer = () => {
    if (isLive) {
      if (isWithinStartupGrace || (shouldUseAbr && !abrReady)) {
        return (
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
              <p className="player-overlay-title">
                {shouldUseAbr && !abrReady
                  ? "Preparing stream"
                  : "Stream starting"}
              </p>
              <p className="player-overlay-sub">
                {shouldUseAbr && !abrReady
                  ? "Optimizing the broadcast for reliable playback…"
                  : "The broadcast will appear here in a moment"}
              </p>
            </div>
          </div>
        );
      }

      // Key playback only to the raw broadcast session. Rendition/FFmpeg
      // recovery must not remount the viewer while the same OBS broadcast is
      // still live; LivePlayer already handles temporary ABR recovery.
      if (lowLatencyMode !== "off") {
        return (
          <>
            <WhepPlayer
              key={`whep-${watchStatus.stream?.liveStartedAtMs ?? 0}-${
                watchStatus.stream?.broadcastGeneration ?? 0
              }`}
              whepUrl={whepUrl}
              onConnected={handleWhepConnected}
              onFallback={handleWhepFallback}
            />
            <button
              type="button"
              className="low-latency-toggle low-latency-toggle--exit"
              onClick={() => setLowLatencyMode("off")}
            >
              Back to standard playback
            </button>
          </>
        );
      }

      return (
        <>
          <LivePlayer
            key={`${watchStatus.stream?.liveStartedAtMs ?? 0}-${
              watchStatus.stream?.broadcastGeneration ?? 0
            }`}
            src={playbackUrl}
            apiBase={API_BASE_URL}
            lowLatency={shouldUseCmaf}
            preferredPlayback={shouldUseCmaf}
            onPreferredPlaybackFailure={handlePreferredPlaybackFailure}
            onRequestDvrPlayback={handleDvrPlaybackRequest}
            dvrEnabled={Boolean(watchStatus.rewindEnabled)}
            dvrWindowSeconds={Number(watchStatus.rewindWindowSeconds || 0)}
            onStreamUnavailable={handleHlsStreamUnavailable}
          />
          {watchStatus.reducedLatencyEnabled ? (
            <button
              type="button"
              className="low-latency-toggle"
              onClick={() => setLowLatencyMode("trying")}
            >
              Try Low Latency (Beta)
            </button>
          ) : null}
        </>
      );
    }

    return (
      <div className="scheduled-placeholder compact-watch-placeholder">
        {watchStatus.loading ? (
          <>
            <h2>Checking stream status...</h2>
            <p>Please wait while we connect to the broadcast system.</p>
          </>
        ) : schedule ? (
          <>
            <span className="schedule-label">Upcoming Broadcast</span>
            <h2>{schedule.title}</h2>

            {countdown ? (
              <div className="countdown-grid">
                <CountdownBox label="Days" value={countdown.days} />
                <CountdownBox label="Hours" value={countdown.hours} />
                <CountdownBox label="Minutes" value={countdown.minutes} />
                <CountdownBox label="Seconds" value={countdown.seconds} />
              </div>
            ) : (
              <p>
                The scheduled start time has arrived. Waiting for the live
                stream signal.
              </p>
            )}

            <p>
              Starts{" "}
              <strong>
                {new Date(schedule.scheduled_start).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </strong>
            </p>
          </>
        ) : (
          <>
            <span className="schedule-label">Offline</span>
            <h2>No live broadcast right now</h2>
            <p>Please check back later or contact the stream host.</p>
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className="watch-page modern-watch-page branded-watch-page"
      style={{
        "--watch-primary": primaryColor,
        "--watch-secondary": secondaryColor,
      }}
    >
      {customCss ? <style>{customCss}</style> : null}
      <header className="watch-hero modern-watch-hero">
        <div>
          <div className="watch-brand branded-watch-brand">
            {brandLogo ? (
              <img src={brandLogo} alt={`${brandName} logo`} />
            ) : (
              <div className="brand-icon" style={{ background: primaryColor }}>
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            <span>{brandTitle}</span>
          </div>

          <h1>{formattedTitle}</h1>
          <p>
            {isLive
              ? `Live broadcast powered by ${brandTitle}.`
              : schedule
                ? "This broadcast is scheduled. The player will appear once the stream is live."
                : `${brandName} is currently offline.`}
          </p>
        </div>

        <div className="modern-watch-status">
          <span className={isLive ? "live" : "offline"}>
            {isLive ? "LIVE" : schedule ? "SCHEDULED" : "OFFLINE"}
          </span>
          <small>{isLive ? "Adaptive HD" : "HLS Ready"}</small>
          <small>{activeViewers} watching now</small>
        </div>
      </header>

      <main className="modern-watch-layout">
        <section className="modern-watch-main">
          <div className="watch-player modern-watch-player">
            {renderPlayer()}
          </div>

          <div className="modern-watch-info-card">
            <div>
              <h2>{formattedTitle}</h2>
              <p>
                {schedule?.description ||
                  "Watch this live stream with adaptive bitrate playback for smoother viewing on desktop, mobile, and connected devices."}
              </p>
            </div>

            <div className="watch-actions modern-watch-actions">
              <button
                type="button"
                onClick={() =>
                  navigator.clipboard.writeText(window.location.href)
                }
              >
                Copy Watch Link
              </button>

              {isLive && (
                <a href={playbackUrl} target="_blank" rel="noreferrer">
                  Open Stream URL
                </a>
              )}
            </div>
          </div>
        </section>

        <aside className="modern-watch-sidebar">
          <div className="modern-side-panel">
            <div className="watch-panel-body">
              <div className="watch-card stream-info-compact-card">
                <h3>Stream Info</h3>

                <div className="watch-info-row">
                  <span>Status</span>
                  <strong>
                    {isLive ? "Live" : schedule ? "Scheduled" : "Offline"}
                  </strong>
                </div>

                <div className="watch-info-row">
                  <span>Quality</span>
                  <strong>{isLive ? "Auto / HD" : "Pending"}</strong>
                </div>

                <div className="watch-info-row">
                  <span>Delivery</span>
                  <strong>
                    {lowLatencyMode === "active"
                      ? "WebRTC"
                      : lowLatencyMode === "trying"
                        ? "WebRTC Connecting…"
                        : "HLS"}
                  </strong>
                </div>

                {isLive && watchStatus.rewindEnabled && (
                  <div className="watch-info-row">
                    <span>Live Rewind</span>
                    <strong>
                      {Math.round(
                        Number(watchStatus.rewindWindowSeconds || 0) / 60,
                      )}{" "}
                      min
                    </strong>
                  </div>
                )}

                <div className="watch-info-row">
                  <span>Watching Now</span>
                  <strong>{activeViewers}</strong>
                </div>

                <div className="watch-info-row">
                  <span>Peak Viewers</span>
                  <strong>{peakViewers}</strong>
                </div>

                {schedule?.scheduled_start && (
                  <div className="watch-info-row">
                    <span>Starts</span>
                    <strong>
                      {new Date(schedule.scheduled_start).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function CountdownBox({ label, value }) {
  return (
    <div className="countdown-box">
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
    </div>
  );
}

export default WatchPage;
