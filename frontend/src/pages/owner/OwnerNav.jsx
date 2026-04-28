import React from "react";
import logo from "../../assets/logo.png";
import useHideNavOnScroll from "../../hooks/useHideNavOnScroll";

export default function OwnerNav({
  active,
  onChange,
  avatarSrc,
  onLogout,
  isApproved = true,
  unseenReservationCount = 0,
  unseenReviewCount = 0,
}) {
  const { pillScrolled, navHidden } = useHideNavOnScroll();

  function tabClass(tab) {
    return tab === active ? "is-active" : "";
  }

  function blockedClass() {
    if (isApproved) return "";
    return "is-disabled";
  }

  return (
    <header className={`nav ${navHidden ? "nav--hidden" : ""}`}>
      <a className="brand" href="#">
        <span className="brand__mark">
          <img src={logo} className="logo-img" alt="Logo" />
        </span>
      </a>

      <div className={`nav__pill ${pillScrolled ? "nav__pill--scrolled" : ""}`}>
        <nav className="nav__links">
          <a
            href="#"
            className={`${tabClass("profile")} ${blockedClass()}`}
            onClick={(e) => {
              e.preventDefault();
              onChange("profile");
            }}
          >
            Profile
          </a>

          <a
            href="#"
            className={`${tabClass("menu")} ${blockedClass()}`}
            onClick={(e) => {
              e.preventDefault();
              onChange("menu");
            }}
          >
            Menu
          </a>

          <a
            href="#"
            className={`${tabClass("table-config")} ${blockedClass()}`}
            onClick={(e) => {
              e.preventDefault();
              onChange("table-config");
            }}
          >
            Table Config
          </a>

          <a
            href="#"
            className={`${tabClass("events")} ${blockedClass()}`}
            onClick={(e) => {
              e.preventDefault();
              onChange("events");
            }}
          >
            Events
          </a>

          <a
            href="#"
            className={`${tabClass("reviews")} ${blockedClass()}`}
            onClick={(e) => {
              e.preventDefault();
              onChange("reviews");
            }}
          >
            Reviews
            {unseenReviewCount > 0 && (
              <span className="adminNavBadge">{unseenReviewCount}</span>
            )}
          </a>

          <a
            href="#"
            className={`${tabClass("reservations")} ${blockedClass()}`}
            onClick={(e) => {
              e.preventDefault();
              onChange("reservations");
            }}
          >
            Reservations
            {unseenReservationCount > 0 && (
              <span className="adminNavBadge">{unseenReservationCount}</span>
            )}
          </a>
        </nav>

        <div className="nav__actions ownerNav__actions">
          <button className="btn btn--ghost" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>

        <button className="nav__burger" type="button" aria-label="Open menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
