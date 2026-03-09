import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import AdminNav from "./AdminNav.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import PendingRestaurantsPage from "./PendingRestaurantsPage.jsx";
import UserManagementPage from "./UserManagementPage.jsx";
import FlaggedReviewsPage from "./FlaggedReviewsPage.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

function tabFromPathname(pathname) {
  if (pathname.includes("/pending")) return "pending";
  if (pathname.includes("/flags")) return "flags";
  if (pathname.includes("/users")) return "users";
  return "dashboard";
}

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, loading } = useAuth();

  const [pendingFlagsCount, setPendingFlagsCount] = useState(0);
  const [pendingRestaurantsCount, setPendingRestaurantsCount] = useState(0);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const active = useMemo(() => tabFromPathname(location.pathname), [location.pathname]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (user.role !== "admin") {
      if (user.role === "owner") navigate("/owner/profile", { replace: true });
      else navigate("/user/profile", { replace: true });
    }
  }, [loading, user, navigate]);

  function handleChange(tab) {
    if (tab === "dashboard") navigate("/admin/dashboard");
    if (tab === "pending") navigate("/admin/pending");
    if (tab === "flags") navigate("/admin/flags");
    if (tab === "users") navigate("/admin/users");
  }

  function handleLogout() {
    setConfirmLogoutOpen(false);
    logout();
    navigate("/");
  }

  const dashboardKey = useMemo(
    () => `${pendingFlagsCount}-${pendingRestaurantsCount}`,
    [pendingFlagsCount, pendingRestaurantsCount]
  );

  if (loading || !user || user.role !== "admin") return null;

  return (
    <div className="adminArea">
      <AdminNav
        active={active}
        onChange={handleChange}
        onLogout={() => setConfirmLogoutOpen(true)}
        pendingFlagsCount={pendingFlagsCount}
      />

      <main className="adminArea__main">
        {active === "dashboard" && (
          <AdminDashboard
            key={dashboardKey}
            onOpenPending={() => handleChange("pending")}
            onOpenFlags={() => handleChange("flags")}
            onOpenUsers={() => handleChange("users")}
            onStatsLoaded={(stats) => {
              setPendingFlagsCount(stats.flagged_reviews || 0);
              setPendingRestaurantsCount(stats.pending_approvals || 0);
            }}
          />
        )}

        {active === "pending" && (
          <PendingRestaurantsPage
            onPendingCountChange={(count) => setPendingRestaurantsCount(count)}
          />
        )}

        {active === "flags" && (
          <FlaggedReviewsPage
            onPendingCountChange={(count) => setPendingFlagsCount(count)}
          />
        )}

        {active === "users" && <UserManagementPage />}
      </main>

      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Sign out?"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
    </div>
  );
}
