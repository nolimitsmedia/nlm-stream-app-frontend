// src/PricingPage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function formatPrice(cents) {
  const amount = Number(cents || 0) / 100;
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return `$${amount.toFixed(hasCents ? 2 : 0)}`;
}

// Feature check icon
function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pp-check-icon"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Used for features a plan does NOT include, matching the business's own
// marketing feature grid (which shows a red X rather than just omitting
// the row) — e.g. Essential explicitly shows "0 Storage" with an X rather
// than hiding the storage line entirely.
function Cross() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="pp-cross-icon"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/plans`);
        const data = await res.json();
        setPlans(data.plans || []);
      } catch (error) {
        console.error("Failed to load plans:", error);
      } finally {
        setLoading(false);
      }
    };
    loadPlans();
  }, []);

  // Mark the middle plan as "featured" (most popular)
  const featuredIndex = Math.floor(plans.length / 2);

  return (
    <>
      <PublicHeader />

      <main className="pp-page">
        {/* ── HERO ── */}
        <section className="pp-hero">
          <div className="pp-hero-glow" />
          <div className="pp-hero-inner">
            <span className="pp-eyebrow">NLM Streaming Cloud</span>
            <h1 className="pp-hero-h1">
              Simple, transparent pricing
              <br />
              for every team size.
            </h1>
            <p className="pp-hero-sub">
              White-label livestreaming for churches, ministries, and media
              teams. Create stream keys, watch pages, overlays, chat, prayer
              requests, reactions, and client portals in one platform.
            </p>

            {/* trust strip */}
            <div className="pp-trust-strip">
              <span className="pp-trust-item">
                <Check /> No setup fees
              </span>
              <span className="pp-trust-dot" />
              <span className="pp-trust-item">
                <Check /> Cancel anytime
              </span>
              <span className="pp-trust-dot" />
              <span className="pp-trust-item">
                <Check /> White-label included
              </span>
            </div>
          </div>
        </section>

        {/* ── PRICING CARDS ── */}
        <section className="pp-cards-section">
          {loading ? (
            <div className="pp-loading">
              <div className="pp-loading-spinner" />
              <p>Loading plans…</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="pp-empty">
              <p>No pricing plans available yet. Please check back soon.</p>
            </div>
          ) : (
            <div className="pp-cards-grid">
              {plans.map((plan, i) => {
                const isFeatured = i === featuredIndex;
                return (
                  <article
                    key={plan.plan_key}
                    className={`pp-card${isFeatured ? " pp-card--featured" : ""}`}
                  >
                    {isFeatured && (
                      <div className="pp-popular-badge">Most Popular</div>
                    )}

                    <div className="pp-card-top">
                      <span className="pp-plan-name">{plan.name}</span>
                      <div className="pp-price">
                        <span className="pp-price-currency">$</span>
                        <span className="pp-price-amount">
                          {formatPrice(plan.monthly_price_cents).replace(
                            "$",
                            "",
                          )}
                        </span>
                        <span className="pp-price-period">/mo</span>
                      </div>
                    </div>

                    <div className="pp-divider" />

                    {plan.whmcs_description && (
                      <p className="pp-plan-description">
                        {plan.whmcs_description}
                      </p>
                    )}

                    <ul className="pp-features">
                      <li>
                        <Check />
                        <span>
                          {plan.max_channels} channel
                          {plan.max_channels !== 1 ? "s" : ""}
                        </span>
                      </li>
                      <li
                        className={
                          plan.max_storage_gb > 0 ? "" : "pp-feature--off"
                        }
                      >
                        {plan.max_storage_gb > 0 ? <Check /> : <Cross />}
                        <span>{plan.max_storage_gb}GB storage</span>
                      </li>
                      <li>
                        <Check />
                        <span>{plan.max_cdn_bandwidth_gb}GB CDN bandwidth</span>
                      </li>
                      <li>
                        <Check />
                        <span>
                          {plan.max_egress_bandwidth_gb}GB egress bandwidth
                        </span>
                      </li>
                      <li
                        className={
                          plan.tv_channel_enabled ? "" : "pp-feature--off"
                        }
                      >
                        {plan.tv_channel_enabled ? <Check /> : <Cross />}
                        <span>TV channel</span>
                      </li>
                      <li
                        className={
                          plan.recording_enabled ? "" : "pp-feature--off"
                        }
                      >
                        {plan.recording_enabled ? <Check /> : <Cross />}
                        <span>Recording</span>
                      </li>
                      <li
                        className={plan.rewind_enabled ? "" : "pp-feature--off"}
                      >
                        {plan.rewind_enabled ? <Check /> : <Cross />}
                        <span>30-minute rewind</span>
                      </li>
                      <li
                        className={
                          plan.reduced_latency_enabled ? "" : "pp-feature--off"
                        }
                      >
                        {plan.reduced_latency_enabled ? <Check /> : <Cross />}
                        <span>Reduced latency</span>
                      </li>
                      <li>
                        <Check />
                        <span>
                          {(plan.max_bitrate_kbps / 1000).toFixed(0)}Mb maximum
                          bitrate
                        </span>
                      </li>
                      <li>
                        <Check />
                        <span>
                          {plan.priority_support_enabled
                            ? "Priority support"
                            : "Standard support"}
                        </span>
                      </li>
                      <li>
                        <Check />
                        <span>
                          {plan.whmcs_configured
                            ? "Secure checkout via WHMCS"
                            : "Manual / local signup"}
                        </span>
                      </li>
                    </ul>

                    <Link
                      to={`/signup?plan=${plan.plan_key}`}
                      className={`pp-cta-btn${isFeatured ? " pp-cta-btn--featured" : ""}`}
                    >
                      Get started with {plan.name}
                    </Link>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="pp-bottom-cta">
          <div className="pp-bottom-cta-inner">
            <h2>Need a custom plan for your organization?</h2>
            <p>
              We work with large ministries and enterprise media teams to build
              tailored solutions.
            </p>
            <a
              href="mailto:support@nolimitsmedia.com"
              className="home-btn-secondary pp-contact-btn"
            >
              Contact us
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

export default PricingPage;
