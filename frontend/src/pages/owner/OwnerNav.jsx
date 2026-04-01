import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";

export default function OwnerNav({
  active,
  onChange,
  avatarSrc,
  onLogout,
  isApproved = true,
  unseenReservationCount = 0,
}) {
  const [pillScrolled, setPillScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setPillScrolled(window.scrollY > 10);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function tabClass(tab) {
    return tab === active ? "is-active" : "";
  }

  function blockedClass() {
    if (isApproved) return "";
    return "is-disabled";
  }

  return (
    <header className="nav">
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