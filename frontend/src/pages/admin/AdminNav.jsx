import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";

export default function AdminNav({ active, onChange, onLogout, pendingFlagsCount = 0 }) {
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
          <span className="adminAvatar" aria-hidden="true">A</span>
          <button className="btn btn--ghost" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

