import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import OwnerNav from "./OwnerNav.jsx";
import OwnerProfile from "./OwnerProfile.jsx";
import OwnerMenu from "./OwnerMenu.jsx";
import RestaurantTableConfig from "./RestaurantTableConfig.jsx";
import OwnerEvents from "./OwnerEvents.jsx";
import OwnerReviews from "./OwnerReviews.jsx";
import OwnerReservations from "./OwnerReservations.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

export default function OwnerShell() {
  const [active, setActive] = useState("profile");
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "owner")) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  // Wait for auth to restore before rendering (so token is in localStorage for API calls)
  if (loading) return null;
  if (!user || user.role !== "owner") return null;

  function handleLogout() {
    setConfirmLogoutOpen(false);
    logout();
    navigate("/");
  }

  return (
    <div className="ownerArea">
      <OwnerNav
        active={active}
        onChange={setActive}
        avatarSrc={restaurantLogoUrl}
        onLogout={() => setConfirmLogoutOpen(true)}
      />

      <main className="ownerArea__main">
        {active === "profile" && (
          <OwnerProfile onLogoPreviewChange={setRestaurantLogoUrl} />
        )}

        {active === "menu" && <OwnerMenu />}

        {active === "table-config" && <RestaurantTableConfig />}

        {active === "events" && <OwnerEvents />}

        {active === "reviews" && <OwnerReviews />}

        {active === "reservations" && <OwnerReservations />}

        {active !== "profile" && active !== "menu" && active !== "table-config" && active !== "events" && active !== "reviews" && active !== "reservations" && (
          <div className="placeholderPage">
            <h1 className="placeholderPage__title">
              {active.charAt(0).toUpperCase() + active.slice(1)}
            </h1>
            <p className="placeholderPage__text">This page will be built next.</p>
          </div>
        )}
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
