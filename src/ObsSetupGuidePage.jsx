import { Link } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";
import goingLiveImg from "./assets/Going_Live.png";

function Screenshot({ label, src }) {
  if (src) {
    return (
      <div className="hc-screenshot">
        <img src={src} alt={label} />
      </div>
    );
  }

  return (
    <div className="hc-screenshot-placeholder">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span>Screenshot: {label}</span>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="hc-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ObsSetupGuidePage() {
  return (
    <div className="hc-page">
      <PublicHeader />

      <main className="hc-main">
        <div className="hc-container">
          <div className="hc-breadcrumb">
            <Link to="/help">Help Center</Link>
            <span>/</span>
            <span>OBS Setup Guide</span>
          </div>

          <header className="hc-hero">
            <span className="hc-eyebrow">Guide</span>
            <h1>OBS Setup Guide</h1>
            <p className="hc-intro">
              Configuring OBS Studio to broadcast to your NLM Stream channel —
              from installing OBS through going live for the first time.
            </p>
          </header>

          <nav className="hc-toc" aria-label="Table of contents">
            <a href="#install">1. Install OBS</a>
            <a href="#get-credentials">2. Get Your Stream Credentials</a>
            <a href="#configure-stream">3. Configure OBS Stream Settings</a>
            <a href="#add-source">4. Add a Video Source</a>
            <a href="#output-settings">5. Recommended Output Settings</a>
            <a href="#go-live">6. Go Live</a>
            <a href="#confirm">7. Confirm You're Actually Live</a>
          </nav>

          <Section id="install" title="1. Install OBS">
            <p>
              Download OBS Studio (free, open-source) from{" "}
              <a href="https://obsproject.com" target="_blank" rel="noreferrer">
                obsproject.com
              </a>{" "}
              and install it like any other application — available for Windows,
              Mac, and Linux.
            </p>
          </Section>

          <Section id="get-credentials" title="2. Get Your Stream Credentials">
            <p>
              Log into your NLM Stream dashboard and go to{" "}
              <strong>Channels</strong>. Every channel has its own{" "}
              <strong>RTMP Server</strong> and <strong>Stream Key</strong> —
              these are what tell OBS where to send your broadcast, and which of
              your channels it belongs to.
            </p>
            <p>
              <em>
                Treat your Stream Key like a password — anyone who has it can
                broadcast to your channel. If it's ever exposed, use Regenerate
                on the Channels page to invalidate the old one immediately.
              </em>
            </p>
          </Section>

          <Section
            id="configure-stream"
            title="3. Configure OBS Stream Settings"
          >
            <p>
              In OBS, go to <strong>Settings → Stream</strong>. Set{" "}
              <strong>Service</strong> to <code>Custom...</code>, then paste
              your channel's RTMP Server into <strong>Server</strong> and your
              Stream Key into <strong>Stream Key</strong>.
            </p>
            <Screenshot
              label="OBS Settings → Stream, with Custom service, RTMP Server, and Stream Key filled in"
              src={goingLiveImg}
            />
            <p>
              Leave <strong>Use authentication</strong> unchecked and{" "}
              <strong>Enable Multitrack Video</strong> off — neither is needed
              for a standard RTMP broadcast to this platform. Click{" "}
              <strong>Apply</strong>, then <strong>OK</strong>.
            </p>
          </Section>

          <Section id="add-source" title="4. Add a Video Source">
            <p>
              In the main OBS window, click the <strong>+</strong> under{" "}
              <strong>Sources</strong> and choose what you're broadcasting —{" "}
              <strong>Video Capture Device</strong> for a webcam or camera,{" "}
              <strong>Display Capture</strong> or{" "}
              <strong>Window Capture</strong> for your screen, or both combined
              for a typical service setup (camera + slides, for example).
            </p>
          </Section>

          <Section id="output-settings" title="5. Recommended Output Settings">
            <p>
              Go to <strong>Settings → Output</strong> and set your video
              bitrate. Your channel's plan sets a hard ceiling on the maximum
              bitrate the platform will accept — going above it won't improve
              quality, it'll just waste your own upload bandwidth:
            </p>
            <table className="hc-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Max Bitrate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Essential</td>
                  <td>4Mb</td>
                </tr>
                <tr>
                  <td>Deluxe</td>
                  <td>10Mb</td>
                </tr>
                <tr>
                  <td>Premium</td>
                  <td>15Mb</td>
                </tr>
              </tbody>
            </table>
            <p>
              In <strong>Settings → Video</strong>, 1920x1080 at 30fps is a
              solid default for most services — go higher only if your plan's
              bitrate ceiling and your internet upload speed can actually
              support it without dropping frames.
            </p>
          </Section>

          <Section id="go-live" title="6. Go Live">
            <p>
              Click <strong>Start Streaming</strong> in the bottom-right of OBS.
              Within a few seconds, your channel should show as{" "}
              <strong>Live</strong> in your NLM Stream dashboard.
            </p>
          </Section>

          <Section id="confirm" title="7. Confirm You're Actually Live">
            <p>
              Don't just trust that OBS says "Live" — confirm the stream is
              actually reaching viewers:
            </p>
            <ul>
              <li>
                Check <strong>Live Monitor</strong> in your dashboard — confirm
                viewer count, bitrate, and stream health are showing real
                numbers, not stuck at zero
              </li>
              <li>
                Open your channel's public <strong>Watch Page</strong> in a
                different browser (or ask someone else to check) and confirm the
                video actually plays
              </li>
            </ul>
            <p>
              <em>
                Running into an issue getting this far? See the Troubleshooting
                Guide for common OBS connection problems.
              </em>
            </p>
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

export default ObsSetupGuidePage;
