import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

// Defaults mirror the server's FEATURE_FLAG_DEFAULTS — used only until
// the real fetch resolves, so behavior never flickers between "on" and
// "off" on first render.
const DEFAULT_FLAGS = {
  members_page: false,
  public_replay_features: false,
};

const FeatureFlagsContext = createContext({
  flags: DEFAULT_FLAGS,
  loading: true,
});

export function FeatureFlagsProvider({ children }) {
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const token = localStorage.getItem("nlm_token");
        if (!token) {
          // Not logged in yet (e.g. on the login/pricing/signup pages) —
          // just use defaults, no point calling an authenticated route.
          setLoading(false);
          return;
        }
        const res = await api.get("/api/feature-flags");
        if (!cancelled) {
          setFlags({ ...DEFAULT_FLAGS, ...(res.data.flags || {}) });
        }
      } catch {
        // If this fails, fall back to defaults rather than breaking
        // the whole app over a flags fetch.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ flags, loading }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
