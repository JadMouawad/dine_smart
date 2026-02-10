import React from "react";

export default function MobileMenu({
  isOpen,
  onClose,
  onLogin,
  onSignup,
}) {
  return (
    <div
      className={`mobileMenu ${isOpen ? "is-open" : ""}`}
      id="mobileMenu"
      aria-hidden={!isOpen}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mobileMenu__panel">
        <div className="mobileMenu__top">
          <span className="mobileMenu__title">Menu</span>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <a href="#about" className="mobileMenu__link" onClick={onClose}>
          About
        </a>
        <a href="#discover" className="mobileMenu__link" onClick={onClose}>
          Discover
        </a>
        <a href="#map" className="mobileMenu__link" onClick={onClose}>
          Map
        </a>

        <div className="mobileMenu__actions">
          <button className="btn btn--ghost" type="button" onClick={onLogin}>
            Log in
          </button>
          <button className="btn btn--gold" type="button" onClick={onSignup}>
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}
