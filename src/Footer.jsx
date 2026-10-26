import { Link } from "react-router-dom";
import logo from "./assets/nlm-logo.png";

function Footer() {
  return (
    <footer className="public-footer">
      {/* top accent gradient line */}
      <div className="pf-accent-line" />

      <div className="public-footer-inner">
        {/* ── Brand block ── */}
        <div className="footer-brand-block">
          <Link to="/home" className="public-brand footer-brand">
            <img src={logo} alt="NLM Stream" className="public-logo" />
          </Link>

          <p>
            No Limits Media blends innovative technology with creative media to
            elevate how your organization works and communicates. We support you
            with IT management, web care, and audio-visual expertise — plus
            design, content, and livestreaming that amplify your impact.
          </p>

          {/* Social / external links */}
          <div className="pf-socials">
            <a
              href="https://nolimitsmedia.com"
              target="_blank"
              rel="noreferrer"
              className="pf-social-btn"
              aria-label="Website"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              nolimitsmedia.com
            </a>
            <a
              href="mailto:team@nolimitsmedia.com"
              className="pf-social-btn"
              aria-label="Support email"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              team@nolimitsmedia.com
            </a>
          </div>
        </div>

        {/* ── Nav columns ── */}
        <div className="footer-links">
          <div>
            <h4>Platform</h4>
            <Link to="/home">Home</Link>
            <Link to="/pricing">Pricing</Link>
            <Link to="/help">Help Center</Link>
            <Link to="/signup">Create Account</Link>
          </div>

          <div>
            <h4>Account</h4>
            <Link to="/login">Client Login</Link>
            <Link to="/pricing">Plans</Link>
            <Link to="/privacy-policy">Privacy Policy</Link>
          </div>

          <div>
            <h4>No Limits Media</h4>
            <a
              href="https://nolimitsmedia.com"
              target="_blank"
              rel="noreferrer"
            >
              Website
            </a>
            <a href="mailto:team@nolimitsmedia.com">Support</a>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="public-footer-bottom">
        <span>© 2026 No Limits Media. All rights reserved.</span>
        <div className="pf-bottom-badges">
          <span className="pf-badge">
            <span className="pf-badge-dot" />
            NLM Streaming Cloud
          </span>
          <span className="pf-bottom-sep">·</span>
          <span>Built for modern streaming teams.</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
