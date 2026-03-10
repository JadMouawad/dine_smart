import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#2b3d8a" />
      <stop offset="100%" stop-color="#1a245b" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#g)" />
  <circle cx="64" cy="48" r="23" fill="#d8deff"/>
  <path d="M24 112c5-20 20-31 40-31s35 11 40 31" fill="#d8deff"/>
</svg>`);

export default function AdminNav({
  active,
  onChange,
  onLogout,
  onOpenProfile,
  pendingFlagsCount = 0,
  avatarSrc,
  user,
}) {
  const [pillScrolled, setPillScrolled] = useState(false);
  const resolvedAvatar = avatarSrc || user?.profilePictureUrl || DEFAULT_AVATAR;

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
        <nav className="nav__links adminNavLinks">
          <a
            href="#"
            className={tabClass("dashboard")}
            onClick={(e) => {
              e.preventDefault();
              onChange("dashboard");
            }}
          >
            Dashboard
          </a>
          <a
            href="#"
            className={tabClass("pending")}
            onClick={(e) => {
              e.preventDefault();
              onChange("pending");
            }}
          >
            Pending
          </a>
          <a
            href="#"
            className={tabClass("flags")}
            onClick={(e) => {
              e.preventDefault();
              onChange("flags");
            }}
          >
            Flagged Reviews
            {pendingFlagsCount > 0 && <span className="adminNavBadge">{pendingFlagsCount}</span>}
          </a>
          <a
            href="#"
            className={tabClass("users")}
            onClick={(e) => {
              e.preventDefault();
              onChange("users");
            }}
          >
            Users
          </a>
        </nav>

        <div className="nav__actions adminNav__actions">
          <button className="btn btn--ghost" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      <button
        className="userAvatar adminNav__profileDock"
        type="button"
        aria-label="Open admin profile"
        onClick={(e) => {
          e.preventDefault();
          onOpenProfile?.();
        }}
      >
        <img className="userAvatar__img" src={resolvedAvatar} alt="Admin avatar" />
      </button>
    </header>
  );
}
