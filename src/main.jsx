import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";

import App from "./App.jsx";
import EmbedPlayer from "./EmbedPlayer.jsx";
import WatchPage from "./WatchPage.jsx";
import LoginPage from "./LoginPage.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import PricingPage from "./PricingPage.jsx";
import ClientSignupPage from "./ClientSignupPage.jsx";
import Home from "./Home.jsx";
import PrivacyPolicyPage from "./PrivacyPolicyPage.jsx";
import StatusPage from "./StatusPage.jsx";
import HelpCenterPage from "./HelpCenterPage.jsx";
import AdminGuidePage from "./AdminGuidePage.jsx";
import ObsSetupGuidePage from "./ObsSetupGuidePage.jsx";
import TroubleshootingGuidePage from "./TroubleshootingGuidePage.jsx";
import { FeatureFlagsProvider } from "./FeatureFlagsContext.jsx";
import { SubscriptionProvider } from "./SubscriptionContext.jsx";

import "./App.css";

function AppRoutes() {
  return (
    <Routes>
      {/* Public Marketing / Signup */}
      <Route path="/home" element={<Home />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/signup" element={<ClientSignupPage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/help" element={<HelpCenterPage />} />
      <Route path="/help/admin-guide" element={<AdminGuidePage />} />
      <Route path="/help/obs-setup" element={<ObsSetupGuidePage />} />
      <Route
        path="/help/troubleshooting"
        element={<TroubleshootingGuidePage />}
      />

      {/* Public Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Dashboard */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        }
      />

      {/* Public Watch Page */}
      <Route path="/watch/:streamName" element={<WatchPage />} />

      {/* Public live-stream embed (Phase 1, Copy Embed Code). Public/
      anonymous — deliberately NOT wrapped in ProtectedRoute, same as
      /watch/:streamName above. */}
      <Route path="/embed/:embedToken" element={<EmbedPlayerRoute />} />
    </Routes>
  );
}

// Bridges react-router's :embedToken param to EmbedPlayer's existing
// `token` prop — keeps EmbedPlayer.jsx itself router-agnostic.
function EmbedPlayerRoute() {
  const { embedToken } = useParams();
  return <EmbedPlayer token={embedToken} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename="/nlm-stream">
      <FeatureFlagsProvider>
        <SubscriptionProvider>
          <AppRoutes />
        </SubscriptionProvider>
      </FeatureFlagsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
