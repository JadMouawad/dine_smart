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
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import ChatWidget from "../../components/ChatWidget.jsx";

export default function UserShell({ initialActive = "search" }) {
    const [active, setActive] = useState(initialActive);
    const [restaurantToOpen, setRestaurantToOpen] = useState(null);
    const [chatCommand, setChatCommand] = useState(null);
    const [userAvatarUrl, setUserAvatarUrl] = useState("");
    const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
    const navigate = useNavigate();
    const { user, logout, loading } = useAuth();

    useEffect(() => {
        setActive(initialActive);
    }, [initialActive]);

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

    // Wait for auth to restore before rendering
    if (loading) return null;
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
            />

            <main className="userArea__main">
                {active === "profile" && (
                    <UserProfile
                      onAvatarPreviewChange={setUserAvatarUrl}
                      onOpenRestaurant={(restaurant) => {
                        setRestaurantToOpen(restaurant);
                        setActive("search");
                      }}
                    />
                  )}

                {active === "search" && (
                    <UserSearch
                      restaurantToOpen={restaurantToOpen}
                      clearRestaurantToOpen={() => setRestaurantToOpen(null)}
                      chatCommand={chatCommand}
                      clearChatCommand={() => setChatCommand(null)}
                    />
                  )}

                {active === "discover" && (
                    <UserDiscover
                      onOpenRestaurant={(restaurant) => {
                        setRestaurantToOpen(restaurant);
                        setActive("search");
                      }}
                      onViewBooking={() => setActive("reservations")}
                    />
                )}

                {active === "explore" && (
                    <UserExplore
                      onOpenRestaurant={(restaurant) => {
                        setRestaurantToOpen(restaurant);
                        setActive("search");
                      }}
                    />
                )}

                {active === "reservations" && <UserReservations />}   

                {active !== "profile" && active !== "search" && active !== "reservations" && active !== "discover" && active !== "explore" && (
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
