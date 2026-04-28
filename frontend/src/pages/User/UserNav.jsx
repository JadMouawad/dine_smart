import React, { useState } from "react";
import logo from "../../assets/logo.png";
import { DEFAULT_AVATAR } from "../../constants/avatar";
import useHideNavOnScroll from "../../hooks/useHideNavOnScroll";

const NAV_TABS = [
  { id: "search", label: "🔍 Search" },
  { id: "discover", label: "✨ Events" },
  { id: "explore", label: "🗺 Explore" },
  { id: "reservations", label: "📅 Reservations" },
  { id: "profile", label: "👤 Profile" },
];

export default function UserNav({
  active,
  onChange,
  onTabIntent,
  avatarSrc,
  user,
  onLogout,
  unseenEventCount = 0,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const resolvedAvatar = avatarSrc || user?.profilePictureUrl || DEFAULT_AVATAR;
  const { pillScrolled, navHidden } = useHideNavOnScroll({ disabled: mobileOpen });

  function tabClass(tab) {
    return tab === active ? "is-active" : "";
  }

  function attachTabIntent(tabId) {
    return {
      onMouseEnter: () => onTabIntent?.(tabId),
      onFocus: () => onTabIntent?.(tabId),
      onTouchStart: () => onTabIntent?.(tabId),
    };
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="userMobileMenu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          <div className="userMobileMenu__panel">
            <div className="userMobileMenu__top">
              <span className="userMobileMenu__title">Menu</span>
              <button
                className="userMobileMenu__close"
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                ✕
              </button>
            </div>

            <nav className="userMobileMenu__nav">
              {NAV_TABS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={`userMobileMenu__link${active === id ? " is-active" : ""}`}
                  {...attachTabIntent(id)}
                  onClick={() => {
                    onChange(id);
                    setMobileOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="userMobileMenu__actions">
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onLogout();
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      <header className={`nav ${navHidden ? "nav--hidden" : ""}`}>
        <a className="brand" href="#">
          <span className="brand__mark">
            <img src={logo} className="logo-img" alt="Logo" />
          </span>
        </a>

        <div className={`nav__pill ${pillScrolled ? "nav__pill--scrolled" : ""} ${navHidden ? "nav__pill--hidden" : ""}`}>
          <nav className="nav__links userNavLinks">
            <button
              type="button"
              className={tabClass("search")}
              {...attachTabIntent("search")}
              onClick={() => onChange("search")}
            >
              Search
            </button>

            <button
              type="button"
              className={tabClass("discover")}
              {...attachTabIntent("discover")}
              onClick={() => onChange("discover")}
            >
              Events
              {unseenEventCount > 0 && (
                <span className="adminNavBadge">{unseenEventCount}</span>
              )}
            </button>

            <button
              type="button"
              className={tabClass("explore")}
              {...attachTabIntent("explore")}
              onClick={() => onChange("explore")}
            >
              Explore
            </button>

            <button
              type="button"
              className={tabClass("reservations")}
              {...attachTabIntent("reservations")}
              onClick={() => onChange("reservations")}
            >
              Reservations
            </button>
          </nav>

          <div className="nav__actions userNav__actions">
            <button className="btn btn--ghost" type="button" onClick={onLogout}>
              Log out
            </button>
          </div>

          <button
            className="nav__burger"
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>

        <button
          className="userAvatar userNav__profileDock"
          type="button"
          aria-label="Open user profile"
          onClick={(e) => {
            e.preventDefault();
            onChange("profile");
          }}
        >
          <img className="userAvatar__img" src={resolvedAvatar} alt="User avatar" />
        </button>
      </header>
    </>
  );
}
