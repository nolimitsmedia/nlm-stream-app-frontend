import { useEffect, useMemo, useState } from "react";
import api from "./api";

const defaultOrganizationForm = {
  name: "",
  slug: "",
  logo_url: "",
  primary_color: "#0d6efd",
  custom_domain: "",
  subscription_plan: "starter",
  is_active: true,
};

const defaultSettingsForm = {
  watch_page_title: "",
  logo_url: "",
  primary_color: "#0d6efd",
  secondary_color: "#fd9d00",
  donation_url: "",
  custom_css: "",
};

const PLAN_ACCENTS = {
  starter: "blue",
  pro: "purple",
  enterprise: "orange",
  internal: "green",
};

const VALID_PLANS = new Set(["starter", "pro", "enterprise", "internal"]);

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 255);

const normalizeColor = (value = "") => {
  const color = String(value).trim();

  if (!color) {
    return "#0d6efd";
  }

  return color;
};

const isValidHexColor = (value = "") =>
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    String(value).trim(),
  );

/*
 * IMPORTANT:
 * Keep InputField outside OrganizationsPage.
 *
 * If this component is declared inside OrganizationsPage, React receives a
 * new component type whenever OrganizationsPage renders. Controlled inputs
 * can then be unmounted/remounted after every keystroke, causing focus loss.
 */
