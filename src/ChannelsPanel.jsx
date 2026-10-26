import { useEffect, useMemo, useState } from "react";
import api from "./api";
import StreamTargets from "./StreamTargets";
import PullSources from "./PullSources";
import { useSubscription } from "./SubscriptionContext.jsx";

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

/* ── Icons ── */
function IconCopy() {
  return (
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconExternalLink() {
  return (
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconChannel() {
  return (
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
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconTrash() {
  return (
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function IconCode() {
  return (
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
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconRefresh() {
  return (
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
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

/* ── EmbedModal — Copy Embed Code (Phase 1) ──
   Kept self-contained with inline styles so it doesn't depend on the
   existing cp-* stylesheet (not part of this handoff) beyond reusing
   CopyField for the generated snippet. */
function EmbedModal({ channel, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [savedSettings, setSavedSettings] = useState({
    autoplay: true,
    muted: true,
    controls: true,
    chat: false,
  });
  const [settings, setSettings] = useState(savedSettings);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get(`/api/channels/${channel.id}/embed`);
        if (cancelled) return;
        setEmbedUrl(res.data.embed_url || "");
        const s = {
          autoplay: true,
          muted: true,
          controls: true,
          chat: false,
          ...(res.data.embed_settings || {}),
        };
        setSavedSettings(s);
        setSettings(s);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || "Failed to load embed info.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel.id]);

  const toggle = (key) =>
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));

  const embedSrc = useMemo(() => {
    if (!embedUrl) return "";
    const params = new URLSearchParams({
      autoplay: settings.autoplay ? "1" : "0",
      muted: settings.muted ? "1" : "0",
      controls: settings.controls ? "1" : "0",
      chat: settings.chat ? "1" : "0",
    });
    return `${embedUrl}?${params.toString()}`;
  }, [embedUrl, settings]);

  // Desktop/tablet: classic 16:9 responsive wrapper (padding-top: 56.25%
  // keeps aspect ratio at any container width). Mobile specifically uses a
  // deliberate override — a bare 16:9 box gets very short on a narrow
  // phone screen (e.g. ~219px tall on a 390px-wide iPhone), so under
  // 640px the wrapper switches to a fixed 70vh instead, filling much more
  // of the screen. This needs a real CSS class + <style> block rather
  // than pure inline styles, since inline styles can't be conditionally
  // overridden by a media query — inline always wins over a CSS rule.
  // Class name is scoped to this channel's own id so multiple different
  // embeds on the same host page never collide with each other's styling.
  const embedWrapClass = channel?.id ? `nlm-embed-${channel.id}` : "nlm-embed";

  const iframeSnippet = embedSrc
    ? `<style>
  .${embedWrapClass} {
    position: relative;
    width: 100%;
    overflow: hidden;
    padding-top: 56.25%;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
  }
  @media (max-width: 640px) {
    .${embedWrapClass} {
      padding-top: 0;
      height: 70vh;
    }
  }
  .${embedWrapClass} iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
    border-radius: 12px;
  }
</style>
<div class="${embedWrapClass}">
  <iframe
    src="${embedSrc}"
    scrolling="no"
    frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen webkitallowfullscreen mozallowfullscreen oallowfullscreen msallowfullscreen>
  </iframe>
</div>`
    : "";

  const saveDefaults = async () => {
    try {
      setSaving(true);
      setError("");
      await api.patch(`/api/channels/${channel.id}/embed/settings`, settings);
      setSavedSettings(settings);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save defaults.");
    } finally {
      setSaving(false);
    }
  };

  const regenerateEmbedLink = async () => {
    if (
      !window.confirm(
        "Regenerate the embed link? Any iframe already placed on a website with the current link will stop working until it's updated with the new one.",
      )
    )
      return;

    try {
      setRegenerating(true);
      setError("");
      const res = await api.post(
        `/api/channels/${channel.id}/embed/regenerate`,
      );
      setEmbedUrl(res.data.embed_url || "");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to regenerate embed link.",
      );
    } finally {
      setRegenerating(false);
    }
  };

  const hasUnsavedDefaults =
    JSON.stringify(settings) !== JSON.stringify(savedSettings);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,10,12,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#17181b",
          color: "#e7e9ec",
          borderRadius: 12,
          maxWidth: 560,
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          padding: 24,
          border: "1px solid #2a2b2f",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>
              Embed “{channel.name}” on your website
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9aa0a6" }}>
              Paste this code anywhere on your site. It auto-plays when the
              channel goes live and shows an offline message otherwise.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#9aa0a6",
              fontSize: 18,
              cursor: "pointer",
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: "#9aa0a6" }}>Loading…</p>
        ) : (
          <>
            {error && (
              <div
                style={{
                  background: "#3a1c20",
                  color: "#f4a3ac",
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  marginBottom: 12,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                ["autoplay", "Autoplay when live"],
                ["muted", "Start muted"],
                ["controls", "Show player controls"],
                ["chat", "Show live chat"],
              ].map(([key, label]) => (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    background: "#1e1f23",
                    borderRadius: 6,
                    padding: "8px 10px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!settings[key]}
                    onChange={() => toggle(key)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <textarea
                readOnly
                value={iframeSnippet}
                rows={12}
                style={{
                  width: "100%",
                  background: "#0f1012",
                  color: "#d7dadd",
                  border: "1px solid #2a2b2f",
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="cp-copy-btn"
                  onClick={() => navigator.clipboard.writeText(iframeSnippet)}
                >
                  <IconCopy /> Copy Embed Code
                </button>
                <button
                  type="button"
                  className="secondary-btn small"
                  disabled={saving || !hasUnsavedDefaults}
                  onClick={saveDefaults}
                  title="Remember these toggles as the default for this channel's embed"
                >
                  {saving ? "Saving…" : "Save as Default"}
                </button>
              </div>
              <button
                type="button"
                className="secondary-btn small"
                disabled={regenerating}
                onClick={regenerateEmbedLink}
                title="Invalidate the current embed link and issue a new one"
              >
                <IconRefresh />{" "}
                {regenerating ? "Regenerating…" : "Regenerate Link"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── CopyField — shows value with copy button and toast ── */
function CopyField({ label, value, mono = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="cp-field">
      <span className="cp-field-label">{label}</span>
      <span className={`cp-field-value${mono ? " cp-field-mono" : ""}`}>
        {value}
      </span>
      <button
        type="button"
        className={`cp-copy-btn${copied ? " cp-copy-btn--done" : ""}`}
        onClick={handleCopy}
        title={`Copy ${label}`}
      >
        {copied ? (
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
        ) : (
          <IconCopy />
        )}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
function ChannelsPanel() {
  const currentAdmin = useMemo(() => getStoredAdmin(), []);
  const [currentOrganization, setCurrentOrganization] = useState(
    getStoredOrganization,
  );

  const isSuperAdmin = currentAdmin.role === "super_admin";
  const orgRole = currentOrganization.membership_role || "";
  const canManage = isSuperAdmin || ["owner", "admin"].includes(orgRole);
  const { hasFeature } = useSubscription();
  const planIncludesRecording = isSuperAdmin || hasFeature("recording_enabled");

  const [channels, setChannels] = useState([]);
  const [mediaNodes, setMediaNodes] = useState([]);
  const [assigningNodeChannelId, setAssigningNodeChannelId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [subscription, setSubscription] = useState(null);
  const [embedChannel, setEmbedChannel] = useState(null); // channel object, or null when modal closed
  const [regeneratingKeyId, setRegeneratingKeyId] = useState(null);
  const [manualRecordingStatus, setManualRecordingStatus] = useState({});
  const [manualRecordingActionId, setManualRecordingActionId] = useState(null);
  const [manualRecordingNow, setManualRecordingNow] = useState(Date.now());

  const fetchChannels = async () => {
    try {
      setError("");
      const res = await api.get("/api/channels");
      setChannels(res.data.channels || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load channels.");
    } finally {
      setLoading(false);
    }
  };

  const loadMediaNodes = async () => {
    if (!isSuperAdmin) return;
    try {
      const res = await api.get("/api/admin/media-nodes");
      setMediaNodes(res.data.nodes || []);
    } catch (err) {
      console.error("Failed to fetch media nodes:", err);
    }
  };

  const assignMediaNode = async (channel, value) => {
    if (!isSuperAdmin) return;
    const mediaNodeId = value ? Number(value) : null;
    try {
      setAssigningNodeChannelId(channel.id);
      setNotice("");
      setError("");
      await api.patch(`/api/admin/channels/${channel.id}/media-node`, {
        media_node_id: mediaNodeId,
      });
      setNotice(`${channel.name} media-node assignment updated.`);
      await Promise.all([fetchChannels(), loadMediaNodes()]);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to update media-node assignment.",
      );
    } finally {
      setAssigningNodeChannelId(null);
    }
  };

  const loadSubscription = async () => {
    try {
      const res = await api.get("/api/subscription/current");
      setSubscription(res.data.subscription || null);
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    }
  };

  const channelLimitReached =
    subscription &&
    Number(subscription.used_channels || channels.length || 0) >=
      Number(subscription.max_channels || 0);

  useEffect(() => {
    const handleOrgChange = (e) => {
      setCurrentOrganization(e.detail?.organization || getStoredOrganization());
      setLoading(true);
      fetchChannels();
      loadSubscription();
      loadMediaNodes();
    };

    window.addEventListener("nlm-organization-changed", handleOrgChange);
    fetchChannels();
    loadSubscription();
    loadMediaNodes();

    return () =>
      window.removeEventListener("nlm-organization-changed", handleOrgChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Without this, a channel going live in OBS never updates is_live in
  // this component's state until someone manually reloads the page — the
  // initial fetchChannels() above only ever runs once. This matters most
  // for the Manual Recording control below, which depends on is_live
  // being current, not just RTMP/embed details that don't change once a
  // channel exists.
  useEffect(() => {
    const interval = setInterval(fetchChannels, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll manual-recording status only for channels that are actually
  // live — a channel that isn't broadcasting can't have a manual
  // recording running, so there's no point checking.
  useEffect(() => {
    const liveChannels = channels.filter((c) => c.is_live);
    if (liveChannels.length === 0) return undefined;

    const loadStatuses = async () => {
      const entries = await Promise.all(
        liveChannels.map(async (c) => {
          try {
            const res = await api.get(
              `/api/channels/${c.id}/manual-recording/status`,
            );
            return [c.id, res.data];
          } catch {
            return [c.id, null];
          }
        }),
      );
      setManualRecordingStatus((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }));
    };

    loadStatuses();
    const interval = setInterval(loadStatuses, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels.map((c) => c.is_live).join(",")]);

  useEffect(() => {
    const tick = setInterval(() => setManualRecordingNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleStartManualRecording = async (channel) => {
    try {
      setManualRecordingActionId(channel.id);
      setError("");
      await api.post(`/api/channels/${channel.id}/manual-recording/start`);
      setNotice(`Manual recording started for ${channel.name}.`);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to start manual recording.",
      );
    } finally {
      setManualRecordingActionId(null);
    }
  };

  const handleStopManualRecording = async (channel) => {
    try {
      setManualRecordingActionId(channel.id);
      setError("");
      await api.post(`/api/channels/${channel.id}/manual-recording/stop`);
      setNotice(
        `Manual recording stopped for ${channel.name} — it'll appear in Recordings shortly.`,
      );
      setManualRecordingStatus((prev) => ({
        ...prev,
        [channel.id]: { recording: false, startedAt: null },
      }));
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to stop manual recording.",
      );
    } finally {
      setManualRecordingActionId(null);
    }
  };

  const formatRecordingElapsed = (startedAt) => {
    if (!startedAt) return "0:00";
    const totalSeconds = Math.max(
      0,
      Math.floor((manualRecordingNow - new Date(startedAt).getTime()) / 1000),
    );
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const createChannel = async (e) => {
    e.preventDefault();

    if (!canManage) {
      setError(
        "You do not have permission to create channels for this tenant.",
      );
      return;
    }
    if (channelLimitReached) {
      setError(
        `Your ${subscription?.plan_name || "current"} plan allows ${subscription?.max_channels || 0} channel(s). Upgrade to add more.`,
      );
      return;
    }

    try {
      setSaving(true);
      setNotice("");
      setError("");
      await api.post("/api/channels", form);
      setForm({ name: "", description: "" });
      setNotice("Channel created successfully.");
      fetchChannels();
      loadSubscription();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create channel.");
    } finally {
      setSaving(false);
    }
  };

  const deleteChannel = async (id) => {
    if (!canManage) {
      setError("You do not have permission to delete channels.");
      return;
    }
    if (!window.confirm("Delete this channel? This cannot be undone.")) return;

    try {
      setNotice("");
      setError("");
      await api.delete(`/api/channels/${id}`);
      setNotice("Channel deleted successfully.");
      fetchChannels();
      loadSubscription();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete channel.");
    }
  };

  const forceOfflineChannel = async (channel) => {
    if (
      !window.confirm(
        `Clear the "live" status for ${channel.name}? Only do this if the channel is stuck showing live but nothing is actually streaming.`,
      )
    )
      return;

    try {
      setNotice("");
      setError("");
      await api.post(`/api/channels/${channel.id}/force-offline`);
      setNotice(`Cleared stuck live status for ${channel.name}.`);
      fetchChannels();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to clear live status.");
    }
  };

  // "Record all incoming streams" toggle (Wowza-parity, 2026-08-10) —
  // layered on top of whatever the org's plan already allows; this can
  // only ever narrow recording (turn it off for one channel), never
  // grant it beyond what the plan permits — that's still enforced
  // server-side regardless of this toggle's state.
  const toggleAutoRecord = async (channel) => {
    const nextEnabled = !(channel.auto_record_enabled !== false);

    try {
      setNotice("");
      setError("");
      await api.put(`/api/channels/${channel.id}/recording-toggle`, {
        auto_record_enabled: nextEnabled,
      });
      setNotice(
        nextEnabled
          ? `${channel.name} will now record every broadcast automatically.`
          : `Automatic recording turned off for ${channel.name}.`,
      );
      fetchChannels();
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to update recording setting.",
      );
    }
  };

  // PHASE 2 — secure stream key rotation. super_admin only — a leaked/
  // compromised key is a support-grade action, not something an org's own
  // owner/admin/operator should trigger on themselves. Blocked server-side
  // while live too; double-confirmed here since it breaks the current
  // OBS/encoder connection until the client updates it with the new key.
  const regenerateStreamKey = async (channel) => {
    if (!isSuperAdmin) {
      setError("Only a platform super admin can rotate stream keys.");
      return;
    }
    if (channel.is_live) {
      setError(
        `${channel.name} is currently live. Stop the broadcast before rotating its stream key.`,
      );
      return;
    }
    if (
      !window.confirm(
        `Regenerate the stream key for "${channel.name}"? The current key will stop working immediately — you'll need to update OBS/your encoder with the new one before going live again.`,
      )
    )
      return;

    try {
      setRegeneratingKeyId(channel.id);
      setNotice("");
      setError("");
      await api.post(`/api/channels/${channel.id}/regenerate-key`);
      setNotice(
        `Stream key regenerated for ${channel.name}. Update your encoder before going live.`,
      );
      fetchChannels();
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to regenerate stream key.",
      );
    } finally {
      setRegeneratingKeyId(null);
    }
  };

  const usedChannels = subscription?.used_channels ?? channels.length;
  const maxChannels = subscription?.max_channels ?? "∞";
  const usagePct = subscription?.max_channels
    ? Math.min(100, (usedChannels / subscription.max_channels) * 100)
    : 0;

  return (
    <div className="cp-page">
      {/* ── Page header ── */}
      <div className="cp-page-header">
        <div className="cp-page-header-left">
          <div className="cp-page-icon">
            <IconChannel />
          </div>
          <div>
            <h2 className="cp-page-title">Channels</h2>
            <p className="cp-page-sub">
              {currentOrganization.name
                ? `Manage stream keys for ${currentOrganization.name}.`
                : "Manage organization stream keys."}
            </p>
          </div>
        </div>
        <span className="cp-usage-pill">
          <span className="cp-usage-dot" />
          {usedChannels} / {maxChannels} Channels
        </span>
      </div>

      {/* ── Banners ── */}
      {notice && (
        <div className="cp-banner cp-banner--success">
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {notice}
        </div>
      )}
      {error && (
        <div className="cp-banner cp-banner--error">
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

      {/* ── Subscription usage card ── */}
      {subscription && (
        <div className="cp-sub-card">
          <div className="cp-sub-card-top">
            <div>
              <span className="cp-sub-plan">{subscription.plan_name} Plan</span>
              <span
                className={`cp-sub-status cp-sub-status--${subscription.status}`}
              >
                {subscription.status}
              </span>
            </div>
            <span className="cp-sub-count">
              {usedChannels} of {maxChannels} channels used
            </span>
          </div>
          {subscription.max_channels > 0 && (
            <div className="cp-usage-bar">
              <div
                className={`cp-usage-bar-fill${channelLimitReached ? " cp-usage-bar-fill--full" : ""}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Read-only notice ── */}
      {!canManage && (
        <div className="cp-readonly-notice">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          You can view stream settings, but only organization owners/admins can
          create or delete channels.
        </div>
      )}

      {/* ── Create channel form ── */}
      {canManage && (
        <div className="cp-form-card card">
          <div className="cp-form-header">
            <h3 className="cp-form-title">Create Channel</h3>
            <p className="cp-form-sub">
              A unique stream key is generated automatically once you create the
              channel.
            </p>
          </div>

          <form className="cp-form" onSubmit={createChannel}>
            <div className="cp-form-grid">
              <div className="cp-field-wrap">
                <label className="cp-label">Channel Name</label>
                <div className="cp-input-wrap">
                  <svg
                    className="cp-input-icon"
                    width="14"
                    height="14"
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
                  <input
                    className="cp-input"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Sunday Service"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="cp-field-wrap">
              <label className="cp-label">
                Description <span className="cp-label-opt">(optional)</span>
              </label>
              <textarea
                className="cp-textarea"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Brief description of this channel"
              />
            </div>

            <div className="cp-form-actions">
              <button
                type="submit"
                className="cp-submit-btn"
                disabled={saving || channelLimitReached}
              >
                {saving ? (
                  <>
                    <span className="cp-spinner" />
                    Creating…
                  </>
                ) : channelLimitReached ? (
                  "Channel Limit Reached"
                ) : (
                  <>
                    Create Channel
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
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Channel list ── */}
      <div className="cp-channel-list">
        {loading ? (
          <div className="cp-loading">
            <div className="cp-spinner-lg" />
            <span>Loading channels…</span>
          </div>
        ) : channels.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-icon">
              <IconChannel />
            </div>
            <strong>No channels yet.</strong>
            <p>
              Create a channel to generate RTMP, SRT, and public playback links.
            </p>
          </div>
        ) : (
          channels.map((channel) => {
            // Phase 2 — node-aware ingest routing.
            // Assigned channels use routing returned by the backend/media-node
            // registry. The legacy environment host is retained only as a
            // safety fallback for an unassigned/older channel record.
            const fallbackIngestHost =
              import.meta.env.VITE_INGEST_HOST ||
              new URL(import.meta.env.VITE_API_BASE).hostname;
            const ingestHost =
              channel.routing?.ingest_host ||
              channel.media_node_public_ip ||
              channel.media_node_hostname ||
              fallbackIngestHost;
            const rtmpServer =
              channel.routing?.rtmp_server || `rtmp://${ingestHost}/live`;
            const streamKey = channel.stream_key;
            const srtUrl =
              channel.routing?.srt_publish_url ||
              `srt://${ingestHost}:10080?streamid=#!::r=live/${channel.stream_key},m=publish`;
            // Public HLS URL for external players (VLC, smart TVs, other
            // sites). Uses the playback ID — never the stream key — and the
            // backend's own /api/hls route. The old value pointed at a raw
            // CDN /hls/ path that no longer exists and exposed the key.
            const playbackUrl = channel.playback_id
              ? `${import.meta.env.VITE_API_BASE.replace(/\/$/, "")}/api/hls/${channel.playback_id}.m3u8`
              : "";
            const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");
            // Phase 2: public watch links use the playback ID, never the
            // stream key (ingest credential).
            const watchUrl = `${window.location.origin}${appBase}/watch/${channel.playback_id || channel.stream_key}`;

            return (
              <div key={channel.id} className="cp-channel-card">
                {/* Card header */}
                <div className="cp-card-header">
                  <div className="cp-card-header-left">
                    <div className="cp-channel-avatar">
                      {(channel.name || "C")[0].toUpperCase()}
                    </div>
                    <div>
                      <h3 className="cp-channel-name">{channel.name}</h3>
                      <p className="cp-channel-desc">
                        {channel.description || "No description"}
                      </p>
                    </div>
                  </div>
                  <div className="cp-card-header-actions">
                    <button
                      type="button"
                      className="cp-watch-btn"
                      onClick={() => window.open(watchUrl, "_blank")}
                    >
                      <IconExternalLink />
                      Watch Page
                    </button>
                    <button
                      type="button"
                      className="cp-watch-btn"
                      onClick={() => setEmbedChannel(channel)}
                      title="Get an iframe embed code for this channel"
                    >
                      <IconCode />
                      Copy Embed Code
                    </button>
                    {isSuperAdmin && channel.is_live && (
                      <button
                        type="button"
                        className="secondary-btn small"
                        onClick={() => forceOfflineChannel(channel)}
                        title="Clear a stuck live status (SRS/DB out of sync)"
                      >
                        Force Offline
                      </button>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        className="cp-delete-btn"
                        onClick={() => deleteChannel(channel.id)}
                        title="Delete channel"
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                </div>

                {isSuperAdmin && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 14,
                      flexWrap: "wrap",
                      margin: "0 0 14px",
                      padding: "12px 14px",
                      border: "1px solid #2a2b2f",
                      borderRadius: 10,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13 }}>Media Node</strong>
                      <p
                        style={{
                          margin: "3px 0 0",
                          fontSize: 12,
                          opacity: 0.7,
                        }}
                      >
                        {channel.media_node_name || "No media node assigned"}
                        {channel.media_node_region
                          ? ` · ${channel.media_node_region}`
                          : ""}
                        {channel.routing?.ingest_host
                          ? ` · routes to ${channel.routing.ingest_host}`
                          : ""}
                        {channel.is_live ? " · Stop broadcast to change." : ""}
                      </p>
                    </div>
                    <select
                      value={channel.media_node_id || ""}
                      disabled={
                        channel.is_live || assigningNodeChannelId === channel.id
                      }
                      onChange={(e) => assignMediaNode(channel, e.target.value)}
                      style={{
                        minWidth: 220,
                        padding: "8px 10px",
                        borderRadius: 7,
                        border: "1px solid #34363b",
                        background: "#17181b",
                        color: "#e7e9ec",
                        fontSize: 12.5,
                      }}
                    >
                      <option value="">Unassigned</option>
                      {mediaNodes.map((node) => (
                        <option
                          key={node.id}
                          value={node.id}
                          disabled={!node.is_enabled || node.is_draining}
                        >
                          {node.name}
                          {node.region ? ` · ${node.region}` : ""}
                          {node.effective_status
                            ? ` · ${node.effective_status}`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Stream credentials */}
                <div className="cp-fields">
                  <CopyField label="RTMP Server" value={rtmpServer} mono />
                  <CopyField label="Stream Key" value={streamKey} mono />
                  <CopyField label="SRT URL" value={srtUrl} mono />
                  {playbackUrl && (
                    <CopyField label="Playback URL" value={playbackUrl} mono />
                  )}
                  <CopyField label="Watch Page" value={watchUrl} />
                </div>

                {isSuperAdmin && (
                  <div style={{ marginTop: 4, marginBottom: 12 }}>
                    <button
                      type="button"
                      className="secondary-btn small"
                      disabled={regeneratingKeyId === channel.id}
                      onClick={() => regenerateStreamKey(channel)}
                      title="Issue a new stream key for this channel (breaks the current OBS/encoder connection) — super admin only"
                    >
                      <IconRefresh />{" "}
                      {regeneratingKeyId === channel.id
                        ? "Regenerating…"
                        : "Regenerate Stream Key"}
                    </button>
                  </div>
                )}

                {canManage && (
                  <div className="cp-record-toggle-row">
                    {planIncludesRecording ? (
                      <>
                        <label className="cp-record-toggle">
                          <input
                            type="checkbox"
                            checked={channel.auto_record_enabled !== false}
                            onChange={() => toggleAutoRecord(channel)}
                          />
                          <span className="cp-record-toggle-slider" />
                        </label>
                        <div>
                          <strong>Record all incoming streams</strong>
                          <p>
                            When on, every broadcast on this channel is
                            automatically archived. Turn off to stop recording
                            this specific channel without affecting others.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <label className="cp-record-toggle cp-record-toggle--locked">
                          <input type="checkbox" checked={false} disabled />
                          <span className="cp-record-toggle-slider" />
                        </label>
                        <div>
                          <strong>Record all incoming streams</strong>
                          <p>
                            Recording isn't included on your current plan.
                            Upgrade to Deluxe or Premium to automatically
                            archive every broadcast on this channel.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {canManage && planIncludesRecording && channel.is_live && (
                  <div className="cp-manual-rec-row">
                    <div>
                      <strong>Manual Recording</strong>
                      <p>
                        Record just part of this live broadcast, independent of
                        the automatic recording setting above — produces its own
                        separate clip.
                      </p>
                    </div>
                    {manualRecordingStatus[channel.id]?.recording ? (
                      <button
                        type="button"
                        className="cp-manual-rec-btn cp-manual-rec-btn--stop"
                        onClick={() => handleStopManualRecording(channel)}
                        disabled={manualRecordingActionId === channel.id}
                      >
                        <span className="cp-manual-rec-dot" />
                        {manualRecordingActionId === channel.id
                          ? "Stopping…"
                          : `Stop · ${formatRecordingElapsed(
                              manualRecordingStatus[channel.id]?.startedAt,
                            )}`}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cp-manual-rec-btn"
                        onClick={() => handleStartManualRecording(channel)}
                        disabled={manualRecordingActionId === channel.id}
                      >
                        {manualRecordingActionId === channel.id
                          ? "Starting…"
                          : "Start Recording"}
                      </button>
                    )}
                  </div>
                )}

                <PullSources channelId={channel.id} canManage={canManage} />
                <StreamTargets channelId={channel.id} />
              </div>
            );
          })
        )}
      </div>

      {embedChannel && (
        <EmbedModal
          channel={embedChannel}
          onClose={() => setEmbedChannel(null)}
        />
      )}
    </div>
  );
}

export default ChannelsPanel;
