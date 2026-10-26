import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import "./LivePlayerDvr.css";

// Copy + a "kind" per phase, so the overlay (see the bottom of this file)
// can swap its pulse color and icon-free signal animation consistently —
// same visual language everywhere a stream isn't playing yet, whether
// that's this component's own internal states or the "Stream starting"
// placeholder shown by WatchPage.jsx/LiveMonitor.jsx before this even
// mounts (they intentionally reuse the same .player-overlay classes).
const STATUS_COPY = {
  loading: {
    title: "Loading stream",
    sub: "Connecting to the broadcast…",
  },
  waiting: {
    title: "Reconnecting",
    sub: "Waiting on the next segment…",
  },
  buffering: {
    title: "Buffering",
    sub: "Loading stream data…",
  },
};

// How often to poll the lightweight /api/hls/session/:streamKey endpoint
// for a discontinuity — deliberately faster than a typical HLS segment
// duration (2s), so this detects a real session change before hls.js's
// own internal manifest polling gets a chance to fetch and try to append
// a segment from the new session into a buffer that still expects the
// old one. Hits a small dedicated JSON endpoint rather than re-fetching
// the manifest itself — an earlier version of this fix did re-fetch the
// manifest on this same fast cadence, but each of those fetches was an
// anonymous, session-less request that looked to SRS like a brand-new HLS
// viewer connecting and immediately disconnecting, confirmed via a flood
// of on_stop events in the server logs for the whole duration of a
// broadcast. The dedicated endpoint answers from server memory with zero
// SRS interaction, so polling it has no such side effect.
const SESSION_POLL_MS = 1500;

// bufferAppendError recovery timing. Fast (250ms) for the common,
// transient case — but if it keeps happening back-to-back on freshly
// reloaded instances, that's a sign the cause isn't transient (a
// persistent, non-session-related issue we haven't diagnosed — see the
// investigation brief), and hammering reloads every 250ms forever would
// make things worse, not better. After a few fast attempts without a
// confirmed successful buffer (FRAG_BUFFERED), back off to the same
// slower cadence used for genuinely fatal errors.
const APPEND_RECOVERY_FAST_MS = 250;
const APPEND_RECOVERY_BACKOFF_MS = 2500;
const MAX_FAST_APPEND_RECOVERIES = 3;

const nextTickSafeBoolean = (value) => Boolean(value);

