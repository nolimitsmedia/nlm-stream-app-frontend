import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "./api";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

const SubscriptionContext = createContext({
  subscription: null,
  loading: true,
  error: "",
  isActive: false,
  hasFeature: () => false,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }) {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("nlm_token");
    let admin = {};
    try {
      admin = JSON.parse(localStorage.getItem("nlm_admin") || "{}");
    } catch {
      admin = {};
    }

    const organizationId = localStorage.getItem("nlm_organization_id");

    if (!token || (admin.role === "super_admin" && !organizationId)) {
      setSubscription(null);
      setError("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await api.get("/api/subscription/current");
      setSubscription(response.data.subscription || null);
    } catch (requestError) {
      setSubscription(null);
      setError(
        requestError.response?.data?.message ||
          "Failed to load subscription details.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    window.addEventListener("nlm-organization-changed", refresh);
    window.addEventListener("nlm-subscription-changed", refresh);

    return () => {
      window.removeEventListener("nlm-organization-changed", refresh);
      window.removeEventListener("nlm-subscription-changed", refresh);
    };
  }, [refresh]);

  const isActive = Boolean(
    subscription &&
    (!subscription.status || ACTIVE_STATUSES.has(subscription.status)),
  );

  const hasFeature = useCallback(
    (featureKey) => Boolean(isActive && subscription?.[featureKey]),
    [isActive, subscription],
  );

  const value = useMemo(
    () => ({
      subscription,
      loading,
      error,
      isActive,
      hasFeature,
      refresh,
    }),
    [subscription, loading, error, isActive, hasFeature, refresh],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
