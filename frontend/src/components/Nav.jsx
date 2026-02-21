import React, { useEffect, useState } from "react";
import logo from "../assets/logo.png";

export default function Nav({
  user,
  loading,
  onLogout,
  onLogin,
  onSignup,
  onOpenMobile,
  onGoSearch,
  onGoHero,
  onGoDiscover,
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

  return (
    <header className="nav">
      {/* Brand (NOT sticky) */}
      <a className="brand" href="#top" aria-label="Go to top">
        <span className="brand__mark">
          <img src={logo} className="logo-img" alt="DineSmart Logo" />
        </span>
      </a>

      {/* Pill (sticky/fixed in CSS) */}
      <div className={`nav__pill ${pillScrolled ? "nav__pill--scrolled" : ""}`}>
        <nav className="nav__links">
          <a href="#hero" onClick={(e) => { e.preventDefault(); onGoHero?.(); }}>
  About
</a>
          <a href="#discover" onClick={(e) => { e.preventDefault(); onGoDiscover?.(); }}>
  Discover
</a>
          <a href="#search" onClick={(e) => { e.preventDefault(); onGoSearch?.(); }}>
  Search
</a>
        </nav>

        <div className="nav__actions">
          {loading ? (
            <>
              <button className="btn btn--ghost" type="button" disabled>
                …
              </button>
              <button className="btn btn--gold" type="button" disabled>
                …
              </button>
            </>
          ) : user ? (
            <button className="btn btn--ghost" type="button" onClick={onLogout}>
              Log out
            </button>
          ) : (
            <>
              <button className="btn btn--ghost" type="button" onClick={onLogin}>
                Log in
              </button>
              <button className="btn btn--gold" type="button" onClick={onSignup}>
                Sign Up
              </button>
            </>
          )}
        </div>

        <button
          className="nav__burger"
          id="burger"
          type="button"
          aria-label="Open menu"
          onClick={onOpenMobile}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}