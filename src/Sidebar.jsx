import { useEffect, useMemo, useState } from "react";
import { useSubscription } from "./SubscriptionContext.jsx";

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

/* Icon map for nav items */
const NAV_ICONS = {
  Dashboard: (
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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  "Client Onboarding": (
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
  Organizations: (
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
  ),
  Channels: (
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
  ),
  "Scheduled Streams": (
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
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  "File Broadcast": (
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polygon points="10 12 15 15 10 18 10 12" />
    </svg>
  ),
  Recordings: (
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
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <polygon points="10 10 16 13 10 16 10 10" />
    </svg>
  ),
  Subscription: (
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
  ),
  "Live Monitor": (
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
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.65 3.36 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Analytics: (
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
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Admins: (
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Settings: (
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  ),
  "API Keys": (
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
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  ),
  "System Status": (
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
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  "Super Admin Guide": (
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

function Sidebar({ activePage, setActivePage }) {
  const admin = useMemo(() => getStoredAdmin(), []);
  const [organization, setOrganization] = useState(getStoredOrganization);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { loading: subscriptionLoading, hasFeature } = useSubscription();

  const isPlatformAdmin = admin.role === "super_admin";
  const showAnalytics =
    isPlatformAdmin ||
    (!subscriptionLoading && hasFeature("analytics_enabled"));
  const inSupportMode = isPlatformAdmin && Boolean(organization?.id);
  const organizationName = organization.name || "Streaming Cloud";
  const organizationInitial = organizationName[0]?.toUpperCase() || "N";

  useEffect(() => {
    const handleOrgChange = (e) => {
      setOrganization(e.detail?.organization || getStoredOrganization());
    };
    window.addEventListener("nlm-organization-changed", handleOrgChange);
    return () =>
      window.removeEventListener("nlm-organization-changed", handleOrgChange);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 760) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sections = [
    {
      label: "Platform",
      items: isPlatformAdmin
        ? [
            "Dashboard",
            "Client Onboarding",
            "Organizations",
            ...(inSupportMode
              ? ["Channels", "Scheduled Streams", "Subscription"]
              : []),
          ]
        : ["Dashboard", "Channels", "Scheduled Streams", "Subscription"],
    },
    {
      label: "Production",
      items:
        !isPlatformAdmin || inSupportMode
          ? [
              "Live Monitor",
              "Recordings",
              "File Broadcast",
              ...(showAnalytics ? ["Analytics"] : []),
            ]
          : [],
    },
    {
      label: "Admin",
      items: isPlatformAdmin
        ? [
            "Admins",
            "API Keys",
            "System Status",
            "Super Admin Guide",
            "Settings",
          ]
        : ["API Keys", "Settings"],
    },
  ].filter((section) => section.items.length > 0);

  return (
    <>
      <button
        type="button"
        className="sb-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
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
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mobileOpen && (
        <div
          className="sb-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`sb-sidebar${collapsed ? " sb-sidebar--collapsed" : ""}${
          mobileOpen ? " sb-sidebar--open" : ""
        }`}
      >
        {/* Brand */}
        <div className="sb-brand">
          <div
            className="sb-brand-icon"
            style={{ background: organization.primary_color || "#0d6efd" }}
          >
            {organizationInitial}
          </div>
          {!collapsed && (
            <div className="sb-brand-text">
              <strong>
                {isPlatformAdmin
                  ? inSupportMode
                    ? organizationName
                    : "NLM Stream"
                  : organizationName}
              </strong>
              <span>
                {isPlatformAdmin
                  ? inSupportMode
                    ? "Support Mode"
                    : "Streaming Cloud"
                  : "Client Portal"}
              </span>
            </div>
          )}
          <button
            type="button"
            className="sb-collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
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
              {collapsed ? (
                <>
                  <polyline points="9 18 15 12 9 6" />
                </>
              ) : (
                <>
                  <polyline points="15 18 9 12 15 6" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Nav sections */}
        <nav className="sb-nav">
          {sections.map((section) => (
            <div key={section.label} className="sb-section">
              {!collapsed && (
                <span className="sb-section-label">{section.label}</span>
              )}
              {section.items.map((item) => (
                <button
                  key={item}
                  type="button"
                  title={collapsed ? item : undefined}
                  className={`sb-nav-btn${activePage === item ? " sb-nav-btn--active" : ""}`}
                  onClick={() => {
                    setActivePage(item);
                    setMobileOpen(false);
                  }}
                >
                  <span className="sb-nav-icon">{NAV_ICONS[item] || null}</span>
                  {!collapsed && <span className="sb-nav-label">{item}</span>}
                  {activePage === item && !collapsed && (
                    <span className="sb-nav-indicator" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
