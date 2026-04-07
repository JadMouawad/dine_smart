import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import AdminNav from "./AdminNav.jsx";
import AdminDashboard from "./AdminDashboard.jsx";
import PendingRestaurantsPage from "./PendingRestaurantsPage.jsx";
import UserManagementPage from "./UserManagementPage.jsx";
import FlaggedReviewsPage from "./FlaggedReviewsPage.jsx";
import AdminProfile from "./AdminProfile.jsx";
import HealthCertificatesPage from "./HealthCertificatesPage.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import { getProfile } from "../../services/profileService.js";

function tabFromPathname(pathname) {
  if (pathname.includes("/profile")) return "profile";
  if (pathname.includes("/pending")) return "pending";
  if (pathname.includes("/flags")) return "flags";
  if (pathname.includes("/users")) return "users";
  if (pathname.includes("/health-certificates")) return "health-certificates";
  return "dashboard";
}

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, loading } = useAuth();

  const [pendingFlagsCount, setPendingFlagsCount] = useState(0);
  const [pendingRestaurantsCount, setPendingRestaurantsCount] = useState(0);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [adminAvatarUrl, setAdminAvatarUrl] = useState("");
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

  useEffect(() => {
    if (!user?.id) {
      setAdminAvatarUrl("");
      return;
    }

    let mounted = true;
    getProfile()
      .then((profile) => {
        if (!mounted) return;
        const avatar = profile?.profilePictureUrl ?? profile?.profile_picture_url ?? "";
        setAdminAvatarUrl(avatar);
      })
      .catch(() => {
        if (mounted) setAdminAvatarUrl("");
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  function handleChange(tab) {
    if (tab === "dashboard") navigate("/admin/dashboard");
    if (tab === "pending") navigate("/admin/pending");
    if (tab === "flags") navigate("/admin/flags");
    if (tab === "users") navigate("/admin/users");
    if (tab === "profile") navigate("/admin/profile");
    if (tab === "health-certificates") navigate("/admin/health-certificates");
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
        onOpenProfile={() => handleChange("profile")}
        avatarSrc={adminAvatarUrl}
        user={user}
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

        {active === "profile" && (
          <AdminProfile onAvatarPreviewChange={setAdminAvatarUrl} />
        )}

        {active === "users" && <UserManagementPage />}

        {active === "health-certificates" && <HealthCertificatesPage />}
      </main>

      <ConfirmDialog
        open={confirmLogoutOpen}
        title="Log out?"
        message="Are you sure you want to log out?"
        confirmLabel="Log Out"
        cancelLabel="Cancel"
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
    </div>
  );
}
