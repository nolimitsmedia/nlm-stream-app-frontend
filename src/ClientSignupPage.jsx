// src/ClientSignupPage.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";

const API_BASE = import.meta.env.VITE_API_BASE;

function formatPrice(cents) {
  const amount = Number(cents || 0) / 100;
  return `$${amount.toFixed(0)}`;
}

// Reusable field wrapper
function Field({ label, hint, children }) {
  return (
    <div className="sp-field">
      <label className="sp-label">
        {label}
        {hint && <span className="sp-label-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function ClientSignupPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPlan = searchParams.get("plan") || "";

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  const [form, setForm] = useState({
    plan_key: requestedPlan,
    organization_name: "",
    client_name: "",
    client_email: "",
    client_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Pull the live plan list (names, prices, whmcs_configured) from the same
  // endpoint PricingPage uses, instead of hardcoding plan keys/labels here.
  // That way a renamed/added/removed plan only ever needs to change in the
  // database — this page (and its tab labels/prices) follow automatically.
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/public/plans`);
        const data = await res.json();
        const loadedPlans = data.plans || [];
        setPlans(loadedPlans);

        setForm((prev) => {
          const requestedIsValid = loadedPlans.some(
            (p) => p.plan_key === prev.plan_key,
          );
          if (requestedIsValid) return prev;

          // Fall back to the first (cheapest) plan if the ?plan= param
          // didn't match anything real, or wasn't provided at all.
          return { ...prev, plan_key: loadedPlans[0]?.plan_key || "" };
        });
      } catch (error) {
        console.error("Failed to load plans:", error);
      } finally {
        setPlansLoading(false);
      }
    };
    loadPlans();
  }, []);

  const updateForm = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const payload = { ...form };

      const res = await fetch(`${API_BASE}/api/public/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || "Signup failed");

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      localStorage.setItem("nlm_token", data.token);
      localStorage.setItem("nlm_admin", JSON.stringify(data.admin));
      localStorage.setItem("nlm_organization_id", String(data.organization.id));
      localStorage.setItem(
        "nlm_current_organization",
        JSON.stringify(data.organization),
      );
      navigate("/");
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.plan_key === form.plan_key);

  return (
    <>
      <PublicHeader />

      <main className="sp-page public-page-with-header">
        {/* ambient glows */}
        <div className="sp-glow sp-glow--blue" />
        <div className="sp-glow sp-glow--purple" />

        <div className="sp-wrap">
          {/* ── LEFT PANEL — branding + feature list ── */}
          <aside className="sp-panel">
            <div className="sp-panel-brand">
              <div className="sp-panel-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polygon
                    points="10 8 16 12 10 16 10 8"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </div>
              <span>NLM Stream</span>
            </div>

            <h2 className="sp-panel-heading">
              Everything you need to go live — ready in minutes.
            </h2>

            <p className="sp-panel-sub">
              Your tenant, channels, stream keys, replay system, analytics
              dashboard, and branded watch page are automatically prepared.
            </p>

            <ul className="sp-panel-features">
              {[
                "Branded watch page included",
                "RTMP + SRT stream keys",
                "Replay library & VOD",
                "Live chat & prayer requests",
                "Team seats & role access",
                "Analytics dashboard",
              ].map((f) => (
                <li key={f} className="sp-panel-feature">
                  <svg
                    className="sp-panel-check"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <div className="sp-panel-plan-badge">
              <span className="sp-panel-plan-dot" />
              {selectedPlan
                ? `${selectedPlan.name} plan selected — ${formatPrice(selectedPlan.monthly_price_cents)}/mo`
                : "Choose a plan"}
            </div>
          </aside>

          {/* ── RIGHT PANEL — form ── */}
          <section className="sp-card">
            <div className="sp-card-header">
              <span className="sp-eyebrow">Start NLM Streaming Cloud</span>
              <h1 className="sp-card-heading">Create your account</h1>
              <p className="sp-card-sub">
                Already have an account?{" "}
                <Link to="/login" className="sp-link">
                  Sign in
                </Link>
              </p>
            </div>

            {error && (
              <div className="sp-error">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <form className="sp-form" onSubmit={submitSignup}>
              {/* Plan selector */}
              <Field label="Plan">
                {plansLoading ? (
                  <div className="sp-plan-tabs">
                    <span className="sp-plan-tab" style={{ opacity: 0.6 }}>
                      Loading plans…
                    </span>
                  </div>
                ) : (
                  <div className="sp-plan-tabs">
                    {plans.map((p) => (
                      <button
                        key={p.plan_key}
                        type="button"
                        className={`sp-plan-tab${form.plan_key === p.plan_key ? " sp-plan-tab--active" : ""}`}
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            plan_key: p.plan_key,
                          }));
                          setSearchParams(
                            { plan: p.plan_key },
                            { replace: true },
                          );
                        }}
                      >
                        {p.name}
                        <span className="sp-plan-tab-price">
                          {" "}
                          — {formatPrice(p.monthly_price_cents)}/mo
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Field>

              <div className="sp-form-grid">
                <Field label="Organization / Church Name">
                  <div className="sp-input-wrap">
                    <svg
                      className="sp-input-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <input
                      className="sp-input"
                      name="organization_name"
                      value={form.organization_name}
                      onChange={updateForm}
                      placeholder="Your Church Name"
                      required
                    />
                  </div>
                </Field>

                <Field label="Your Name">
                  <div className="sp-input-wrap">
                    <svg
                      className="sp-input-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      className="sp-input"
                      name="client_name"
                      value={form.client_name}
                      onChange={updateForm}
                      placeholder="Pastor / Media Director"
                      required
                    />
                  </div>
                </Field>

                <Field label="Email address">
                  <div className="sp-input-wrap">
                    <svg
                      className="sp-input-icon"
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
                    <input
                      className="sp-input"
                      type="email"
                      name="client_email"
                      value={form.client_email}
                      onChange={updateForm}
                      placeholder="client@example.com"
                      required
                    />
                  </div>
                </Field>

                <Field label="Password">
                  <div className="sp-input-wrap">
                    <svg
                      className="sp-input-icon"
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      className="sp-input sp-input--pw"
                      type={showPassword ? "text" : "password"}
                      name="client_password"
                      value={form.client_password}
                      onChange={updateForm}
                      placeholder="At least 6 characters"
                      required
                    />
                    <button
                      type="button"
                      className="sp-pw-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label="Toggle password"
                    >
                      {showPassword ? (
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
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
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
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </Field>
              </div>
              {/* /sp-form-grid */}

              {selectedPlan && !selectedPlan.whmcs_configured && (
                <div className="sp-error">
                  This plan isn't available for self-serve checkout yet — please
                  contact us directly to get set up.
                </div>
              )}

              <button
                type="submit"
                className="sp-submit"
                disabled={
                  loading ||
                  plansLoading ||
                  !selectedPlan ||
                  !selectedPlan.whmcs_configured
                }
              >
                {loading ? (
                  <>
                    <span className="sp-spinner" />
                    Preparing your account…
                  </>
                ) : (
                  <>
                    Create Account
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </main>

      <Footer />
    </>
  );
}

export default ClientSignupPage;
