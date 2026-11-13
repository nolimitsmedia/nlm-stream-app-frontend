import { useCallback, useEffect, useState } from "react";
import api from "./api";
import "./EncoderCheck.css";

// Encoder pre-flight check for one channel. The server runs it automatically
// ~25 seconds after the encoder connects; "Check again" re-measures after the
// person changes OBS settings.

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const GRADE = {
  pass: { label: "Looks good", tone: "pass" },
  warn: { label: "Could be better", tone: "warn" },
  fail: { label: "Needs fixing", tone: "fail" },
};

export default function EncoderCheck({ channelId }) {
  const [state, setState] = useState({ loading: true });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      const res = await api.get(`/api/channels/${channelId}/preflight`);
      return { loading: false, ...res.data };
    } catch {
      return { loading: false, unavailable: true };
    }
  }, [channelId]);

  useEffect(() => {
    let active = true;
    const read = () =>
      fetchReport().then((next) => {
        if (active) setState(next);
      });
    read();
    const timer = setInterval(read, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchReport]);

  const runNow = async () => {
    setRunning(true);
    setError("");
    try {
      const res = await api.post(`/api/channels/${channelId}/preflight/run`);
      setState((s) => ({
        ...s,
        report: res.data.report,
        reportIsCurrent: true,
        live: true,
      }));
      setExpanded(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not run the encoder check.",
      );
    } finally {
      setRunning(false);
    }
  };

  if (state.loading || state.unavailable) return null;

  const { report, live, reportIsCurrent } = state;
  const current = report && reportIsCurrent;
  const grade = current ? GRADE[report.grade] || GRADE.warn : null;
  const problems = current
    ? (report.checks || []).filter((c) => c.status !== "pass")
    : [];
  const showChecks = current && (expanded || problems.length > 0);

  return (
    <section
      className={`enc ${grade ? `enc--${grade.tone}` : ""}`}
      aria-label="Encoder check"
    >
      <header className="enc-head">
        <div className="enc-title">
          <span className="enc-icon" aria-hidden="true">
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
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </span>
          <div>
            <h4>Encoder check</h4>
            <p>
              {current
                ? report.summary
                : live
                  ? "Your encoder is connected. The check runs automatically about 25 seconds after it connects."
                  : "Runs automatically when your encoder connects, and checks keyframe interval, bitrate, resolution, frame rate and audio."}
            </p>
          </div>
        </div>
        <div className="enc-actions">
          {grade ? (
            <span className={`enc-grade enc-grade--${grade.tone}`}>
              {grade.label}
            </span>
          ) : null}
          {live ? (
            <button
              type="button"
              className="enc-btn"
              onClick={runNow}
              disabled={running}
              title="Measure the incoming stream again, for example after changing OBS settings"
            >
              {running ? "Checking…" : current ? "Check again" : "Check now"}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="enc-error" role="alert">
          {error}
        </div>
      ) : null}

      {showChecks ? (
        <ul className="enc-checks">
          {report.checks.map((check) => (
            <li
              key={check.id}
              className={`enc-check enc-check--${check.status}`}
            >
              <span className="enc-mark" aria-hidden="true">
                {check.status === "pass"
                  ? "✓"
                  : check.status === "warn"
                    ? "!"
                    : "✕"}
              </span>
              <div>
                <div className="enc-check-line">
                  <strong>{check.label}</strong>
                  {check.measured ? <code>{check.measured}</code> : null}
                </div>
                {check.status !== "pass" ? (
                  <>
                    <p>{check.message}</p>
                    {check.fix ? (
                      <p className="enc-fix">How to fix: {check.fix}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {current ? (
        <footer className="enc-foot">
          <span>Checked {formatWhen(report.created_at)}</span>
          {problems.length === 0 ? (
            <button
              type="button"
              className="enc-link"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide details" : "Show details"}
            </button>
          ) : null}
        </footer>
      ) : null}
    </section>
  );
}
