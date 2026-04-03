import React, { useEffect, useMemo, useState } from "react";
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
import { getMyRestaurant } from "../../services/restaurantService.js";

export default function OwnerShell() {
  const [active, setActive] = useState("profile");
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [approvalNotice, setApprovalNotice] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "owner")) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  const fetchApprovalStatus = () => {
    if (!user?.id) return;
    getMyRestaurant()
      .then((restaurant) => {
        setApprovalStatus(String(restaurant?.approval_status || ""));
      })
      .catch(() => {
        // Preserve the last known status on transient failures so the owner shell
        // does not jump into an empty/incorrect state after a save.
      });
  };

  useEffect(() => {
    fetchApprovalStatus();
  }, [user?.id]);

  const isApproved = useMemo(() => approvalStatus === "approved", [approvalStatus]);

  useEffect(() => {
    if (approvalStatus === "pending") {
      setActive("profile");
    }
  }, [approvalStatus]);

  // Wait for auth to restore before rendering (so token is in localStorage for API calls)
  if (loading) return null;
  if (!user || user.role !== "owner") return null;

  function handleLogout() {
    setConfirmLogoutOpen(false);
    logout();
    navigate("/");
  }

  if (approvalStatus === "pending") {
    return (
      <div className="ownerArea ownerArea--pending">
        <main className="ownerArea__main ownerArea__main--pending">
          <div className="formCard formCard--userProfile ownerPendingCard">
            <div className="formCard__title ownerPendingCard__title">Approval Pending</div>
            <p className="userProfileFormHint ownerPendingCard__text">
              Your restaurant is awaiting admin approval. You can still update your profile and upload your business
              license here while the rest of the owner tools stay locked.
            </p>
          </div>
          <OwnerProfile onLogoPreviewChange={setRestaurantLogoUrl} onSaved={fetchApprovalStatus} />
        </main>
      </div>
    );
  }

  if (approvalStatus === "rejected") {
    return (
      <div className="ownerArea ownerArea--pending">
        <main className="ownerArea__main ownerArea__main--pending">
          <div className="formCard formCard--userProfile ownerPendingCard">
            <div className="formCard__title ownerPendingCard__title" style={{ color: "#e53e3e" }}>Restaurant Rejected</div>
            <p className="userProfileFormHint ownerPendingCard__text">
              Your restaurant application has been rejected by the admin. Please contact support for more information.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ownerArea">
      <OwnerNav
        active={active}
        onChange={(tab) => {
          setApprovalNotice("");
          setActive(tab);
        }}
        avatarSrc={restaurantLogoUrl}
        onLogout={() => setConfirmLogoutOpen(true)}
        isApproved={isApproved}
      />

      <main className="ownerArea__main">
        {approvalNotice && (
          <div className="formCard__error" style={{ marginBottom: 12 }}>
            {approvalNotice}
          </div>
        )}

        {active === "profile" && (
          <OwnerProfile onLogoPreviewChange={setRestaurantLogoUrl} onSaved={fetchApprovalStatus} />
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
