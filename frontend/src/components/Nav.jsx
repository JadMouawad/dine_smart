import React, { useEffect, useState } from "react";
import logo from "../assets/logo.png";

export default function Nav({ onLogin, onSignup, onOpenMobile }) {
  const [pillScrolled, setPillScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setPillScrolled(window.scrollY > 10);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="nav">
      <a className="brand" href="#">
        <span className="brand__mark">
          <img src={logo} className="logo-img" alt="Logo" />

        </span>
      </a>

      <div className={`nav__pill ${pillScrolled ? "nav__pill--scrolled" : ""}`}>
        <nav className="nav__links">
          <a href="#about">About</a>
          <a href="#discover">Discover</a>
          <a href="#map">Map</a>
        </nav>

        <div className="nav__actions">
          <button className="btn btn--ghost" type="button" onClick={onLogin}>
            Log in
          </button>
          <button className="btn btn--gold" type="button" onClick={onSignup}>
            Sign Up
          </button>
        </div>

        {/* burger only visible on mobile via CSS */}
        <button className="nav__burger" id="burger" type="button" aria-label="Open menu" onClick={onOpenMobile}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
