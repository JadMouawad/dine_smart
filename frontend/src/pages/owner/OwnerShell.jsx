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
import { getOwnerReservations } from "../../services/reservationService.js";

const OWNER_SEEN_RESERVATIONS_KEY = "ds-owner-seen-reservation-ids";

function normalizeReservationId(reservation) {
  return String(reservation?.id ?? "");
}

export default function OwnerShell() {
  const [active, setActive] = useState("profile");
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");
  const [approvalStatus, setApprovalStatus] = useState("");
  const [approvalNotice, setApprovalNotice] = useState("");
  const [unseenReservationCount, setUnseenReservationCount] = useState(0);

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
        // keep last known status
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

  useEffect(() => {
    if (!user?.id || !isApproved) {
      setUnseenReservationCount(0);
      return;
    }

    const storageKey = `${OWNER_SEEN_RESERVATIONS_KEY}:${user.id}`;
    let cancelled = false;

    async function syncReservationBadge(markAllAsSeen = false) {
      try {
        const data = await getOwnerReservations();
        if (cancelled) return;

        const reservations = Array.isArray(data) ? data : [];
        const reservationIds = reservations
          .map(normalizeReservationId)
          .filter(Boolean);

        if (markAllAsSeen) {
          localStorage.setItem(storageKey, JSON.stringify(reservationIds));
          setUnseenReservationCount(0);
          return;
        }

        const savedRaw = localStorage.getItem(storageKey);

        if (!savedRaw) {
          localStorage.setItem(storageKey, JSON.stringify(reservationIds));
          setUnseenReservationCount(0);
          return;
        }

        let seenIds = [];
        try {
          seenIds = JSON.parse(savedRaw);
        } catch {
          seenIds = [];
        }

        const seenSet = new Set((Array.isArray(seenIds) ? seenIds : []).map(String));

        const unseenCount = reservationIds.filter((id) => !seenSet.has(id)).length;
        setUnseenReservationCount(unseenCount);
      } catch {
        // keep last known count
      }
    }

    if (active === "reservations") {
      syncReservationBadge(true);
      return () => {
        cancelled = true;
      };
    }

    syncReservationBadge(false);

    const intervalId = window.setInterval(() => {
      syncReservationBadge(false);
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user?.id, isApproved, active]);

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
            <div className="formCard__title" style={{ color: "#e53e3e" }}>
              Restaurant Rejected
            </div>
            <p className="userProfileFormHint" style={{ marginTop: 6 }}>
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
        unseenReservationCount={unseenReservationCount}
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

        {active !== "profile" &&
          active !== "menu" &&
          active !== "table-config" &&
          active !== "events" &&
          active !== "reviews" &&
          active !== "reservations" && (
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