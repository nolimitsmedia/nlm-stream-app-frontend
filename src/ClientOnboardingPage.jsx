import { useMemo, useState } from "react";
import api from "./api";

const initialForm = {
  organization_name: "",
  organization_slug: "",
  subscription_plan: "starter",
  primary_color: "#0d6efd",
  secondary_color: "#fd9d00",
  logo_url: "",
  custom_domain: "",
  donation_url: "",
  client_name: "",
  client_email: "",
  client_password: "",
  client_global_role: "operator",
  organization_role: "operator",
  channel_name: "",
  channel_description: "",
};

const STEPS = [
  {
    num: 1,
    label: "Organization",
    icon: (
      <svg
        width="14"
        height="14"
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
    ),
  },
  {
    num: 2,
    label: "Client Login",
    icon: (
      <svg
        width="14"
        height="14"
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
    ),
  },
  {
    num: 3,
    label: "First Channel",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Shared field/input components ── */
function Field({ label, hint, children, wide }) {
  return (
    <div className={`ob-field${wide ? " ob-field--wide" : ""}`}>
      <label className="ob-label">
        {label}
        {hint && <span className="ob-label-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function OBInput({ icon, ...props }) {
  return (
    <div className="ob-input-wrap">
      {icon && <span className="ob-input-icon">{icon}</span>}
      <input
        className={`ob-input${icon ? " ob-input--icon" : ""}`}
        {...props}
      />
    </div>
  );
}

function OBSelect({ children, ...props }) {
  return (
    <div className="ob-input-wrap">
      <select className="ob-input ob-select" {...props}>
        {children}
      </select>
    </div>
  );
}

/* ── Result row with copy toast ── */
function ResultRow({ label, value, onCopy }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!value) return;
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="ob-result-row">
      <span className="ob-result-label">{label}</span>
      <strong className="ob-result-value">{value || "—"}</strong>
      <button
        type="button"
        className={`ob-result-copy${copied ? " ob-result-copy--done" : ""}`}
        onClick={handleCopy}
      >
        {copied ? (
          <svg
            width="12"
            height="12"
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
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
function ClientOnboardingPage({ setActivePage }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const generatedSlug = useMemo(
    () => slugify(form.organization_name),
    [form.organization_name],
  );

  const updateForm = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const applyGeneratedValues = () => {
    setForm((prev) => ({
      ...prev,
      organization_slug: prev.organization_slug || generatedSlug,
      channel_name: prev.channel_name || `${prev.organization_name} Main`,
    }));
  };

  const copyText = async (value) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setNotice("Copied to clipboard.");
  };

  const submitOnboarding = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setNotice("");
      setError("");
      setResult(null);

      const payload = {
        ...form,
        organization_slug: form.organization_slug || generatedSlug,
        channel_name: form.channel_name || `${form.organization_name} Main`,
      };

      const res = await api.post("/api/onboarding/client", payload);
      const data = res.data;

      setResult(data);
      setNotice("Client onboarded successfully.");

      if (data.organization?.id) {
        localStorage.setItem(
          "nlm_organization_id",
          String(data.organization.id),
        );
        localStorage.setItem(
          "nlm_current_organization",
          JSON.stringify({ ...data.organization, membership_role: "owner" }),
        );
        window.dispatchEvent(
          new CustomEvent("nlm-organization-changed", {
            detail: {
              organizationId: String(data.organization.id),
              organization: { ...data.organization, membership_role: "owner" },
            },
          }),
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to onboard client.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ob-page">
      {/* ── Page header ── */}
      <div className="ob-page-header">
        <div className="ob-page-header-left">
          <div className="ob-page-icon">
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
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="ob-page-title">Client Onboarding Wizard</h2>
            <p className="ob-page-sub">
              Create a tenant, client login, first channel, and watch links in
              one flow.
            </p>
          </div>
        </div>
        <span className="ob-saas-pill">SaaS Setup</span>
      </div>

      {/* ── Step tracker ── */}
      <div className="ob-stepper">
        {STEPS.map((step, i) => (
          <div key={step.num} className="ob-step-wrap">
            <div className="ob-step">
              <div className="ob-step-circle">{step.icon}</div>
              <div className="ob-step-meta">
                <span className="ob-step-num">Step {step.num}</span>
                <span className="ob-step-label">{step.label}</span>
              </div>
            </div>
            {i < STEPS.length - 1 && <div className="ob-step-connector" />}
          </div>
        ))}
      </div>

      {/* ── Banners ── */}
      {notice && (
        <div className="ob-banner ob-banner--success">
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
        <div className="ob-banner ob-banner--error">
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

      {/* ── Form ── */}
      <form className="ob-form" onSubmit={submitOnboarding}>
        {/* Step 1 — Organization */}
        <div className="ob-panel">
          <div className="ob-panel-header">
            <div className="ob-step-badge">1</div>
            <div>
              <h3 className="ob-panel-title">Organization</h3>
              <p className="ob-panel-sub">Client / church tenant details.</p>
            </div>
          </div>

          <div className="ob-fields-grid">
            <Field label="Organization Name">
              <OBInput
                icon={
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
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                }
                name="organization_name"
                value={form.organization_name}
                onChange={updateForm}
                onBlur={applyGeneratedValues}
                placeholder="Your Church Name"
                required
              />
            </Field>

            <Field label="Organization Slug" hint="(auto-generated)">
              <OBInput
                name="organization_slug"
                value={form.organization_slug}
                onChange={updateForm}
                placeholder={generatedSlug || "your-church-name"}
              />
            </Field>

            <Field label="Plan">
              <OBSelect
                name="subscription_plan"
                value={form.subscription_plan}
                onChange={updateForm}
              >
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
                <option value="internal">Internal</option>
              </OBSelect>
            </Field>

            <Field label="Custom Domain">
              <OBInput
                icon={
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                }
                name="custom_domain"
                value={form.custom_domain}
                onChange={updateForm}
                placeholder="live.clientchurch.org"
              />
            </Field>

            <Field label="Logo URL">
              <OBInput
                icon={
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
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                }
                name="logo_url"
                value={form.logo_url}
                onChange={updateForm}
                placeholder="https://..."
              />
            </Field>

            <Field label="Donation URL">
              <OBInput
                icon={
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
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
                name="donation_url"
                value={form.donation_url}
                onChange={updateForm}
                placeholder="https://..."
              />
            </Field>

            {/* Color pickers */}
            <Field label="Primary Color">
              <div className="ob-color-row">
                <div
                  className="ob-color-swatch"
                  style={{ background: form.primary_color }}
                />
                <input
                  className="ob-input ob-color-input"
                  name="primary_color"
                  value={form.primary_color}
                  onChange={updateForm}
                  placeholder="#0d6efd"
                />
                <input
                  type="color"
                  className="ob-color-picker"
                  value={form.primary_color}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, primary_color: e.target.value }))
                  }
                />
              </div>
            </Field>

            <Field label="Secondary Color">
              <div className="ob-color-row">
                <div
                  className="ob-color-swatch"
                  style={{ background: form.secondary_color }}
                />
                <input
                  className="ob-input ob-color-input"
                  name="secondary_color"
                  value={form.secondary_color}
                  onChange={updateForm}
                  placeholder="#fd9d00"
                />
                <input
                  type="color"
                  className="ob-color-picker"
                  value={form.secondary_color}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, secondary_color: e.target.value }))
                  }
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Step 2 — Client Login */}
        <div className="ob-panel">
          <div className="ob-panel-header">
            <div className="ob-step-badge">2</div>
            <div>
              <h3 className="ob-panel-title">Client Login</h3>
              <p className="ob-panel-sub">
                Create or attach the client admin / operator account.
              </p>
            </div>
          </div>

          <div className="ob-fields-grid">
            <Field label="Client Name">
              <OBInput
                icon={
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
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
                name="client_name"
                value={form.client_name}
                onChange={updateForm}
                placeholder="Pastor / Media Director"
                required
              />
            </Field>

            <Field label="Client Email">
              <OBInput
                icon={
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
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                }
                name="client_email"
                type="email"
                value={form.client_email}
                onChange={updateForm}
                placeholder="client@example.com"
                required
              />
            </Field>

            <Field label="Temporary Password">
              <OBInput
                icon={
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                name="client_password"
                type="password"
                value={form.client_password}
                onChange={updateForm}
                placeholder="At least 6 characters"
              />
            </Field>

            <Field label="Global Role">
              <OBSelect
                name="client_global_role"
                value={form.client_global_role}
                onChange={updateForm}
              >
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </OBSelect>
            </Field>

            <Field label="Tenant Role">
              <OBSelect
                name="organization_role"
                value={form.organization_role}
                onChange={updateForm}
              >
                <option value="operator">Operator</option>
                <option value="admin">Tenant Admin</option>
                <option value="owner">Owner</option>
                <option value="viewer">Viewer</option>
              </OBSelect>
            </Field>
          </div>

          <div className="ob-helper-text">
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            If the email already exists, the wizard will attach the existing
            account to this tenant and will not overwrite its password.
          </div>
        </div>

        {/* Step 3 — First Channel (full width) */}
        <div className="ob-panel ob-panel--wide">
          <div className="ob-panel-header">
            <div className="ob-step-badge">3</div>
            <div>
              <h3 className="ob-panel-title">First Channel</h3>
              <p className="ob-panel-sub">
                Generate stream credentials and the public watch page.
              </p>
            </div>
          </div>

          <div className="ob-fields-grid">
            <Field label="Channel Name">
              <OBInput
                icon={
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
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                }
                name="channel_name"
                value={form.channel_name}
                onChange={updateForm}
                placeholder={
                  form.organization_name
                    ? `${form.organization_name} Main`
                    : "Main Livestream"
                }
              />
            </Field>

            <Field label="Channel Description" wide>
              <div className="ob-input-wrap">
                <textarea
                  className="ob-textarea"
                  name="channel_description"
                  value={form.channel_description}
                  onChange={updateForm}
                  placeholder="Primary livestream channel for worship services, events, and broadcasts."
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Form actions */}
        <div className="ob-form-actions">
          <button
            type="button"
            className="ob-btn-ghost"
            onClick={applyGeneratedValues}
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
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Auto-fill Slug
          </button>

          <button
            type="submit"
            className="ob-btn-primary"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="ob-spinner" />
                Creating Client…
              </>
            ) : (
              <>
                Create Client Tenant
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
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Success result card ── */}
      {result && (
        <div className="ob-result">
          {/* Success header */}
          <div className="ob-result-header">
            <div className="ob-result-check">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <span className="ob-result-pill">Client Ready</span>
              <h3 className="ob-result-org">{result.organization?.name}</h3>
              <p className="ob-result-desc">
                Login, tenant membership, first channel, and watch link were
                created successfully.
              </p>
            </div>
          </div>

          {/* Credentials grid */}
          <div className="ob-result-grid">
            <ResultRow
              label="Client Login"
              value={result.admin?.email}
              onCopy={() => copyText(result.admin?.email)}
            />
            <ResultRow
              label="Stream Key"
              value={result.links?.stream_key}
              onCopy={() => copyText(result.links?.stream_key)}
            />
            <ResultRow
              label="RTMP Server"
              value={result.links?.rtmp_server}
              onCopy={() => copyText(result.links?.rtmp_server)}
            />
            <ResultRow
              label="Watch Page"
              value={result.links?.watch_url}
              onCopy={() => copyText(result.links?.watch_url)}
            />
            <ResultRow
              label="Playback URL"
              value={result.links?.playback_url}
              onCopy={() => copyText(result.links?.playback_url)}
            />
            <ResultRow
              label="SRT URL"
              value={result.links?.srt_url}
              onCopy={() => copyText(result.links?.srt_url)}
            />
          </div>

          <div className="ob-result-actions">
            <button
              type="button"
              className="ob-btn-ghost"
              onClick={() => window.open(result.links?.watch_url, "_blank")}
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
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Open Watch Page
            </button>
            <button
              type="button"
              className="ob-btn-primary"
              onClick={() => setActivePage?.("Channels")}
            >
              Go To Channels
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
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientOnboardingPage;
