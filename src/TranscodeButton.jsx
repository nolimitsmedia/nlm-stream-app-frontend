import { useState } from "react";
import api from "./api";

function TranscodeButton({ streamName }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const startTranscoding = async () => {
    try {
      setLoading(true);
      await api.post("/api/transcode/start", { stream: streamName });
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (err) {
      console.error("Failed to start transcoding:", err);
      alert("Failed to start transcoding.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`tcb-btn${done ? " tcb-btn--done" : ""}`}
      onClick={startTranscoding}
      disabled={loading}
    >
      {loading ? (
        <>
          <span className="tcb-spinner" />
          Starting…
        </>
      ) : done ? (
        <>
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
          Transcoding Started
        </>
      ) : (
        <>
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
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Start Transcoding
        </>
      )}
    </button>
  );
}

export default TranscodeButton;
