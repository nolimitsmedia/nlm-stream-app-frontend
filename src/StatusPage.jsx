import { useEffect, useState } from "react";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";

const API_BASE = import.meta.env.VITE_API_BASE || window.location.origin;
const POLL_INTERVAL_MS = 30000;

const STATUS_COPY = {
  operational: { label: "All Systems Operational", color: "#22c55e" },
  degraded: { label: "Degraded Performance", color: "#fb923c" },
  outage: { label: "Service Outage", color: "#f87171" },
};

function StatusDot({ status }) {
  const color = STATUS_COPY[status]?.color || "#64748b";
  return (
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 0 4px ${color}22`,
      }}
    />
  );
}

function StatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public/status`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) throw new Error("Status unavailable");
      setData(json);
      setError("");
    } catch {
      setError("Unable to load status right now. Please try again shortly.");
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const overall = data?.status || null;
  const overallCopy = STATUS_COPY[overall] || {
    label: "Checking status…",
    color: "#64748b",
  };

  return (
    <>
      <PublicHeader />

      <main className="status-page">
        <div className="status-page-inner">
          <div className="status-hero">
            <StatusDot status={overall} />
            <h1>{overallCopy.label}</h1>
          </div>

          {error && <p className="status-error">{error}</p>}

          {data && (
            <div className="status-grid">
              {data.categories.map((cat) => (
                <div key={cat.name} className="status-card">
                  <span className="status-card-name">{cat.name}</span>
                  <span
                    className="status-card-badge"
                    style={{
                      color: STATUS_COPY[cat.status]?.color,
                      background: `${STATUS_COPY[cat.status]?.color}18`,
                    }}
                  >
                    <StatusDot status={cat.status} />
                    {STATUS_COPY[cat.status]?.label.replace(
                      /^(All Systems |Service )/,
                      "",
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {data?.updated_at && (
            <p className="status-updated">
              Last checked:{" "}
              {new Date(data.updated_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              · refreshes automatically every 30 seconds
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export default StatusPage;
