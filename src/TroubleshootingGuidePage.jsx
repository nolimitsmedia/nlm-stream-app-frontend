import { Link } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";

function Section({ id, title, children }) {
  return (
    <section id={id} className="hc-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function TroubleshootingGuidePage() {
  return (
    <div className="hc-page">
      <PublicHeader />

      <main className="hc-main">
        <div className="hc-container">
          <div className="hc-breadcrumb">
            <Link to="/help">Help Center</Link>
            <span>/</span>
            <span>Troubleshooting Guide</span>
          </div>

          <header className="hc-hero">
            <span className="hc-eyebrow">Guide</span>
            <h1>Troubleshooting Guide</h1>
            <p className="hc-intro">
              Common issues and how to resolve them — most problems here can be
              fixed in a couple of minutes without needing to contact support.
            </p>
          </header>

          <nav className="hc-toc" aria-label="Table of contents">
            <a href="#offline">Stream Shows Offline</a>
            <a href="#wont-connect">OBS Won't Connect</a>
            <a href="#buffering">Buffering / Choppy Playback</a>
            <a href="#missing-recording">Can't Find a Recording</a>
            <a href="#embed-not-working">Embed Code Not Working</a>
            <a href="#api-key">API Key Stopped Working</a>
            <a href="#simulcast">Facebook/YouTube Not Showing</a>
            <a href="#manual-recording">Manual Recording Button Missing</a>
          </nav>

          <Section
            id="offline"
            title="Stream Shows Offline (but OBS says Connected)"
          >
            <ul>
              <li>
                Give it a few seconds — there's a brief delay between OBS
                connecting and the dashboard reflecting it
              </li>
              <li>
                Double-check the <strong>Stream Key</strong> in OBS exactly
                matches the one shown on your channel — even one wrong character
                will fail silently in some encoders
              </li>
              <li>
                Confirm you're looking at the right channel — if you have
                multiple channels, it's easy to check the wrong one
              </li>
              <li>
                If it's genuinely stuck, use <strong>Force Offline</strong> on
                the channel to clear a stuck live status, then reconnect OBS
              </li>
            </ul>
          </Section>

          <Section
            id="wont-connect"
            title="OBS Won't Connect / Connection Failed"
          >
            <ul>
              <li>
                Confirm your internet connection is actually working — try
                loading a website in a browser first
              </li>
              <li>
                Check whether the stream key was recently regenerated — a
                regenerated key immediately invalidates the old one, so OBS
                needs the new one pasted in
              </li>
              <li>
                Confirm <strong>Server</strong> in OBS's Stream settings is
                exactly the RTMP Server shown on your channel, with{" "}
                <strong>Service</strong> set to <code>Custom...</code>
              </li>
              <li>
                Some networks (hotel wifi, restrictive office/church networks)
                block outbound RTMP — try a different network if nothing else
                works
              </li>
            </ul>
          </Section>

          <Section
            id="buffering"
            title="Buffering / Choppy Playback for Viewers"
          >
            <ul>
              <li>
                Check OBS's <strong>Dropped Frames</strong> indicator
                (bottom-right status bar) — if it's climbing, your upload
                bandwidth can't keep up with your configured bitrate
              </li>
              <li>
                Lower your bitrate in <strong>Settings → Output</strong> — see
                the <Link to="/help/obs-setup">OBS Setup Guide</Link> for
                recommended settings per plan
              </li>
              <li>
                Wired ethernet is significantly more stable than wifi for the
                OBS machine itself, if that's an option
              </li>
            </ul>
          </Section>

          <Section
            id="missing-recording"
            title="Can't Find a Recording After a Broadcast"
          >
            <ul>
              <li>
                Recordings take a short while to process after a broadcast ends
                — give it a few minutes before assuming it's missing
              </li>
              <li>
                Confirm <strong>Record all incoming streams</strong> was
                actually on for that channel before the broadcast started — it
                can't retroactively record a broadcast that already happened
              </li>
              <li>
                Confirm your plan includes recording —{" "}
                <strong>Essential</strong> doesn't, so nothing will ever appear
                regardless of the toggle
              </li>
            </ul>
          </Section>

          <Section
            id="embed-not-working"
            title="Embed Code Not Showing on My Website"
          >
            <ul>
              <li>
                Confirm the entire embed code was copied — a partially copied
                iframe snippet will fail silently
              </li>
              <li>
                Some website builders strip raw HTML/iframe embeds by default —
                check your site platform's settings for an "allow custom HTML"
                or "embed" block type
              </li>
            </ul>
          </Section>

          <Section id="api-key" title="API Key Stopped Working">
            <ul>
              <li>
                Check whether it was revoked (intentionally or by accident) on
                the API Keys page — a revoked key stops working immediately and
                can't be un-revoked
              </li>
              <li>
                Generate a new key if needed — remember, the full key is only
                ever shown once at creation
              </li>
            </ul>
          </Section>

          <Section
            id="simulcast"
            title="Facebook/YouTube Broadcast Not Showing Up"
          >
            <ul>
              <li>
                Confirm the platform still shows as <strong>Connected</strong>{" "}
                on your channel — connections can expire and need reconnecting
              </li>
              <li>
                For Instagram specifically, remember it's manual-key only — you
                need a fresh Stream Key from Instagram's own Live Producer
                before each broadcast, it doesn't stay connected automatically
              </li>
            </ul>
          </Section>

          <Section
            id="manual-recording"
            title="Manual Recording Button Isn't Showing"
          >
            <ul>
              <li>
                It only appears while the channel is actually{" "}
                <strong>live</strong> — it's not available before or after a
                broadcast
              </li>
              <li>
                Confirm your plan includes recording — same requirement as
                automatic recording
              </li>
            </ul>
          </Section>

          <div className="hc-footer-links">
            <Link to="/help">← Back to Help Center</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default TroubleshootingGuidePage;
