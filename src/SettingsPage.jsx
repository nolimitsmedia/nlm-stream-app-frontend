// src/SettingsPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import api from "./api";

/* ── Helpers ── */
function getStoredAdmin() {
  try {
    return JSON.parse(localStorage.getItem("nlm_admin") || "{}");
  } catch {
    return {};
  }
}

function getStoredOrganization() {
  try {
    return JSON.parse(localStorage.getItem("nlm_current_organization") || "{}");
  } catch {
    return {};
  }
}

/* ── Reusable Field ── */
function Field({ label, hint, children }) {
  return (
    <div className="stg-field">
      <label className="stg-label">
        {label}
        {hint && <span className="stg-label-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ icon, ...props }) {
  return (
    <div className="stg-input-wrap">
      {icon && <span className="stg-input-icon">{icon}</span>}
      <input
        className={`stg-input${icon ? " stg-input--icon" : ""}`}
        {...props}
      />
    </div>
  );
}

function Banner({ type, message }) {
  if (!message) return null;
  return (
    <div className={`stg-banner stg-banner--${type}`}>
      {type === "success" ? (
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
      ) : (
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
      )}
      {message}
    </div>
  );
}

function SaveBtn({ saving, label = "Save Changes", savedLabel = "Saved!" }) {
  return (
    <button type="submit" className="stg-save-btn" disabled={saving}>
      {saving ? (
        <>
          <span className="stg-spinner" />
          Saving…
        </>
      ) : (
        <>
          {label}
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
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        </>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════
   TAB 1 — Watch Page Branding
══════════════════════════════════════════ */
function WatchPageTab({ organization }) {
  const orgId = organization?.id;
  const [form, setForm] = useState({
    watch_page_title: "",
    logo_url: "",
    primary_color: "#0d6efd",
    secondary_color: "#fd9d00",
    donation_url: "",
    custom_css: "",
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await api.get(`/api/organizations/${orgId}/settings`);
        const s = res.data.settings || {};
        setForm({
          watch_page_title: s.watch_page_title || organization?.name || "",
          logo_url: s.logo_url || "",
          primary_color: s.primary_color || "#0d6efd",
          secondary_color: s.secondary_color || "#fd9d00",
          donation_url: s.donation_url || "",
          custom_css: s.custom_css || "",
        });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [orgId]);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orgId) {
      setError("No organization selected.");
      return;
    }
    try {
      setSaving(true);
      setNotice("");
      setError("");
      await api.put(`/api/organizations/${orgId}/settings`, form);
      setNotice("Watch page settings saved successfully.");
      // Update stored org primary color so sidebar icon updates
      const stored = getStoredOrganization();
      if (stored.id) {
        const updated = { ...stored, primary_color: form.primary_color };
        localStorage.setItem(
          "nlm_current_organization",
          JSON.stringify(updated),
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="stg-loading">
        <div className="stg-spinner-lg" />
        <span>Loading settings…</span>
      </div>
    );

  return (
    <form className="stg-form" onSubmit={handleSubmit}>
      <Banner type="success" message={notice} />
      <Banner type="error" message={error} />

      <div className="stg-section">
        <h3 className="stg-section-title">Watch Page Identity</h3>
        <p className="stg-section-sub">
          Customizes the public-facing watch page header and branding.
        </p>
        <div className="stg-grid stg-grid-2">
          <Field label="Watch Page Title">
            <Input
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
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              }
              name="watch_page_title"
              value={form.watch_page_title}
              onChange={handleChange}
              placeholder="NLM Live"
            />
          </Field>
          <Field label="Logo URL" hint="(PNG or SVG, leave blank for initials)">
            <Input
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
              onChange={handleChange}
              placeholder="https://example.com/logo.png"
            />
          </Field>
          <Field label="Donation URL">
            <Input
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
              onChange={handleChange}
              placeholder="https://yourchurch.com/give"
              type="url"
            />
          </Field>
        </div>
      </div>

      <div className="stg-section">
        <h3 className="stg-section-title">Brand Colors</h3>
        <p className="stg-section-sub">
          Sets the accent color for buttons, highlights, and watch page UI.
        </p>
        <div className="stg-grid stg-grid-2">
          <Field label="Primary Color">
            <div className="stg-color-row">
              <div
                className="stg-color-swatch"
                style={{ background: form.primary_color }}
              />
              <input
                className="stg-input stg-color-text"
                name="primary_color"
                value={form.primary_color}
                onChange={handleChange}
                placeholder="#0d6efd"
              />
              <input
                type="color"
                className="stg-color-picker"
                value={form.primary_color}
                onChange={(e) =>
                  setForm((p) => ({ ...p, primary_color: e.target.value }))
                }
              />
            </div>
          </Field>
          <Field label="Secondary Color">
            <div className="stg-color-row">
              <div
                className="stg-color-swatch"
                style={{ background: form.secondary_color }}
              />
              <input
                className="stg-input stg-color-text"
                name="secondary_color"
                value={form.secondary_color}
                onChange={handleChange}
                placeholder="#fd9d00"
              />
              <input
                type="color"
                className="stg-color-picker"
                value={form.secondary_color}
                onChange={(e) =>
                  setForm((p) => ({ ...p, secondary_color: e.target.value }))
                }
              />
            </div>
          </Field>
        </div>

        {/* Live color preview */}
        <div
          className="stg-color-preview"
          style={{
            "--preview-primary": form.primary_color,
            "--preview-secondary": form.secondary_color,
          }}
        >
          <span className="stg-preview-label">Preview</span>
          <div className="stg-preview-bar">
            <div className="stg-preview-brand">
              {(form.watch_page_title || organization?.name || "Live")
                .slice(0, 1)
                .toUpperCase()}
            </div>
            <strong style={{ color: "var(--preview-primary)" }}>
              {form.watch_page_title || organization?.name || "Watch Page"}
            </strong>
            <a
              className="stg-preview-btn"
              style={{ background: "var(--preview-secondary)" }}
            >
              Give Now
            </a>
          </div>
        </div>
      </div>

      <div className="stg-section">
        <h3 className="stg-section-title">Custom CSS</h3>
        <p className="stg-section-sub">
          Inject custom styles into the public watch page. Advanced use only.
        </p>
        <Field
          label="Custom CSS"
          hint="(injected into watch page &lt;head&gt;)"
        >
          <textarea
            className="stg-textarea stg-code-area"
            name="custom_css"
            value={form.custom_css}
            onChange={handleChange}
            placeholder=".watch-page { background: #000; }"
            rows={8}
          />
        </Field>
      </div>

      <div className="stg-form-footer">
        <SaveBtn saving={saving} label="Save Branding" />
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════
   TAB — Team (self-service member management)
══════════════════════════════════════════ */
function TeamTab({ organization }) {
  const orgId = organization?.id;
  const currentAdmin = useMemo(() => getStoredAdmin(), []);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "operator",
  });
  const [inviting, setInviting] = useState(false);

  const loadMembers = async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/api/organizations/${orgId}/users`);
      setMembers(res.data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load team.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const myMembership = members.find(
    (m) => String(m.admin_id) === String(currentAdmin.id),
  );
  const canManageTeam =
    currentAdmin.role === "super_admin" ||
    ["owner", "admin"].includes(myMembership?.role);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) {
      setError("Email is required.");
      return;
    }
    try {
      setInviting(true);
      setNotice("");
      setError("");
      const res = await api.post(`/api/organizations/${orgId}/users`, {
        name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
      });
      if (res.data.temp_password) {
        setNotice(
          `Added ${inviteForm.email} — this is a brand new account, so share this temporary password with them: ${res.data.temp_password}`,
        );
      } else {
        setNotice(`Added ${inviteForm.email} to the team.`);
      }
      setInviteForm({ name: "", email: "", role: "operator" });
      await loadMembers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add team member.");
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (member) => {
    if (
      !window.confirm(
        `Remove ${member.name || member.email} from ${organization?.name}?`,
      )
    )
      return;
    try {
      setNotice("");
      setError("");
      await api.delete(`/api/organizations/${orgId}/users/${member.admin_id}`);
      setNotice("Team member removed.");
      await loadMembers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove member.");
    }
  };

  if (loading)
    return (
      <div className="stg-loading">
        <div className="stg-spinner-lg" />
        <span>Loading team…</span>
      </div>
    );

  return (
    <div className="stg-form">
      <Banner type="success" message={notice} />
      <Banner type="error" message={error} />

      {canManageTeam && (
        <form className="stg-section" onSubmit={handleInvite}>
          <h3 className="stg-section-title">Add Team Member</h3>
          <p className="stg-section-sub">
            If they don't have an account yet, one will be created and you'll
            get a temporary password to share with them.
          </p>
          <div className="stg-grid stg-grid-2">
            <Field label="Name">
              <Input
                value={inviteForm.name}
                onChange={(e) =>
                  setInviteForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Jane Smith"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="jane@example.com"
              />
            </Field>
            <Field label="Role">
              <select
                className="stg-input"
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm((p) => ({ ...p, role: e.target.value }))
                }
              >
                <option value="admin">Admin</option>
                <option value="operator">Operator</option>
              </select>
            </Field>
          </div>
          <div className="stg-form-footer">
            <SaveBtn saving={inviting} label="Add to Team" />
          </div>
        </form>
      )}

      <div className="stg-section">
        <h3 className="stg-section-title">Team Members ({members.length})</h3>
        <div className="stg-info-grid">
          {members.map((m) => (
            <div key={m.admin_id} className="stg-info-row">
              <div className="stg-info-body">
                <span className="stg-info-label">
                  {m.role}
                  {String(m.admin_id) === String(currentAdmin.id) && " · you"}
                </span>
                <strong className="stg-info-value">{m.name || m.email}</strong>
              </div>
              {canManageTeam &&
                String(m.admin_id) !== String(currentAdmin.id) && (
                  <button
                    type="button"
                    className="danger-btn small"
                    onClick={() => removeMember(m)}
                  >
                    Remove
                  </button>
                )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 2 — My Profile
══════════════════════════════════════════ */
function ProfileTab() {
  const storedAdmin = useMemo(() => getStoredAdmin(), []);
  const [profile, setProfile] = useState({
    name: storedAdmin.name || "",
    email: storedAdmin.email || "",
  });
  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [pwNotice, setPwNotice] = useState("");
  const [pwError, setPwError] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!profile.name.trim() || !profile.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    try {
      setSaving(true);
      setNotice("");
      setError("");
      // Use /me/profile — works for all roles (operator, admin, super_admin)
      const res = await api.put("/api/admins/me/profile", {
        name: profile.name,
        email: profile.email,
      });
      const updated = res.data.admin || {};
      localStorage.setItem(
        "nlm_admin",
        JSON.stringify({ ...storedAdmin, ...updated }),
      );
      setNotice("Profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwords.newPass) {
      setPwError("New password is required.");
      return;
    }
    if (passwords.newPass.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (passwords.newPass !== passwords.confirm) {
      setPwError("Passwords do not match.");
      return;
    }
    try {
      setSavingPw(true);
      setPwNotice("");
      setPwError("");
      // Use /me/profile — works for all roles, never changes role
      await api.put("/api/admins/me/profile", {
        name: profile.name || storedAdmin.name,
        email: profile.email || storedAdmin.email,
        password: passwords.newPass,
      });
      setPwNotice("Password changed successfully.");
      setPasswords({ current: "", newPass: "", confirm: "" });
    } catch (err) {
      setPwError(err.response?.data?.message || "Failed to change password.");
    } finally {
      setSavingPw(false);
    }
  };

  const EyeBtn = ({ show, toggle }) => (
    <button
      type="button"
      className="stg-eye-btn"
      onClick={toggle}
      tabIndex={-1}
    >
      {show ? (
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
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
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
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="stg-form-stack">
      {/* Profile */}
      <form className="stg-form" onSubmit={handleProfileSubmit}>
        <div className="stg-section">
          <div className="stg-section-head-row">
            <div>
              <h3 className="stg-section-title">Account Profile</h3>
              <p className="stg-section-sub">
                Update your display name and login email.
              </p>
            </div>
            <div className="stg-profile-badge">
              <div className="stg-profile-avatar">
                {(storedAdmin.name || "A")[0].toUpperCase()}
              </div>
              <div>
                <strong>{storedAdmin.name || "Admin"}</strong>
                <span>{storedAdmin.role}</span>
              </div>
            </div>
          </div>
          <Banner type="success" message={notice} />
          <Banner type="error" message={error} />
          <div className="stg-grid stg-grid-2">
            <Field label="Display Name">
              <Input
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
                name="name"
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Your Name"
                required
              />
            </Field>
            <Field label="Email Address">
              <Input
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
                name="email"
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="you@example.com"
                required
              />
            </Field>
          </div>
          <div className="stg-form-footer">
            <SaveBtn saving={saving} label="Update Profile" />
          </div>
        </div>
      </form>

      {/* Change password */}
      <form className="stg-form" onSubmit={handlePasswordSubmit}>
        <div className="stg-section">
          <h3 className="stg-section-title">Change Password</h3>
          <p className="stg-section-sub">
            Leave blank to keep your existing password. Minimum 6 characters.
          </p>
          <Banner type="success" message={pwNotice} />
          <Banner type="error" message={pwError} />
          <div className="stg-grid stg-grid-2">
            <Field label="New Password">
              <div className="stg-input-wrap">
                <svg
                  className="stg-input-icon"
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
                <input
                  className="stg-input stg-input--icon stg-input--pw"
                  type={showNew ? "text" : "password"}
                  value={passwords.newPass}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, newPass: e.target.value }))
                  }
                  placeholder="New password"
                  minLength={6}
                />
                <EyeBtn show={showNew} toggle={() => setShowNew((v) => !v)} />
              </div>
            </Field>
            <Field label="Confirm New Password">
              <div className="stg-input-wrap">
                <svg
                  className="stg-input-icon"
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
                <input
                  className={`stg-input stg-input--icon stg-input--pw${passwords.confirm && passwords.confirm !== passwords.newPass ? " stg-input--error" : ""}`}
                  type={showNew ? "text" : "password"}
                  value={passwords.confirm}
                  onChange={(e) =>
                    setPasswords((p) => ({ ...p, confirm: e.target.value }))
                  }
                  placeholder="Confirm password"
                />
                <EyeBtn show={showNew} toggle={() => setShowNew((v) => !v)} />
              </div>
            </Field>
          </div>
          <div className="stg-form-footer">
            <SaveBtn saving={savingPw} label="Change Password" />
          </div>
        </div>
      </form>
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 3 — Platform Info (read-only)
══════════════════════════════════════════ */
function PlatformTab() {
  const [health, setHealth] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [checkingIntegrations, setCheckingIntegrations] = useState(false);

  const checkHealth = async () => {
    try {
      setChecking(true);
      const res = await api.get("/api/health");
      setHealth(res.data);
      setCheckedAt(new Date().toLocaleTimeString());
    } catch {
      setHealth({ ok: false });
    } finally {
      setChecking(false);
    }
  };

  const checkIntegrations = async () => {
    try {
      setCheckingIntegrations(true);
      const res = await api.get("/api/admin/integration-health");
      setIntegrations(res.data.integrations || null);
    } catch {
      setIntegrations(null);
    } finally {
      setCheckingIntegrations(false);
    }
  };

  useEffect(() => {
    checkHealth();
    checkIntegrations();
  }, []);

  const InfoRow = ({ icon, label, value, mono = false, status }) => (
    <div className="stg-info-row">
      <div className="stg-info-icon">{icon}</div>
      <div className="stg-info-body">
        <span className="stg-info-label">{label}</span>
        <strong
          className={`stg-info-value${mono ? " stg-info-mono" : ""}${status ? " stg-info-value--" + status : ""}`}
        >
          {value}
        </strong>
      </div>
    </div>
  );

  return (
    <div className="stg-form">
      <div className="stg-section">
        <div className="stg-section-head-row">
          <div>
            <h3 className="stg-section-title">Platform Health</h3>
            <p className="stg-section-sub">
              Live status of the streaming backend API.
            </p>
          </div>
          <button
            type="button"
            className="stg-ghost-btn"
            onClick={checkHealth}
            disabled={checking}
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
              className={checking ? "stg-spin" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {checking ? "Checking…" : "Recheck"}
          </button>
        </div>

        <div className="stg-info-grid">
          <InfoRow
            label="API Status"
            value={
              health === null ? "Checking…" : health?.ok ? "Online" : "Offline"
            }
            status={health?.ok ? "good" : health === null ? "" : "error"}
            icon={
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
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            }
          />
          <InfoRow
            label="Service"
            value={health?.service || "nlm-streaming-manager"}
            mono
            icon={
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
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            }
          />
          {checkedAt && (
            <InfoRow
              label="Last Checked"
              value={checkedAt}
              icon={
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
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
          )}
        </div>
      </div>

      <div className="stg-section">
        <div className="stg-section-head-row">
          <div>
            <h3 className="stg-section-title">Integration Health</h3>
            <p className="stg-section-sub">
              Live connectivity checks — not just configuration display.
            </p>
          </div>
          <button
            type="button"
            className="stg-ghost-btn"
            onClick={checkIntegrations}
            disabled={checkingIntegrations}
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
              className={checkingIntegrations ? "stg-spin" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {checkingIntegrations ? "Checking…" : "Recheck"}
          </button>
        </div>

        {!integrations ? (
          <p className="stg-section-sub">Unable to load integration status.</p>
        ) : (
          <div className="stg-info-grid">
            {[
              { key: "srs", label: "SRS Streaming Server" },
              { key: "bunny", label: "Bunny Storage" },
              { key: "stripe", label: "Stripe" },
              { key: "database", label: "PostgreSQL" },
            ].map(({ key, label }) => {
              const info = integrations[key];
              return (
                <InfoRow
                  key={key}
                  label={label}
                  status={info?.ok ? "good" : "error"}
                  value={
                    info?.ok
                      ? `${info.status}${info.latency_ms != null ? ` (${info.latency_ms}ms)` : ""}`
                      : info?.status || "Unknown"
                  }
                  icon={
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
                      {info?.ok ? (
                        <polyline points="8 12 11 15 16 9" />
                      ) : (
                        <>
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </>
                      )}
                    </svg>
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="stg-section">
        <h3 className="stg-section-title">Stream Infrastructure</h3>
        <p className="stg-section-sub">
          These are set via environment variables on the server. Contact your
          system administrator to change them.
        </p>

        <div className="stg-info-grid">
          <InfoRow
            label="SRS Ingest API"
            value={
              import.meta.env.VITE_API_BASE
                ? `${import.meta.env.VITE_API_BASE} → :1985`
                : "localhost:1985"
            }
            mono
            icon={
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
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            }
          />
          <InfoRow
            label="HLS Playback"
            value=":8080/live/{stream_key}.m3u8"
            mono
            icon={
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
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
            }
          />
          <InfoRow
            label="RTMP Ingest"
            value="rtmp://server/live/{stream_key}"
            mono
            icon={
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
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
            }
          />
          <InfoRow
            label="SRT Ingest"
            value="srt://server:10080?streamid=live/{stream_key}"
            mono
            icon={
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
                <path d="M1 6s4-2 11-2 11 2 11 2" />
                <path d="M1 12s4-2 11-2 11 2 11 2" />
                <path d="M1 18s4-2 11-2 11 2 11 2" />
              </svg>
            }
          />
          <InfoRow
            label="API Base URL"
            value={import.meta.env.VITE_API_BASE || "http://localhost:5000"}
            mono
            icon={
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
            }
          />
        </div>
      </div>

      <div className="stg-section">
        <h3 className="stg-section-title">Stripe Integration</h3>
        <p className="stg-section-sub">
          Payment processing status. Keys are stored server-side and never
          exposed to the client.
        </p>
        <div className="stg-info-grid">
          <InfoRow
            label="Payment Provider"
            value="Stripe"
            icon={
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
                <rect x="1" y="4" width="22" height="16" rx="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            }
          />
          <InfoRow
            label="Secret Key"
            value="Stored server-side (env)"
            icon={
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            }
          />
          <InfoRow
            label="Webhook"
            value="/api/stripe/webhook"
            mono
            icon={
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
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB — Feature Flags (super_admin only)
══════════════════════════════════════════ */
function FeatureFlagsTab() {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadFlags = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admin/feature-flags");
      setFlags(res.data.flags || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load feature flags.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const toggleFlag = async (flag) => {
    try {
      setSavingKey(flag.key);
      setNotice("");
      setError("");
      await api.put(`/api/admin/feature-flags/${flag.key}`, {
        enabled: !flag.enabled,
      });
      setFlags((prev) =>
        prev.map((f) =>
          f.key === flag.key ? { ...f, enabled: !f.enabled } : f,
        ),
      );
      setNotice(
        `${flag.key} is now ${!flag.enabled ? "enabled" : "disabled"}. Users may need to refresh to see the change.`,
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update flag.");
    } finally {
      setSavingKey("");
    }
  };

  if (loading)
    return (
      <div className="stg-loading">
        <div className="stg-spinner-lg" />
        <span>Loading feature flags…</span>
      </div>
    );

  return (
    <div className="stg-form">
      <Banner type="success" message={notice} />
      <Banner type="error" message={error} />

      <div className="stg-section">
        <h3 className="stg-section-title">Feature Flags</h3>
        <p className="stg-section-sub">
          Toggle features across the whole platform without a code deploy.
          Changes take effect the next time a user's app loads (a page refresh,
          or their next login).
        </p>

        <div className="stg-flags-list">
          {flags.map((flag) => (
            <div key={flag.key} className="stg-flag-row">
              <div className="stg-flag-body">
                <strong>{flag.key}</strong>
                <p>{flag.description}</p>
              </div>
              <button
                type="button"
                className={`stg-flag-toggle${flag.enabled ? " stg-flag-toggle--on" : ""}`}
                onClick={() => toggleFlag(flag)}
                disabled={savingKey === flag.key}
                aria-label={`Toggle ${flag.key}`}
              >
                <span className="stg-flag-toggle-dot" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB — Notifications (self-scoped, all roles)
══════════════════════════════════════════ */
function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    stream_live: true,
    chat_needs_moderation: false,
    recording_processed: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadPrefs = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/admins/me/notification-preferences");
      setPrefs(res.data.preferences);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load preferences.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrefs();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setNotice("");
      setError("");
      await api.put("/api/admins/me/notification-preferences", prefs);
      setNotice("Notification preferences saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  if (loading)
    return (
      <div className="stg-loading">
        <div className="stg-spinner-lg" />
        <span>Loading preferences…</span>
      </div>
    );

  const OPTIONS = [
    {
      key: "stream_live",
      label: "A stream goes live",
      hint: "Notify me when one of my channels starts streaming.",
    },
    {
      key: "chat_needs_moderation",
      label: "Chat needs moderation",
      hint: "Notify me when a message is flagged or reported.",
    },
    {
      key: "recording_processed",
      label: "Recording finished processing",
      hint: "Notify me when a stream's recording is ready to view.",
    },
  ];

  return (
    <form className="stg-form" onSubmit={handleSubmit}>
      <Banner type="success" message={notice} />
      <Banner type="error" message={error} />

      <div className="stg-section">
        <h3 className="stg-section-title">Notification Preferences</h3>
        <p className="stg-section-sub">
          Email delivery isn't connected yet — these preferences are saved now
          so they're ready the moment email sending is set up. Nothing will be
          emailed to you until then.
        </p>

        <div className="stg-flags-list">
          {OPTIONS.map((opt) => (
            <div key={opt.key} className="stg-flag-row">
              <div className="stg-flag-body">
                <strong>{opt.label}</strong>
                <p>{opt.hint}</p>
              </div>
              <button
                type="button"
                className={`stg-flag-toggle${prefs[opt.key] ? " stg-flag-toggle--on" : ""}`}
                onClick={() => toggle(opt.key)}
                aria-label={`Toggle ${opt.label}`}
              >
                <span className="stg-flag-toggle-dot" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="stg-form-footer">
        <SaveBtn saving={saving} />
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════
   TAB 4 — About / Version
══════════════════════════════════════════ */
function AboutTab() {
  const FEATURES = [
    "White-label multi-tenant architecture",
    "RTMP + SRT ingest via SRS 6.0",
    "HLS playback with auto-segmenting",
    "Live chat, prayer requests, and reactions",
    "Replay library with progress tracking",
    "OBS browser-source overlays via WebSocket",
    "Stripe billing integration",
    "Analytics and viewer session tracking",
    "Member-gated replay access",
    "Real-time analytics via Socket.IO",
  ];

  return (
    <div className="stg-form">
      <div className="stg-section stg-about-hero">
        <div className="stg-about-brand">
          <div className="stg-about-icon">
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
              <circle cx="12" cy="12" r="10" />
              <polygon
                points="10 8 16 12 10 16 10 8"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </div>
          <div>
            <h2 className="stg-about-title">NLM Streaming Manager</h2>
            <span className="stg-about-version">
              v1.0 · NLM Streaming Cloud
            </span>
          </div>
        </div>
        <p className="stg-about-desc">
          A white-label SaaS livestreaming platform built by{" "}
          <strong>No Limits Media</strong> for churches, ministries, and media
          teams. Delivers RTMP + SRT ingest, HLS playback, member replay
          libraries, live engagement tools, and a full admin control plane.
        </p>
      </div>

      <div className="stg-section">
        <h3 className="stg-section-title">Platform Capabilities</h3>
        <div className="stg-feature-grid">
          {FEATURES.map((f) => (
            <div key={f} className="stg-feature-item">
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
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="stg-section">
        <h3 className="stg-section-title">Built By</h3>
        <div className="stg-info-grid">
          <div className="stg-info-row">
            <div className="stg-info-icon">
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
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="stg-info-body">
              <span className="stg-info-label">Organization</span>
              <strong className="stg-info-value">No Limits Media</strong>
            </div>
          </div>
          <div className="stg-info-row">
            <div className="stg-info-icon">
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
            </div>
            <div className="stg-info-body">
              <span className="stg-info-label">Website</span>
              <a
                href="https://nolimitsmedia.com"
                target="_blank"
                rel="noreferrer"
                className="stg-info-link"
              >
                nolimitsmedia.com
              </a>
            </div>
          </div>
          <div className="stg-info-row">
            <div className="stg-info-icon">
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
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div className="stg-info-body">
              <span className="stg-info-label">Stack</span>
              <strong className="stg-info-value">
                React · Node.js · PostgreSQL · SRS · Socket.IO · Stripe
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   ROOT COMPONENT
══════════════════════════════════════════ */
const ALL_TABS = [
  {
    key: "watchpage",
    label: "Watch Page",
    icon: (
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
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    key: "team",
    label: "Team",
    icon: (
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
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "My Profile",
    icon: (
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
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    key: "platform",
    label: "Platform Info",
    icon: (
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
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
    ),
  },
  {
    key: "flags",
    label: "Feature Flags",
    icon: (
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
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: (
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
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    key: "about",
    label: "About",
    icon: (
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
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
];

function SettingsPage() {
  const admin = useMemo(() => getStoredAdmin(), []);
  const organization = useMemo(() => getStoredOrganization(), []);
  const isSuperAdmin = admin.role === "super_admin";
  const inSupportMode = isSuperAdmin && Boolean(organization?.id);

  // Watch Page branding only makes sense when there's an actual
  // organization to brand — a regular client's own org, or a
  // super_admin currently in Support Mode for a specific client.
  // Platform Info exposes internal infrastructure details (ingest
  // URLs, webhook paths) and is for platform staff only, never a
  // client's own account, regardless of Support Mode.
  const TABS = ALL_TABS.filter((tab) => {
    if (tab.key === "watchpage") return !isSuperAdmin || inSupportMode;
    if (tab.key === "team") return !isSuperAdmin || inSupportMode;
    if (tab.key === "platform") return isSuperAdmin;
    if (tab.key === "flags") return isSuperAdmin;
    return true;
  });

  const [activeTab, setActiveTab] = useState(
    isSuperAdmin && !inSupportMode ? "platform" : "watchpage",
  );

  useEffect(() => {
    const handler = (e) => {
      // refresh on org change
      window.location.reload();
    };
    window.addEventListener("nlm-organization-changed", handler);
    return () =>
      window.removeEventListener("nlm-organization-changed", handler);
  }, []);

  return (
    <div className="stg-page">
      {/* Page header */}
      <div className="stg-page-header">
        <div className="stg-page-header-left">
          <div className="stg-page-icon">
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
              <circle cx="12" cy="12" r="3" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
            </svg>
          </div>
          <div>
            <h2 className="stg-page-title">Settings</h2>
            <p className="stg-page-sub">
              Configure watch page branding, account profile, and platform
              details.
            </p>
          </div>
        </div>
        {organization.name && (
          <span className="stg-org-pill">
            <span
              className="stg-org-dot"
              style={{ background: organization.primary_color || "#0d6efd" }}
            />
            {organization.name}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div className="stg-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`stg-tab${activeTab === tab.key ? " stg-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="stg-tab-content">
        {activeTab === "watchpage" && (
          <WatchPageTab organization={organization} />
        )}
        {activeTab === "team" && <TeamTab organization={organization} />}
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "platform" && <PlatformTab />}
        {activeTab === "flags" && <FeatureFlagsTab />}
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "about" && <AboutTab />}
      </div>
    </div>
  );
}

export default SettingsPage;
