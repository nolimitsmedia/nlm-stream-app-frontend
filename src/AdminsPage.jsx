import { useEffect, useMemo, useState } from "react";
import api from "./api";

const defaultForm = { name: "", email: "", password: "", role: "admin" };

const ROLE_META = {
  super_admin: { label: "Super Admin", color: "orange" },
  admin: { label: "Admin", color: "blue" },
  operator: { label: "Operator", color: "green" },
};

function RoleIcon() {
  return (
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AdminsPage() {
  const currentAdmin = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("nlm_admin") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isSuperAdmin = currentAdmin.role === "super_admin";

  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const fetchAdmins = async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    try {
      setError("");
      const res = await api.get("/api/admins");
      setAdmins(res.data.admins || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load admin accounts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []); // eslint-disable-line

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultForm);
    setError("");
    setNotice("");
    setShowPw(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEdit = (admin) => {
    setEditingId(admin.id);
    setForm({
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      role: admin.role || "admin",
    });
    setNotice("");
    setError("");
    setShowPw(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setError("Name and email are required.");
      return;
    }
    if (!editingId && !form.password) {
      setError("Password is required for new admin accounts.");
      return;
    }

    try {
      setSaving(true);
      setNotice("");
      setError("");
      const payload = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;

      if (editingId) {
        await api.put(`/api/admins/${editingId}`, payload);
        setNotice("Admin account updated successfully.");
      } else {
        await api.post("/api/admins", payload);
        setNotice("Admin account created successfully.");
      }
      resetForm();
      await fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save admin account.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin) => {
    if (
      !window.confirm(
        `Delete ${admin.name || admin.email}? This cannot be undone.`,
      )
    )
      return;
    try {
      setNotice("");
      setError("");
      await api.delete(`/api/admins/${admin.id}`);
      setNotice("Admin account deleted successfully.");
      await fetchAdmins();
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to delete admin account.",
      );
    }
  };

  /* ── Access denied ── */
  if (!isSuperAdmin) {
    return (
      <section className="card ap-restricted">
        <div className="ap-restricted-icon">
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
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 className="ap-restricted-heading">Access Restricted</h2>
        <p className="ap-restricted-sub">
          Only super admins can manage admin and operator accounts.
        </p>
      </section>
    );
  }

  const roleCounts = admins.reduce((acc, a) => {
    acc[a.role] = (acc[a.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="ap-page">
      {/* ── Page header ── */}
      <div className="ap-page-header">
        <div className="ap-page-header-left">
          <div className="ap-page-icon">
            <RoleIcon />
          </div>
          <div>
            <h1 className="ap-page-title">Admins &amp; Users</h1>
            <p className="ap-page-sub">
              Manage super admins, admins, and streaming operators.
            </p>
          </div>
        </div>
        <div className="ap-stat-pills">
          <span className="ap-stat-pill ap-pill-orange">
            {roleCounts.super_admin || 0} Super Admin
            {roleCounts.super_admin !== 1 ? "s" : ""}
          </span>
          <span className="ap-stat-pill ap-pill-blue">
            {roleCounts.admin || 0} Admin{roleCounts.admin !== 1 ? "s" : ""}
          </span>
          <span className="ap-stat-pill ap-pill-green">
            {roleCounts.operator || 0} Operator
            {roleCounts.operator !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Notice / Error banners ── */}
      {notice && (
        <div className="ap-banner ap-banner--success">
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {notice}
        </div>
      )}
      {error && (
        <div className="ap-banner ap-banner--error">
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

      {/* ── Create / Edit form ── */}
      <section className="card ap-form-card">
        <div className="ap-form-card-header">
          <div>
            <h2 className="ap-form-title">
              {editingId ? "Edit Admin Account" : "Create Admin Account"}
            </h2>
            <p className="ap-form-sub">
              {editingId
                ? "Update name, email, role, or password."
                : "Add a new super admin, admin, or operator."}
            </p>
          </div>
          {editingId && (
            <span className="ap-editing-badge">
              <span className="ap-editing-dot" />
              Editing #{editingId}
            </span>
          )}
        </div>

        <form className="ap-form" onSubmit={handleSubmit}>
          <div className="ap-form-grid">
            {/* Name */}
            <div className="ap-field">
              <label className="ap-label" htmlFor="ap-name">
                Name
              </label>
              <div className="ap-input-wrap">
                <svg
                  className="ap-input-icon"
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
                <input
                  id="ap-name"
                  className="ap-input"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Operator name"
                />
              </div>
            </div>

            {/* Email */}
            <div className="ap-field">
              <label className="ap-label" htmlFor="ap-email">
                Email
              </label>
              <div className="ap-input-wrap">
                <svg
                  className="ap-input-icon"
                  width="14"
                  height="14"
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
                  id="ap-email"
                  className="ap-input"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="operator@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="ap-field">
              <label className="ap-label" htmlFor="ap-password">
                Password
                {editingId ? (
                  <span className="ap-label-hint"> (optional)</span>
                ) : (
                  ""
                )}
              </label>
              <div className="ap-input-wrap">
                <svg
                  className="ap-input-icon"
                  width="14"
                  height="14"
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
                  id="ap-password"
                  className="ap-input ap-input--pw"
                  name="password"
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  placeholder={
                    editingId
                      ? "Leave blank to keep current"
                      : "Create password"
                  }
                />
                <button
                  type="button"
                  className="ap-pw-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="Toggle password"
                >
                  {showPw ? (
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
              </div>
            </div>

            {/* Role */}
            <div className="ap-field">
              <label className="ap-label" htmlFor="ap-role">
                Role
              </label>
              <div className="ap-input-wrap">
                <svg
                  className="ap-input-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <select
                  id="ap-role"
                  className="ap-input ap-select"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                >
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
            </div>
          </div>
          {/* /ap-form-grid */}

          <div className="ap-form-actions">
            <button className="ap-submit-btn" type="submit" disabled={saving}>
              {saving ? (
                <>
                  <span className="ap-spinner" />
                  {editingId ? "Updating…" : "Creating…"}
                </>
              ) : (
                <>
                  {editingId ? "Update Admin" : "Create Admin"}
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
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>
            {editingId && (
              <button
                className="ap-cancel-btn"
                type="button"
                onClick={resetForm}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ── Admins table ── */}
      <section className="card ap-table-card">
        <div className="ap-table-header">
          <h2 className="ap-table-title">All Accounts</h2>
          <span className="status-pill">{admins.length} total</span>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="ap-loading">
              <div className="ap-loading-spinner" />
              <span>Loading accounts…</span>
            </div>
          ) : admins.length === 0 ? (
            <div className="ap-empty">No admin accounts found.</div>
          ) : (
            <table className="admin-table ap-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => {
                  const isSelf = Number(admin.id) === Number(currentAdmin.id);
                  const meta = ROLE_META[admin.role] || {
                    label: admin.role,
                    color: "default",
                  };
                  return (
                    <tr key={admin.id} className={isSelf ? "ap-row-self" : ""}>
                      <td>
                        <div className="ap-name-cell">
                          <div className="ap-avatar" data-color={meta.color}>
                            {(admin.name ||
                              admin.email ||
                              "?")[0].toUpperCase()}
                          </div>
                          <span>{admin.name}</span>
                          {isSelf && <span className="ap-you-tag">you</span>}
                        </div>
                      </td>
                      <td className="ap-email-cell">{admin.email}</td>
                      <td>
                        <span className={`role-badge role-${admin.role}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="ap-date-cell">
                        {admin.created_at
                          ? new Date(admin.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="secondary-btn small"
                            type="button"
                            onClick={() => handleEdit(admin)}
                          >
                            Edit
                          </button>
                          <button
                            className="danger-btn small"
                            type="button"
                            onClick={() => handleDelete(admin)}
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "You cannot delete your own account"
                                : "Delete account"
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

export default AdminsPage;
