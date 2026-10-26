// src/LoginPage.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "./api";
import PublicHeader from "./PublicHeader";
import Footer from "./Footer";

function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.post("/api/auth/login", form);
      localStorage.setItem("nlm_token", res.data.token);
      localStorage.setItem("nlm_admin", JSON.stringify(res.data.admin));
      navigate("/");
    } catch (error) {
      alert(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PublicHeader />

      <div className="lp-page public-page-with-header">
        {/* background glows */}
        <div className="lp-glow lp-glow--blue" />
        <div className="lp-glow lp-glow--purple" />

        <div className="lp-card-wrap">
          {/* brand mark */}
          <div className="lp-brand">
            <div className="lp-brand-icon">
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
            <span className="lp-brand-name">NLM Stream</span>
          </div>

          <h1 className="lp-heading">Welcome back</h1>
          <p className="lp-sub">Sign in to your admin dashboard</p>

          <form className="lp-form" onSubmit={handleLogin}>
            {/* Email */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-email">
                Email address
              </label>
              <div className="lp-input-wrap">
                <svg
                  className="lp-input-icon"
                  width="16"
                  height="16"
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
                  id="lp-email"
                  className="lp-input"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="lp-field">
              <label className="lp-label" htmlFor="lp-password">
                Password
              </label>
              <div className="lp-input-wrap">
                <svg
                  className="lp-input-icon"
                  width="16"
                  height="16"
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
                  id="lp-password"
                  className="lp-input lp-input--password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="lp-toggle-pw"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
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
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
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
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" className="lp-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="lp-spinner" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="lp-footer-links">
            <Link to="/pricing" className="lp-footer-link">
              View Pricing
            </Link>
            <span className="lp-footer-sep">·</span>
            <Link to="/signup" className="lp-footer-link">
              Create Account
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

export default LoginPage;
