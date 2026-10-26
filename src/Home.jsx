// src/Home.jsx
import { Link } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";
import heroBg from "./assets/nlm-streaming.jpg";

function Home() {
  return (
    <>
      <PublicHeader />

      {/* home-page wrapper — no saas-public-page so we avoid its padding */}
      <main className="home-page">
        {/* ── HERO ── */}
        <section
          className="home-hero"
          style={{ backgroundImage: `url(${heroBg})` }}
        >
          {/* dark vertical gradient so text stays legible */}
          <div className="home-hero-overlay" />
          {/* purple/violet edge bloom matching the cinematic reference */}
          <div className="home-hero-edge-bloom" />

          {/* centered content */}
          <div className="home-hero-inner">
            {/* pulsing LIVE READY badge */}
            <div className="home-hero-live-badge">
              <span className="home-live-dot" />
              LIVE READY
            </div>

            {/* circular play button */}
            <button className="home-hero-play" aria-label="Watch demo">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </button>

            <span className="home-hero-eyebrow">NLM Streaming Manager</span>

            <h1 className="home-hero-h1">
              Powerful livestreaming, replay, and viewer tools for churches and
              media teams.
            </h1>

            <p className="home-hero-sub">
              Manage live streams, stream keys, recordings, replays, overlays,
              chat, prayer requests, analytics, and client accounts from one
              modern platform.
            </p>

            <div className="home-hero-actions">
              <Link to="/login" className="home-btn-primary">
                Login to Dashboard
              </Link>
              <Link to="/pricing" className="home-btn-secondary">
                View Pricing
              </Link>
            </div>

            {/* progress bar strip */}
            <div className="home-hero-progress">
              <div className="home-hero-progress-fill" />
            </div>
          </div>
        </section>

        {/* ── SOCIAL PROOF STRIP ── */}
        <div className="home-proof-strip">
          <span className="home-proof-label">
            Trusted by ministries and media teams
          </span>
          <div className="home-proof-divider" />
          <span className="home-proof-stat">
            <strong>4K</strong> SRT Ingest
          </span>
          <div className="home-proof-divider" />
          <span className="home-proof-stat">
            <strong>HLS</strong> Playback
          </span>
          <div className="home-proof-divider" />
          <span className="home-proof-stat">
            <strong>Multi-tenant</strong> Accounts
          </span>
          <div className="home-proof-divider" />
          <span className="home-proof-stat">
            <strong>Cloud</strong> Infrastructure
          </span>
        </div>

        {/* ── FEATURE CARDS ── */}
        <section className="home-features-section">
          <div className="home-features-eyebrow">
            <span className="home-eyebrow-label">Platform Features</span>
            <h2 className="home-features-heading">
              Everything your team needs to go live
            </h2>
          </div>

          <div className="home-features-grid">
            <article className="home-feature-card">
              <div className="home-feature-icon home-icon-blue">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="10 8 16 12 10 16 10 8" />
                </svg>
              </div>
              <span className="plan-badge">Live Streaming</span>
              <h3>RTMP + SRT</h3>
              <p>
                Connect OBS, send secure stream keys, and deliver stable HLS
                playback to your audience.
              </p>
            </article>

            <article className="home-feature-card">
              <div className="home-feature-icon home-icon-orange">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="2.18"
                    ry="2.18"
                  />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="2" y1="7" x2="7" y2="7" />
                  <line x1="2" y1="17" x2="7" y2="17" />
                  <line x1="17" y1="17" x2="22" y2="17" />
                  <line x1="17" y1="7" x2="22" y2="7" />
                </svg>
              </div>
              <span className="plan-badge">Replay Library</span>
              <h3>Record &amp; Publish</h3>
              <p>
                Convert recordings, publish public or members-only replays, and
                let viewers resume where they left off.
              </p>
            </article>

            <article className="home-feature-card">
              <div className="home-feature-icon home-icon-green">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span className="plan-badge">Engagement</span>
              <h3>Chat + Prayer</h3>
              <p>
                Add live chat, reactions, donation links, prayer requests,
                overlays, and moderation tools.
              </p>
            </article>
          </div>
        </section>

        {/* ── BUILT FOR GROWING TEAMS ── */}
        <section className="home-cta-section">
          <div
            className="home-cta-inner card"
            style={{ maxWidth: 1110, margin: "0 auto" }}
          >
            <div className="section-header">
              <h2>Built for growing streaming teams</h2>
              <div className="status-pill">Cloud Ready</div>
            </div>

            <p className="home-cta-body">
              NLM Streaming Manager gives every organization its own dashboard,
              stream channels, branded watch pages, replay tools, team access,
              and analytics foundation.
            </p>

            <div className="home-cta-highlights">
              <div className="home-cta-highlight">
                <span className="home-cta-highlight-dot home-dot-blue" />
                Role-based access control
              </div>
              <div className="home-cta-highlight">
                <span className="home-cta-highlight-dot home-dot-orange" />
                Automated transcoding pipeline
              </div>
              <div className="home-cta-highlight">
                <span className="home-cta-highlight-dot home-dot-green" />
                Real-time viewer analytics
              </div>
              <div className="home-cta-highlight">
                <span className="home-cta-highlight-dot home-dot-blue" />
                Mobile-responsive watch pages
              </div>
            </div>
          </div>
        </section>

        <div className="home-cta-actions">
          <Link to="/signup" className="home-btn-primary">
            Create Client Account
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

export default Home;
