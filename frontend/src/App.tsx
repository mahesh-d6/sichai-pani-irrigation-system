import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import Layout from "./components/Layout";
import RoleSelectLogin from "./pages/RoleSelectLogin";
import AdminLogin from "./pages/AdminLogin";
import AdminRegister from "./pages/AdminRegister";
import OperatorLogin from "./pages/OperatorLogin";
import FarmerLogin from "./pages/FarmerLogin";
import ForgotPassword from "./pages/ForgotPassword";
import ForceChangePassword from "./pages/ForceChangePassword";
import Dashboard from "./pages/Dashboard";
import Farmers from "./pages/Farmers";
import WaterRequests from "./pages/WaterRequests";
import Payments from "./pages/Payments";
import Complaints from "./pages/Complaints";
import Reports from "./pages/Reports";
import SettingsPage from "./pages/Settings";

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // A farmer given a temporary password by an Admin must set their own
  // before touching anything else in the app.
  if (user.role === "farmer" && user.must_change_password) {
    return <Navigate to="/force-change-password" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<RoleSelectLogin />} />
      <Route path="/login/admin" element={<AdminLogin />} />
      <Route path="/login/admin/register" element={<AdminRegister />} />
      <Route path="/login/operator" element={<OperatorLogin />} />
      <Route path="/farmer/login" element={<FarmerLogin />} />
      <Route path="/farmer/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/force-change-password"
        element={
          <ProtectedRouteBypass>
            <ForceChangePassword />
          </ProtectedRouteBypass>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="farmers" element={<Farmers />} />
        <Route path="requests" element={<WaterRequests />} />
        <Route path="payments" element={<Payments />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Like ProtectedRoute, but for the one page a logged-in-but-must-change-
// password farmer IS allowed to reach -- requires a session, but doesn't
// bounce back here again if must_change_password is still true.
function ProtectedRouteBypass({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
