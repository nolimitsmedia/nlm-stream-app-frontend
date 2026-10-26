function DashboardCards({ streams = [] }) {
  const activeStreams = streams.filter((s) => s.publish?.active);
  const totalClients = activeStreams.reduce(
    (t, s) => t + Number(s.clients || 0),
    0,
  );
  const totalKbps = activeStreams.reduce(
    (t, s) => t + Number(s.kbps?.recv_30s || 0),
    0,
  );
  const peakViewers = activeStreams.reduce(
    (p, s) => Math.max(p, Number(s.clients || 0)),
    0,
  );
  const averageBitrate = activeStreams.length
    ? Math.round(totalKbps / activeStreams.length)
    : 0;

  // SRS reports bitrate as a rolling 30-second average (kbps.recv_30s),
  // so it genuinely reads 0 for the first ~30-35s of any new stream —
  // that's expected SRS behavior, not a problem. If every active stream
  // is still within that startup window, show "Starting" instead of an
  // alarming "Warning". If even one stream has been live longer than
  // that and bitrate is still 0, that's a real warning worth surfacing.
  const STARTUP_GRACE_SECONDS = 35;
  const allActiveStreamsStillStarting =
    activeStreams.length > 0 &&
    activeStreams.every(
      (s) => Number(s.uptime_seconds || 0) < STARTUP_GRACE_SECONDS,
    );

  const health =
    activeStreams.length === 0
      ? "Offline"
      : averageBitrate > 0
        ? "Good"
        : allActiveStreamsStillStarting
          ? "Starting"
          : "Warning";

  const CARDS = [
    {
      label: "Active Streams",
      value: activeStreams.length,
      sub: `${streams.length} total detected`,
      accent: "blue",
      icon: (
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
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
      ),
    },
    {
      label: "Live Viewers",
      value: totalClients,
      sub: `Peak: ${peakViewers}`,
      accent: "green",
      icon: (
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
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      label: "Incoming Bitrate",
      value: `${totalKbps} kbps`,
      sub: `Avg: ${averageBitrate} kbps`,
      accent: "purple",
      icon: (
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
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      label: "Stream Health",
      value: health,
      sub:
        health === "Good"
          ? "Ingest signal is active"
          : health === "Starting"
            ? "Stream just started, bitrate reading in a few seconds"
            : health === "Warning"
              ? "Stream live but bitrate is low"
              : "No active ingest",
      accent:
        health === "Good"
          ? "green"
          : health === "Starting"
            ? "blue"
            : health === "Warning"
              ? "orange"
              : "red",
      icon: (
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
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dc-grid">
      {CARDS.map((card) => (
        <div key={card.label} className={`dc-card dc-card--${card.accent}`}>
          <div className={`dc-card-icon dc-icon--${card.accent}`}>
            {card.icon}
          </div>
          <span className="dc-card-label">{card.label}</span>
          <strong className="dc-card-value">{card.value}</strong>
          <small className="dc-card-sub">{card.sub}</small>
        </div>
      ))}
    </div>
  );
}

export default DashboardCards;
