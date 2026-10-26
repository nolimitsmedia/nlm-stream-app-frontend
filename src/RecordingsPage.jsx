import { useEffect, useMemo, useState } from "react";
import api from "./api";

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

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSize(size) {
  const bytes = Number(size || 0);

  if (!bytes) return "0 MB";

  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(2)} MB`;

  return `${(mb / 1024).toFixed(2)} GB`;
}

function cleanDisplayName(file = "") {
  return String(file)
    .replace(/\.(flv|mp4|mkv|mov)$/i, "")
    .replace(/[_-]/g, " ");
}

function getRecordingKey(recording) {
  return `${recording.stream}-${recording.file}`;
}

function getProcessingLabel(recording) {
  const status = recording.processing_status || "pending";

  if (recording.playable || status === "ready") return "Ready";
  if (status === "processing") return "Processing";
  if (status === "waiting") return "Waiting";
  if (status === "failed") return "Failed";
  return "Needs Processing";
}

function getProcessingClass(recording) {
  const status = recording.processing_status || "pending";

  if (recording.playable || status === "ready") return "status-ready";
  if (status === "processing") return "status-processing";
  if (status === "waiting") return "status-waiting";
  if (status === "failed") return "status-failed";
  return "status-pending";
}

function groupRecordingsByChannelMonthDay(recordings) {
  const channelMap = new Map();

  for (const recording of recordings) {
    const channelName =
      recording.channel_name || recording.stream || "Unknown Channel";
    const dateSource = recording.created || recording.started_at;
    const date = dateSource ? new Date(dateSource) : new Date();
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}`;
    const dayKey = `${monthKey}-${String(date.getDate()).padStart(2, "0")}`;

    if (!channelMap.has(channelName)) channelMap.set(channelName, new Map());
    const monthMap = channelMap.get(channelName);

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, {
        label: date.toLocaleString([], { month: "long", year: "numeric" }),
        days: new Map(),
      });
    }
    const monthEntry = monthMap.get(monthKey);

    if (!monthEntry.days.has(dayKey)) {
      monthEntry.days.set(dayKey, {
        label: date.toLocaleString([], {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        recordings: [],
      });
    }
    monthEntry.days.get(dayKey).recordings.push(recording);
  }

  return Array.from(channelMap.entries())
    .map(([channelName, monthMap]) => {
      const months = Array.from(monthMap.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([monthKey, monthEntry]) => {
          const days = Array.from(monthEntry.days.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dayKey, dayEntry]) => ({
              dayKey,
              label: dayEntry.label,
              recordings: dayEntry.recordings.sort(
                (a, b) => new Date(b.created) - new Date(a.created),
              ),
            }));
          return { monthKey, label: monthEntry.label, days };
        });
      return { channelName, months };
    })
    .sort((a, b) => a.channelName.localeCompare(b.channelName));
}

