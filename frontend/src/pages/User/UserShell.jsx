import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import UserNav from "./UserNav.jsx";
import UserSearch from "./UserSearch.jsx";
import UserProfile from "./UserProfile.jsx";
import UserReservations from "./UserReservations.jsx";
import UserDiscover from "./UserDiscover.jsx";
import UserExplore from "./UserExplore.jsx";
import { getProfile } from "../../services/profileService.js";
import { getPublicEvents } from "../../services/restaurantService.js";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import ChatWidget from "../../components/ChatWidget.jsx";

const USER_SEEN_EVENT_IDS_KEY = "ds-user-seen-event-ids";

function normalizeEventId(eventItem) {
  return String(eventItem?.id ?? "");
}

export default function UserShell({ initialActive = "search" }) {
  const [active, setActive] = useState(initialActive);
  const [openedTabs, setOpenedTabs] = useState(() => ({
    search: initialActive === "search",
    discover: initialActive === "discover",
    reservations: initialActive === "reservations",
    profile: initialActive === "profile",
  }));
  const [restaurantToOpen, setRestaurantToOpen] = useState(null);
  const [chatCommand, setChatCommand] = useState(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState("");
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [unseenEventCount, setUnseenEventCount] = useState(0);

  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();

  useEffect(() => {
    setActive(initialActive);
  }, [initialActive]);

  useEffect(() => {
    if (!["search", "discover", "reservations", "profile"].includes(active)) return;
    setOpenedTabs((prev) => {
      if (prev[active]) return prev;
      return { ...prev, [active]: true };
    });
  }, [active]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "user")) {
      navigate("/", { replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user?.id) {
      setUserAvatarUrl("");
      return;
    }

    let mounted = true;
    getProfile()
      .then((profile) => {
        if (!mounted) return;
        const avatar = profile?.profilePictureUrl ?? profile?.profile_picture_url ?? "";
        setUserAvatarUrl(avatar);
      })
      .catch(() => {
        if (mounted) setUserAvatarUrl("");
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnseenEventCount(0);
      return;
    }

    const storageKey = `${USER_SEEN_EVENT_IDS_KEY}:${user.id}`;
    let cancelled = false;

    async function syncEventBadge(markAllAsSeen = false) {
      try {
        const data = await getPublicEvents({
          latitude: user?.latitude ?? undefined,
          longitude: user?.longitude ?? undefined,
          limit: 40,
        });

        if (cancelled) return;

        const events = Array.isArray(data) ? data : [];
        const eventIds = events
          .map(normalizeEventId)
          .filter(Boolean);

        if (markAllAsSeen) {
          localStorage.setItem(storageKey, JSON.stringify(eventIds));
          setUnseenEventCount(0);
          return;
        }

        const savedRaw = localStorage.getItem(storageKey);

        if (!savedRaw) {
          localStorage.setItem(storageKey, JSON.stringify(eventIds));
          setUnseenEventCount(0);
          return;
        }

        let seenIds = [];
        try {
          seenIds = JSON.parse(savedRaw);
        } catch {
          seenIds = [];
        }

        const seenSet = new Set((Array.isArray(seenIds) ? seenIds : []).map(String));

        const unseenCount = eventIds.filter((id) => !seenSet.has(id)).length;
        setUnseenEventCount(unseenCount);
      } catch {
        // keep last known count
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      syncEventBadge(active === "discover");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (active === "discover") {
      syncEventBadge(true);
      return () => {
        cancelled = true;
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };
    }

    syncEventBadge(false);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      syncEventBadge(false);
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.id, user?.latitude, user?.longitude, active]);

  if (loading) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Loading your dashboard...</h1>
      </div>
    );
  }
  if (!user || user.role !== "user") return null;

  function handleLogout() {
    setConfirmLogoutOpen(false);
    logout();
    navigate("/");
  }

  function handleChatAction(action) {
    if (!action?.type) return;
    setActive("search");
    setChatCommand({
      ...action,
      id: action.id || `chat-${Date.now()}`,
    });
  }

  return (
    <div className="userArea">
      <UserNav
        active={active}
        onChange={setActive}
        avatarSrc={userAvatarUrl}
        user={user}
        onLogout={() => setConfirmLogoutOpen(true)}
        unseenEventCount={unseenEventCount}
      />

      <main className="userArea__main">
        {openedTabs.profile && (
          <div style={{ display: active === "profile" ? "block" : "none" }}>
            <UserProfile
              onAvatarPreviewChange={setUserAvatarUrl}
              onOpenRestaurant={(restaurant) => {
                setRestaurantToOpen(restaurant);
                setActive("search");
              }}
            />
          </div>
        )}

        {openedTabs.search && (
          <div style={{ display: active === "search" ? "block" : "none" }}>
            <UserSearch
              restaurantToOpen={restaurantToOpen}
              clearRestaurantToOpen={() => setRestaurantToOpen(null)}
              chatCommand={chatCommand}
              clearChatCommand={() => setChatCommand(null)}
            />
          </div>
        )}

        {openedTabs.discover && (
          <div style={{ display: active === "discover" ? "block" : "none" }}>
            <UserDiscover
              onOpenRestaurant={(restaurant) => {
                setRestaurantToOpen(restaurant);
                setActive("search");
              }}
              onViewBooking={() => {
                setActive("reservations");
              }}
            />
          </div>
        )}

        {active === "explore" && (
          <div>
          <UserExplore
            onOpenRestaurant={(restaurant) => {
              setRestaurantToOpen(restaurant);
              setActive("search");
            }}
          />
          </div>
        )}

        {openedTabs.reservations && (
          <div style={{ display: active === "reservations" ? "block" : "none" }}>
            <UserReservations />
          </div>
        )}

        {active !== "profile" &&
          active !== "search" &&
          active !== "reservations" &&
          active !== "discover" &&
          active !== "explore" && (
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

      <ChatWidget onAction={handleChatAction} />
    </div>
  );
}
