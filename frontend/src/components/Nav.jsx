import React from "react";
import logo from "../assets/logo.png";
import { useTheme } from "../auth/ThemeContext.jsx";
import useHideNavOnScroll from "../hooks/useHideNavOnScroll.js";

export default function Nav({
  user,
  loading,
  onLogout,
  onLogin,
  onSignup,
  onOpenMobile,
  onCloseMobile,
  isMobileOpen = false,
  onGoSearch,
  onGoHero,
  onGoDiscover,
  onGoContact,
}) {
  const { theme, toggleTheme } = useTheme();
  const { pillScrolled, navHidden } = useHideNavOnScroll({ disabled: isMobileOpen });

  return (
    <header className={`nav ${navHidden ? "nav--hidden" : ""}`}>
      <a className="brand" href="#top" aria-label="Go to top">
        <span className="brand__mark">
          <img src={logo} className="logo-img" alt="DineSmart Logo" />
        </span>
      </a>

      <div className={`nav__pill ${pillScrolled ? "nav__pill--scrolled" : ""} ${navHidden ? "nav__pill--hidden" : ""}`}>
        <nav className="nav__links">
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              onGoHero?.();
            }}
          >
            About
          </a>

          <a
            href="#discover"
            onClick={(e) => {
              e.preventDefault();
              onGoDiscover?.();
            }}
          >
            Discover
          </a>

          <a
            href="#search"
            onClick={(e) => {
              e.preventDefault();
              onGoSearch?.();
            }}
          >
            Search
          </a>

          <a
            href="#contact"
            onClick={(e) => {
              e.preventDefault();
              onGoContact?.();
            }}
          >
            Contact Us
          </a>
        </nav>

        <div className="nav__actions">
          <button
            className="themeToggleBtn"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

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
          className={`nav__burger${isMobileOpen ? " is-open" : ""}`}
          id="burger"
          type="button"
          aria-label={isMobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileOpen}
          onClick={isMobileOpen ? onCloseMobile : onOpenMobile}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
}
