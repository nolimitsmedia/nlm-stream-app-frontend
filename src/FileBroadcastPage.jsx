import { useEffect, useState } from "react";
import api from "./api";

function PanelHeader({ title, sub, badge }) {
  return (
    <div className="fb-panel-header">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {badge && <span className="fb-badge">{badge}</span>}
    </div>
  );
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 MB";
  const mb = Number(bytes) / 1024 ** 2;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatElapsed(startedAt, now) {
  if (!startedAt) return "0s";
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(startedAt).getTime()) / 1000),
  );
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function FileBroadcastPage() {
  const [channels, setChannels] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedRecordingId, setSelectedRecordingId] = useState("");
  const [loop, setLoop] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  const loadChannelsAndRecordings = async () => {
    try {
      setLoading(true);
      const [channelsRes, recordingsRes] = await Promise.all([
        api.get("/api/channels"),
        api.get("/api/recordings"),
      ]);
      const channelList = channelsRes.data.channels || [];
      setChannels(channelList);
      setRecordings(recordingsRes.data.recordings || []);
      if (!selectedChannelId && channelList.length) {
        setSelectedChannelId(String(channelList[0].id));
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to load channels/recordings.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async (channelId) => {
    if (!channelId) {
      setStatus(null);
      return;
    }
    try {
      const res = await api.get(
        `/api/channels/${channelId}/file-broadcast/status`,
      );
      setStatus(res.data);
    } catch {
      setStatus(null);
    }
  };

  useEffect(() => {
    loadChannelsAndRecordings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadStatus(selectedChannelId);
    const interval = setInterval(() => loadStatus(selectedChannelId), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannelId]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleStart = async () => {
    if (!selectedChannelId || !selectedRecordingId) {
      setError("Choose a channel and a recording first.");
      return;
    }
    try {
      setStarting(true);
      setError("");
      await api.post(
        `/api/channels/${selectedChannelId}/file-broadcast/start`,
        { recording_id: Number(selectedRecordingId), loop },
      );
      await loadStatus(selectedChannelId);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to start file broadcast.",
      );
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      setStopping(true);
      setError("");
      await api.post(`/api/channels/${selectedChannelId}/file-broadcast/stop`);
      await loadStatus(selectedChannelId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to stop file broadcast.");
    } finally {
      setStopping(false);
    }
  };

  const selectedChannel = channels.find(
    (c) => String(c.id) === String(selectedChannelId),
  );
  const runningRecording = recordings.find(
    (r) => String(r.id) === String(status?.recordingId),
  );
  const isRunning = Boolean(status?.running);

  return (
    <div className="fb-page">
      <div className="fb-page-header">
        <div className="fb-page-header-left">
          <div className="fb-page-icon">
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
          </div>
          <div>
            <h2 className="fb-page-title">File Broadcast</h2>
            <p className="fb-page-sub">
              Stream a pre-uploaded recording out through the live pipeline —
              repeat airings, time-zone rebroadcasts, or filling a scheduled
              slot with pre-recorded content.
            </p>
          </div>
        </div>
      </div>

      {error && <div className="fb-error">{error}</div>}

      {loading ? (
        <p className="fb-loading">Loading channels and recordings…</p>
      ) : (
        <div className="fb-layout-grid">
          <section className="fb-panel">
            <PanelHeader
              title="Configure Broadcast"
              sub="Choose a channel and a recording to stream as live."
            />

            <div className="fb-field">
              <label>Channel</label>
              <select
                value={selectedChannelId}
                onChange={(e) => setSelectedChannelId(e.target.value)}
                disabled={isRunning}
              >
                {channels.length === 0 && <option value="">No channels</option>}
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="fb-field">
              <label>Recording</label>
              <select
                value={selectedRecordingId}
                onChange={(e) => setSelectedRecordingId(e.target.value)}
                disabled={isRunning}
              >
                <option value="">Select a recording…</option>
                {recordings.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.filename} · {formatBytes(r.size)}
                  </option>
                ))}
              </select>
            </div>

            <label className="fb-checkbox-row">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                disabled={isRunning}
              />
              <span>
                Loop continuously
                <small>
                  Off = broadcast ends automatically when the file finishes. On
                  = repeats until manually stopped.
                </small>
              </span>
            </label>

            <div className="fb-actions">
              {isRunning ? (
                <button
                  type="button"
                  className="fb-btn fb-btn--danger"
                  onClick={handleStop}
                  disabled={stopping}
                >
                  {stopping ? "Stopping…" : "Stop Broadcast"}
                </button>
              ) : (
                <button
                  type="button"
                  className="fb-btn fb-btn--primary"
                  onClick={handleStart}
                  disabled={starting || !selectedRecordingId}
                >
                  {starting ? "Starting…" : "Start Broadcast"}
                </button>
              )}
            </div>
          </section>

          <section className="fb-panel">
            <PanelHeader
              title="Status"
              sub={
                selectedChannel
                  ? `Channel: ${selectedChannel.name}`
                  : "Select a channel"
              }
              badge={isRunning ? "LIVE" : "Idle"}
            />

            {isRunning ? (
              <div className="fb-status-grid">
                <div className="fb-status-tile">
                  <span>Now Playing</span>
                  <strong>{runningRecording?.filename || "Recording"}</strong>
                </div>
                <div className="fb-status-tile">
                  <span>Loop</span>
                  <strong>{loop ? "On" : "Off"}</strong>
                </div>
                <div className="fb-status-tile">
                  <span>Elapsed</span>
                  <strong>{formatElapsed(status?.startedAt, now)}</strong>
                </div>
              </div>
            ) : (
              <div className="fb-empty">
                <p>No file broadcast currently running on this channel.</p>
                <p className="fb-empty-sub">
                  Once started, this behaves exactly like a real broadcast — it
                  shows up on Live Monitor, gets transcoded to ABR, and can be
                  watched from the normal public watch page.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default FileBroadcastPage;
