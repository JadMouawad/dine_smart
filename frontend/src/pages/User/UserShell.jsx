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

export default function UserShell({ initialActive = "search" }) {
    const [active, setActive] = useState(initialActive);
    const [restaurantToOpen, setRestaurantToOpen] = useState(null);
    const [userAvatarUrl, setUserAvatarUrl] = useState("");
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
        logout();
        navigate("/");
    }

    return (
        <div className="userArea">
            <UserNav
                active={active}
                onChange={setActive}
                avatarSrc={userAvatarUrl}
                user={user}
                onLogout={handleLogout}
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
                    />
                  )}

                {active === "discover" && (
                    <UserDiscover
                      onOpenRestaurant={(restaurant) => {
                        setRestaurantToOpen(restaurant);
                        setActive("search");
                      }}
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
        </div>
    );
}
