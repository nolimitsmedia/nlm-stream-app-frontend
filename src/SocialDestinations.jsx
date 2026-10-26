import { useEffect, useState } from "react";
import api from "./api";

const PLATFORMS = [
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
];

/* ── Brand icons (simplified, single-color-safe glyphs — not the official
   asset files, just recognizable shapes so each connect button reads at a
   glance) ── */
function IconFacebook({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z" />
    </svg>
  );
}

function IconYouTube({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.51 3.5 12 3.5 12 3.5s-7.51 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14C4.49 20.5 12 20.5 12 20.5s7.51 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z" />
    </svg>
  );
}

const PLATFORM_ICON = {
  facebook: IconFacebook,
  youtube: IconYouTube,
};

const PLATFORM_COLOR = {
  facebook: "#1877F2",
  youtube: "#FF0000",
};

function IconUnlink({ size = 14 }) {
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
      <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M5.17 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="2" y1="8" x2="5" y2="8" />
      <line x1="16" y1="19" x2="16" y2="22" />
      <line x1="19" y1="16" x2="22" y2="16" />
    </svg>
  );
}

function PlatformRow({
  channelId,
  platformKey,
  platformLabel,
  destination,
  oauthAccounts,
  onChange,
}) {
  const [toggling, setToggling] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const Icon = PLATFORM_ICON[platformKey];
  const brandColor = PLATFORM_COLOR[platformKey];
  const isRunning = destination?.is_running;

  // Only trust "connected" if the linked account still actually exists —
  // disconnecting the account nulls oauth_account_id via FK, but
  // automation_mode can be left stale as 'oauth' with nothing to back it up.
  const connectedAccount =
    destination?.automation_mode === "oauth" && destination?.oauth_account_id
      ? oauthAccounts.find((a) => a.id === destination.oauth_account_id)
      : null;
  const isOAuthConnected = Boolean(connectedAccount);

  const handleGoLive = async () => {
    if (!destination?.id) return;
    try {
      setToggling(true);
      setError("");
      await api.post(
        `/api/channels/${channelId}/social-destinations/${destination.id}/go-live`,
      );
      await onChange();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to go live.");
    } finally {
      setToggling(false);
    }
  };

  const handleEndLive = async () => {
    if (!destination?.id) return;
    try {
      setToggling(true);
      setError("");
      await api.post(
        `/api/channels/${channelId}/social-destinations/${destination.id}/end-live`,
      );
      await onChange();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to end broadcast.");
    } finally {
      setToggling(false);
    }
  };

  // ── Connect: popup OAuth flow, then link the resulting account to this
  // channel's destination row (creating the row first if it doesn't exist yet) ──
  const handleConnect = () => {
    setConnecting(true);
    setError("");

    let popup;
    const handleMessage = async (event) => {
      if (
        event.data?.type !== "social-oauth-result" ||
        event.data?.platform !== platformKey
      ) {
        return;
      }
      window.removeEventListener("message", handleMessage);

      if (!event.data.ok) {
        setError("Connection wasn't completed — try again.");
        setConnecting(false);
        return;
      }

      try {
        const accountsRes = await api.get(
          "/api/organizations/current/oauth-accounts",
        );
        const forPlatform = (accountsRes.data.accounts || []).filter(
          (a) => a.platform === platformKey,
        );
        const newest = forPlatform[forPlatform.length - 1];
        if (!newest) throw new Error("Connected account not found");

        let destinationId = destination?.id;
        if (!destinationId) {
          const createRes = await api.post(
            `/api/channels/${channelId}/social-destinations`,
            {
              platform: platformKey,
              // Placeholder — never read once automation_mode is 'oauth';
              // the create route requires a non-empty key to create the
              // row at all, so this just satisfies that.
              stream_key: "oauth-managed",
            },
          );
          destinationId = createRes.data.destination.id;
        }

        await api.post(
          `/api/channels/${channelId}/social-destinations/${destinationId}/link-oauth`,
          { oauthAccountId: newest.id },
        );

        await onChange();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to finish connecting.");
      } finally {
        setConnecting(false);
      }
    };

    window.addEventListener("message", handleMessage);

    api
      .post(`/api/channels/${channelId}/oauth/${platformKey}/init`)
      .then((res) => {
        popup = window.open(
          res.data.authUrl,
          "oauth-popup",
          "width=600,height=720",
        );
        if (!popup) {
          window.removeEventListener("message", handleMessage);
          setError("Popup blocked — allow popups for this site and try again.");
          setConnecting(false);
        }
      })
      .catch((err) => {
        window.removeEventListener("message", handleMessage);
        setError(err.response?.data?.message || "Failed to start connection.");
        setConnecting(false);
      });
  };

  const handleDisconnect = async () => {
    if (!connectedAccount) return;
    if (
      !window.confirm(
        `Disconnect the ${platformLabel} account "${connectedAccount.external_account_name}"? This removes it from every channel using it, not just this one.`,
      )
    ) {
      return;
    }
    try {
      setError("");
      await api.delete(
        `/api/organizations/current/oauth-accounts/${connectedAccount.id}`,
      );
      await onChange();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to disconnect.");
    }
  };

  return (
    <div
      style={{
        padding: "10px 0",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            width: "100px",
            fontSize: "13px",
            opacity: 0.8,
          }}
        >
          <Icon size={16} />
          {platformLabel}
        </div>

        {isOAuthConnected ? (
          <>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "999px",
                background: "rgba(59,130,246,0.15)",
                color: "#60a5fa",
              }}
            >
              ✓ Connected: {connectedAccount.external_account_name}
            </span>

            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: "999px",
                background: isRunning
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(255,255,255,0.08)",
                color: isRunning ? "#22c55e" : "rgba(255,255,255,0.6)",
              }}
            >
              {isRunning ? "LIVE" : "Stopped"}
            </span>

            {isRunning ? (
              <button
                type="button"
                className="cp-delete-btn"
                onClick={handleEndLive}
                disabled={toggling}
              >
                {toggling ? "..." : "End Live"}
              </button>
            ) : (
              <button
                type="button"
                className="cp-submit-btn"
                onClick={handleGoLive}
                disabled={toggling}
                style={{ padding: "6px 14px" }}
              >
                {toggling ? "..." : "Go Live"}
              </button>
            )}

            <button
              type="button"
              onClick={handleDisconnect}
              title={`Disconnect ${platformLabel}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
              }}
            >
              <IconUnlink size={13} />
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            title={`Connect ${platformLabel}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              border: "none",
              background: connecting ? "rgba(255,255,255,0.08)" : brandColor,
              color: "#fff",
              opacity: connecting ? 0.6 : 1,
              cursor: connecting ? "default" : "pointer",
            }}
          >
            <Icon size={20} />
          </button>
        )}

        {!isOAuthConnected && (
          <span style={{ fontSize: "11px", opacity: 0.6 }}>
            {connecting
              ? "Connecting…"
              : `Connect your ${platformLabel} account to go live automatically`}
          </span>
        )}
      </div>

      {error && (
        <div style={{ fontSize: "12px", color: "#f87171", marginTop: "6px" }}>
          {error}
        </div>
      )}
    </div>
  );
}

function SocialDestinations({ channelId }) {
  const [destinations, setDestinations] = useState([]);
  const [oauthAccounts, setOauthAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [destRes, accountsRes] = await Promise.all([
        api.get(`/api/channels/${channelId}/social-destinations`),
        api.get("/api/organizations/current/oauth-accounts"),
      ]);
      setDestinations(destRes.data.destinations || []);
      setOauthAccounts(accountsRes.data.accounts || []);
    } catch (err) {
      console.error("Failed to load social destinations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  if (loading) return null;

  return (
    <div
      style={{
        marginTop: "16px",
        paddingTop: "12px",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <h4
        style={{
          fontSize: "13px",
          fontWeight: 600,
          marginBottom: "4px",
          opacity: 0.8,
        }}
      >
        Stream Targets
      </h4>
      {PLATFORMS.map((p) => (
        <PlatformRow
          key={p.key}
          channelId={channelId}
          platformKey={p.key}
          platformLabel={p.label}
          destination={destinations.find((d) => d.platform === p.key)}
          oauthAccounts={oauthAccounts}
          onChange={fetchAll}
        />
      ))}
    </div>
  );
}

export default SocialDestinations;
