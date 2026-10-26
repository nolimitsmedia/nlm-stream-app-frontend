import { useCallback, useEffect, useMemo, useState } from "react";
import LivePlayer from "./LivePlayer";

const API_BASE = (
  import.meta.env.VITE_API_BASE || "http://localhost:5000"
).replace(/\/$/, "");

const POLL_WHEN_OFFLINE_MS = 4000;
const POLL_WHEN_PREPARING_MS = 2000;
const POLL_WHEN_LIVE_MS = 15000;
const SIGNED_URL_REFRESH_WINDOW_SECONDS = 120;

const readBooleanParam = (searchParams, name, fallback) => {
  if (!searchParams.has(name)) return fallback;
  return ["1", "true", "yes", "on"].includes(
    String(searchParams.get(name) || "").toLowerCase(),
  );
};

const buildManifestUrl = (status) => {
  if (!status?.streamKey) return "";

  const base = String(status.hlsBaseUrl || API_BASE).replace(/\/$/, "");
  const path = status.transcodingEnabled
    ? `/api/abr/${encodeURIComponent(status.streamKey)}/master.m3u8`
    : `/api/hls/${encodeURIComponent(status.streamKey)}.m3u8`;

  return `${base}${path}${status.hlsAuthQs || ""}`;
};

const signedUrlNeedsRefresh = (url) => {
  if (!url) return true;

  try {
    const parsed = new URL(url, window.location.href);
    const expires = Number(parsed.searchParams.get("expires") || 0);

    if (!Number.isFinite(expires) || expires <= 0) return false;

    const secondsRemaining = expires - Math.floor(Date.now() / 1000);
    return secondsRemaining <= SIGNED_URL_REFRESH_WINDOW_SECONDS;
  } catch {
    return false;
  }
};

