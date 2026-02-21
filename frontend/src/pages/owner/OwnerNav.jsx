import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";

export default function OwnerNav({ active, onChange, avatarSrc, onLogout }) {
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
            className={tabClass("profile")}
            onClick={(e) => {
              e.preventDefault();
              onChange("profile");
            }}
          >
            Profile
          </a>

          <a
            href="#"
            className={tabClass("menu")}
            onClick={(e) => {
              e.preventDefault();
              onChange("menu");
            }}
          >
            Menu
          </a>

          <a
            href="#"
            className={tabClass("reservations")}
            onClick={(e) => {
              e.preventDefault();
              onChange("reservations");
            }}
          >
            Reservations
          </a>

        </nav>

        <div className="nav__actions ownerNav__actions">
          <div className="ownerAvatar" aria-label="Restaurant logo">
            {avatarSrc ? (
              <img className="ownerAvatar__img" src={avatarSrc} alt="Restaurant logo" />
            ) : (
              <span className="ownerAvatar__fallback">R</span>
            )}
          </div>

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