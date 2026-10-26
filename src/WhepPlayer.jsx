import { useEffect, useRef, useState } from "react";

// ══════════════════════════════════════════
// WhepPlayer — real WebRTC (WHEP) playback via SRS's rtc_server.
// Deliberately kept separate from LivePlayer.jsx: this has a completely
// different lifecycle (RTCPeerConnection/ICE, no hls.js, no manifest
// polling) and is still "Beta" — an opt-in low-latency alternative to
// the proven HLS path, not a replacement for it.
//
// Contract with the parent (WatchPage.jsx):
//   - onConnected() — fires once the peer connection genuinely reaches
//     "connected". Parent can use this to hide a loading indicator.
//   - onFallback(reason) — fires if connection doesn't establish within
//     CONNECT_TIMEOUT_MS, or the peer connection later drops to
//     "failed"/"disconnected" without recovering. Parent should treat
//     this as "switch back to LivePlayer (HLS)" and this component
//     unmounting is expected to follow.
// Never throws past its own boundary — any WHEP/ICE failure is reported
// via onFallback, not left to bubble up and break the page.
// ══════════════════════════════════════════

const CONNECT_TIMEOUT_MS = 6000;

function WhepPlayer({ whepUrl, onConnected, onFallback }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const timeoutRef = useRef(null);
  const hasConnectedRef = useRef(false);
  const [statusText, setStatusText] = useState("Connecting (low latency)...");

  useEffect(() => {
    let cancelled = false;
    hasConnectedRef.current = false;

    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch (_err) {
          // Already closed or never fully opened — fine to ignore.
        }
        pcRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const fail = (reason) => {
      if (cancelled) return;
      cancelled = true;
      cleanup();
      onFallback?.(reason);
    };

    const connect = async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (cancelled || !videoRef.current) return;
        if (videoRef.current.srcObject !== event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (cancelled) return;
        const state = pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          if (!hasConnectedRef.current) {
            hasConnectedRef.current = true;
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setStatusText("");
            onConnected?.();
          }
        } else if (state === "failed" || state === "disconnected") {
          // Only treat as a fallback-worthy failure once we'd previously
          // connected, OR the connect timeout below hasn't already fired —
          // avoids double-reporting the same failure twice.
          fail(`ice-${state}`);
        }
      };

      // WHEP is playback-only from the browser's side.
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });

      timeoutRef.current = setTimeout(() => {
        if (!hasConnectedRef.current) {
          fail("connect-timeout");
        }
      }, CONNECT_TIMEOUT_MS);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const res = await fetch(whepUrl, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: offer.sdp,
        });

        if (!res.ok) {
          fail(`whep-http-${res.status}`);
          return;
        }

        const answerSdp = await res.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (err) {
        fail(`whep-exception: ${err.message}`);
      }
    };

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whepUrl]);

  return (
    <div className="live-player-box whep-player-box">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        controls
        className="whep-video"
      />
      {statusText ? (
        <div className="player-overlay player-overlay--starting" role="status">
          <span className="player-pulse" aria-hidden="true">
            <span className="player-pulse-ring" />
            <span className="player-pulse-ring player-pulse-ring--delay" />
            <span className="player-pulse-dot" />
          </span>
          <p className="player-overlay-title">{statusText}</p>
        </div>
      ) : null}
    </div>
  );
}

export default WhepPlayer;
