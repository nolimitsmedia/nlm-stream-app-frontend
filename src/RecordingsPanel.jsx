import { useEffect, useState } from "react";
import api from "./api";

function RecordingsPanel() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = async () => {
    try {
      const res = await api.get("/api/recordings");
      setRecordings(res.data.recordings || []);
    } catch (err) {
      console.error("Failed to load recordings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings();
  }, []);

  return (
    <div className="rp-page">
      <div className="rp-header">
        <div className="rp-header-left">
          <div className="rp-page-icon">
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
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div>
            <h2 className="rp-title">Recordings</h2>
            <p className="rp-sub">Stream archive from SRS DVR.</p>
          </div>
        </div>
        <span className="rp-count-pill">{recordings.length} Saved</span>
      </div>

      {loading ? (
        <div className="rp-loading">
          <div className="rp-spinner" />
          <span>Loading recordings…</span>
        </div>
      ) : recordings.length === 0 ? (
        <div className="rp-empty">
          <div className="rp-empty-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <strong>No recordings yet.</strong>
          <p>
            Start a stream with DVR enabled. Recordings will appear here after
            sync.
          </p>
        </div>
      ) : (
        <div className="rp-list">
          {recordings.map((rec) => (
            <div key={rec.id} className="rp-card">
              <div className="rp-card-icon">
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
              </div>
              <div className="rp-card-body">
                <strong className="rp-card-name">{rec.filename}</strong>
                <p className="rp-card-path">{rec.filepath}</p>
                <span className="rp-card-date">{rec.created_at}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecordingsPanel;
