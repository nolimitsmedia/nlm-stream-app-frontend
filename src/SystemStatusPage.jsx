import { useEffect, useState } from "react";
import api from "./api";

function PanelHeader({ title, sub, badge, badgeColor }) {
  return (
    <div className="sh-panel-header">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {badge && (
        <span
          className="sh-badge"
          style={{ color: badgeColor, background: `${badgeColor}18` }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

const STATUS_COLORS = {
  operational: "#22c55e",
  degraded: "#fb923c",
  outage: "#f87171",
};

function CheckRow({ label, check }) {
  const state =
    check.ok === true ? "ok" : check.ok === false ? "down" : "unconfigured";

  const color =
    state === "ok" ? "#22c55e" : state === "down" ? "#f87171" : "#64748b";
  const text =
    state === "ok" ? "Healthy" : state === "down" ? "Down" : "Not configured";

  return (
    <div className="sh-check-row">
      <div>
        <strong>{label}</strong>
        {check.error && <p className="sh-check-error">{check.error}</p>}
      </div>
      <div className="sh-check-right">
        {check.latencyMs != null && (
          <span className="sh-check-latency">{check.latencyMs}ms</span>
        )}
        <span className="sh-check-status" style={{ color }}>
          <i style={{ background: color }} />
          {text}
        </span>
      </div>
    </div>
  );
}

function SystemStatusPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await api.get("/api/admin/status");
      setData(res.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load system status.");
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="sh-page">
      <div className="sh-page-header">
        <div className="sh-page-header-left">
          <div className="sh-page-icon">
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
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <h2 className="sh-page-title">System Status</h2>
            <p className="sh-page-sub">
              Live health of every underlying service — the same checks behind
              the public status page, with real detail.
            </p>
          </div>
        </div>
      </div>

      {error && <div className="sh-error">{error}</div>}

      {data && (
        <>
          <section className="sh-panel">
            <PanelHeader
              title="Overall Status"
              badge={data.public_view.overall.toUpperCase()}
              badgeColor={STATUS_COLORS[data.public_view.overall]}
            />
            <div className="sh-category-grid">
              {data.public_view.categories.map((cat) => (
                <div key={cat.name} className="sh-category-tile">
                  <span>{cat.name}</span>
                  <strong style={{ color: STATUS_COLORS[cat.status] }}>
                    {cat.status}
                  </strong>
                </div>
              ))}
            </div>
          </section>

          <section className="sh-panel">
            <PanelHeader
              title="Raw Checks"
              sub="Real latency and error detail behind each category above."
            />
            <div className="sh-check-list">
              <CheckRow
                label="Database (Postgres)"
                check={data.checks.database}
              />
              <CheckRow label="SRS Media Server" check={data.checks.srs} />
              <CheckRow label="Bunny CDN/Storage" check={data.checks.bunny} />
              <CheckRow label="WHMCS Billing" check={data.checks.whmcs} />
            </div>
          </section>

          <p className="sh-updated">
            Last checked:{" "}
            {new Date(data.updated_at).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "medium",
            })}{" "}
            · refreshes every 15 seconds · checks run in the background every 30
            seconds
          </p>
        </>
      )}
    </div>
  );
}

export default SystemStatusPage;