function RecordingsPage() {
  const currentAdmin = useMemo(() => getStoredAdmin(), []);
  const [currentOrganization, setCurrentOrganization] = useState(
    getStoredOrganization,
  );

  const isSuperAdmin = currentAdmin.role === "super_admin";
  const orgRole = currentOrganization.membership_role || "";
  const canManageRecordings =
    isSuperAdmin || ["owner", "admin"].includes(orgRole);

  const [recordings, setRecordings] = useState([]);
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState("");
  const [downloadingFile, setDownloadingFile] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [currentPath, setCurrentPath] = useState([]);

  const navigateInto = (segment) => {
    setCurrentPath((prev) => [...prev, segment]);
  };

  const navigateToDepth = (depth) => {
    setCurrentPath((prev) => prev.slice(0, depth));
  };

  const updateSelectedFromList = (items) => {
    if (!selectedRecording) return;

    const updated = items.find((item) => item.id === selectedRecording.id);
    if (updated) setSelectedRecording(updated);
  };

  const loadRecordings = async ({ silent = false, process = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const res = await api.get("/api/recordings/files", {
        params: process ? { process: 1 } : {},
      });

      const items = res.data.recordings || [];
      setRecordings(items);
      updateSelectedFromList(items);
      return items;
    } catch (err) {
      console.error("Failed to load recordings:", err);
      setError(err.response?.data?.message || "Failed to load recordings.");
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const handleOrganizationChange = (event) => {
      if (event.detail?.organization) {
        setCurrentOrganization(event.detail.organization);
      } else {
        setCurrentOrganization(getStoredOrganization());
      }

      setSelectedRecording(null);
      loadRecordings();
    };

    window.addEventListener(
      "nlm-organization-changed",
      handleOrganizationChange,
    );

    loadRecordings();

    return () => {
      window.removeEventListener(
        "nlm-organization-changed",
        handleOrganizationChange,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveProcessing = recordings.some((recording) =>
    ["processing", "waiting"].includes(recording.processing_status || ""),
  );

  useEffect(() => {
    if (
      !hasActiveProcessing &&
      !autoProcessing &&
      !processingAll &&
      !processingKey
    ) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadRecordings({ silent: true });
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveProcessing, autoProcessing, processingAll, processingKey]);

  const syncRecordings = async () => {
    try {
      setSyncing(true);
      setNotice("");
      setError("");

      const res = await api.post("/api/recordings/sync");
      const items = res.data.recordings || [];

      setRecordings(items);
      updateSelectedFromList(items);
      setNotice("Recording library synced successfully.");
    } catch (err) {
      console.error("Failed to sync recordings:", err);
      setError(err.response?.data?.message || "Failed to sync recordings.");
    } finally {
      setSyncing(false);
    }
  };

  const syncAndAutoProcess = async () => {
    try {
      setAutoProcessing(true);
      setNotice("");
      setError("");

      const res = await api.post("/api/recordings/sync?process=1", {
        process: true,
      });

      const items = res.data.recordings || [];
      setRecordings(items);
      updateSelectedFromList(items);
      setNotice("Recording library synced and auto-processed.");
    } catch (err) {
      console.error("Failed to sync and auto-process recordings:", err);
      setError(
        err.response?.data?.message ||
          "Failed to sync and auto-process recordings.",
      );
    } finally {
      setAutoProcessing(false);
      loadRecordings({ silent: true });
    }
  };

  const processAllRecordings = async () => {
    try {
      setProcessingAll(true);
      setNotice("");
      setError("");

      const res = await api.post("/api/recordings/process-all");
      const items = res.data.recordings || [];
      const processed = res.data.processed || [];
      const failed = processed.filter((item) => !item.ok);

      setRecordings(items);
      updateSelectedFromList(items);

      if (failed.length > 0) {
        setError(
          `${failed.length} recording(s) failed to process. Check the server console for FFmpeg details.`,
        );
      } else {
        setNotice(
          processed.length
            ? `Processed ${processed.length} recording(s).`
            : "No pending recordings needed processing.",
        );
      }
    } catch (err) {
      console.error("Failed to process all recordings:", err);
      setError(err.response?.data?.message || "Failed to process recordings.");
    } finally {
      setProcessingAll(false);
      loadRecordings({ silent: true });
    }
  };

  const deleteRecording = async (recording) => {
    if (!canManageRecordings) {
      setError("Only organization owners/admins can delete recordings.");
      return;
    }

    const confirmed = window.confirm(`Delete recording "${recording.file}"?`);

    if (!confirmed) return;

    try {
      setNotice("");
      setError("");

      await api.delete(`/api/recordings/${recording.id}`);

      if (selectedRecording?.file === recording.file) {
        setSelectedRecording(null);
      }

      setNotice("Recording deleted successfully.");
      loadRecordings();
    } catch (err) {
      console.error("Failed to delete recording:", err);
      setError(err.response?.data?.message || "Failed to delete recording.");
    }
  };

  const convertRecording = async (recording) => {
    const key = getRecordingKey(recording);

    try {
      setNotice("");
      setError("");
      setProcessingKey(key);

      const res = await api.post("/api/recordings/process", {
        stream: recording.stream,
        file: recording.file,
      });

      const items = res.data.recordings || [];
      setRecordings(items);
      updateSelectedFromList(items);
      setNotice("Recording processed successfully.");
    } catch (err) {
      console.error("Failed to process recording:", err);
      setError(err.response?.data?.message || "Failed to process recording.");
    } finally {
      setProcessingKey("");
      loadRecordings({ silent: true });
    }
  };

  const downloadRecording = async (recording, source = false) => {
    const fileToDownload = source
      ? recording.file
      : recording.mp4_file || recording.file;

    try {
      setNotice("");
      setError("");
      setDownloadingFile(fileToDownload);

      const res = await api.get("/api/recordings/files/download", {
        params: {
          stream: recording.stream,
          file: fileToDownload,
        },
        responseType: "blob",
      });

      const contentType =
        res.headers?.["content-type"] || "application/octet-stream";

      const blob = new Blob([res.data], {
        type: contentType,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      let downloadName = fileToDownload;

      const contentDisposition = res.headers?.["content-disposition"];

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename\*?=(?:UTF-8''|")?([^";]+)/i,
        );

        if (filenameMatch?.[1]) {
          try {
            downloadName = decodeURIComponent(
              filenameMatch[1].replace(/^["']|["']$/g, ""),
            );
          } catch {
            downloadName = filenameMatch[1].replace(/^["']|["']$/g, "");
          }
        }
      }

      link.href = url;
      link.setAttribute("download", downloadName);
      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

      setNotice("Recording download started.");
    } catch (err) {
      console.error("Failed to download recording:", err);

      let message = "Failed to download recording.";

      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const payload = JSON.parse(text);

          if (payload?.message) {
            message = payload.message;
          }
        } catch {
          // Keep the generic message when the blob is not JSON.
        }
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }

      setError(message);
    } finally {
      setDownloadingFile("");
    }
  };

  const totalStorageBytes = recordings.reduce(
    (total, recording) => total + Number(recording.size || 0),
    0,
  );

  const mp4Count = recordings.filter((recording) => recording.playable).length;
  const pendingCount = recordings.filter(
    (recording) =>
      !recording.playable &&
      !["processing", "waiting"].includes(recording.processing_status || ""),
  ).length;
  const activelyProcessingCount = recordings.filter((recording) =>
    ["processing", "waiting"].includes(recording.processing_status || ""),
  ).length;
  const thumbnailCount = recordings.filter(
    (recording) => recording.thumbnail_url || recording.thumbnail_file,
  ).length;

  const groupedRecordings = groupRecordingsByChannelMonthDay(recordings);

  return (
    <section className="card recordings-page">
      <div className="section-header">
        <div>
          <h2>Recordings</h2>
          <p>
            {currentOrganization.name
              ? `Archive library for ${currentOrganization.name}.`
              : "Tenant-safe stream archive library."}
          </p>
          {!canManageRecordings && (
            <p>
              You can watch, process, and download recordings. Delete access is
              limited to organization owners/admins.
            </p>
          )}
        </div>

        <div className="recording-header-actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={syncRecordings}
            disabled={syncing || autoProcessing || processingAll}
          >
            {syncing ? "Syncing..." : "Sync Library"}
          </button>

          <button
            type="button"
            className="secondary-btn"
            onClick={syncAndAutoProcess}
            disabled={syncing || autoProcessing || processingAll}
          >
            {autoProcessing ? "Processing..." : "Sync + Auto Process"}
          </button>

          <button
            type="button"
            className="primary-btn"
            onClick={processAllRecordings}
            disabled={
              syncing || autoProcessing || processingAll || pendingCount === 0
            }
          >
            {processingAll ? "Processing..." : "Process All"}
          </button>

          <div className="status-pill">{recordings.length} Saved</div>
        </div>
      </div>

      {notice && <div className="success-box">{notice}</div>}
      {error && <div className="error-box">{error}</div>}

      <div className="analytics-grid recording-summary-grid">
        <div className="analytics-tile">
          <span>Total Recordings</span>
          <strong>{recordings.length}</strong>
        </div>
        <div className="analytics-tile">
          <span>Playable MP4</span>
          <strong>{mp4Count}</strong>
        </div>
        <div className="analytics-tile">
          <span>Needs Processing</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="analytics-tile">
          <span>Processing Now</span>
          <strong>{activelyProcessingCount}</strong>
        </div>
        <div className="analytics-tile">
          <span>Thumbnails</span>
          <strong>{thumbnailCount}</strong>
        </div>
        <div className="analytics-tile">
          <span>Storage Used</span>
          <strong>{formatSize(totalStorageBytes)}</strong>
        </div>
      </div>

      {selectedRecording && (
        <div
          className="recording-player-modal-backdrop"
          onClick={() => setSelectedRecording(null)}
        >
          <div
            className="recording-player-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="recording-player-modal-close"
              onClick={() => setSelectedRecording(null)}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="recording-player">
              <div className="section-header compact">
                <div>
                  <h3>
                    {selectedRecording.channel_name || selectedRecording.stream}
                  </h3>
                  <p>{selectedRecording.mp4_file || selectedRecording.file}</p>
                </div>
                <span
                  className={`status-pill recording-status ${getProcessingClass(
                    selectedRecording,
                  )}`}
                >
                  {getProcessingLabel(selectedRecording)}
                </span>
              </div>

              {selectedRecording.thumbnail_url &&
                !selectedRecording.playable && (
                  <img
                    src={selectedRecording.thumbnail_url}
                    alt="Recording thumbnail"
                    className="recording-thumbnail-preview"
                    style={{
                      width: "100%",
                      maxHeight: "360px",
                      objectFit: "cover",
                      borderRadius: "14px",
                      background: "#000",
                    }}
                  />
                )}

              {selectedRecording.playable ? (
                <video
                  src={selectedRecording.url}
                  poster={selectedRecording.thumbnail_url || undefined}
                  controls
                  style={{
                    width: "100%",
                    borderRadius: "14px",
                    background: "#000",
                  }}
                />
              ) : (
                <div className="empty-state">
                  <strong>
                    {selectedRecording.processing_status === "processing"
                      ? "Processing Recording"
                      : "Preview Not Available"}
                  </strong>
                  <p>
                    {selectedRecording.processing_status === "processing"
                      ? "FFmpeg is converting the recording and generating metadata."
                      : "This recording is saved as FLV. Process it to create MP4 playback, duration metadata, and thumbnail."}
                  </p>
                  {selectedRecording.processing_error && (
                    <p>Error: {selectedRecording.processing_error}</p>
                  )}
                </div>
              )}

              <div className="stream-meta monitor-meta">
                <span>Stream: {selectedRecording.stream}</span>
                <span>Size: {formatSize(selectedRecording.size)}</span>
                <span>
                  Duration:{" "}
                  {selectedRecording.duration_seconds
                    ? formatDuration(selectedRecording.duration_seconds)
                    : "—"}
                </span>
                {selectedRecording.width && selectedRecording.height && (
                  <span>
                    Resolution: {selectedRecording.width}×
                    {selectedRecording.height}
                  </span>
                )}
                {selectedRecording.bitrate_kbps && (
                  <span>Bitrate: {selectedRecording.bitrate_kbps} KBPS</span>
                )}
                {selectedRecording.codec && (
                  <span>Codec: {selectedRecording.codec}</span>
                )}
                <span>Created: {formatDate(selectedRecording.created)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading recordings...</p>
      ) : recordings.length === 0 ? (
        <div className="empty-state">
          <strong>No recordings yet.</strong>
          <p>
            Start a stream with SRS DVR/recording enabled. Finished recordings
            will appear here after sync.
          </p>
        </div>
      ) : (
        <div className="recording-browser">
          <div className="recording-breadcrumb">
            <button type="button" onClick={() => navigateToDepth(0)}>
              All Channels
            </button>
            {currentPath.map((segment, depth) => {
              let label = segment;

              if (depth === 1) {
                const channelGroup = groupedRecordings.find(
                  (c) => c.channelName === currentPath[0],
                );
                const monthGroup = channelGroup?.months.find(
                  (m) => m.monthKey === segment,
                );
                label = monthGroup?.label || segment;
              }

              if (depth === 2) {
                const channelGroup = groupedRecordings.find(
                  (c) => c.channelName === currentPath[0],
                );
                const monthGroup = channelGroup?.months.find(
                  (m) => m.monthKey === currentPath[1],
                );
                const dayGroup = monthGroup?.days.find(
                  (d) => d.dayKey === segment,
                );
                label = dayGroup?.label || segment;
              }

              return (
                <span key={depth}>
                  <span className="recording-breadcrumb-sep"> / </span>
                  <button
                    type="button"
                    onClick={() => navigateToDepth(depth + 1)}
                  >
                    {label}
                  </button>
                </span>
              );
            })}
          </div>

          {currentPath.length === 0 && (
            <div className="recording-folder-list">
              {groupedRecordings.map((channelGroup) => {
                const total = channelGroup.months.reduce(
                  (sum, m) =>
                    sum + m.days.reduce((s, d) => s + d.recordings.length, 0),
                  0,
                );

                return (
                  <button
                    key={channelGroup.channelName}
                    type="button"
                    className="recording-folder"
                    onClick={() => navigateInto(channelGroup.channelName)}
                  >
                    <span className="recording-folder-icon">📁</span>
                    <span className="recording-folder-name">
                      {channelGroup.channelName}
                    </span>
                    <span className="recording-folder-count">
                      {total} recording{total !== 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {currentPath.length === 1 &&
            (() => {
              const channelGroup = groupedRecordings.find(
                (c) => c.channelName === currentPath[0],
              );
              if (!channelGroup) return <p>Not found.</p>;

              return (
                <div className="recording-folder-list">
                  {channelGroup.months.map((monthGroup) => {
                    const total = monthGroup.days.reduce(
                      (s, d) => s + d.recordings.length,
                      0,
                    );

                    return (
                      <button
                        key={monthGroup.monthKey}
                        type="button"
                        className="recording-folder"
                        onClick={() => navigateInto(monthGroup.monthKey)}
                      >
                        <span className="recording-folder-icon">📁</span>
                        <span className="recording-folder-name">
                          {monthGroup.label}
                        </span>
                        <span className="recording-folder-count">
                          {total} recording{total !== 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

          {currentPath.length === 2 &&
            (() => {
              const channelGroup = groupedRecordings.find(
                (c) => c.channelName === currentPath[0],
              );
              const monthGroup = channelGroup?.months.find(
                (m) => m.monthKey === currentPath[1],
              );
              if (!monthGroup) return <p>Not found.</p>;

              return (
                <div className="recording-folder-list">
                  {monthGroup.days.map((dayGroup) => (
                    <button
                      key={dayGroup.dayKey}
                      type="button"
                      className="recording-folder"
                      onClick={() => navigateInto(dayGroup.dayKey)}
                    >
                      <span className="recording-folder-icon">📁</span>
                      <span className="recording-folder-name">
                        {dayGroup.label}
                      </span>
                      <span className="recording-folder-count">
                        {dayGroup.recordings.length} recording
                        {dayGroup.recordings.length !== 1 ? "s" : ""}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}

          {currentPath.length === 3 &&
            (() => {
              const channelGroup = groupedRecordings.find(
                (c) => c.channelName === currentPath[0],
              );
              const monthGroup = channelGroup?.months.find(
                (m) => m.monthKey === currentPath[1],
              );
              const dayGroup = monthGroup?.days.find(
                (d) => d.dayKey === currentPath[2],
              );
              if (!dayGroup) return <p>Not found.</p>;

              return (
                <div className="recording-list archive-recording-list">
                  {dayGroup.recordings.map((recording, index) => {
                    const key = getRecordingKey(recording);
                    const isProcessingThis =
                      processingKey === key ||
                      ["processing", "waiting"].includes(
                        recording.processing_status || "",
                      );

                    return (
                      <div
                        key={`${recording.stream}-${recording.file}-${index}`}
                        className="recording-card archive-recording-card"
                      >
                        {recording.thumbnail_url ? (
                          <img
                            src={recording.thumbnail_url}
                            alt={`${recording.channel_name || recording.stream} thumbnail`}
                            className="recording-card-thumb"
                            style={{
                              width: "140px",
                              height: "80px",
                              objectFit: "cover",
                              borderRadius: "12px",
                              background: "#000",
                              marginRight: "14px",
                            }}
                          />
                        ) : (
                          <div
                            className="recording-card-thumb placeholder"
                            style={{
                              width: "140px",
                              height: "80px",
                              borderRadius: "12px",
                              background: "rgba(255,255,255,0.06)",
                              marginRight: "14px",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            {recording.playable ? "MP4" : "FLV"}
                          </div>
                        )}

                        <div>
                          <strong>
                            {recording.channel_name ||
                              recording.stream ||
                              "Recording"}
                          </strong>

                          <p>
                            {cleanDisplayName(
                              recording.mp4_file || recording.file,
                            )}{" "}
                            <span className="recording-type">
                              {(recording.playable
                                ? "mp4"
                                : recording.type
                              )?.toUpperCase()}
                            </span>
                          </p>

                          <div className="stream-meta monitor-meta">
                            <span>{formatSize(recording.size)}</span>
                            <span>
                              {recording.duration_seconds
                                ? formatDuration(recording.duration_seconds)
                                : "Duration pending"}
                            </span>
                            <span>{formatDate(recording.created)}</span>
                            <span
                              className={`recording-status ${getProcessingClass(
                                recording,
                              )}`}
                            >
                              {getProcessingLabel(recording)}
                            </span>
                            {recording.processing_error && (
                              <span>Error: {recording.processing_error}</span>
                            )}
                          </div>
                        </div>

                        <div className="recording-actions">
                          {recording.playable ? (
                            <button
                              onClick={() => setSelectedRecording(recording)}
                            >
                              Watch
                            </button>
                          ) : (
                            <button
                              onClick={() => setSelectedRecording(recording)}
                            >
                              Details
                            </button>
                          )}

                          {!recording.playable && (
                            <button
                              onClick={() => convertRecording(recording)}
                              disabled={
                                isProcessingThis ||
                                processingAll ||
                                autoProcessing
                              }
                            >
                              {isProcessingThis ? "Processing..." : "Process"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => downloadRecording(recording)}
                            disabled={
                              downloadingFile ===
                              (recording.mp4_file || recording.file)
                            }
                          >
                            {downloadingFile ===
                            (recording.mp4_file || recording.file)
                              ? "Downloading..."
                              : "Download"}
                          </button>

                          {recording.playable &&
                            recording.file !== recording.mp4_file && (
                              <button
                                type="button"
                                onClick={() =>
                                  downloadRecording(recording, true)
                                }
                                disabled={downloadingFile === recording.file}
                              >
                                Source FLV
                              </button>
                            )}

                          {canManageRecordings && (
                            <button
                              className="danger-btn small"
                              onClick={() => deleteRecording(recording)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}{" "}
                </div>
              );
            })()}
        </div>
      )}
    </section>
  );
}

export default RecordingsPage;
