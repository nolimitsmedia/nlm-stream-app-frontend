import { useCallback, useEffect, useRef, useState } from "react";
import api from "./api";
import "./FacebookLiveStudio.css";

// Facebook Live Studio
// One place to: sign in with Facebook -> choose a Page -> go live -> see the
// broadcast and the Page's content. Every Graph API call happens on the
// server; Page tokens never reach the browser.

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return null;
  return compact.format(Number(value));
}

function formatUptime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Facebook LiveVideo.status -> words a person understands.
function describeLiveStatus(status) {
  switch (String(status || "").toUpperCase()) {
    case "LIVE":
      return { text: "Live on Facebook", tone: "live" };
    case "UNPUBLISHED":
    case "PROCESSING":
    case "SCHEDULED_LIVE":
      return { text: "Connecting to Facebook", tone: "pending" };
    case "LIVE_STOPPED":
      return { text: "Video signal interrupted", tone: "warn" };
    case "VOD":
      return { text: "Ended, saved to the Page", tone: "done" };
    case "SCHEDULED_UNPUBLISHED":
    case "SCHEDULED_CANCELED":
      return { text: "Scheduled", tone: "pending" };
    case "UNKNOWN":
      return { text: "Status unavailable", tone: "warn" };
    default:
      return { text: status ? String(status) : "Not live", tone: "idle" };
  }
}

// Turns common Graph API refusals into a next step a person can take.
function explainFacebookError(message) {
  const text = String(message || "");
  if (
    /eligib|not allowed to go live|can't go live|cannot go live|live video is not available/i.test(
      text,
    )
  )
    return "This Page isn’t allowed to go live yet. Check it in Facebook Live Producer; new Pages or Pages with very few followers can be restricted.";
  if (
    /#200|#10\b|permission|not authorized|publish_video|pages_manage_posts/i.test(
      text,
    )
  )
    return "The app doesn’t have permission to publish live video on this Page. Make sure you’re an app Admin, Developer or Tester while the app is in review, then use Edit Page access and tick the Page again.";
  if (/#190|session|expired|token|reconnect/i.test(text))
    return "Facebook access expired. Click Disconnect, then Continue with Facebook again.";
  if (/HLS|media is not ready|source/i.test(text))
    return "NLM didn’t have playable video yet. It retries automatically; if this keeps happening, check the encoder’s keyframe interval (2 seconds) and bitrate.";
  return "NLM retries automatically up to 3 times per stream. You can also click Go live now.";
}

function apiOrigin() {
  return new URL(
    import.meta.env.VITE_API_URL ||
      api.defaults.baseURL ||
      window.location.origin,
    window.location.origin,
  ).origin;
}

function FacebookMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  );
}

