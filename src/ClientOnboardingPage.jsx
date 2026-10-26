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
const PLAN_LABELS = {
  starter: "Essential",
  pro: "Deluxe",
  enterprise: "Premium",
  internal: "Internal",
};
const LINK_STATE_LABELS = {
  linked: "Linked",
  email_match: "Email match",
  not_in_app: "Not in app",
};

function ClientOnboardingPage({ setActivePage }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // ── Import from WHMCS (2026-10-26) ──
  // Lists WHMCS clients with a StreamControl product; "Import" prefills this
  // wizard and links billing automatically after the tenant is created;
  // "Link" connects an organization that already exists. Server-side checks
  // (whmcs_link_service.js) block unsafe links; nothing is written to WHMCS.
  const [whmcsClients, setWhmcsClients] = useState(null);
  const [whmcsLoading, setWhmcsLoading] = useState(false);
  const [whmcsError, setWhmcsError] = useState("");
  const [pendingLink, setPendingLink] = useState(null);
  const [orgOptions, setOrgOptions] = useState([]);
  const [linkForm, setLinkForm] = useState(null);
  const [linkPreview, setLinkPreview] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkDone, setLinkDone] = useState(null);
  const [linkForce, setLinkForce] = useState(false);

  const generatedSlug = useMemo(
    () => slugify(form.organization_name),
    [form.organization_name],
  );

  const loadWhmcsClients = async () => {
    try {
      setWhmcsLoading(true);
      setWhmcsError("");
      const res = await api.get("/api/admin/whmcs/clients");
      setWhmcsClients(res.data.clients || []);
    } catch (err) {
      setWhmcsError(
        err.response?.data?.message || "Failed to load WHMCS clients.",
      );
    } finally {
      setWhmcsLoading(false);
    }
  };

  const loadOrgOptions = async () => {
    if (orgOptions.length) return;
    try {
      const res = await api.get("/api/organizations");
      setOrgOptions(res.data.organizations || []);
    } catch {
      setOrgOptions([]);
    }
  };

  const startImport = (row) => {
    const orgName = row.company || row.client_name || "";
    setForm((prev) => ({
      ...prev,
      organization_name: orgName,
      organization_slug: "",
      subscription_plan: row.plan_key || prev.subscription_plan,
      client_name: row.contact_name || row.client_name || "",
      client_email: row.email || "",
      client_password: "",
      organization_role: "owner",
      channel_name: orgName ? `${orgName} Main` : prev.channel_name,
    }));
    setPendingLink({
      whmcs_client_id: row.whmcs_client_id,
      service_id: row.service_id,
      client_name: row.client_name,
    });
    setResult(null);
    setError("");
    setNotice(
      `Importing WHMCS client #${row.whmcs_client_id} (${row.client_name}). Enter a temporary password, review the details, then click Create Client Tenant — billing will be linked automatically.`,
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openLinkPanel = (row) => {
    loadOrgOptions();
    setLinkForm({
      organization_id: row.link?.organization_id
        ? String(row.link.organization_id)
        : "",
      whmcs_client_id: row.whmcs_client_id,
      service_id: row.service_id,
      client_name: row.client_name,
    });
    setLinkPreview(null);
    setLinkError("");
    setLinkDone(null);
    setLinkForce(false);
  };

  const runLinkPreview = async (linkInput = linkForm) => {
    if (!linkInput?.organization_id) {
      setLinkError("Choose the organization to link.");
      return null;
    }
    try {
      setLinkBusy(true);
      setLinkError("");
      setLinkDone(null);
      const res = await api.post("/api/admin/whmcs/link/preview", {
        organization_id: linkInput.organization_id,
        whmcs_client_id: linkInput.whmcs_client_id,
        service_id: linkInput.service_id,
      });
      setLinkPreview(res.data.preview);
      return res.data.preview;
    } catch (err) {
      setLinkError(
        err.response?.data?.message || "Failed to preview the link.",
      );
      return null;
    } finally {
      setLinkBusy(false);
    }
  };

  const applyLinkRequest = async (linkInput = linkForm, force = linkForce) => {
    try {
      setLinkBusy(true);
      setLinkError("");
      const res = await api.post("/api/admin/whmcs/link", {
        organization_id: linkInput.organization_id,
        whmcs_client_id: linkInput.whmcs_client_id,
        service_id: linkInput.service_id,
        force,
      });
      setLinkDone(res.data.after);
      setLinkPreview(res.data.preview);
      if (whmcsClients) loadWhmcsClients();
      return res.data.after;
    } catch (err) {
      if (err.response?.data?.preview)
        setLinkPreview(err.response.data.preview);
      setLinkError(
        err.response?.data?.message || "Failed to link the WHMCS client.",
      );
      return null;
    } finally {
      setLinkBusy(false);
    }
  };

  // After "Create Client Tenant" for an imported client: preview, and link
  // automatically only when nothing blocks it; otherwise leave the preview
  // open for the operator to decide.
  const linkImportedOrganization = async (organizationId) => {
    const linkInput = {
      organization_id: String(organizationId),
      whmcs_client_id: pendingLink.whmcs_client_id,
      service_id: pendingLink.service_id,
      client_name: pendingLink.client_name,
    };
    setLinkForm(linkInput);
    setLinkForce(false);
    const preview = await runLinkPreview(linkInput);
    if (!preview) return;
    if (preview.blocked) {
      setLinkError(
        "The new tenant was created, but billing was not linked automatically — review the issues below.",
      );
      return;
    }
    const after = await applyLinkRequest(linkInput, false);
    if (after) {
      setNotice(
        `Client onboarded and linked to WHMCS client #${after.whmcs_client_id}: ${PLAN_LABELS[after.plan_key] || after.plan_key}, ${after.status}.`,
      );
      setPendingLink(null);
    }
  };

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

      if (pendingLink && data.organization?.id) {
        await linkImportedOrganization(data.organization.id);
      }

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

      {/* ── Import from WHMCS ── */}
      <div className="ob-panel ob-panel--wide" style={{ marginBottom: 24 }}>
        <div className="ob-panel-header">
          <div className="ob-step-badge">W</div>
          <div>
            <h3 className="ob-panel-title">Import from WHMCS</h3>
            <p className="ob-panel-sub">
              Clients who already bought StreamControl in WHMCS. Import creates
              the tenant with this wizard and links billing; Link connects an
              existing organization. Nothing is changed in WHMCS.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            className="ob-btn-ghost"
            onClick={loadWhmcsClients}
            disabled={whmcsLoading}
          >
            {whmcsLoading
              ? "Loading WHMCS clients…"
              : whmcsClients
                ? "Refresh WHMCS clients"
                : "Load WHMCS clients"}
          </button>
          {pendingLink && (
            <span className="ob-label-hint" style={{ alignSelf: "center" }}>
              Pending import: WHMCS client #{pendingLink.whmcs_client_id} (
              {pendingLink.client_name}) — billing links after Create Client
              Tenant.{" "}
              <button
                type="button"
                className="ob-btn-ghost"
                onClick={() => setPendingLink(null)}
              >
                Cancel import
              </button>
            </span>
          )}
        </div>

        {whmcsError && (
          <div className="ob-banner ob-banner--error">{whmcsError}</div>
        )}

        {whmcsClients && whmcsClients.length === 0 && (
          <p className="ob-panel-sub">
            No WHMCS clients hold a StreamControl product.
          </p>
        )}

        {whmcsClients && whmcsClients.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", opacity: 0.75 }}>
                  <th style={{ padding: "8px 6px" }}>WHMCS #</th>
                  <th style={{ padding: "8px 6px" }}>Client</th>
                  <th style={{ padding: "8px 6px" }}>Email</th>
                  <th style={{ padding: "8px 6px" }}>Plan</th>
                  <th style={{ padding: "8px 6px" }}>Service</th>
                  <th style={{ padding: "8px 6px" }}>Next due</th>
                  <th style={{ padding: "8px 6px" }}>In app</th>
                  <th style={{ padding: "8px 6px" }} />
                </tr>
              </thead>
              <tbody>
                {whmcsClients.map((row) => {
                  const active =
                    String(row.service_status).toLowerCase() === "active";
                  const state = row.link?.state;
                  return (
                    <tr
                      key={`${row.whmcs_client_id}-${row.service_id}`}
                      style={{
                        borderTop: "1px solid rgba(148,163,184,0.18)",
                        opacity: active ? 1 : 0.55,
                      }}
                    >
                      <td style={{ padding: "8px 6px" }}>
                        {row.whmcs_client_id}
                      </td>
                      <td style={{ padding: "8px 6px" }}>{row.client_name}</td>
                      <td style={{ padding: "8px 6px" }}>{row.email || "—"}</td>
                      <td style={{ padding: "8px 6px" }}>
                        {PLAN_LABELS[row.plan_key] || row.plan_key}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {row.service_status || "—"}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {row.next_due || "—"}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        {LINK_STATE_LABELS[state] || state}
                        {row.link?.organization_name
                          ? ` — ${row.link.organization_name}`
                          : ""}
                      </td>
                      <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                        {state === "not_in_app" && active && (
                          <button
                            type="button"
                            className="ob-btn-primary"
                            onClick={() => startImport(row)}
                          >
                            Import
                          </button>
                        )}{" "}
                        {state !== "linked" && (
                          <button
                            type="button"
                            className="ob-btn-ghost"
                            onClick={() => openLinkPanel(row)}
                          >
                            Link existing org
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {linkForm && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <h4 className="ob-panel-title" style={{ fontSize: 15 }}>
              Link WHMCS client #{linkForm.whmcs_client_id} (
              {linkForm.client_name})
            </h4>
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                margin: "10px 0",
              }}
            >
              <OBSelect
                value={linkForm.organization_id}
                onChange={(e) => {
                  setLinkForm((prev) => ({
                    ...prev,
                    organization_id: e.target.value,
                  }));
                  setLinkPreview(null);
                  setLinkDone(null);
                  setLinkForce(false);
                }}
              >
                <option value="">Choose organization…</option>
                {orgOptions.map((org) => (
                  <option key={org.id} value={String(org.id)}>
                    {org.name} (#{org.id})
                  </option>
                ))}
              </OBSelect>
              <button
                type="button"
                className="ob-btn-ghost"
                onClick={() => runLinkPreview()}
                disabled={linkBusy}
              >
                {linkBusy ? "Checking…" : "Preview"}
              </button>
              <button
                type="button"
                className="ob-btn-ghost"
                onClick={() => {
                  setLinkForm(null);
                  setLinkPreview(null);
                  setLinkError("");
                  setLinkDone(null);
                }}
              >
                Close
              </button>
            </div>

            {linkError && (
              <div className="ob-banner ob-banner--error">{linkError}</div>
            )}

            {linkPreview && (
              <div className="ob-panel-sub" style={{ lineHeight: 1.7 }}>
                <div>
                  <strong>{linkPreview.organization.name}</strong> (#
                  {linkPreview.organization.id}) → WHMCS client #
                  {linkPreview.client.id} {linkPreview.client.name}
                </div>
                <div>
                  Will set: plan{" "}
                  <strong>
                    {PLAN_LABELS[linkPreview.planned.plan_key] ||
                      linkPreview.planned.plan_key}
                  </strong>
                  , status <strong>{linkPreview.planned.status}</strong>, next
                  billing{" "}
                  <strong>
                    {linkPreview.planned.current_period_end || "unchanged"}
                  </strong>
                </div>
                {linkPreview.warnings.map((w) => (
                  <div key={w} style={{ color: "#fbbf24" }}>
                    Warning: {w}
                  </div>
                ))}
                {linkPreview.problems.map((p) => (
                  <div key={p} style={{ color: "#f87171" }}>
                    Blocked: {p}
                  </div>
                ))}
                {!linkDone && (
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {linkPreview.blocked && (
                      <label
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={linkForce}
                          onChange={(e) => setLinkForce(e.target.checked)}
                        />
                        I understand the blocked items above and want to link
                        anyway
                      </label>
                    )}
                    <button
                      type="button"
                      className="ob-btn-primary"
                      disabled={linkBusy || (linkPreview.blocked && !linkForce)}
                      onClick={() => applyLinkRequest()}
                    >
                      {linkBusy ? "Linking…" : "Link billing"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {linkDone && (
              <div
                className="ob-banner ob-banner--success"
                style={{ marginTop: 10 }}
              >
                Linked: organization #{linkDone.organization_id} → WHMCS client
                #{linkDone.whmcs_client_id} —{" "}
                {PLAN_LABELS[linkDone.plan_key] || linkDone.plan_key},{" "}
                {linkDone.status}. The client can confirm on Subscription →
                Refresh Billing.
              </div>
            )}
          </div>
        )}
      </div>

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
                <option value="starter">Essential</option>
                <option value="pro">Deluxe</option>
                <option value="enterprise">Premium</option>
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
