import { useEffect, useMemo, useState } from "react";
import api from "./api";

function formatPrice(cents, currency = "usd") {
  const amount = Number(cents || 0) / 100;
  if (amount <= 0) return "Included";
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "usd").toUpperCase(),
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount) + "/mo"
  );
}

function formatMoney(cents, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
  }).format(Number(cents || 0) / 100);
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getBillingNotice(search) {
  const p = new URLSearchParams(search || "");
  if (p.get("billing") === "success")
    return "Billing updated successfully. WHMCS may take a few minutes to sync.";
  if (p.get("billing") === "cancelled")
    return "Billing update was cancelled. Your existing plan is unchanged.";
  return "";
}

function UsageBar({ label, used, limit, percent, accent = "blue" }) {
  return (
    <div className={`sub-usage-card sub-usage-card--${accent}`}>
      <span className="sub-usage-label">{label}</span>
      <strong className="sub-usage-count">
        {used || 0} / {limit || 0}
      </strong>
      <div className="sub-usage-bar">
        <div
          className={`sub-usage-fill sub-usage-fill--${accent}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="sub-usage-pct">{percent}% used</span>
    </div>
  );
}

function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [notice, setNotice] = useState(() =>
    getBillingNotice(window.location.search),
  );
  const [error, setError] = useState("");

  const loadBilling = async ({ refreshWhmcs = false } = {}) => {
    try {
      setError("");
      if (refreshWhmcs) await api.post("/api/subscription/refresh");
      const [subRes, plansRes, invRes] = await Promise.all([
        api.get("/api/subscription/current"),
        api.get("/api/public/plans"),
        api.get("/api/subscription/invoices"),
      ]);
      setSubscription(subRes.data.subscription || null);
      setPlans(plansRes.data.plans || []);
      setInvoices(invRes.data.invoices || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load subscription.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleOrgChange = () => {
      setLoading(true);
      loadBilling({ refreshWhmcs: true });
    };
    window.addEventListener("nlm-organization-changed", handleOrgChange);
    const params = new URLSearchParams(window.location.search || "");
    const fromWhmcs = params.has("billing");
    loadBilling({ refreshWhmcs: fromWhmcs });
    if (fromWhmcs)
      window.history.replaceState({}, "", window.location.pathname);
    return () =>
      window.removeEventListener("nlm-organization-changed", handleOrgChange);
  }, []);

  const startCheckout = async (planKey) => {
    try {
      setActionLoading(planKey);
      setNotice("");
      setError("");
      const res = await api.post("/api/subscription/checkout", {
        plan_key: planKey,
      });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
        return;
      }
      setNotice("Checkout session created, but no URL was returned.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to start WHMCS checkout.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const openBillingPortal = async () => {
    try {
      setActionLoading("portal");
      setNotice("");
      setError("");
      const res = await api.post("/api/subscription/portal");
      if (res.data.portal_url) {
        window.location.href = res.data.portal_url;
        return;
      }
      setNotice("Portal session created, but no URL was returned.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to open the WHMCS client area.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const refreshBilling = async () => {
    try {
      setActionLoading("refresh");
      setNotice("");
      setError("");
      await loadBilling({ refreshWhmcs: true });
      setNotice("Billing status refreshed from WHMCS.");
    } finally {
      setActionLoading("");
    }
  };

  const channelPct = subscription?.max_channels
    ? Math.min(
        100,
        Math.round(
          (Number(subscription.used_channels || 0) /
            Number(subscription.max_channels)) *
            100,
        ),
      )
    : 0;
  const adminPct = subscription?.max_admins
    ? Math.min(
        100,
        Math.round(
          (Number(subscription.used_admins || 0) /
            Number(subscription.max_admins)) *
            100,
        ),
      )
    : 0;
  const latestInvoice = useMemo(() => invoices[0] || null, [invoices]);

  const FEATURE_LIST = [
    { label: "Transcoding", on: subscription?.transcoding_enabled },
    { label: "Analytics", on: subscription?.analytics_enabled },
    { label: "Custom Domain", on: subscription?.custom_domain_enabled },
  ];

  return (
    <div className="subp-page">
      {/* Page header */}
      <div className="subp-page-header">
        <div className="subp-page-header-left">
          <div className="subp-page-icon">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="4" width="22" height="16" rx="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div>
            <h2 className="subp-page-title">Subscription &amp; Plan</h2>
            <p className="subp-page-sub">
              Track tenant usage, WHMCS status, invoices, and upgrades.
            </p>
          </div>
        </div>
        <div className="subp-header-actions">
          <button
            type="button"
            className="subp-btn-ghost"
            disabled={actionLoading === "refresh"}
            onClick={refreshBilling}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={actionLoading === "refresh" ? "subp-spin" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {actionLoading === "refresh" ? "Refreshing…" : "Refresh Billing"}
          </button>
          <span className="subp-plan-pill">
            {subscription?.plan_name || "Plan"}
          </span>
        </div>
      </div>

      {/* Banners */}
      {notice && (
        <div className="subp-banner subp-banner--success">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {notice}
        </div>
      )}
      {error && (
        <div className="subp-banner subp-banner--error">
          <svg
            width="14"
            height="14"
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

      {loading ? (
        <div className="subp-loading">
          <div className="subp-spinner" />
          <span>Loading subscription…</span>
        </div>
      ) : !subscription ? (
        <div className="subp-empty">
          <strong>No subscription found.</strong>
          <p>This tenant does not have a subscription record yet.</p>
        </div>
      ) : (
        <>
          {/* Summary grid */}
          <div className="subp-summary">
            {/* Hero plan card */}
            <div className="subp-hero-card">
              <span className="subp-eyebrow">Current Plan</span>
              <h3 className="subp-hero-plan">{subscription.plan_name}</h3>
              <div className="subp-hero-price">
                {formatPrice(
                  subscription.monthly_price_cents,
                  latestInvoice?.currency || "usd",
                )}
              </div>
              <div className="subp-hero-meta">
                <div>
                  <span
                    className={`subp-status-badge subp-status--${subscription.status}`}
                  >
                    {subscription.status}
                  </span>
                </div>
                <span>
                  Next billing: {formatDate(subscription.current_period_end)}
                </span>
                {subscription.cancel_at_period_end && (
                  <span className="subp-cancel-warn">
                    ⚠ Cancels {formatDate(subscription.current_period_end)}
                  </span>
                )}
              </div>
              {subscription.whmcs_client_id ? (
                <button
                  type="button"
                  className="subp-portal-btn"
                  disabled={actionLoading === "portal"}
                  onClick={openBillingPortal}
                >
                  {actionLoading === "portal" ? "Opening…" : "Manage Billing"}
                </button>
              ) : (
                <small className="subp-no-stripe">
                  WHMCS account not connected yet.
                </small>
              )}
            </div>

            {/* Usage cards */}
            <UsageBar
              label="Channels"
              used={subscription.used_channels}
              limit={subscription.max_channels}
              percent={channelPct}
              accent="blue"
            />
            <UsageBar
              label="Admin Seats"
              used={subscription.used_admins}
              limit={subscription.max_admins}
              percent={adminPct}
              accent="orange"
            />

            {/* Features card */}
            <div className="subp-features-card">
              <span className="subp-features-title">Features</span>
              <ul className="subp-features-list">
                {FEATURE_LIST.map((f) => (
                  <li
                    key={f.label}
                    className={f.on ? "subp-feature--on" : "subp-feature--off"}
                  >
                    {f.on ? (
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
                    ) : (
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
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    )}
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Plan upgrade cards */}
          <div className="subp-plans-grid">
            {plans.map((plan) => {
              const current = plan.plan_key === subscription.plan_key;
              const btnLoading = actionLoading === plan.plan_key;
              return (
                <div
                  key={plan.plan_key}
                  className={`subp-plan-card${current ? " subp-plan-card--current" : ""}`}
                >
                  {current && (
                    <div className="subp-plan-current-badge">Current</div>
                  )}
                  <span className="subp-plan-name">{plan.name}</span>
                  <div className="subp-plan-price">
                    {formatPrice(plan.monthly_price_cents)}
                  </div>
                  <ul className="subp-plan-features">
                    <li>{plan.max_channels} channel(s)</li>
                    <li>{plan.max_admins} team seats</li>
                    <li>{plan.max_storage_gb}GB storage</li>
                    <li>{plan.max_bitrate_kbps} KBPS max</li>
                  </ul>
                  <button
                    type="button"
                    className={
                      current
                        ? "subp-btn-ghost subp-plan-btn"
                        : "subp-btn-primary subp-plan-btn"
                    }
                    disabled={current || btnLoading}
                    onClick={() => startCheckout(plan.plan_key)}
                  >
                    {current
                      ? "Current Plan"
                      : btnLoading
                        ? "Opening…"
                        : "Upgrade via WHMCS"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Invoice history */}
          <div className="subp-invoices card">
            <div className="subp-invoices-header">
              <div>
                <h3 className="subp-invoices-title">Invoice History</h3>
                <p className="subp-invoices-sub">
                  Recent Stripe invoices and payment status.
                </p>
              </div>
              <span className="status-pill">{invoices.length} Invoice(s)</span>
            </div>

            {invoices.length === 0 ? (
              <div className="subp-empty">
                <strong>No invoices yet.</strong>
                <p>Invoices will appear here after Stripe creates them.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Created</th>
                      <th>Period</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="subp-muted">{inv.number || inv.id}</td>
                        <td>
                          <span
                            className={`subp-inv-status subp-inv-status--${inv.status}`}
                          >
                            {inv.status || "unknown"}
                          </span>
                        </td>
                        <td>{formatMoney(inv.amount_paid, inv.currency)}</td>
                        <td className="subp-muted">
                          {formatDate(inv.created)}
                        </td>
                        <td className="subp-muted">
                          {formatDate(inv.period_start)} —{" "}
                          {formatDate(inv.period_end)}
                        </td>
                        <td>
                          <div className="row-actions">
                            {inv.hosted_invoice_url && (
                              <a
                                href={inv.hosted_invoice_url}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-btn small"
                              >
                                View
                              </a>
                            )}
                            {inv.invoice_pdf && (
                              <a
                                href={inv.invoice_pdf}
                                target="_blank"
                                rel="noreferrer"
                                className="secondary-btn small"
                              >
                                PDF
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default SubscriptionPage;
