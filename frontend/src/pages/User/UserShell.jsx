import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import UserNav from "./UserNav.jsx";
import UserSearch from "./UserSearch.jsx";
import UserProfile from "./UserProfile.jsx";
import UserReservations from "./UserReservations.jsx";

export default function UserShell() {
    const [active, setActive] = useState("search");
    const [restaurantToOpen, setRestaurantToOpen] = useState(null);
    const [userAvatarUrl, setUserAvatarUrl] = useState("");
    const navigate = useNavigate();

    return (
        <div className="userArea">
            <UserNav
                active={active}
                onChange={setActive}
                avatarSrc={userAvatarUrl}
                onLogout={() => navigate("/")}
            />

            <main className="userArea__main">
                {active === "profile" && (
  <UserProfile
    onOpenRestaurant={(restaurant) => {
      setRestaurantToOpen(restaurant);
      setActive("search");
    }}
  />
)}

                {active === "search" && (
  <UserSearch
    goReservations={() => setActive("reservations")}
    restaurantToOpen={restaurantToOpen}
    clearRestaurantToOpen={() => setRestaurantToOpen(null)}
  />
)}

                {active === "reservations" && <UserReservations />}   

                {active !== "profile" && active !== "search" && active !== "reservations" && (
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