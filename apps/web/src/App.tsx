import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { WorkspaceRedirect } from "./pages/WorkspaceRedirect.js";
import { AppLayout } from "./components/layout/AppLayout.js";
import { OverviewPage } from "./pages/OverviewPage.js";
import { ComposePage } from "./pages/ComposePage.js";
import { MediaPage } from "./pages/MediaPage.js";
import { PostsPage } from "./pages/PostsPage.js";
import { CalendarPage } from "./pages/CalendarPage.js";
import { AccountsPage } from "./pages/AccountsPage.js";
import { OAuthCallbackPage } from "./pages/OAuthCallbackPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";

export function App() {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Static OAuth Callback Route (single Postiz FRONTEND_URL target) */}
      <Route path="/accounts/callback" element={<OAuthCallbackPage />} />

      {/* Authenticated Workspace Redirect */}
      <Route path="/app" element={<WorkspaceRedirect />} />

      {/* Authenticated Workspace Shell */}
      <Route path="/app/:workspaceId" element={<AppLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="compose" element={<ComposePage />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="posts" element={<PostsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="accounts/callback" element={<OAuthCallbackPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}