function EmbedPlayer({ token }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  const [status, setStatus] = useState(null);
  const [requestState, setRequestState] = useState("loading");
  const [requestMessage, setRequestMessage] = useState("");
  const [playerRevision, setPlayerRevision] = useState(0);
  const [stableManifestUrl, setStableManifestUrl] = useState("");
  const isLive = status?.isLive === true;
  const isReady =
    isLive &&
    status?.playbackReady !== false &&
    (!status?.transcodingEnabled || status?.abrReady === true);

  const manifestUrl = stableManifestUrl;
  const branding = status?.branding || {};
  const channelName =
    status?.channelName || branding.title || branding.name || "Live Broadcast";
  const primaryColor = branding.primary_color || "#7c3aed";
  const secondaryColor = branding.secondary_color || "#fd9d00";

  const fetchStatus = useCallback(async () => {
    if (!token) {
      setRequestState("error");
      setRequestMessage("This embed link is incomplete.");
      return null;
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/public/embed/${encodeURIComponent(token)}/status`,
        {
          cache: "no-store",
          credentials: "omit",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `Embed status ${response.status}`);
      }

      setStatus(data);
      setRequestState("ready");
      setRequestMessage("");
      return data;
    } catch (error) {
      setRequestState("error");
      setRequestMessage(
        error?.message || "The player could not contact the streaming service.",
      );
      return null;
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const poll = async () => {
      const next = await fetchStatus();
      if (cancelled) return;

      let delay = POLL_WHEN_OFFLINE_MS;
      if (next?.isLive) {
        const nextReady =
          next?.playbackReady !== false &&
          (!next?.transcodingEnabled || next?.abrReady === true);
        delay = nextReady ? POLL_WHEN_LIVE_MS : POLL_WHEN_PREPARING_MS;
      }

      timer = window.setTimeout(poll, delay);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (!isLive) {
      setStableManifestUrl("");
      return;
    }

    if (!isReady) return;

    const candidate = buildManifestUrl(status);
    if (!candidate) return;

    setStableManifestUrl((current) => {
      if (!current) return candidate;
      if (signedUrlNeedsRefresh(current)) return candidate;
      return current;
    });
  }, [isLive, isReady, status]);

  useEffect(() => {
    document.title = `${channelName} | Live Stream`;
  }, [channelName]);

  const retryPlayer = () => {
    const freshUrl = buildManifestUrl(status);
    if (freshUrl) setStableManifestUrl(freshUrl);
    setPlayerRevision((current) => current + 1);
    fetchStatus();
  };

  const renderState = () => {
    if (requestState === "loading" && !status) {
      return {
        eyebrow: "Connecting",
        title: "Loading live player",
        message: "Securing the broadcast and checking stream availability.",
        kind: "loading",
      };
    }

    if (requestState === "error" && !status) {
      return {
        eyebrow: "Connection issue",
        title: "Player temporarily unavailable",
        message: requestMessage || "Please try again in a moment.",
        kind: "error",
      };
    }

    if (!isLive) {
      const nextStart = status?.schedule?.scheduled_start
        ? new Date(status.schedule.scheduled_start).toLocaleString()
        : null;

      return {
        eyebrow: "Currently offline",
        title: "The broadcast has not started",
        message: nextStart
          ? `Next scheduled broadcast: ${nextStart}`
          : "The player will start automatically when the host goes live.",
        kind: "offline",
      };
    }

    if (!isReady && !stableManifestUrl) {
      return {
        eyebrow: "Live signal detected",
        title: "Preparing your stream",
        message:
          "The broadcast is live and the viewing qualities are being prepared.",
        kind: "preparing",
      };
    }

    return null;
  };

  const state = renderState();

  return (
    <main
      className="embed-player-page"
      style={{
        "--embed-primary": primaryColor,
        "--embed-secondary": secondaryColor,
      }}
    >
      <style>{`
        html, body, #root {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          background: #000;
        }
        .embed-player-page {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #000 !important;
          overflow: hidden !important;
        }
        .embed-player-shell {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          background: #000 !important;
        }
        .embed-player-stage {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
          overflow: hidden !important;
          background: #020308 !important;
        }
        .embed-player-stage > .live-player-box {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          margin: 0 !important;
          border-radius: 0 !important;
          background: #000 !important;
        }
        .embed-player-stage .live-video {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          background: #000 !important;
        }
        .embed-player-state {
          position: absolute !important;
          inset: 0 !important;
          min-height: 0 !important;
          padding: clamp(18px, 5vw, 48px) !important;
        }
        .embed-player-state h1 {
          font-size: clamp(22px, 5vw, 46px) !important;
          line-height: 1.06 !important;
          text-wrap: balance;
        }
        .embed-player-state > p:last-of-type {
          max-width: 680px;
          font-size: clamp(12px, 2vw, 17px) !important;
          text-wrap: balance;
        }
        .embed-player-footer,
        .embed-player-header,
        .embed-player-ambient {
          display: none !important;
        }
        @media (max-width: 560px), (max-height: 360px) {
          .embed-player-state {
            padding: 16px !important;
          }
          .embed-player-state h1 {
            font-size: clamp(20px, 7vw, 30px) !important;
          }
        }
      `}</style>

      <section className="embed-player-shell" aria-label={channelName}>
        <div className="embed-player-ambient" aria-hidden="true" />

        <div className="embed-player-stage">
          {manifestUrl ? (
            <LivePlayer
              key={playerRevision}
              src={manifestUrl}
              apiBase={API_BASE}
              lowLatency={Boolean(status?.reducedLatencyEnabled)}
              onStreamUnavailable={() => {
                setStableManifestUrl("");
                fetchStatus();
              }}
            />
          ) : (
            <div className="embed-player-poster" />
          )}

          {state && (
            <div
              className={`embed-player-state embed-player-state--${state.kind}`}
              role="status"
            >
              <div className="embed-player-signal" aria-hidden="true">
                <span />
                <span />
                <i />
              </div>
              <p className="embed-player-eyebrow">{state.eyebrow}</p>
              <h1>{state.title}</h1>
              <p>{state.message}</p>

              {state.kind === "error" && (
                <button
                  type="button"
                  className="embed-player-primary-button"
                  onClick={retryPlayer}
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {manifestUrl && !state && (
            <span
              style={{
                position: "absolute",
                top: "clamp(10px, 2vw, 16px)",
                right: "clamp(10px, 2vw, 16px)",
                zIndex: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.14)",
                background: "rgba(5,7,17,.72)",
                color: "#fff",
                backdropFilter: "blur(12px)",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".12em",
                textTransform: "uppercase",
                pointerEvents: "none",
              }}
            >
              <i
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#fb3456",
                  boxShadow: "0 0 0 4px rgba(251,52,86,.12)",
                }}
              />
              Live
            </span>
          )}
        </div>
      </section>
    </main>
  );
}

export default EmbedPlayer;