function PageAvatar({ url, name, size = 44, live = false }) {
  const initial = String(name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();
  return (
    <span
      className={live ? "fls-avatar fls-avatar--live" : "fls-avatar"}
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" /> : <span>{initial}</span>}
    </span>
  );
}

function Steps({ current }) {
  const steps = [
    "Continue with Facebook",
    "Choose a Page",
    "Go live",
    "See it on your Page",
  ];
  return (
    <ol className="fls-steps" aria-label="Facebook Live setup progress">
      {steps.map((label, index) => {
        const n = index + 1;
        const state = n < current ? "done" : n === current ? "current" : "todo";
        return (
          <li
            key={label}
            className={`fls-step fls-step--${state}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="fls-step-num">{state === "done" ? "✓" : n}</span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ─────────────────────────────────────────────────────────────
// Page picker (pages_show_list)
// ─────────────────────────────────────────────────────────────
function PagePicker({
  channelId,
  onSelected,
  onCancel,
  onEditAccess,
  canCancel,
}) {
  const [state, setState] = useState({ loading: true, pages: [], error: "" });
  const [choosing, setChoosing] = useState(null);

  // Returns the next picker state; callers decide when to apply it.
  const fetchPages = useCallback(async () => {
    try {
      const res = await api.get(`/api/channels/${channelId}/facebook/pages`);
      return {
        loading: false,
        pages: res.data.pages || [],
        signedInAs: res.data.signedInAs,
        error: "",
      };
    } catch (err) {
      return {
        loading: false,
        pages: [],
        error:
          err.response?.data?.message || "Could not load your Facebook Pages.",
      };
    }
  }, [channelId]);

  useEffect(() => {
    let active = true;
    fetchPages().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [fetchPages]);

  const choose = async (page) => {
    setChoosing(page.pageId);
    try {
      await api.post(`/api/channels/${channelId}/facebook/select-page`, {
        pageId: page.pageId,
      });
      await onSelected(page);
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err.response?.data?.message || "Could not select that Page.",
      }));
    } finally {
      setChoosing(null);
    }
  };

  return (
    <section className="fls-picker" aria-labelledby="fls-picker-title">
      <header className="fls-picker-head">
        <div>
          <h5 id="fls-picker-title">
            Choose the Page this channel goes live on
          </h5>
          <p>
            These are the Pages you shared with NLM Streaming in the Facebook
            window. Your live videos are published to the Page you pick.
          </p>
        </div>
        {canCancel ? (
          <button
            type="button"
            className="fls-btn fls-btn--quiet"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </header>

      {state.loading ? (
        <div className="fls-muted">Loading your Pages…</div>
      ) : null}
      {state.error ? <div className="fls-error">{state.error}</div> : null}

      {!state.loading && !state.error && state.pages.length === 0 ? (
        <div className="fls-empty">
          <strong>No Pages were shared with NLM Streaming</strong>
          <p>
            You need to be an admin of a Facebook Page, and select it in the
            Facebook window. Choose Edit Page access and tick the Page.
          </p>
        </div>
      ) : null}

      <ul className="fls-page-list">
        {state.pages.map((page) => (
          <li key={page.pageId} className="fls-page-row">
            <PageAvatar url={page.pictureUrl} name={page.pageName} />
            <div className="fls-page-row-text">
              <strong>{page.pageName}</strong>
              <span>
                {[
                  page.category,
                  formatCount(page.followers) &&
                    `${formatCount(page.followers)} followers`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </span>
              {!page.canGoLive ? (
                <small className="fls-warn-text">
                  Your role on this Page can’t publish live video.
                </small>
              ) : null}
            </div>
            {page.selected ? (
              <span className="fls-tag fls-tag--ok">In use</span>
            ) : (
              <button
                type="button"
                className="fls-btn fls-btn--primary"
                disabled={!page.canGoLive || Boolean(choosing)}
                onClick={() => choose(page)}
                title="Live videos from this channel will be published to this Page"
              >
                {choosing === page.pageId ? "Selecting…" : "Use this Page"}
              </button>
            )}
          </li>
        ))}
      </ul>

      <footer className="fls-picker-foot">
        <span>Don’t see your Page?</span>
        <button type="button" className="fls-link" onClick={onEditAccess}>
          Edit Page access on Facebook
        </button>
      </footer>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Page content (pages_read_engagement)
// ─────────────────────────────────────────────────────────────
function PageContent({ channelId, page, liveId }) {
  const [tab, setTab] = useState("live");
  const [data, setData] = useState({ loading: true, items: [], error: "" });

  const fetchContent = useCallback(
    async (refresh = false) => {
      try {
        const res = await api.get(
          `/api/channels/${channelId}/facebook/content`,
          {
            params: { tab, ...(refresh ? { refresh: 1 } : {}) },
          },
        );
        return {
          loading: false,
          items: res.data.items || [],
          fetchedAt: res.data.fetchedAt,
          error: "",
        };
      } catch (err) {
        return {
          loading: false,
          items: [],
          error:
            err.response?.data?.message ||
            "Could not read this Page’s content.",
        };
      }
    },
    [channelId, tab],
  );

  const load = async (refresh = false) => setData(await fetchContent(refresh));

  useEffect(() => {
    let active = true;
    fetchContent().then((next) => {
      if (active) setData(next);
    });
    return () => {
      active = false;
    };
  }, [fetchContent, liveId]);

  const tabs = [
    { key: "live", label: "Live videos" },
    { key: "videos", label: "Videos" },
    { key: "posts", label: "Recent posts" },
  ];

  return (
    <section className="fls-content" aria-label={`Content from ${page.name}`}>
      <header className="fls-content-head">
        <div className="fls-content-identity">
          <PageAvatar url={page.pictureUrl} name={page.name} size={28} />
          <div>
            <strong>On {page.name}</strong>
            <small>
              Read from Facebook so you can confirm what’s published.
            </small>
          </div>
        </div>
        <button
          type="button"
          className="fls-btn fls-btn--quiet"
          onClick={() => {
            setData((d) => ({ ...d, loading: true, error: "" }));
            load(true);
          }}
          disabled={data.loading}
          title="Read the latest content from this Facebook Page"
        >
          {data.loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="fls-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "fls-tab fls-tab--on" : "fls-tab"}
            onClick={() => {
              if (t.key === tab) return;
              setData({ loading: true, items: [], error: "" });
              setTab(t.key);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {data.error ? <div className="fls-error">{data.error}</div> : null}
      {!data.loading && !data.error && data.items.length === 0 ? (
        <div className="fls-muted fls-pad">
          {tab === "live"
            ? "No live videos on this Page yet. Go live and it will appear here."
            : tab === "videos"
              ? "No videos on this Page yet."
              : "No posts on this Page yet."}
        </div>
      ) : null}

      <ul className="fls-items">
        {data.items.map((item) => {
          const isCurrent = liveId && String(item.id) === String(liveId);
          const statusInfo = item.status
            ? describeLiveStatus(item.status)
            : null;
          const thumb = item.thumbnailUrl || item.imageUrl;
          return (
            <li
              key={item.id}
              className={isCurrent ? "fls-item fls-item--current" : "fls-item"}
            >
              <div className="fls-item-thumb">
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" />
                ) : (
                  <FacebookMark size={18} />
                )}
              </div>
              <div className="fls-item-body">
                <div className="fls-item-author">
                  <PageAvatar
                    url={page.pictureUrl}
                    name={page.name}
                    size={18}
                  />
                  <span>{page.name}</span>
                  <time>{formatWhen(item.createdTime)}</time>
                </div>
                <p className="fls-item-text">
                  {item.title || item.message || "Untitled"}
                </p>
                <div className="fls-item-meta">
                  {statusInfo ? (
                    <span className={`fls-tag fls-tag--${statusInfo.tone}`}>
                      {statusInfo.text}
                    </span>
                  ) : null}
                  {isCurrent ? (
                    <span className="fls-tag fls-tag--live">
                      This broadcast
                    </span>
                  ) : null}
                  {item.liveViews != null ? (
                    <span>{formatCount(item.liveViews)} watching</span>
                  ) : null}
                  {item.lengthSeconds ? (
                    <span>{formatUptime(item.lengthSeconds)}</span>
                  ) : null}
                  {item.reactions != null ? (
                    <span>{formatCount(item.reactions)} reactions</span>
                  ) : null}
                  {item.comments != null ? (
                    <span>{formatCount(item.comments)} comments</span>
                  ) : null}
                  {item.shares != null ? (
                    <span>{formatCount(item.shares)} shares</span>
                  ) : null}
                </div>
              </div>
              {item.permalinkUrl ? (
                <a
                  className="fls-btn fls-btn--quiet fls-item-open"
                  href={item.permalinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open this on Facebook in a new tab"
                >
                  View on Facebook
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      {data.fetchedAt ? (
        <div className="fls-fetched">
          Read from Facebook at {formatWhen(data.fetchedAt)}
        </div>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Studio
// ─────────────────────────────────────────────────────────────
export default function FacebookLiveStudio({ channelId }) {
  const [studio, setStudio] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [picking, setPicking] = useState(false);
  const [sourceOffline, setSourceOffline] = useState(false);
  const [diag, setDiag] = useState(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const formDirty = useRef(false);
  const popupCleanup = useRef(null);

  // Fetches studio state and returns a function that applies it, so the
  // effect below can apply results asynchronously (and skip them on unmount).
  const fetchStudio = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        const res = await api.get(`/api/channels/${channelId}/facebook/studio`);
        return () => {
          setStudio(res.data);
          setLoadError("");
          if (!formDirty.current && res.data.target) {
            setForm({
              title: res.data.target.broadcastTitle || "",
              description: res.data.target.broadcastDescription || "",
            });
          }
        };
      } catch (err) {
        return () => {
          if (!quiet)
            setLoadError(
              err.response?.data?.message ||
                "Could not load Facebook Live Studio.",
            );
        };
      }
    },
    [channelId],
  );

  const load = useCallback(
    async (options) => (await fetchStudio(options))(),
    [fetchStudio],
  );

  useEffect(() => {
    let active = true;
    const tick = (options) =>
      fetchStudio(options).then((apply) => {
        if (active) apply();
      });
    tick();
    const timer = setInterval(() => tick({ quiet: true }), 5000);
    const cleanupRef = popupCleanup;
    return () => {
      active = false;
      clearInterval(timer);
      cleanupRef.current?.();
    };
  }, [fetchStudio]);

  const openFacebookLogin = async ({ rerequest = false } = {}) => {
    setError("");
    setNotice("");
    setBusy("connect");
    popupCleanup.current?.();
    let popup = null;
    let settled = false;
    const cleanup = () => window.removeEventListener("message", onMessage);
    popupCleanup.current = cleanup;

    const onMessage = async (event) => {
      if (
        settled ||
        event.data?.type !== "social-oauth-result" ||
        event.data?.platform !== "facebook"
      )
        return;
      if (popup && event.source !== popup) return;
      if (event.origin !== apiOrigin()) return;
      settled = true;
      cleanup();
      setBusy("");
      if (!event.data.ok) {
        setError("Facebook sign-in was not completed. Try again.");
        return;
      }
      await load({ quiet: true });
      setPicking(true);
    };

    window.addEventListener("message", onMessage);
    try {
      const res = await api.post(
        `/api/channels/${channelId}/oauth/facebook/init`,
        rerequest ? { rerequest: true } : {},
      );
      popup = window.open(
        res.data.authUrl,
        "nlm-facebook-oauth",
        "width=620,height=760",
      );
      if (!popup)
        throw new Error(
          "Your browser blocked the Facebook window. Allow pop-ups for this site and try again.",
        );
      const watch = setInterval(() => {
        if (popup.closed) {
          clearInterval(watch);
          setTimeout(() => {
            if (!settled) {
              cleanup();
              setBusy("");
            }
          }, 800);
        }
      }, 700);
    } catch (err) {
      cleanup();
      setBusy("");
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not open Facebook sign-in.",
      );
    }
  };

  const goLive = async ({ force = false } = {}) => {
    setError("");
    setNotice("");
    setBusy("golive");
    try {
      const res = await api.post(
        `/api/channels/${channelId}/facebook/go-live`,
        {
          title: form.title,
          description: form.description,
          force,
        },
      );
      formDirty.current = false;
      setSourceOffline(false);
      setNotice(res.data.message || "You are live on Facebook");
      await load({ quiet: true });
    } catch (err) {
      if (err.response?.data?.code === "source_offline") {
        setSourceOffline(true);
      } else {
        setError(
          err.response?.data?.message || "Could not start the Facebook live.",
        );
      }
    } finally {
      setBusy("");
    }
  };

  const endLive = async () => {
    if (
      !window.confirm(
        "End the live video on Facebook? Viewers will see that the broadcast has ended.",
      )
    )
      return;
    setError("");
    setBusy("end");
    try {
      await api.post(`/api/channels/${channelId}/facebook/end-live`);
      setNotice("Facebook live ended. The video stays on your Page.");
      await load({ quiet: true });
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not end the Facebook live.",
      );
    } finally {
      setBusy("");
    }
  };

  const saveDetails = async () => {
    setError("");
    setBusy("save");
    try {
      await api.patch(`/api/channels/${channelId}/facebook/settings`, {
        title: form.title,
        description: form.description,
      });
      formDirty.current = false;
      setNotice(
        "Title and description saved. They’ll be used for the next Facebook live.",
      );
      await load({ quiet: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not save the title.");
    } finally {
      setBusy("");
    }
  };

  const runDiagnostics = async () => {
    setBusy("diag");
    setDiag({ running: true, checks: [] });
    try {
      const res = await api.post(
        `/api/channels/${channelId}/facebook/diagnostics`,
      );
      setDiag({ running: false, checks: res.data.checks || [] });
    } catch (err) {
      setDiag({
        running: false,
        checks: err.response?.data?.checks || [],
        error:
          err.response?.data?.message || "Could not run the Facebook check.",
      });
    } finally {
      setBusy("");
    }
  };

  const toggleAutoStart = async (value) => {
    setError("");
    try {
      const res = await api.patch(
        `/api/channels/${channelId}/facebook/settings`,
        { autoStart: value },
      );
      if (res.data?.started === true)
        setNotice(
          "Your encoder is already live, so NLM started the Facebook live.",
        );
      await load({ quiet: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not save that setting.");
    }
  };

  const disconnect = async () => {
    if (
      !window.confirm(
        "Disconnect Facebook from NLM Streaming? Facebook targets on this organization stop and Page access is removed.",
      )
    )
      return;
    setBusy("disconnect");
    setError("");
    try {
      const res = await api.get("/api/organizations/current/oauth-accounts");
      const ids = (res.data.accounts || [])
        .filter(
          (a) =>
            a.platform === "facebook_user" ||
            String(a.id) === String(studio?.page?.accountId),
        )
        .map((a) => a.id);
      for (const id of ids) {
        await api.delete(`/api/organizations/current/oauth-accounts/${id}`);
      }
      setPicking(false);
      setNotice("Facebook disconnected.");
      await load({ quiet: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not disconnect Facebook.");
    } finally {
      setBusy("");
    }
  };

  if (loadError && !studio)
    return (
      <section className="fls-shell">
        <div className="fls-error">{loadError}</div>
      </section>
    );
  if (!studio)
    return (
      <section className="fls-shell fls-muted">
        Loading Facebook Live Studio…
      </section>
    );

  const { facebook, page, target, live, lastBroadcast, channel } = studio;
  const isLive = Boolean(target?.liveVideoId) || Boolean(target?.workerRunning);
  const liveInfo = describeLiveStatus(live?.status);
  const step = !facebook.signedIn ? 1 : !page || picking ? 2 : isLive ? 4 : 3;
  const reconnect = facebook.reconnectRequired;
  const autoMode = Boolean(target?.autoStart);

  return (
    <section className="fls-shell" aria-labelledby={`fls-title-${channelId}`}>
      <header className="fls-head">
        <div className="fls-title">
          <span className="fls-fb-badge">
            <FacebookMark size={18} />
          </span>
          <div>
            <h4 id={`fls-title-${channelId}`}>Facebook Live</h4>
            <p>
              Go live on a Facebook Page you manage, straight from this channel.
            </p>
          </div>
        </div>
        {facebook.signedIn ? (
          <div className="fls-account">
            <span>
              Signed in as <strong>{facebook.signedInAs}</strong>
            </span>
            <button
              type="button"
              className="fls-btn fls-btn--quiet"
              onClick={disconnect}
              disabled={Boolean(busy) || isLive}
              title={
                isLive
                  ? "End the live before disconnecting"
                  : "Remove Facebook access from NLM Streaming"
              }
            >
              Disconnect
            </button>
          </div>
        ) : null}
      </header>

      <Steps current={step} />

      {!studio.configured ? (
        <div className="fls-error">
          Facebook isn’t configured on this server yet. Set FACEBOOK_APP_ID,
          FACEBOOK_APP_SECRET and FACEBOOK_CONFIG_ID.
        </div>
      ) : null}
      {error ? (
        <div className="fls-error" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="fls-notice" role="status">
          {notice}
        </div>
      ) : null}

      {/* Step 1: sign in */}
      {!facebook.signedIn || reconnect ? (
        <div className="fls-connect">
          <div>
            <strong>
              {reconnect ? "Reconnect Facebook" : "Connect your Facebook Page"}
            </strong>
            <p>
              {reconnect
                ? "Facebook access expired or was removed. Sign in again to keep going live."
                : "Sign in with Facebook, then pick the Pages NLM Streaming may publish live video to. You can change this later."}
            </p>
          </div>
          <button
            type="button"
            className="fls-btn fls-btn--facebook"
            onClick={() => openFacebookLogin()}
            disabled={busy === "connect" || !studio.configured}
            title="Opens Facebook in a new window so you can sign in and choose which Pages to share"
          >
            <FacebookMark />
            {busy === "connect"
              ? "Waiting for Facebook…"
              : "Continue with Facebook"}
          </button>
        </div>
      ) : null}

      {/* Step 2: choose Page */}
      {facebook.signedIn && !reconnect && (!page || picking) ? (
        <PagePicker
          channelId={channelId}
          canCancel={Boolean(page)}
          onCancel={() => setPicking(false)}
          onEditAccess={() => openFacebookLogin({ rerequest: true })}
          onSelected={async (chosen) => {
            setPicking(false);
            setNotice(
              `${chosen.pageName} is now this channel’s Facebook Page.`,
            );
            await load({ quiet: true });
          }}
        />
      ) : null}

      {/* Steps 3 and 4: broadcast + Page content */}
      {facebook.signedIn && page && !picking ? (
        <>
          <div
            className={isLive ? "fls-pagebar fls-pagebar--live" : "fls-pagebar"}
          >
            <PageAvatar
              url={page.pictureUrl}
              name={page.name}
              size={52}
              live={isLive}
            />
            <div className="fls-pagebar-text">
              <strong>{page.name}</strong>
              <span>
                {[
                  page.category,
                  formatCount(page.followers) &&
                    `${formatCount(page.followers)} followers`,
                ]
                  .filter(Boolean)
                  .join(", ") || "Facebook Page"}
              </span>
            </div>
            <div className="fls-pagebar-actions">
              <a
                className="fls-btn fls-btn--quiet"
                href={page.link}
                target="_blank"
                rel="noreferrer"
                title="Open this Page on Facebook in a new tab"
              >
                Open Page
              </a>
              <button
                type="button"
                className="fls-btn fls-btn--quiet"
                onClick={runDiagnostics}
                disabled={busy === "diag"}
                title="Checks permissions and asks Facebook whether this Page can go live. Nothing is posted."
              >
                {busy === "diag" ? "Checking…" : "Check Facebook setup"}
              </button>
              <button
                type="button"
                className="fls-btn fls-btn--quiet"
                onClick={() => setPicking(true)}
                disabled={isLive}
                title={
                  isLive
                    ? "End the live before changing Page"
                    : "Choose a different Page for this channel"
                }
              >
                Change Page
              </button>
            </div>
          </div>

          {diag ? (
            <section className="fls-diag" aria-label="Facebook setup check">
              <header>
                <strong>Facebook setup check</strong>
                <button
                  type="button"
                  className="fls-link"
                  onClick={() => setDiag(null)}
                >
                  Close
                </button>
              </header>
              {diag.running ? (
                <div className="fls-muted">Asking Facebook…</div>
              ) : null}
              {diag.error ? (
                <div className="fls-error">{diag.error}</div>
              ) : null}
              <ul>
                {diag.checks.map((check) => (
                  <li
                    key={check.id}
                    className={check.ok ? "fls-diag-ok" : "fls-diag-bad"}
                  >
                    <span aria-hidden="true">{check.ok ? "✓" : "✕"}</span>
                    <div>
                      <strong>{check.label}</strong>
                      {check.detail ? <small>{check.detail}</small> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="fls-grid">
            <section className="fls-broadcast" aria-label="Broadcast">
              {isLive ? (
                <div className="fls-onair">
                  <div className="fls-onair-head">
                    <span className={`fls-status fls-status--${liveInfo.tone}`}>
                      <span className="fls-dot" aria-hidden="true" />
                      {live ? liveInfo.text : "Starting"}
                    </span>
                    <span className="fls-clock">
                      {formatUptime(target.uptimeSeconds)}
                    </span>
                  </div>
                  <h5>
                    {live?.title || target.broadcastTitle || channel.name}
                  </h5>
                  <dl className="fls-stats">
                    <div>
                      <dt>Watching now</dt>
                      <dd>
                        {live?.liveViews != null
                          ? formatCount(live.liveViews)
                          : "–"}
                      </dd>
                    </div>
                    <div>
                      <dt>Bitrate sent</dt>
                      <dd>
                        {Number(target.bitrateKbps || 0).toLocaleString()} kbps
                      </dd>
                    </div>
                    <div>
                      <dt>Reconnects</dt>
                      <dd>{target.reconnects}</dd>
                    </div>
                  </dl>
                  <div className="fls-onair-actions">
                    {live?.permalinkUrl ? (
                      <a
                        className="fls-btn fls-btn--primary"
                        href={live.permalinkUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Open this live video on your Facebook Page"
                      >
                        Watch on Facebook
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className="fls-btn fls-btn--danger"
                      onClick={endLive}
                      disabled={busy === "end"}
                      title="Stop sending video and end the live video on Facebook"
                    >
                      {busy === "end" ? "Ending…" : "End live"}
                    </button>
                  </div>
                  {target.lastError && !target.deliveryVerified ? (
                    <div className="fls-warn">{target.lastError}</div>
                  ) : null}
                </div>
              ) : (
                <form
                  className="fls-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    goLive();
                  }}
                >
                  <div
                    className={autoMode ? "fls-auto fls-auto--on" : "fls-auto"}
                  >
                    <label
                      className="fls-switch"
                      title="When on, NLM starts and ends the Facebook live for you based on your encoder"
                    >
                      <input
                        type="checkbox"
                        role="switch"
                        checked={autoMode}
                        onChange={(e) => toggleAutoStart(e.target.checked)}
                      />
                      <span className="fls-switch-track" aria-hidden="true" />
                      <span className="fls-auto-label">
                        Automatic Facebook live {autoMode ? "on" : "off"}
                      </span>
                    </label>
                    <p>
                      {autoMode
                        ? `Start streaming in OBS (or NLM Stream Control) with this channel’s stream key. About 10 seconds later NLM goes live on ${page.name}. When you stop streaming, the Facebook live ends after a short grace period, so brief disconnects continue the same video.`
                        : "Facebook goes live only when you click the button below."}
                    </p>
                  </div>

                  <div
                    className={
                      channel.sourceLive
                        ? "fls-source fls-source--on"
                        : "fls-source"
                    }
                  >
                    <span className="fls-dot" aria-hidden="true" />
                    {channel.sourceLive
                      ? autoMode && !target?.failed
                        ? "Encoder connected. Starting the Facebook live…"
                        : "NLM is receiving video from your encoder"
                      : "Waiting for video from your encoder (OBS, vMix or hardware)"}
                  </div>

                  {target?.failed && target?.lastError ? (
                    <div className="fls-error" role="alert">
                      <strong>Facebook didn’t go live.</strong> Facebook said:{" "}
                      {target.lastError}
                      {target.lastErrorAt
                        ? ` (${formatWhen(target.lastErrorAt)})`
                        : ""}
                      <div className="fls-error-help">
                        {explainFacebookError(target.lastError)}{" "}
                        <button
                          type="button"
                          className="fls-link"
                          onClick={runDiagnostics}
                        >
                          Check Facebook setup
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <h5>Broadcast details</h5>
                  <label>
                    Title
                    <input
                      value={form.title}
                      maxLength={254}
                      placeholder={`${channel.name} – {date}`}
                      onChange={(e) => {
                        formDirty.current = true;
                        setForm((f) => ({ ...f, title: e.target.value }));
                      }}
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      rows={3}
                      value={form.description}
                      maxLength={5000}
                      placeholder="What’s this broadcast about?"
                      onChange={(e) => {
                        formDirty.current = true;
                        setForm((f) => ({ ...f, description: e.target.value }));
                      }}
                    />
                  </label>
                  <small className="fls-hint">
                    Placeholders for recurring services: {"{date}"} {"{time}"}{" "}
                    {"{weekday}"} {"{channel}"}. Example: Sunday Service –{" "}
                    {"{date}"}
                  </small>
                  <button
                    type="button"
                    className="fls-btn fls-btn--quiet"
                    onClick={saveDetails}
                    disabled={busy === "save"}
                    title="Save the title and description for the next Facebook live without going live"
                  >
                    {busy === "save" ? "Saving…" : "Save details"}
                  </button>

                  {sourceOffline ? (
                    <div className="fls-warn">
                      NLM isn’t receiving video for this channel yet. Start your
                      encoder first.
                      <button
                        type="button"
                        className="fls-link"
                        onClick={() => goLive({ force: true })}
                      >
                        Go live anyway
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    className={
                      autoMode
                        ? "fls-btn fls-btn--quiet fls-btn--wide"
                        : "fls-btn fls-btn--golive"
                    }
                    disabled={
                      busy === "golive" ||
                      page.connectionStatus === "reconnect_required"
                    }
                    title={`Creates a live video on ${page.name} now and starts sending this channel to it`}
                  >
                    {busy === "golive"
                      ? "Going live…"
                      : autoMode
                        ? "Go live now"
                        : `Go live on ${page.name}`}
                  </button>
                  {lastBroadcast ? (
                    <div className="fls-last">
                      <span>Last broadcast</span>
                      <strong>{lastBroadcast.title}</strong>
                      <span
                        className={`fls-tag fls-tag--${describeLiveStatus(lastBroadcast.status).tone}`}
                      >
                        {describeLiveStatus(lastBroadcast.status).text}
                      </span>
                      {lastBroadcast.permalinkUrl ? (
                        <a
                          className="fls-link"
                          href={lastBroadcast.permalinkUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View on Facebook
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </form>
              )}
            </section>

            <PageContent
              channelId={channelId}
              page={page}
              liveId={target?.liveVideoId || target?.lastLiveVideoId || null}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