function LivePlayer({
  src,
  lowLatency = false,
  apiBase,
  onStreamUnavailable,
  autoPlay = true,
  muted = true,
  controls = true,
  onPlaybackReady,
  dvrEnabled = false,
  dvrWindowSeconds = 0,
  preferredPlayback = false,
  onPreferredPlaybackFailure,
  onRequestDvrPlayback,
}) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState({ kind: "loading" });
  const [isLandscapeContent, setIsLandscapeContent] = useState(false);
  const [isPortraitViewport, setIsPortraitViewport] = useState(false);
  const [rotatePromptDismissed, setRotatePromptDismissed] = useState(false);

  // Phase 4.2 — viewer-facing Live DVR state. The source-of-truth for the
  // available rewind range is the media element's seekable TimeRanges,
  // which hls.js derives from the SRS rolling HLS playlist verified in
  // Phase 4.1. No synthetic timestamps are used here.
  const [dvrState, setDvrState] = useState({
    available: false,
    start: 0,
    end: 0,
    current: 0,
    behindLive: 0,
    paused: false,
    seeking: false,
  });
  const dvrSeekingRef = useRef(false);

  // The most recent viewer-intended DVR offset while playback is healthy.
  //
  // This is intentionally separate from dvrResumeRef. During a real HA media
  // interruption hls.js may briefly move currentTime close to the new live edge
  // BEFORE our fatal-error/rebuild callback runs. If we capture from currentTime
  // at that point, the original 60-90 second rewind position has already been
  // lost. Keeping a continuously refreshed "last known good" intent lets us
  // restore the viewer to the same relative offset after Primary/Backup handoff.
  const dvrIntentRef = useRef(null);

  // Frozen recovery snapshot. While this is populated, readDvrRange() must not
  // overwrite dvrIntentRef with transient near-live values produced by an HLS
  // discontinuity/reconnect.
  const dvrResumeRef = useRef(null);
  const dvrRecoveryActiveRef = useRef(false);

  // V5: explicit viewer DVR intent is authoritative for the lifetime of the
  // logical broadcast. Transport observations must not overwrite it during HA.
  const dvrIntentModeRef = useRef("live"); // "live" | "dvr"
  const dvrRestoreInFlightRef = useRef(false);
  const dvrRestoreVerifyTimerRef = useRef(null);

  // V6 fallback: arm DVR intent from a stable observed rewind position even
  // when the browser/native seek path does not emit the exact event sequence
  // used by our custom slider. We require two stable observations and a
  // meaningful offset so ordinary live latency is never mistaken for DVR.
  const dvrStableObservationRef = useRef(null);

  // V7: survive React remounts caused by HA transport-generation / playback URL
  // changes. useRef state is component-local, so a remount previously erased a
  // valid ~10 minute DVR intent and recovery restarted with intentMode='live'.
  //
  // sessionStorage is deliberately used instead of localStorage: this state is
  // only viewer-session continuity, not a permanent preference.
  const dvrLogicalSessionRef = useRef(null);
  const DVR_PERSIST_TTL_MS = 6 * 60 * 60 * 1000;

  // V9: live_started_at can be regenerated by the current HA recovery path even
  // though Primary -> Backup is still the same viewer-facing broadcast.
  // A recently committed DVR position is therefore allowed to follow one such
  // logical-marker rollover for a short recovery window.
  //
  // This does NOT make DVR intent permanent across real broadcasts: once the
  // stored intent is older than this short HA window, a different logical
  // marker is treated as a genuinely new broadcast and the old position is
  // discarded as before.
  const DVR_HA_LOGICAL_ROLLOVER_GRACE_MS = 2 * 60 * 1000;

  const getStableStreamKey = useCallback(() => {
    const match = String(src || "").match(
      /\/api\/(?:hls\/([^/?]+)\.m3u8|abr\/([^/?]+)\/master\.m3u8|cmaf\/([^/?]+)\/index\.m3u8)/,
    );
    return match?.[1] || match?.[2] || match?.[3] || null;
  }, [src]);

  const getDvrStorageKey = useCallback(() => {
    const key = getStableStreamKey();
    return key ? `nlm:dvr-intent:${key}` : null;
  }, [getStableStreamKey]);

  const persistDvrIntent = useCallback(
    (intent, { explicitViewerAction = false, origin = "unknown" } = {}) => {
      const storageKey = getDvrStorageKey();
      if (!storageKey || typeof window === "undefined") return;

      try {
        if (!intent || Number(intent.behindLive || 0) <= 6) {
          if (explicitViewerAction) {
            window.sessionStorage.removeItem(storageKey);
          }
          return;
        }

        const nextBehindLive = Math.max(0, Number(intent.behindLive || 0));

        let existing = null;
        try {
          const rawExisting = window.sessionStorage.getItem(storageKey);
          existing = rawExisting ? JSON.parse(rawExisting) : null;
        } catch {
          existing = null;
        }

        const existingBehindLive = Math.max(
          0,
          Number(existing?.behindLive || 0),
        );

        // V8 protection: an HA remount/native transport seek can briefly report
        // ~10-15 seconds behind live before restoration. Never allow that
        // programmatic observation to erase a real viewer rewind such as 10 min.
        //
        // A genuine viewer action is still allowed to replace the old value.
        const DOWNGRADE_GUARD_EXISTING_SECONDS = 30;
        const DOWNGRADE_GUARD_NEXT_SECONDS = 20;

        if (
          !explicitViewerAction &&
          existingBehindLive >= DOWNGRADE_GUARD_EXISTING_SECONDS &&
          nextBehindLive <= DOWNGRADE_GUARD_NEXT_SECONDS
        ) {
          console.info(
            "[LivePlayer DVR] Protected persisted DVR intent from transport overwrite",
            {
              existingBehindLive,
              rejectedBehindLive: nextBehindLive,
              origin,
            },
          );
          return;
        }

        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            behindLive: nextBehindLive,
            paused: Boolean(intent.paused),
            savedAt: Date.now(),
            logicalSession: dvrLogicalSessionRef.current,
            origin,
          }),
        );
      } catch {
        // Persistence is best-effort. Playback must never depend on storage.
      }
    },
    [getDvrStorageKey],
  );

  const clearPersistedDvrIntent = useCallback(() => {
    const storageKey = getDvrStorageKey();
    if (!storageKey || typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch {
      // Best effort.
    }
  }, [getDvrStorageKey]);

  const readPersistedDvrIntent = useCallback(() => {
    const storageKey = getDvrStorageKey();
    if (!storageKey || typeof window === "undefined") return null;

    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const behindLive = Number(parsed?.behindLive || 0);
      const savedAt = Number(parsed?.savedAt || 0);

      if (
        !Number.isFinite(behindLive) ||
        behindLive <= 6 ||
        !savedAt ||
        Date.now() - savedAt > DVR_PERSIST_TTL_MS
      ) {
        window.sessionStorage.removeItem(storageKey);
        return null;
      }

      return {
        behindLive,
        paused: Boolean(parsed?.paused),
        capturedAt: savedAt,
        logicalSession:
          parsed?.logicalSession === null ||
          parsed?.logicalSession === undefined
            ? null
            : String(parsed.logicalSession),
      };
    } catch {
      return null;
    }
  }, [getDvrStorageKey]);

  // A user-driven seek is allowed to replace the stored DVR intent even when it
  // changes the behind-live offset by many minutes. HA/media discontinuities
  // are not.
  const shouldAdoptLogicalMarkerForHa = useCallback((persisted) => {
    if (!persisted) return false;

    const behindLive = Number(persisted.behindLive || 0);
    const capturedAt = Number(persisted.capturedAt || 0);
    const ageMs = capturedAt ? Date.now() - capturedAt : Infinity;

    return (
      Number.isFinite(behindLive) &&
      behindLive >= 20 &&
      Number.isFinite(ageMs) &&
      ageMs >= 0 &&
      ageMs <= DVR_HA_LOGICAL_ROLLOVER_GRACE_MS
    );
  }, []);

  const dvrUserSeekCommitRef = useRef(false);

  // Phase 5B.9 DVR/CMAF handoff: native browser controls can emit seeking
  // events for both viewer actions and transport-driven timeline changes.
  // While CMAF is the preferred live-edge source, only treat a seek as a
  // viewer DVR request when it follows a recent pointer/touch/keyboard action.
  // Standard TS-HLS/ABR keeps the established behavior unchanged.
  const nativeViewerSeekIntentUntilRef = useRef(0);

  useEffect(() => {
    if (!dvrEnabled) return;

    const persisted = readPersistedDvrIntent();
    if (!persisted) return;

    dvrIntentModeRef.current = "dvr";
    dvrIntentRef.current = {
      behindLive: persisted.behindLive,
      paused: persisted.paused,
      capturedAt: persisted.capturedAt,
    };

    // A fresh LivePlayer instance must treat this as a recovery snapshot so the
    // first valid seekable timeline restores the viewer instead of starting
    // near live.
    dvrResumeRef.current = {
      behindLive: persisted.behindLive,
      paused: persisted.paused,
      capturedAt: persisted.capturedAt,
    };
    dvrRecoveryActiveRef.current = true;

    console.info("[LivePlayer DVR] Rehydrated DVR intent after remount", {
      behindLive: persisted.behindLive,
      logicalSession: persisted.logicalSession,
    });
  }, [dvrEnabled, readPersistedDvrIntent]);

  const readDvrRange = useCallback(() => {
    const video = videoRef.current;
    if (!video || !dvrEnabled || video.seekable.length === 0) {
      setDvrState((prev) => ({
        ...prev,
        available: false,
        paused: Boolean(video?.paused),
        seeking: dvrSeekingRef.current,
      }));
      return null;
    }

    const first = 0;
    const last = video.seekable.length - 1;
    const originStart = video.seekable.start(first);
    const end = video.seekable.end(last);

    // Enforce the application's entitlement even if the SRS origin keeps a
    // larger rolling window. This allows the origin to retain the platform
    // maximum while Starter/Pro/Deluxe/etc. can expose different rewind limits.
    const configuredWindow = Math.max(0, Number(dvrWindowSeconds || 0));
    const start =
      configuredWindow > 0
        ? Math.max(originStart, end - configuredWindow)
        : originStart;

    const rawCurrent = Number.isFinite(video.currentTime)
      ? video.currentTime
      : end;

    const clampedCurrent = Math.min(Math.max(rawCurrent, start), end);
    const observedBehindLive = Math.max(0, end - clampedCurrent);
    const existingIntent = dvrIntentRef.current;

    // HA/source replacement can remap the media timeline BEFORE hls.js reports
    // a fatal/waiting event. In the reproduced failure, a viewer at ~10 minutes
    // behind suddenly appeared at ~30 minutes behind for one poll, which then
    // overwrote the good intent before recovery captured it.
    //
    // Treat a large, non-user-driven offset jump as a media discontinuity and
    // freeze the previous stable intent immediately. Normal rolling-window drift
    // is only a few seconds; 30 seconds gives plenty of tolerance while still
    // catching the multi-minute jumps created by a canonical HLS handoff.
    const OFFSET_DISCONTINUITY_SECONDS = 30;
    const hasStableIntent =
      dvrIntentModeRef.current === "dvr" &&
      existingIntent &&
      Number(existingIntent.behindLive) > 6 &&
      Number.isFinite(Number(existingIntent.behindLive));

    const offsetJumpSeconds = hasStableIntent
      ? Math.abs(
          observedBehindLive - Math.max(0, Number(existingIntent.behindLive)),
        )
      : 0;

    const outsideSeekableWindow =
      Number.isFinite(rawCurrent) && rawCurrent < start - 0.25;

    const discontinuityDetected = nextTickSafeBoolean(
      !dvrSeekingRef.current &&
        !dvrUserSeekCommitRef.current &&
        !dvrRecoveryActiveRef.current &&
        hasStableIntent &&
        (outsideSeekableWindow ||
          offsetJumpSeconds > OFFSET_DISCONTINUITY_SECONDS),
    );

    if (discontinuityDetected) {
      console.warn("[LivePlayer DVR] Media timeline discontinuity detected", {
        previousBehindLive: Number(existingIntent.behindLive || 0),
        observedBehindLive,
        offsetJumpSeconds,
        rawCurrent,
        start,
        end,
        outsideSeekableWindow,
      });

      dvrResumeRef.current = {
        behindLive: Math.max(0, Number(existingIntent.behindLive || 0)),
        paused: Boolean(existingIntent.paused),
        capturedAt: Number(existingIntent.capturedAt || Date.now()),
      };
      dvrRecoveryActiveRef.current = true;
    }

    // While recovery is active, keep the UI anchored to the viewer's frozen DVR
    // intent instead of briefly displaying the remapped transport position
    // (for example 30:00 behind or 0:13 behind).
    const recoveryIntent = dvrResumeRef.current || dvrIntentRef.current;
    const effectiveBehindLive =
      dvrRecoveryActiveRef.current && recoveryIntent
        ? Math.min(
            Math.max(0, Number(recoveryIntent.behindLive || 0)),
            Math.max(0, end - start),
          )
        : observedBehindLive;

    const current =
      dvrRecoveryActiveRef.current && recoveryIntent
        ? Math.min(Math.max(end - effectiveBehindLive, start), end)
        : clampedCurrent;

    const next = {
      available: end > start + 1,
      start,
      end,
      current,
      behindLive: effectiveBehindLive,
      paused: video.paused,
      seeking: dvrSeekingRef.current,
    };

    // V6: transport observations never redefine a committed DVR position.
    // While still in live mode, however, a clearly rewound and stable position
    // can promote itself to authoritative DVR intent. This handles native video
    // seeks/browser behavior that may bypass our custom slider event path.
    if (
      next.available &&
      !dvrSeekingRef.current &&
      !dvrRecoveryActiveRef.current &&
      dvrIntentModeRef.current === "live"
    ) {
      const LIVE_INTENT_THRESHOLD_SECONDS = 6;
      const AUTO_ARM_DVR_THRESHOLD_SECONDS = 20;
      const STABLE_OFFSET_TOLERANCE_SECONDS = 5;
      const STABLE_OBSERVATION_MIN_AGE_MS = 900;

      if (
        observedBehindLive <= LIVE_INTENT_THRESHOLD_SECONDS &&
        !video.paused
      ) {
        dvrIntentRef.current = null;
        dvrStableObservationRef.current = null;
      } else if (
        observedBehindLive >= AUTO_ARM_DVR_THRESHOLD_SECONDS &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        Number.isFinite(video.currentTime) &&
        video.currentTime > 0
      ) {
        const previous = dvrStableObservationRef.current;
        const now = Date.now();

        if (
          previous &&
          Math.abs(previous.behindLive - observedBehindLive) <=
            STABLE_OFFSET_TOLERANCE_SECONDS &&
          now - previous.capturedAt >= STABLE_OBSERVATION_MIN_AGE_MS
        ) {
          dvrIntentModeRef.current = "dvr";
          dvrIntentRef.current = {
            behindLive: observedBehindLive,
            paused: Boolean(video.paused),
            capturedAt: now,
          };
          persistDvrIntent(dvrIntentRef.current, {
            origin: "stable-auto-arm",
          });
          dvrStableObservationRef.current = null;

          console.info("[LivePlayer DVR] Stable rewind auto-armed DVR intent", {
            behindLive: observedBehindLive,
          });
        } else if (
          !previous ||
          Math.abs(previous.behindLive - observedBehindLive) >
            STABLE_OFFSET_TOLERANCE_SECONDS
        ) {
          dvrStableObservationRef.current = {
            behindLive: observedBehindLive,
            capturedAt: now,
          };
        }
      }
    }

    setDvrState(next);
    return next;
  }, [dvrEnabled, dvrWindowSeconds]);

  const captureDvrResumePoint = useCallback(() => {
    const video = videoRef.current;
    if (!video || !dvrEnabled) {
      dvrResumeRef.current = null;
      dvrRecoveryActiveRef.current = false;
      return;
    }

    if (dvrIntentModeRef.current !== "dvr" || !dvrIntentRef.current) {
      const persisted = readPersistedDvrIntent();
      if (persisted) {
        dvrIntentModeRef.current = "dvr";
        dvrIntentRef.current = {
          behindLive: persisted.behindLive,
          paused: persisted.paused,
          capturedAt: persisted.capturedAt,
        };

        console.info("[LivePlayer DVR] Recovered persisted intent on freeze", {
          behindLive: persisted.behindLive,
        });
      }
    }

    if (dvrIntentModeRef.current === "dvr" && dvrIntentRef.current) {
      dvrResumeRef.current = {
        behindLive: Math.max(0, Number(dvrIntentRef.current.behindLive || 0)),
        paused: Boolean(dvrIntentRef.current.paused),
        capturedAt: Number(dvrIntentRef.current.capturedAt || Date.now()),
      };
      dvrRecoveryActiveRef.current = true;

      console.info("[LivePlayer DVR] Frozen authoritative viewer intent", {
        behindLive: dvrResumeRef.current.behindLive,
        paused: dvrResumeRef.current.paused,
      });
      return;
    }

    dvrResumeRef.current = null;
    dvrRecoveryActiveRef.current = false;
  }, [dvrEnabled, readPersistedDvrIntent]);

  const restoreDvrResumePoint = useCallback(() => {
    const video = videoRef.current;
    const resume = dvrResumeRef.current;

    if (
      !video ||
      !dvrEnabled ||
      !resume ||
      video.seekable.length === 0 ||
      dvrRestoreInFlightRef.current
    ) {
      return false;
    }

    const first = 0;
    const last = video.seekable.length - 1;
    const originStart = video.seekable.start(first);
    const end = video.seekable.end(last);
    const configuredWindow = Math.max(0, Number(dvrWindowSeconds || 0));
    const start =
      configuredWindow > 0
        ? Math.max(originStart, end - configuredWindow)
        : originStart;

    const availableWindow = Math.max(0, end - start);
    if (availableWindow < 1) return false;

    const targetBehindLive = Math.min(
      Math.max(0, Number(resume.behindLive || 0)),
      availableWindow,
    );

    const target = Math.min(
      Math.max(end - targetBehindLive, start + 0.05),
      Math.max(start, end - 0.15),
    );

    dvrRestoreInFlightRef.current = true;
    dvrSeekingRef.current = true;

    console.info("[LivePlayer DVR] Restoring authoritative viewer offset", {
      targetBehindLive,
      target,
      seekableStart: start,
      seekableEnd: end,
    });

    try {
      video.currentTime = target;
    } catch {
      dvrSeekingRef.current = false;
      dvrRestoreInFlightRef.current = false;
      return false;
    }

    if (resume.paused) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }

    if (dvrRestoreVerifyTimerRef.current) {
      window.clearTimeout(dvrRestoreVerifyTimerRef.current);
    }

    dvrRestoreVerifyTimerRef.current = window.setTimeout(() => {
      dvrRestoreVerifyTimerRef.current = null;
      const v = videoRef.current;

      if (!v || v.seekable.length === 0) {
        dvrRestoreInFlightRef.current = false;
        return;
      }

      const verifyEnd = v.seekable.end(v.seekable.length - 1);
      const actualBehindLive = Math.max(0, verifyEnd - v.currentTime);
      const errorSeconds = Math.abs(actualBehindLive - targetBehindLive);
      const RESTORE_TOLERANCE_SECONDS = 8;

      console.info("[LivePlayer DVR] Restore verification", {
        targetBehindLive,
        actualBehindLive,
        errorSeconds,
      });

      dvrSeekingRef.current = false;
      dvrRestoreInFlightRef.current = false;
      dvrUserSeekCommitRef.current = false;

      if (errorSeconds <= RESTORE_TOLERANCE_SECONDS) {
        dvrIntentModeRef.current = "dvr";
        dvrIntentRef.current = {
          behindLive: targetBehindLive,
          paused: Boolean(resume.paused),
          capturedAt: Date.now(),
        };
        persistDvrIntent(dvrIntentRef.current, {
          origin: "restore-verification",
        });
        dvrResumeRef.current = null;
        dvrRecoveryActiveRef.current = false;
        readDvrRange();
      } else {
        dvrRecoveryActiveRef.current = true;
      }
    }, 1200);

    return true;
  }, [dvrEnabled, dvrWindowSeconds, readDvrRange, persistDvrIntent]);

  const seekToDvrTime = useCallback(
    (target) => {
      const video = videoRef.current;
      const range = readDvrRange();
      if (!video || !range?.available) return;

      const safeTarget = Math.min(
        Math.max(Number(target), range.start + 0.05),
        Math.max(range.start, range.end - 0.15),
      );

      dvrRecoveryActiveRef.current = false;
      dvrResumeRef.current = null;
      dvrUserSeekCommitRef.current = true;
      dvrSeekingRef.current = true;
      video.currentTime = safeTarget;

      dvrIntentModeRef.current = "dvr";
      dvrStableObservationRef.current = null;
      dvrIntentRef.current = {
        behindLive: Math.max(0, range.end - safeTarget),
        paused: Boolean(video.paused),
        capturedAt: Date.now(),
      };
      persistDvrIntent(dvrIntentRef.current, {
        explicitViewerAction: true,
        origin: "custom-dvr-slider",
      });

      console.info("[LivePlayer DVR] Viewer committed DVR offset", {
        behindLive: dvrIntentRef.current.behindLive,
        persistedBehindLive: readPersistedDvrIntent()?.behindLive ?? null,
      });

      setDvrState((prev) => ({
        ...prev,
        current: safeTarget,
        behindLive: Math.max(0, range.end - safeTarget),
        seeking: true,
      }));
    },
    [readDvrRange, persistDvrIntent, readPersistedDvrIntent],
  );

  const rewindBy = useCallback(
    (seconds) => {
      const video = videoRef.current;
      const range = readDvrRange();
      if (!video || !range?.available) return;
      seekToDvrTime(Math.max(range.start, video.currentTime - seconds));
    },
    [readDvrRange, seekToDvrTime],
  );

  const goLive = useCallback(() => {
    const video = videoRef.current;
    const range = readDvrRange();
    if (!video || !range?.available) return;

    // Stay a small amount behind the absolute edge so the browser has a
    // complete segment to decode instead of landing on a not-yet-complete
    // fragment boundary.
    const target = Math.max(range.start, range.end - 1.5);
    dvrIntentModeRef.current = "live";
    dvrStableObservationRef.current = null;
    dvrIntentRef.current = null;
    clearPersistedDvrIntent();
    dvrResumeRef.current = null;
    dvrRecoveryActiveRef.current = false;
    dvrRestoreInFlightRef.current = false;
    if (dvrRestoreVerifyTimerRef.current) {
      window.clearTimeout(dvrRestoreVerifyTimerRef.current);
      dvrRestoreVerifyTimerRef.current = null;
    }
    dvrUserSeekCommitRef.current = true;
    dvrSeekingRef.current = true;
    video.currentTime = target;
    video.play().catch(() => {});
  }, [readDvrRange, clearPersistedDvrIntent]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // Detects the ACTUAL content's orientation from the video's real
  // dimensions (not assumed) — needed since screen-share/desktop-capture
  // broadcasts are landscape-shaped, same as a normal camera stream, but
  // some future content type might not be. Re-attaches per `src` so a
  // fresh load's metadata is always captured, even when the same <video>
  // DOM node is being reused across sources.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      if (video.videoWidth && video.videoHeight) {
        setIsLandscapeContent(video.videoWidth > video.videoHeight);
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () =>
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
  }, [src]);

  // Tracks the VIEWPORT's orientation (independent of video/src) via
  // matchMedia — more broadly supported across browsers, including iOS
  // Safari, than the Screen Orientation API's own .type/.angle reads.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia("(orientation: portrait)");
    setIsPortraitViewport(mq.matches);

    const handleChange = (event) => {
      setIsPortraitViewport(event.matches);
      // A fresh transition into portrait re-shows the prompt even if it
      // was dismissed during an earlier portrait session — otherwise a
      // viewer who rotates portrait -> landscape -> portrait again would
      // never see it a second time.
      if (event.matches) setRotatePromptDismissed(false);
    };

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Keep the DVR UI synchronized with playback and the rolling seekable
  // window. Progress/timeupdate cover normal playback; durationchange and
  // loadedmetadata catch initial/live-playlist expansion; seeking/seeked
  // distinguish intentional viewer seeks from genuine buffering.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !dvrEnabled) {
      setDvrState({
        available: false,
        start: 0,
        end: 0,
        current: 0,
        behindLive: 0,
        paused: false,
        seeking: false,
      });
      return;
    }

    const sync = () => readDvrRange();

    const armNativeViewerSeekIntent = () => {
      // Give the browser's native media controls enough time to complete a
      // drag/keyboard seek after the viewer starts interacting with them.
      nativeViewerSeekIntentUntilRef.current = Date.now() + 8000;
    };

    const handleNativeSeekKeyDown = (event) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        armNativeViewerSeekIntent();
      }
    };

    const handleSeeking = () => {
      dvrSeekingRef.current = true;
      if (!dvrRecoveryActiveRef.current) {
        const recentViewerInteraction =
          Date.now() <= nativeViewerSeekIntentUntilRef.current;

        // On standard TS-HLS/ABR, preserve the proven DVR behavior. On the
        // short CMAF live-edge presentation, require a recent viewer action so
        // hls.js/browser transport seeks cannot accidentally arm DVR fallback.
        dvrUserSeekCommitRef.current =
          !preferredPlayback || recentViewerInteraction;
      }
      sync();
    };
    const handleSeeked = () => {
      dvrSeekingRef.current = false;

      // A real viewer seek is allowed to establish a completely new offset,
      // even if it differs from the previous intent by many minutes.
      if (dvrUserSeekCommitRef.current && !dvrRecoveryActiveRef.current) {
        const first = 0;
        const last = video.seekable.length - 1;

        if (last >= first && video.seekable.length > 0) {
          const originStart = video.seekable.start(first);
          const end = video.seekable.end(last);
          const configuredWindow = Math.max(0, Number(dvrWindowSeconds || 0));
          const start =
            configuredWindow > 0
              ? Math.max(originStart, end - configuredWindow)
              : originStart;
          const current = Math.min(Math.max(video.currentTime, start), end);
          const behindLive = Math.max(0, end - current);

          if (behindLive > 6 || video.paused) {
            dvrIntentModeRef.current = "dvr";
            dvrStableObservationRef.current = null;
            dvrIntentRef.current = {
              behindLive,
              paused: Boolean(video.paused),
              capturedAt: Date.now(),
            };
            const nativeSeekWasExplicitViewerAction =
              Boolean(dvrUserSeekCommitRef.current) &&
              !dvrRecoveryActiveRef.current &&
              !dvrRestoreInFlightRef.current;

            persistDvrIntent(dvrIntentRef.current, {
              explicitViewerAction: nativeSeekWasExplicitViewerAction,
              origin: nativeSeekWasExplicitViewerAction
                ? "native-viewer-seek"
                : "native-transport-seek",
            });

            console.info("[LivePlayer DVR] Native seek committed DVR offset", {
              behindLive,
              explicitViewerAction: nativeSeekWasExplicitViewerAction,
            });

            // CMAF intentionally carries only the short live-edge window. A
            // genuine viewer rewind must continue on the long TS-HLS/ABR DVR
            // presentation. Persist the relative offset first, then ask the
            // parent to perform the one-way source switch; the standard player
            // restores this exact intent after the source change.
            if (
              preferredPlayback &&
              nativeSeekWasExplicitViewerAction &&
              behindLive > 6 &&
              typeof onRequestDvrPlayback === "function"
            ) {
              console.info(
                "[LivePlayer DVR] Viewer rewind on CMAF — switching to standard DVR playback",
                { behindLive },
              );
              onRequestDvrPlayback({
                reason: "viewer-native-dvr-seek",
                behindLive,
              });
            }
          } else {
            dvrIntentModeRef.current = "live";
            dvrIntentRef.current = null;
            clearPersistedDvrIntent();
          }
        }
      }

      dvrUserSeekCommitRef.current = false;
      sync();
    };

    const events = [
      "timeupdate",
      "progress",
      "durationchange",
      "loadedmetadata",
      "playing",
      "pause",
    ];

    events.forEach((eventName) => video.addEventListener(eventName, sync));
    video.addEventListener("pointerdown", armNativeViewerSeekIntent);
    video.addEventListener("touchstart", armNativeViewerSeekIntent, {
      passive: true,
    });
    video.addEventListener("keydown", handleNativeSeekKeyDown);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);

    const interval = window.setInterval(sync, 1000);
    sync();

    return () => {
      window.clearInterval(interval);
      events.forEach((eventName) => video.removeEventListener(eventName, sync));
      video.removeEventListener("pointerdown", armNativeViewerSeekIntent);
      video.removeEventListener("touchstart", armNativeViewerSeekIntent);
      video.removeEventListener("keydown", handleNativeSeekKeyDown);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeked);
    };
  }, [
    dvrEnabled,
    dvrWindowSeconds,
    readDvrRange,
    src,
    persistDvrIntent,
    clearPersistedDvrIntent,
    shouldAdoptLogicalMarkerForHa,
    preferredPlayback,
    onRequestDvrPlayback,
  ]);

  // Auto-locks to landscape when entering fullscreen, on browsers that
  // support it (mainly Android Chrome/Firefox). Deliberately best-effort:
  // screen.orientation.lock() is NOT supported at all on iOS Safari
  // (Apple restricts it to installed PWAs) — but iOS's own native
  // full-screen video mode already auto-rotates landscape content on its
  // own without any code here, so this only needs to help the browsers
  // that don't already do that natively.
  useEffect(() => {
    const attemptLandscapeLock = () => {
      if (screen.orientation?.lock) {
        screen.orientation.lock("landscape").catch(() => {});
      }
    };

    const releaseLock = () => {
      try {
        screen.orientation?.unlock?.();
      } catch {
        // Safe to ignore — not every browser supports this.
      }
    };

    const handleFullscreenChange = () => {
      const fsElement =
        document.fullscreenElement || document.webkitFullscreenElement;
      if (fsElement) {
        attemptLandscapeLock();
      } else {
        releaseLock();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const handlePlaybackReady = () => {
      // hls.js can sometimes recover an interrupted live manifest internally
      // without invoking our explicit loadPlayer() rebuild. In that path the
      // browser may resume close to live. Re-apply the frozen viewer offset as
      // soon as a seekable range is available.
      if (
        dvrResumeRef.current &&
        dvrRecoveryActiveRef.current &&
        !dvrRestoreInFlightRef.current
      ) {
        restoreDvrResumePoint();
      }

      setStatus({ kind: "" });
      onPlaybackReady?.();
    };

    const handleWaiting = () => {
      const hasBufferedMedia =
        video.buffered.length > 0 &&
        video.buffered.end(video.buffered.length - 1) > video.currentTime + 0.1;

      // A viewer intentionally dragging backward in the DVR window will
      // naturally wait while hls.js loads the requested historical fragment.
      // Do not make that look like a stream-health failure.
      if (dvrEnabled && dvrSeekingRef.current) {
        return;
      }

      if (
        video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA &&
        !hasBufferedMedia
      ) {
        freezeDvrForRecovery();
        setStatus({ kind: "buffering" });
      }
    };

    video.addEventListener("playing", handlePlaybackReady);
    video.addEventListener("canplay", handlePlaybackReady);
    video.addEventListener("loadeddata", handlePlaybackReady);
    video.addEventListener("waiting", handleWaiting);

    let hls;
    let retryTimer;
    let sessionPollTimer;
    let lastLogicalSessionMarker = null;
    let lastTransportGeneration = null;
    let cancelled = false;
    // Bumped on every loadPlayer() call; captured per-instance as
    // thisInstanceId inside each hls.js event callback below. A callback
    // belonging to an OLD, already-superseded instance checks this before
    // acting — closes a real bug where a stale retryTimer (or a stale
    // event callback) from a destroyed player could still fire later and
    // tear down a newer, healthy instance, since `hls` is shared mutable
    // state across reloads.
    let playerInstanceId = 0;
    let appendRecoveryPending = false;
    let consecutiveAppendRecoveries = 0;
    let streamUnavailable = false;

    const destroyCurrentPlayer = ({ clearVideo = true } = {}) => {
      // Invalidate every callback belonging to the current hls.js instance
      // before destroying it. This prevents a late ERROR/MANIFEST callback
      // from scheduling another manifest request after the broadcast ended.
      playerInstanceId += 1;
      clearRetryTimer();
      appendRecoveryPending = false;

      if (hls) {
        try {
          hls.stopLoad();
        } catch {
          // Best-effort shutdown.
        }

        try {
          hls.detachMedia();
        } catch {
          // Best-effort shutdown.
        }

        hls.destroy();
        hls = null;
      }

      if (clearVideo) {
        try {
          video.pause();
        } catch {
          // Best-effort shutdown.
        }

        video.removeAttribute("src");
        video.load();
      }
    };

    const clearRetryTimer = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const getBufferedRanges = () => {
      const ranges = [];
      for (let i = 0; i < video.buffered.length; i += 1) {
        ranges.push([video.buffered.start(i), video.buffered.end(i)]);
      }
      return ranges;
    };

    const freezeDvrForRecovery = () => {
      if (!dvrEnabled || dvrSeekingRef.current) return;

      // Do not repeatedly recapture during one recovery cycle. The first
      // snapshot is the valuable one because later currentTime values may have
      // already drifted toward live.
      if (dvrRecoveryActiveRef.current && dvrResumeRef.current) return;

      const persistedIntent = readPersistedDvrIntent();

      console.info("[LivePlayer DVR] Recovery freeze requested", {
        intentMode: dvrIntentModeRef.current,
        authoritativeBehindLive: dvrIntentRef.current?.behindLive ?? null,
        persistedBehindLive: persistedIntent?.behindLive ?? null,
        currentTime: video.currentTime,
      });

      captureDvrResumePoint();
    };

    const streamKeyMatch = src.match(
      /\/api\/(?:hls\/([^/?]+)\.m3u8|abr\/([^/?]+)\/master\.m3u8|cmaf\/([^/?]+)\/index\.m3u8)/,
    );
    const streamKeyFromSrc =
      streamKeyMatch?.[1] || streamKeyMatch?.[2] || streamKeyMatch?.[3];

    const isAbrMasterSource = /\/api\/abr\/[^/?]+\/master\.m3u8/.test(src);
    const isCmafSource = /\/api\/cmaf\/[^/?]+\/index\.m3u8/.test(src);

    let preferredFallbackRequested = false;
    const requestPreferredFallback = (reason, data = null) => {
      if (
        !preferredPlayback ||
        !isCmafSource ||
        preferredFallbackRequested ||
        typeof onPreferredPlaybackFailure !== "function"
      ) {
        return false;
      }

      preferredFallbackRequested = true;
      console.warn(
        `[LivePlayer] CMAF playback unavailable (${reason}); falling back to standard HLS/ABR.`,
        data || "",
      );
      onPreferredPlaybackFailure({ reason });
      return true;
    };

    // Reports every real HLS error — fatal or not — to a lightweight
    // server-side logging endpoint (see /api/player/error-report in
    // server.js), so a bufferAppendError or similar shows up in server
    // logs automatically for ANY viewer at ANY time, instead of only ever
    // being visible when someone happens to have DevTools open at the
    // exact right moment. Uses sendBeacon (falls back to a fire-and-forget
    // fetch) so this never blocks or delays actual playback recovery.
    // Includes fragment timing/level and buffered-range/playback-position
    // context beyond the original version — this is what we're actually
    // missing to diagnose the still-unexplained bufferAppendError cases
    // (ones with no corresponding session/encoder change at all).
    const reportPlayerError = (data) => {
      if (!streamKeyFromSrc) return;

      const payload = JSON.stringify({
        streamKey: streamKeyFromSrc,
        errorType: data.details || data.type || "unknown",
        fatal: Boolean(data.fatal),
        details: {
          type: data.type,
          reason: data.reason,
          responseCode: data.response?.code,
          frag: data.frag?.sn,
          level: data.frag?.level ?? data.level,
          fragStart: data.frag?.start,
          fragDuration: data.frag?.duration,
          fragStartPTS: data.frag?.startPTS,
          fragEndPTS: data.frag?.endPTS,
          currentTime: video.currentTime,
          readyState: video.readyState,
          buffered: getBufferedRanges(),
          userAgent: navigator.userAgent,
        },
        sessionInfo: {
          logicalSession: lastLogicalSessionMarker,
          transportGeneration: lastTransportGeneration,
        },
        playerKind: window.location.pathname,
      });

      // apiBase defaults to src's own origin if the parent didn't pass one
      // (backward compat) — but since src may now point at a separate,
      // Bunny-token-gated video CDN zone (see bunny-signed-urls.md), the
      // parent SHOULD pass the general API base explicitly so this
      // lightweight logging call doesn't route through a host that will
      // 403 it (real incident 2026-08-02: it did, silently, until this fix).
      const reportBase = apiBase || src.split("/api/")[0];
      const reportUrl = `${reportBase.replace(/\/$/, "")}/api/player/error-report`;

      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            reportUrl,
            new Blob([payload], { type: "application/json" }),
          );
        } else {
          fetch(reportUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Reporting is best-effort — never let it interfere with playback.
      }
    };

    const loadPlayer = ({ preserveDvrPosition = true } = {}) => {
      if (cancelled || streamUnavailable) return;

      if (preserveDvrPosition && dvrEnabled) {
        captureDvrResumePoint();
      }

      destroyCurrentPlayer();
      const thisInstanceId = playerInstanceId;

      setStatus({ kind: "loading" });

      // Fully detach the previous MediaSource before constructing a new
      // hls.js instance — important after a real SourceBuffer append
      // error, where the video element's internal MediaSource state can
      // remain in a bad state even after hls.destroy().
      if (Hls.isSupported()) {
        // Two presets, chosen by the org's plan (reduced_latency_enabled).
        // Plans without it get the original, looser defaults — more
        // buffer cushion, safer against real-world hiccups. Plans with
        // it get the tuned settings from tonight's latency work — real
        // improvement, tested to hold up against a genuine reconnect
        // without the segment-integrity issues we hit at more aggressive
        // settings. Neither preset is the most extreme LL-HLS numbers —
        // see the reasoning in this file's history for why that trade
        // wasn't worth it for a live ministry stream.
        const bufferConfig = dvrEnabled
          ? {
              // Phase 4.2 DVR:
              // A viewer may intentionally remain anywhere inside the rolling
              // rewind window. Do not let hls.js interpret that distance from
              // the live edge as excessive latency and seek the video forward.
              liveSyncDurationCount: lowLatency ? 3 : 5,
              liveMaxLatencyDurationCount: Infinity,

              // Keep normal forward buffering conservative while allowing the
              // browser/hls.js to retain previously-played media when memory
              // permits. The source playlist remains the authority for the
              // actual rewind limit (for example, 30 minutes from SRS).
              maxBufferLength: lowLatency ? 20 : 30,
              maxMaxBufferLength: lowLatency ? 45 : 60,
              backBufferLength: Infinity,

              // Never speed playback up merely to catch a DVR viewer back up
              // to live. Returning to live is an explicit viewer action via
              // the GO LIVE control.
              maxLiveSyncPlaybackRate: 1,
            }
          : lowLatency
            ? {
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 6,
                maxBufferLength: 15,
                maxMaxBufferLength: 30,
              }
            : {
                liveSyncDurationCount: 5,
                liveMaxLatencyDurationCount: 10,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
              };

        hls = new Hls({
          lowLatencyMode: false,
          ...bufferConfig,
          manifestLoadingMaxRetry: 10,
          levelLoadingMaxRetry: 10,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
        });

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled || thisInstanceId !== playerInstanceId) return;

          setStatus({ kind: "" });

          const restored = restoreDvrResumePoint();
          if (!restored && autoPlay) {
            video.play().catch(() => {});
          }
        });

        // Some browsers expose the live seekable range only after the media
        // playlist/level has loaded, not at MANIFEST_PARSED. Retry the DVR
        // restore at that point when a recovery snapshot still exists.
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          if (cancelled || thisInstanceId !== playerInstanceId) return;
          if (
            dvrResumeRef.current &&
            dvrRecoveryActiveRef.current &&
            !dvrRestoreInFlightRef.current
          ) {
            restoreDvrResumePoint();
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (
            cancelled ||
            streamUnavailable ||
            thisInstanceId !== playerInstanceId
          ) {
            return;
          }

          const responseCode = data.response?.code;

          // WatchPage normally mounts this player only after the JSON ABR
          // status endpoint reports readiness. Keep this 503 handling as
          // protection for a rendition that temporarily disappears during
          // an already-running broadcast.
          const isAbrUnavailableError =
            isAbrMasterSource && responseCode === 503;

          if (isAbrUnavailableError) {
            freezeDvrForRecovery();

            // The bounded rendition may still be initializing. Stay on ABR
            // and retry the master instead of permanently switching to raw
            // HLS, whose short rolling window can expose stale segments.
            console.debug(
              "[LivePlayer] ABR rendition is still initializing.",
              data,
            );
            setStatus({ kind: "waiting" });

            clearRetryTimer();
            retryTimer = setTimeout(() => {
              if (!cancelled && thisInstanceId === playerInstanceId) {
                loadPlayer();
              }
            }, 2000);

            return;
          }

          if (data.details === "bufferAppendError") {
            freezeDvrForRecovery();

            if (requestPreferredFallback("buffer-append-error", data)) {
              reportPlayerError(data);
              return;
            }

            // A SourceBuffer that rejected an append may stay poisoned
            // even when hls.js labels the first occurrence non-fatal —
            // letting it keep trying can produce repeated errors before
            // hls.js ever calls it fatal. Recover immediately by rebuilding
            // the whole player, rather than waiting passively.
            console.warn(
              "HLS SourceBuffer append failed; rebuilding player:",
              data,
            );
            reportPlayerError(data);
            setStatus({ kind: "waiting" });

            if (!appendRecoveryPending) {
              appendRecoveryPending = true;
              consecutiveAppendRecoveries += 1;
              clearRetryTimer();

              const delay =
                consecutiveAppendRecoveries > MAX_FAST_APPEND_RECOVERIES
                  ? APPEND_RECOVERY_BACKOFF_MS
                  : APPEND_RECOVERY_FAST_MS;

              retryTimer = setTimeout(() => {
                if (!cancelled && thisInstanceId === playerInstanceId) {
                  loadPlayer();
                }
              }, delay);
            }
          } else if (data.fatal || data.response?.code === 404) {
            freezeDvrForRecovery();

            if (requestPreferredFallback("fatal-hls-error", data)) {
              reportPlayerError(data);
              return;
            }

            console.warn("HLS error:", data);
            reportPlayerError(data);
            setStatus({ kind: "waiting" });

            clearRetryTimer();
            retryTimer = setTimeout(() => {
              if (!cancelled && thisInstanceId === playerInstanceId) {
                loadPlayer();
              }
            }, 2500);
          } else if (data.details === "bufferStalledError") {
            // A stall with no future buffer is often the earliest observable
            // symptom of an HA handoff. Freeze the viewer's DVR intent before
            // hls.js has a chance to catch up toward the new live edge.
            const hasBufferedMedia =
              video.buffered.length > 0 &&
              video.buffered.end(video.buffered.length - 1) >
                video.currentTime + 0.1;

            if (
              video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA &&
              !hasBufferedMedia
            ) {
              freezeDvrForRecovery();
            }

            // Non-fatal and normally self-recovering. Do not hide an
            // already-decoding video when usable buffered media remains.
            console.debug("HLS buffer stall (recovering):", data);

            if (
              video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA &&
              !hasBufferedMedia
            ) {
              setStatus({ kind: "buffering" });
            }
          } else {
            console.debug("HLS non-fatal event:", data);
            reportPlayerError(data);
          }
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (cancelled || thisInstanceId !== playerInstanceId) return;

          if (
            dvrResumeRef.current &&
            dvrRecoveryActiveRef.current &&
            !dvrRestoreInFlightRef.current
          ) {
            restoreDvrResumePoint();
          }

          // A fragment actually landed — playback genuinely resumed, so
          // reset the append-recovery backoff counter (confirms this
          // instance is healthy, not just "we tried reloading again").
          consecutiveAppendRecoveries = 0;
          // Clears the buffering overlay set above, as soon as a new
          // fragment actually lands (i.e. playback has resumed).
          setStatus((current) =>
            current.kind === "buffering" ? { kind: "" } : current,
          );
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.muted = muted;
        video.autoplay = autoPlay;
        video.controls = controls;
        video.playsInline = true;
        const handleNativePlaybackError = () => {
          requestPreferredFallback("native-hls-error");
        };
        video.addEventListener("error", handleNativePlaybackError, {
          once: true,
        });
        video.src = src;
        if (autoPlay) {
          video.play().catch(() => {});
        }
      }
    };

    // Independently polls a lightweight session-info endpoint (see
    // SESSION_POLL_MS above for why this isn't just re-fetching the
    // manifest) — separate from whatever hls.js is doing internally. This
    // is what actually closes a real race: our earlier fix (React
    // remounting this component via an encoderGeneration-derived key)
    // only updates on App.jsx's external 3s poll, which is slower than
    // hls.js's own internal manifest refresh — so the old player instance
    // could still fetch and try to append a segment from a NEW session
    // before React ever got around to remounting it. Detecting the change
    // here, on a faster independent cadence, lets this component
    // proactively tear down and reload itself the moment a real
    // discontinuity occurs, instead of reactively discovering it via a
    // bufferAppendError.
    // src may be /api/cmaf/{streamKey}/index.m3u8 at the live edge,
    // /api/hls/{streamKey}.m3u8 for standard single-rendition playback, or
    // /api/abr/{streamKey}/master.m3u8 when ABR is enabled. Extract the stream
    // key from all three shapes so session polling/error reporting continue to
    // use the general API host even while media comes through the video CDN.
    // to build the lightweight session endpoint's URL. Uses apiBase (the
    // general API host), NOT src's own origin — src may now point at the
    // separate, Bunny-token-gated video CDN zone, which this unsigned
    // endpoint would just get 403'd by (real incident 2026-08-02).
    const sessionBase = apiBase || src.split("/api/")[0];
    const sessionUrl = streamKeyFromSrc
      ? `${sessionBase.replace(/\/$/, "")}/api/hls/session/${streamKeyFromSrc}`
      : null;

    const pollSession = async () => {
      if (!sessionUrl) return;

      try {
        const res = await fetch(sessionUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Session endpoint HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.message || "Invalid session response");
        }
        // V6: distinguish the LOGICAL broadcast from a transport generation.
        //
        // liveStartedAtMs is preserved by server-side Pull Source HA and is the
        // viewer-facing broadcast identity. broadcastGeneration may legitimately
        // change while Primary/Backup transport is being rebuilt, so it must not
        // clear the viewer's DVR position.
        const logicalMarker = `${data.liveStartedAtMs ?? 0}`;
        const transportGeneration = Number(data.broadcastGeneration ?? 0);
        dvrLogicalSessionRef.current = logicalMarker;

        // Validate a rehydrated DVR snapshot against the session endpoint.
        //
        // V9: a Pull Source HA handoff may regenerate liveStartedAtMs even though
        // the viewer is still inside the same logical broadcast. If the viewer
        // committed a substantial DVR position very recently, adopt the new
        // marker as an HA continuation instead of deleting the rewind intent.
        const persistedForSession = readPersistedDvrIntent();
        const persistedMarkerMismatch =
          Boolean(persistedForSession?.logicalSession) &&
          persistedForSession.logicalSession !== logicalMarker;

        // V10:
        // A long-running HA/failback cycle can exceed the V9 two-minute grace
        // even though this SAME mounted viewer is still watching the SAME
        // logical broadcast. In that case the strongest signal is not age —
        // it is that this player already has an authoritative DVR intent and
        // has already observed a logical session marker.
        //
        // Keep the short V9 grace as a fallback for remounts, but allow an
        // active mounted DVR viewer to adopt the new marker regardless of age.
        const mountedViewerHasAuthoritativeDvrIntent =
          lastLogicalSessionMarker !== null &&
          dvrIntentModeRef.current === "dvr" &&
          Boolean(dvrIntentRef.current) &&
          Number(dvrIntentRef.current?.behindLive || 0) > 6;

        const adoptMarkerForHa =
          persistedMarkerMismatch &&
          (mountedViewerHasAuthoritativeDvrIntent ||
            shouldAdoptLogicalMarkerForHa(persistedForSession));

        if (adoptMarkerForHa) {
          console.warn(
            "[LivePlayer DVR] HA logical session rollover — preserving DVR intent",
            {
              from: persistedForSession.logicalSession,
              to: logicalMarker,
              behindLive: persistedForSession.behindLive,
              mountedViewerHasAuthoritativeDvrIntent,
              ageMs:
                Date.now() -
                Number(persistedForSession.capturedAt || Date.now()),
            },
          );

          dvrIntentModeRef.current = "dvr";
          dvrIntentRef.current = {
            behindLive: persistedForSession.behindLive,
            paused: Boolean(persistedForSession.paused),
            capturedAt: persistedForSession.capturedAt,
          };
          dvrResumeRef.current = {
            behindLive: persistedForSession.behindLive,
            paused: Boolean(persistedForSession.paused),
            capturedAt: persistedForSession.capturedAt,
          };
          dvrRecoveryActiveRef.current = true;

          // dvrLogicalSessionRef.current already points at logicalMarker, so
          // rewrite storage under the newly adopted marker without changing the
          // viewer's offset.
          persistDvrIntent(
            {
              behindLive: persistedForSession.behindLive,
              paused: persistedForSession.paused,
              capturedAt: persistedForSession.capturedAt,
            },
            { origin: "ha-logical-session-rollover" },
          );
        } else if (persistedMarkerMismatch) {
          console.info(
            "[LivePlayer DVR] Discarding persisted intent from old broadcast",
            {
              storedLogicalSession: persistedForSession.logicalSession,
              currentLogicalSession: logicalMarker,
              ageMs:
                Date.now() -
                Number(persistedForSession.capturedAt || Date.now()),
            },
          );
          clearPersistedDvrIntent();
          dvrIntentModeRef.current = "live";
          dvrIntentRef.current = null;
          dvrResumeRef.current = null;
          dvrRecoveryActiveRef.current = false;
        } else if (persistedForSession && !persistedForSession.logicalSession) {
          // Backfill the logical session on intents committed before the first
          // session poll completed.
          persistDvrIntent(
            {
              behindLive: persistedForSession.behindLive,
              paused: persistedForSession.paused,
              capturedAt: persistedForSession.capturedAt,
            },
            { origin: "logical-session-backfill" },
          );
        }

        const sessionIsLive =
          data.isLive !== false && Number(data.liveStartedAtMs || 0) > 0;

        // When the logical broadcast truly ends, clear all DVR intent.
        if (!sessionIsLive) {
          streamUnavailable = true;
          lastLogicalSessionMarker = logicalMarker;
          lastTransportGeneration = transportGeneration;
          dvrIntentModeRef.current = "live";
          dvrStableObservationRef.current = null;
          dvrIntentRef.current = null;
          clearPersistedDvrIntent();
          dvrResumeRef.current = null;
          dvrRecoveryActiveRef.current = false;
          dvrRestoreInFlightRef.current = false;
          if (dvrRestoreVerifyTimerRef.current) {
            window.clearTimeout(dvrRestoreVerifyTimerRef.current);
            dvrRestoreVerifyTimerRef.current = null;
          }
          dvrUserSeekCommitRef.current = false;
          destroyCurrentPlayer();
          setStatus({ kind: "waiting" });

          if (typeof onStreamUnavailable === "function") {
            onStreamUnavailable();
          }

          return;
        }

        const logicalBroadcastChanged =
          lastLogicalSessionMarker !== null &&
          logicalMarker !== lastLogicalSessionMarker;

        const transportChanged =
          lastTransportGeneration !== null &&
          transportGeneration !== lastTransportGeneration;

        if (logicalBroadcastChanged) {
          const persistedAtLogicalChange = readPersistedDvrIntent();
          const mountedViewerHasAuthoritativeDvrIntent =
            dvrIntentModeRef.current === "dvr" &&
            Boolean(dvrIntentRef.current) &&
            Number(dvrIntentRef.current?.behindLive || 0) > 6;

          const preserveLogicalChangeForHa =
            mountedViewerHasAuthoritativeDvrIntent ||
            shouldAdoptLogicalMarkerForHa(persistedAtLogicalChange);

          if (preserveLogicalChangeForHa) {
            console.warn(
              "HLS logical marker changed during HA — preserving viewer DVR session",
              {
                from: lastLogicalSessionMarker,
                to: logicalMarker,
                transportGeneration,
                behindLive: persistedAtLogicalChange.behindLive,
                mountedViewerHasAuthoritativeDvrIntent,
              },
            );

            dvrIntentModeRef.current = "dvr";
            dvrIntentRef.current = {
              behindLive: persistedAtLogicalChange.behindLive,
              paused: Boolean(persistedAtLogicalChange.paused),
              capturedAt: persistedAtLogicalChange.capturedAt,
            };
            dvrResumeRef.current = {
              behindLive: persistedAtLogicalChange.behindLive,
              paused: Boolean(persistedAtLogicalChange.paused),
              capturedAt: persistedAtLogicalChange.capturedAt,
            };
            dvrRecoveryActiveRef.current = true;

            lastLogicalSessionMarker = logicalMarker;
            lastTransportGeneration = transportGeneration;

            persistDvrIntent(
              {
                behindLive: persistedAtLogicalChange.behindLive,
                paused: persistedAtLogicalChange.paused,
                capturedAt: persistedAtLogicalChange.capturedAt,
              },
              { origin: "ha-logical-marker-change" },
            );

            loadPlayer({ preserveDvrPosition: true });
          } else {
            console.warn(
              "HLS logical broadcast changed — starting a fresh viewer session",
              {
                from: lastLogicalSessionMarker,
                to: logicalMarker,
                transportGeneration,
              },
            );

            lastLogicalSessionMarker = logicalMarker;
            lastTransportGeneration = transportGeneration;

            dvrIntentModeRef.current = "live";
            dvrStableObservationRef.current = null;
            dvrIntentRef.current = null;
            clearPersistedDvrIntent();
            dvrResumeRef.current = null;
            dvrRecoveryActiveRef.current = false;
            dvrRestoreInFlightRef.current = false;
            if (dvrRestoreVerifyTimerRef.current) {
              window.clearTimeout(dvrRestoreVerifyTimerRef.current);
              dvrRestoreVerifyTimerRef.current = null;
            }
            dvrUserSeekCommitRef.current = false;

            loadPlayer({ preserveDvrPosition: false });
          }
        } else if (transportChanged) {
          console.warn(
            "HLS transport generation changed — preserving logical DVR session",
            {
              logicalSession: logicalMarker,
              from: lastTransportGeneration,
              to: transportGeneration,
              authoritativeBehindLive: dvrIntentRef.current?.behindLive ?? null,
            },
          );

          // Freeze the authoritative viewer offset BEFORE rebuilding.
          freezeDvrForRecovery();

          lastLogicalSessionMarker = logicalMarker;
          lastTransportGeneration = transportGeneration;

          // Rebuild against the fresh transport, but preserve DVR intent.
          loadPlayer({ preserveDvrPosition: true });
        } else {
          lastLogicalSessionMarker = logicalMarker;
          lastTransportGeneration = transportGeneration;
        }
      } catch {
        // Transient fetch failure — next poll will retry; not worth
        // surfacing as an error since hls.js's own error handling above
        // already covers genuine connectivity problems.
      }

      if (!cancelled && !streamUnavailable) {
        sessionPollTimer = setTimeout(pollSession, SESSION_POLL_MS);
      }
    };

    loadPlayer();
    pollSession();

    return () => {
      cancelled = true;
      streamUnavailable = true;
      if (sessionPollTimer) clearTimeout(sessionPollTimer);
      sessionPollTimer = null;

      if (dvrRestoreVerifyTimerRef.current) {
        window.clearTimeout(dvrRestoreVerifyTimerRef.current);
        dvrRestoreVerifyTimerRef.current = null;
      }
      dvrRestoreInFlightRef.current = false;
      dvrStableObservationRef.current = null;

      destroyCurrentPlayer();

      video.removeEventListener("playing", handlePlaybackReady);
      video.removeEventListener("canplay", handlePlaybackReady);
      video.removeEventListener("loadeddata", handlePlaybackReady);
      video.removeEventListener("waiting", handleWaiting);
    };
  }, [
    src,
    lowLatency,
    apiBase,
    onStreamUnavailable,
    autoPlay,
    muted,
    controls,
    onPlaybackReady,
    dvrEnabled,
    dvrWindowSeconds,
    preferredPlayback,
    onPreferredPlaybackFailure,
    captureDvrResumePoint,
    restoreDvrResumePoint,
    readPersistedDvrIntent,
    persistDvrIntent,
    clearPersistedDvrIntent,
  ]);

  const copy = STATUS_COPY[status.kind];

  const formatOffset = (seconds) => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  };

  const effectiveWindowSeconds =
    dvrState.available && dvrState.end > dvrState.start
      ? dvrState.end - dvrState.start
      : Number(dvrWindowSeconds || 0);

  // Treat the last few seconds as "at live" because the safest playable
  // point is intentionally a little behind the absolute manifest edge.
  const LIVE_EDGE_THRESHOLD_SECONDS = 6;
  const isAtLiveEdge =
    dvrState.available &&
    !dvrState.paused &&
    dvrState.behindLive <= LIVE_EDGE_THRESHOLD_SECONDS;

  const sliderValue = dvrState.available
    ? Math.min(Math.max(dvrState.current, dvrState.start), dvrState.end)
    : 0;

  return (
    <div className="live-player-box">
      <video
        ref={videoRef}
        controls={controls}
        muted={muted}
        autoPlay={autoPlay}
        playsInline
        className="live-video"
      />

      {copy && (
        <div
          className={`player-overlay player-overlay--${status.kind}`}
          role="status"
        >
          <span className="player-pulse" aria-hidden="true">
            <span className="player-pulse-ring" />
            <span className="player-pulse-ring player-pulse-ring--delay" />
            <span className="player-pulse-dot" />
          </span>
          <p className="player-overlay-title">{copy.title}</p>
          <p className="player-overlay-sub">{copy.sub}</p>
        </div>
      )}

      {!copy && (
        <span
          className={`player-live-chip${
            dvrEnabled && dvrState.available && !isAtLiveEdge
              ? " player-live-chip--behind"
              : ""
          }`}
        >
          <span className="player-live-chip-dot" aria-hidden="true" />
          {dvrEnabled && dvrState.available && !isAtLiveEdge
            ? `${formatOffset(dvrState.behindLive)} behind`
            : "Live"}
        </span>
      )}

      {!copy &&
        dvrEnabled &&
        preferredPlayback &&
        typeof onRequestDvrPlayback === "function" && (
          <div className="nlm-dvr" aria-label="Live rewind controls">
            <div className="nlm-dvr__top">
              <div className="nlm-dvr__actions">
                <button
                  type="button"
                  className="nlm-dvr__button"
                  onClick={onRequestDvrPlayback}
                  aria-label="Open full rewind"
                  title="Open full rewind"
                >
                  Rewind / DVR
                </button>
              </div>
              <div className="nlm-dvr__status">
                <span className="nlm-dvr__live-label">
                  <span />
                  LIVE
                </span>
              </div>
            </div>
          </div>
        )}

      {!copy && dvrEnabled && !preferredPlayback && dvrState.available && (
        <div className="nlm-dvr" aria-label="Live rewind controls">
          <div className="nlm-dvr__top">
            <div className="nlm-dvr__actions">
              <button
                type="button"
                className="nlm-dvr__button nlm-dvr__button--play"
                onClick={togglePlayback}
                aria-label={
                  dvrState.paused ? "Resume playback" : "Pause playback"
                }
                title={dvrState.paused ? "Resume" : "Pause"}
              >
                {dvrState.paused ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                className="nlm-dvr__button"
                onClick={() => rewindBy(10)}
                aria-label="Rewind 10 seconds"
                title="Rewind 10 seconds"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M11 7V3L5 8l6 5V9c3.3 0 6 2.7 6 6 0 1.4-.5 2.7-1.3 3.7l1.5 1.3A7.9 7.9 0 0 0 19 15c0-4.4-3.6-8-8-8Z" />
                </svg>
                <span>10</span>
              </button>
            </div>

            <div className="nlm-dvr__status">
              {isAtLiveEdge ? (
                <span className="nlm-dvr__live-label">
                  <span />
                  LIVE
                </span>
              ) : (
                <>
                  <span className="nlm-dvr__behind-label">
                    {dvrState.paused ? "Paused" : "Behind live"} ·{" "}
                    {formatOffset(dvrState.behindLive)}
                  </span>
                  <button
                    type="button"
                    className="nlm-dvr__go-live"
                    onClick={goLive}
                  >
                    GO LIVE
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="nlm-dvr__timeline">
            <span className="nlm-dvr__time">
              −{formatOffset(Math.max(0, dvrState.end - dvrState.start))}
            </span>
            <input
              type="range"
              min={dvrState.start}
              max={dvrState.end}
              step="0.1"
              value={sliderValue}
              onChange={(event) => seekToDvrTime(Number(event.target.value))}
              aria-label="Live rewind position"
              aria-valuetext={
                isAtLiveEdge
                  ? "Live"
                  : `${formatOffset(dvrState.behindLive)} behind live`
              }
              style={{
                "--dvr-progress": `${
                  dvrState.end > dvrState.start
                    ? ((sliderValue - dvrState.start) /
                        (dvrState.end - dvrState.start)) *
                      100
                    : 100
                }%`,
              }}
            />
            <span className="nlm-dvr__time nlm-dvr__time--live">LIVE</span>
          </div>

          <div className="nlm-dvr__meta">
            <span>
              Available rewind: {formatOffset(effectiveWindowSeconds)}
            </span>
            <span>
              {isAtLiveEdge
                ? "At live edge"
                : `${formatOffset(dvrState.behindLive)} behind live`}
            </span>
          </div>
        </div>
      )}

      {isLandscapeContent && isPortraitViewport && !rotatePromptDismissed && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: "50%",
            bottom: 16,
            transform: "translateX(-50%)",
            zIndex: 9,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(5,7,17,.82)",
            color: "#fff",
            backdropFilter: "blur(12px)",
            fontSize: 12,
            fontWeight: 600,
            maxWidth: "calc(100% - 32px)",
          }}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <rect
              x="7"
              y="2"
              width="10"
              height="20"
              rx="2"
              transform="rotate(90 12 12)"
            />
          </svg>
          <span>Rotate your device for the best view</span>
          <button
            type="button"
            onClick={() => setRotatePromptDismissed(true)}
            aria-label="Dismiss"
            style={{
              marginLeft: 4,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,.7)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default LivePlayer;
