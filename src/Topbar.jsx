import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";

function getStoredAdmin() {
  try {
    return JSON.parse(localStorage.getItem("nlm_admin") || "{}");
  } catch {
    return {};
  }
}

function Topbar() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(getStoredAdmin);
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(
    () => localStorage.getItem("nlm_organization_id") || "",
  );

  const selectedOrganization = useMemo(
    () =>
      organizations.find(
        (o) => String(o.id) === String(selectedOrganizationId),
      ),
    [organizations, selectedOrganizationId],
  );

  const isPlatformAdmin = admin.role === "super_admin";

  const persistOrganization = (org) => {
    if (!org?.id) return;
    localStorage.setItem("nlm_organization_id", String(org.id));
    localStorage.setItem("nlm_current_organization", JSON.stringify(org));
    setSelectedOrganizationId(String(org.id));
    window.dispatchEvent(
      new CustomEvent("nlm-organization-changed", {
        detail: { organizationId: String(org.id), organization: org },
      }),
    );
  };

  const loadProfile = async () => {
    try {
      const res = await api.get("/api/auth/me");
      const next = res.data.admin || {};
      setAdmin(next);
      localStorage.setItem("nlm_admin", JSON.stringify(next));

      if (next.role === "super_admin") {
        // Super admin can step into ANY organization for support
        // purposes — pull the full list, but don't auto-select one.
        // Landing on "no org selected" keeps them on the Platform
        // Overview by default instead of silently dropping them into
        // whichever client happens to be first.
        const orgsRes = await api.get("/api/organizations");
        setOrganizations(orgsRes.data.organizations || []);
        return;
      }

      const orgs = res.data.organizations || [];
      setOrganizations(orgs);
      const stored = orgs.find(
        (o) =>
          String(o.id) === String(localStorage.getItem("nlm_organization_id")),
      );
      persistOrganization(stored || orgs[0]);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []); // eslint-disable-line

  const handleOrgChange = (e) => {
    if (e.target.value === "") {
      exitSupportMode();
      return;
    }
    const next = organizations.find(
      (o) => String(o.id) === String(e.target.value),
    );
    if (next) persistOrganization(next);
  };

  const exitSupportMode = () => {
    localStorage.removeItem("nlm_organization_id");
    localStorage.removeItem("nlm_current_organization");
    setSelectedOrganizationId("");
    window.dispatchEvent(
      new CustomEvent("nlm-organization-changed", {
        detail: { organizationId: null, organization: null },
      }),
    );
  };

  const logout = () => {
    [
      "nlm_token",
      "nlm_admin",
      "nlm_organization_id",
      "nlm_current_organization",
    ].forEach((k) => localStorage.removeItem(k));
    navigate("/login");
  };

  const initials = (admin.name || "A")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="tb-topbar">
      <div className="tb-left">
        <div className="tb-title-block">
          <span className="tb-eyebrow">
            {isPlatformAdmin
              ? selectedOrganization
                ? `Support Mode — ${selectedOrganization.name}`
                : "Reseller Console"
              : "Client Portal"}
          </span>
          <h1 className="tb-title">
            {isPlatformAdmin
              ? selectedOrganization
                ? selectedOrganization.name
                : "NLM Streaming Manager"
              : selectedOrganization?.name || "Streaming Dashboard"}
          </h1>
        </div>
      </div>

      <div className="tb-right">
        {/* System status */}
        <div className="tb-status">
          <span className="tb-status-dot" />
          <span>Online</span>
        </div>

        {/* Tenant switcher */}
        {organizations.length > 0 && (
          <div className="tb-org-switcher">
            {isPlatformAdmin && selectedOrganization && (
              <span className="tb-support-badge">Support Mode</span>
            )}
            <svg
              className="tb-org-icon"
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
            <select
              className="tb-org-select"
              value={selectedOrganizationId}
              onChange={handleOrgChange}
            >
              {isPlatformAdmin && (
                <option value="">— Platform view (no client selected) —</option>
              )}
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Admin pill */}
        <div className="tb-admin-pill">
          <div className="tb-admin-avatar">{initials}</div>
          <div className="tb-admin-info">
            <strong>{admin.name || "Admin"}</strong>
            <span>{admin.role || "admin"}</span>
          </div>
        </div>

        {/* Logout */}
        <button type="button" className="tb-logout-btn" onClick={logout}>
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}

export default Topbar;