function InputField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
}) {
  const inputId = `op-${name}`;

  return (
    <div className="op-field">
      <label className="op-label" htmlFor={inputId}>
        {label}
      </label>

      <input
        id={inputId}
        className="op-input"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

function OrganizationsPage() {
  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("nlm_admin") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isSuperAdmin = currentAdmin.role === "super_admin";

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);

  const [organizationForm, setOrganizationForm] = useState(
    defaultOrganizationForm,
  );

  const [settingsForm, setSettingsForm] = useState(defaultSettingsForm);

  const [members, setMembers] = useState([]);
  const [selectedSubscription, setSelectedSubscription] = useState(null);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("operator");
  const [createdMemberCredentials, setCreatedMemberCredentials] =
    useState(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const [editingOrgId, setEditingOrgId] = useState(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const selectedOrgId = selectedOrg?.id;

  const loadOrganizations = async (preferredOrgId = null) => {
    try {
      setError("");

      const res = await api.get("/api/organizations");
      const loaded = res.data.organizations || [];

      setOrganizations(loaded);

      if (preferredOrgId) {
        const preferred = loaded.find(
          (org) => Number(org.id) === Number(preferredOrgId),
        );

        if (preferred) {
          setSelectedOrg(preferred);
          return loaded;
        }
      }

      if (selectedOrg) {
        const refreshedSelected = loaded.find(
          (org) => Number(org.id) === Number(selectedOrg.id),
        );

        if (refreshedSelected) {
          setSelectedOrg(refreshedSelected);
          return loaded;
        }
      }

      if (loaded.length > 0) {
        setSelectedOrg(loaded[0]);
      } else {
        setSelectedOrg(null);
      }

      return loaded;
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load organizations.");

      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async (orgId) => {
    if (!orgId) {
      setSettingsForm(defaultSettingsForm);
      return;
    }

    try {
      const res = await api.get(`/api/organizations/${orgId}/settings`);

      const s = res.data.settings || {};

      setSettingsForm({
        watch_page_title: s.watch_page_title || selectedOrg?.name || "",
        logo_url: s.logo_url || "",
        primary_color: s.primary_color || "#0d6efd",
        secondary_color: s.secondary_color || "#fd9d00",
        donation_url: s.donation_url || "",
        custom_css: s.custom_css || "",
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const loadSelectedSubscription = async (orgId) => {
    if (!orgId) {
      setSelectedSubscription(null);
      return;
    }

    try {
      const res = await api.get("/api/subscription/current", {
        headers: {
          "x-organization-id": String(orgId),
        },
      });

      setSelectedSubscription(res.data.subscription || null);
    } catch (err) {
      console.error("Failed to load organization subscription:", err);
      setSelectedSubscription(null);
    }
  };

  const loadMembers = async (orgId) => {
    if (!orgId) {
      setMembers([]);
      return;
    }

    try {
      const res = await api.get(`/api/organizations/${orgId}/users`);
      setMembers(res.data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
      setMembers([]);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selectedOrgId) {
      setMembers([]);
      setSelectedSubscription(null);
      return;
    }

    loadSettings(selectedOrgId);
    loadMembers(selectedOrgId);
    loadSelectedSubscription(selectedOrgId);
  }, [selectedOrgId]); // eslint-disable-line

  const resetOrganizationForm = () => {
    setEditingOrgId(null);

    setOrganizationForm({
      ...defaultOrganizationForm,
    });

    setSlugManuallyEdited(false);
  };

  const handleOrgFormChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "name") {
      setOrganizationForm((previous) => ({
        ...previous,
        name: value,
        slug: slugManuallyEdited ? previous.slug : slugify(value),
      }));

      return;
    }

    if (name === "slug") {
      setSlugManuallyEdited(true);

      setOrganizationForm((previous) => ({
        ...previous,
        slug: slugify(value),
      }));

      return;
    }

    setOrganizationForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;

    setSettingsForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const selectOrganization = (org) => {
    setSelectedOrg(org);
    setNotice("");
    setError("");
    setCreatedMemberCredentials(null);
    setCopiedPassword(false);
  };

  const enterSupportMode = (org) => {
    if (!org?.id) {
      return;
    }

    localStorage.setItem("nlm_organization_id", String(org.id));

    localStorage.setItem("nlm_current_organization", JSON.stringify(org));

    window.dispatchEvent(
      new CustomEvent("nlm-organization-changed", {
        detail: {
          organizationId: String(org.id),
          organization: org,
        },
      }),
    );

    setNotice(
      `Now viewing as ${org.name}. Use the Topbar switcher or "Platform view" to exit.`,
    );
  };

  const startEditOrganization = (org) => {
    if (!org?.id) {
      return;
    }

    setEditingOrgId(org.id);

    setOrganizationForm({
      name: org.name || "",
      slug: org.slug || "",
      logo_url: org.logo_url || "",
      primary_color: org.primary_color || "#0d6efd",
      custom_domain: org.custom_domain || "",
      subscription_plan: org.subscription_plan || "starter",
      is_active: org.is_active !== false,
    });

    /*
     * Preserve the existing slug while editing.
     * The administrator can still change it manually.
     */
    setSlugManuallyEdited(true);

    setNotice("");
    setError("");
  };

  const saveOrganization = async (e) => {
    e.preventDefault();

    if (!isSuperAdmin) {
      setError("Only super admins can create or edit organizations.");
      return;
    }

    const organizationName = organizationForm.name.trim();

    if (!organizationName) {
      setError("Organization name is required.");
      return;
    }

    const normalizedSlug = slugify(organizationForm.slug || organizationName);

    if (!normalizedSlug) {
      setError(
        "A valid organization slug could not be generated. Please enter a valid name or slug.",
      );
      return;
    }

    const primaryColor = normalizeColor(organizationForm.primary_color);

    if (!isValidHexColor(primaryColor)) {
      setError("Primary Color must be a valid hex color such as #0d6efd.");
      return;
    }

    const subscriptionPlan = VALID_PLANS.has(organizationForm.subscription_plan)
      ? organizationForm.subscription_plan
      : "starter";

    const payload = {
      name: organizationName,
      slug: normalizedSlug,
      logo_url: organizationForm.logo_url.trim(),
      primary_color: primaryColor,
      custom_domain: organizationForm.custom_domain.trim(),
      subscription_plan: subscriptionPlan,
      is_active: organizationForm.is_active !== false,
    };

    try {
      setSavingOrg(true);
      setNotice("");
      setError("");

      let savedOrganization = null;

      if (editingOrgId) {
        const res = await api.put(
          `/api/organizations/${editingOrgId}`,
          payload,
        );

        savedOrganization = res.data?.organization || {
          ...payload,
          id: editingOrgId,
        };

        resetOrganizationForm();

        await loadOrganizations(savedOrganization.id);

        setNotice("Organization updated successfully.");
      } else {
        const res = await api.post("/api/organizations", payload);

        savedOrganization = res.data?.organization || null;

        resetOrganizationForm();

        if (savedOrganization?.id) {
          await loadOrganizations(savedOrganization.id);
        } else {
          await loadOrganizations();
        }

        setNotice(
          savedOrganization?.name
            ? `${savedOrganization.name} created successfully.`
            : "Organization created successfully.",
        );
      }
    } catch (err) {
      console.error("Save organization error:", err);

      setError(err.response?.data?.message || "Failed to save organization.");
    } finally {
      setSavingOrg(false);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();

    if (!selectedOrgId) {
      return;
    }

    if (
      settingsForm.primary_color &&
      !isValidHexColor(settingsForm.primary_color)
    ) {
      setError("Primary Color must be a valid hex color such as #0d6efd.");
      return;
    }

    if (
      settingsForm.secondary_color &&
      !isValidHexColor(settingsForm.secondary_color)
    ) {
      setError("Secondary Color must be a valid hex color such as #fd9d00.");
      return;
    }

    try {
      setSavingSettings(true);
      setNotice("");
      setError("");

      await api.put(`/api/organizations/${selectedOrgId}/settings`, {
        ...settingsForm,
        watch_page_title: settingsForm.watch_page_title.trim(),
        logo_url: settingsForm.logo_url.trim(),
        primary_color: normalizeColor(settingsForm.primary_color),
        secondary_color: settingsForm.secondary_color.trim() || "#fd9d00",
        donation_url: settingsForm.donation_url.trim(),
      });

      setNotice("Organization settings saved.");

      await loadSettings(selectedOrgId);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const addMember = async (e) => {
    e.preventDefault();

    const email = memberEmail.trim().toLowerCase();

    if (!selectedOrgId || !email) {
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    const usedAdmins = Number(
      selectedSubscription?.used_admins ?? members.length,
    );

    const maxAdmins = Number(selectedSubscription?.max_admins || 0);

    if (maxAdmins > 0 && usedAdmins >= maxAdmins) {
      setError(
        `This organization has reached its ${
          selectedSubscription?.plan_name || "plan"
        } limit of ${maxAdmins} user(s).`,
      );

      return;
    }

    try {
      setAddingMember(true);
      setNotice("");
      setError("");
      setCreatedMemberCredentials(null);
      setCopiedPassword(false);

      const res = await api.post(`/api/organizations/${selectedOrgId}/users`, {
        email,
        role: memberRole,
      });

      const tempPassword = res.data?.temp_password || null;

      if (tempPassword) {
        setCreatedMemberCredentials({
          email,
          password: tempPassword,
          role: memberRole,
        });
        setNotice("Organization user account created successfully.");
      } else {
        setNotice("Existing account added to organization successfully.");
      }

      setMemberEmail("");

      await Promise.all([
        loadMembers(selectedOrgId),
        loadSelectedSubscription(selectedOrgId),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add member.");
    } finally {
      setAddingMember(false);
    }
  };

  const copyTemporaryPassword = async () => {
    const password = createdMemberCredentials?.password;

    if (!password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      setCopiedPassword(true);

      window.setTimeout(() => {
        setCopiedPassword(false);
      }, 2000);
    } catch (err) {
      console.error("Copy temporary password error:", err);
      setError(
        "Could not copy the temporary password. Please copy it manually.",
      );
    }
  };

  const dismissTemporaryCredentials = () => {
    setCreatedMemberCredentials(null);
    setCopiedPassword(false);
  };

  const removeMember = async (member) => {
    if (
      !window.confirm(
        `Remove ${member.name || member.email} from ${selectedOrg?.name}?`,
      )
    ) {
      return;
    }

    try {
      setNotice("");
      setError("");

      await api.delete(
        `/api/organizations/${selectedOrgId}/users/${member.admin_id}`,
      );

      setNotice("Organization member removed.");

      await Promise.all([
        loadMembers(selectedOrgId),
        loadSelectedSubscription(selectedOrgId),
      ]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member.");
    }
  };

  const generateTempPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

    let out = "";

    for (let i = 0; i < 10; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }

    return out;
  };

  const resetMemberPassword = async (member) => {
    if (
      !window.confirm(
        `Reset the password for ${
          member.name || member.email
        }? Their current password will stop working immediately.`,
      )
    ) {
      return;
    }

    const tempPassword = generateTempPassword();

    try {
      setNotice("");
      setError("");

      await api.put(`/api/admins/${member.admin_id}`, {
        name: member.name,
        email: member.email,
        role: member.global_role,
        password: tempPassword,
      });

      setNotice(
        `Password reset for ${
          member.name || member.email
        }. Temporary password: ${tempPassword} — share this with the client and ask them to change it after logging in.`,
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password.");
    }
  };

  return (
    <div className="op-page">
      {/* Page header */}
      <div className="op-page-header">
        <div className="op-page-header-left">
          <div className="op-page-icon">
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
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>

          <div>
            <h2 className="op-page-title">Organizations</h2>

            <p className="op-page-sub">
              Build the multi-tenant foundation. Each client/church gets
              isolated channels, branding, users, and settings.
            </p>
          </div>
        </div>

        <span className="op-tenant-pill">{organizations.length} Tenants</span>
      </div>

      {/* Banners */}
      {notice && (
        <div className="op-banner op-banner--success">
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
        <div className="op-banner op-banner--error">
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

      <div className="op-layout">
        {/* Sidebar: tenant list */}
        <aside className="op-sidebar">
          <div className="op-sidebar-header">
            <h3 className="op-sidebar-title">Tenants</h3>

            <p className="op-sidebar-sub">
              Client accounts and internal brands.
            </p>
          </div>

          {loading ? (
            <p className="op-muted">Loading organizations…</p>
          ) : organizations.length === 0 ? (
            <p className="op-muted">No organizations yet.</p>
          ) : (
            <div className="op-org-list">
              {organizations.map((org) => {
                const accent = PLAN_ACCENTS[org.subscription_plan] || "blue";

                return (
                  <button
                    key={org.id}
                    type="button"
                    className={`op-org-btn${
                      Number(selectedOrg?.id) === Number(org.id)
                        ? " op-org-btn--active"
                        : ""
                    }`}
                    onClick={() => selectOrganization(org)}
                  >
                    <div
                      className="op-org-color"
                      style={{
                        background: org.primary_color || "#0d6efd",
                      }}
                    />

                    <div className="op-org-btn-body">
                      <strong>{org.name}</strong>

                      <span>
                        {org.slug} ·{" "}
                        <span
                          className={`op-plan-chip op-plan-chip--${accent}`}
                        >
                          {org.subscription_plan}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="op-main">
          {/* Create / edit organization */}
          {isSuperAdmin && (
            <div className="op-card">
              <div className="op-card-header">
                <div>
                  <h3 className="op-card-title">
                    {editingOrgId ? "Edit Organization" : "Create Organization"}
                  </h3>

                  <p className="op-card-sub">
                    Create client/church accounts for white-label streaming.
                  </p>
                </div>

                {editingOrgId && (
                  <button
                    className="op-cancel-btn"
                    type="button"
                    onClick={resetOrganizationForm}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form className="op-form" onSubmit={saveOrganization}>
                <div className="op-form-grid">
                  <InputField
                    label="Name"
                    name="name"
                    value={organizationForm.name}
                    onChange={handleOrgFormChange}
                    placeholder="Your Church Name"
                  />

                  <InputField
                    label="Slug"
                    name="slug"
                    value={organizationForm.slug}
                    onChange={handleOrgFormChange}
                    placeholder="your-church-name"
                  />

                  <InputField
                    label="Primary Color"
                    name="primary_color"
                    value={organizationForm.primary_color}
                    onChange={handleOrgFormChange}
                    placeholder="#0d6efd"
                  />

                  <div className="op-field">
                    <label className="op-label" htmlFor="op-subscription-plan">
                      Plan
                    </label>

                    <select
                      id="op-subscription-plan"
                      className="op-input op-select"
                      name="subscription_plan"
                      value={organizationForm.subscription_plan}
                      onChange={handleOrgFormChange}
                    >
                      <option value="starter">Starter</option>

                      <option value="pro">Pro</option>

                      <option value="enterprise">Enterprise</option>

                      <option value="internal">Internal</option>
                    </select>
                  </div>

                  <InputField
                    label="Logo URL"
                    name="logo_url"
                    value={organizationForm.logo_url}
                    onChange={handleOrgFormChange}
                    placeholder="https://..."
                    type="url"
                  />

                  <InputField
                    label="Custom Domain"
                    name="custom_domain"
                    value={organizationForm.custom_domain}
                    onChange={handleOrgFormChange}
                    placeholder="live.clientchurch.org"
                  />
                </div>

                <label className="op-checkbox-row">
                  <div
                    className={`op-toggle${
                      organizationForm.is_active ? " op-toggle--on" : ""
                    }`}
                    onClick={() =>
                      setOrganizationForm((previous) => ({
                        ...previous,
                        is_active: !previous.is_active,
                      }))
                    }
                    role="switch"
                    aria-checked={organizationForm.is_active}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();

                        setOrganizationForm((previous) => ({
                          ...previous,
                          is_active: !previous.is_active,
                        }));
                      }
                    }}
                  >
                    <div className="op-toggle-thumb" />
                  </div>

                  <span>Active organization</span>
                </label>

                <div className="op-form-actions">
                  <button
                    className="op-btn-primary"
                    type="submit"
                    disabled={savingOrg}
                  >
                    {savingOrg ? (
                      <>
                        <span className="op-spinner" />
                        Saving…
                      </>
                    ) : editingOrgId ? (
                      "Update Organization"
                    ) : (
                      "Create Organization"
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {selectedOrg ? (
            <>
              {/* Selected organization */}
              <div className="op-card op-selected-card">
                <div className="op-selected-header">
                  <div>
                    <span
                      className={`op-plan-chip op-plan-chip--${
                        PLAN_ACCENTS[selectedOrg.subscription_plan] || "blue"
                      }`}
                    >
                      {selectedOrg.subscription_plan}
                    </span>

                    <h3 className="op-selected-name">{selectedOrg.name}</h3>

                    <p className="op-selected-slug">
                      Slug: <strong>{selectedOrg.slug}</strong>
                    </p>
                  </div>

                  <div className="op-selected-actions">
                    {selectedOrg.custom_domain && (
                      <span className="status-pill">
                        {selectedOrg.custom_domain}
                      </span>
                    )}

                    {isSuperAdmin && (
                      <button
                        className="op-btn-primary"
                        type="button"
                        onClick={() => enterSupportMode(selectedOrg)}
                      >
                        View As
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        className="secondary-btn"
                        type="button"
                        onClick={() => startEditOrganization(selectedOrg)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                <div className="op-metrics">
                  {[
                    {
                      label: "Status",
                      value: selectedOrg.is_active ? "Active" : "Inactive",
                    },
                    {
                      label: "Membership Role",
                      value: selectedOrg.membership_role || "owner",
                    },
                    {
                      label: "Created",
                      value: selectedOrg.created_at
                        ? new Date(selectedOrg.created_at).toLocaleDateString()
                        : "—",
                    },
                  ].map((metric) => (
                    <div key={metric.label} className="op-metric">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* White-label settings */}
              <div className="op-card">
                <div className="op-card-header">
                  <div>
                    <h3 className="op-card-title">White-Label Settings</h3>

                    <p className="op-card-sub">
                      Brand the watch page and future client portal.
                    </p>
                  </div>
                </div>

                <form className="op-form" onSubmit={saveSettings}>
                  <div className="op-form-grid">
                    <InputField
                      label="Watch Page Title"
                      name="watch_page_title"
                      value={settingsForm.watch_page_title}
                      onChange={handleSettingsChange}
                      placeholder="Your Church Live"
                    />

                    <InputField
                      label="Logo URL"
                      name="logo_url"
                      value={settingsForm.logo_url}
                      onChange={handleSettingsChange}
                      placeholder="https://..."
                      type="url"
                    />

                    <InputField
                      label="Primary Color"
                      name="primary_color"
                      value={settingsForm.primary_color}
                      onChange={handleSettingsChange}
                    />

                    <InputField
                      label="Secondary Color"
                      name="secondary_color"
                      value={settingsForm.secondary_color}
                      onChange={handleSettingsChange}
                    />
                  </div>

                  <div className="op-field">
                    <label className="op-label" htmlFor="op-donation-url">
                      Donation URL
                    </label>

                    <input
                      id="op-donation-url"
                      className="op-input"
                      name="donation_url"
                      value={settingsForm.donation_url}
                      onChange={handleSettingsChange}
                      placeholder="https://..."
                      type="url"
                    />
                  </div>

                  <div className="op-field">
                    <label className="op-label" htmlFor="op-custom-css">
                      Custom CSS
                    </label>

                    <textarea
                      id="op-custom-css"
                      className="op-textarea"
                      name="custom_css"
                      value={settingsForm.custom_css}
                      onChange={handleSettingsChange}
                      placeholder=".watch-page { ... }"
                    />
                  </div>

                  <div className="op-form-actions">
                    <button
                      className="op-btn-primary"
                      type="submit"
                      disabled={savingSettings}
                    >
                      {savingSettings ? (
                        <>
                          <span className="op-spinner" />
                          Saving…
                        </>
                      ) : (
                        "Save Settings"
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Organization users */}
              <div className="op-card">
                <div className="op-card-header">
                  <div>
                    <h3 className="op-card-title">Organization Users</h3>

                    <p className="op-card-sub">
                      Attach existing admin accounts to this organization.
                    </p>
                  </div>
                </div>

                {isSuperAdmin && (
                  <>
                    {selectedSubscription && (
                      <div className="op-seat-summary">
                        Team seats:{" "}
                        <strong>
                          {Number(
                            selectedSubscription.used_admins ?? members.length,
                          )}
                          /{selectedSubscription.max_admins}
                        </strong>{" "}
                        on {selectedSubscription.plan_name}
                      </div>
                    )}

                    <form className="op-add-member-form" onSubmit={addMember}>
                      <input
                        className="op-input op-member-email-input"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="admin@example.com"
                        type="email"
                      />

                      <select
                        className="op-input op-select op-member-role-select"
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value)}
                      >
                        <option value="admin">Admin</option>

                        <option value="operator">Operator</option>
                      </select>

                      <button
                        className="op-btn-primary"
                        type="submit"
                        disabled={
                          addingMember ||
                          Number(
                            selectedSubscription?.used_admins ?? members.length,
                          ) >=
                            Number(selectedSubscription?.max_admins || Infinity)
                        }
                      >
                        {addingMember ? (
                          <>
                            <span className="op-spinner" />
                            Adding…
                          </>
                        ) : (
                          "Add User"
                        )}
                      </button>
                    </form>

                    {createdMemberCredentials && (
                      <div
                        style={{
                          marginTop: "16px",
                          padding: "16px",
                          border: "1px solid rgba(19, 106, 254, 0.45)",
                          borderRadius: "12px",
                          background: "rgba(19, 106, 254, 0.08)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: "16px",
                          }}
                        >
                          <div>
                            <strong
                              style={{ display: "block", marginBottom: "6px" }}
                            >
                              New user credentials
                            </strong>
                            <span className="op-muted">
                              This temporary password is shown only for this
                              newly created account. Copy it before dismissing
                              this message.
                            </span>
                          </div>

                          <button
                            className="secondary-btn small"
                            type="button"
                            onClick={dismissTemporaryCredentials}
                          >
                            Dismiss
                          </button>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "minmax(0, 1fr) minmax(0, 1fr)",
                            gap: "12px",
                            marginTop: "14px",
                          }}
                        >
                          <div>
                            <span className="op-label">Email</span>
                            <div
                              className="op-input"
                              style={{ height: "auto" }}
                            >
                              {createdMemberCredentials.email}
                            </div>
                          </div>

                          <div>
                            <span className="op-label">Temporary Password</span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                              }}
                            >
                              <input
                                className="op-input"
                                type="text"
                                value={createdMemberCredentials.password}
                                readOnly
                                autoComplete="off"
                                aria-label="Temporary password"
                              />

                              <button
                                className="secondary-btn"
                                type="button"
                                onClick={copyTemporaryPassword}
                              >
                                {copiedPassword ? "Copied" : "Copy Password"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="table-wrap">
                  {members.length === 0 ? (
                    <p className="op-muted">No members found.</p>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Org Role</th>
                          <th>Global Role</th>

                          {isSuperAdmin && <th>Actions</th>}
                        </tr>
                      </thead>

                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id}>
                            <td>{member.name || "—"}</td>

                            <td className="op-muted">{member.email}</td>

                            <td>
                              <span className="role-badge">{member.role}</span>
                            </td>

                            <td className="op-muted">{member.global_role}</td>

                            {isSuperAdmin && (
                              <td>
                                <div className="op-member-actions">
                                  <button
                                    className="secondary-btn small"
                                    type="button"
                                    onClick={() => resetMemberPassword(member)}
                                  >
                                    Reset Password
                                  </button>

                                  <button
                                    className="danger-btn small"
                                    type="button"
                                    onClick={() => removeMember(member)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="op-card op-select-prompt">
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
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>

              <h3>Select an organization</h3>

              <p>Choose a tenant from the left to manage branding and users.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrganizationsPage;
