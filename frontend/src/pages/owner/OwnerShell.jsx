import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import OwnerNav from "./OwnerNav.jsx";
import OwnerProfile from "./OwnerProfile.jsx";
import OwnerMenu from "./OwnerMenu.jsx";

export default function OwnerShell() {
  const [active, setActive] = useState("profile");
  const navigate = useNavigate();
  const [restaurantLogoUrl, setRestaurantLogoUrl] = useState("");

  return (
    <div className="ownerArea">
      <OwnerNav
        active={active}
        onChange={setActive}
        avatarSrc={restaurantLogoUrl}
        onLogout={() => navigate("/")}
      />

      <main className="ownerArea__main">
        {active === "profile" && (
          <OwnerProfile onLogoPreviewChange={setRestaurantLogoUrl} />
        )}

        {active === "menu" && <OwnerMenu />}

        {active !== "profile" && active !== "menu" && (
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