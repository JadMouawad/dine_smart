import React from "react";

export default function MobileMenu({
  isOpen,
  onClose,
  onLogin,
  onSignup,
  onGoHero,
  onGoDiscover,
  onGoSearch,
  onGoContact,
}) {
  function handleClick(action) {
    onClose();
    window.setTimeout(() => {
      action?.();
    }, 10);
  }

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

        <button
          type="button"
          className="mobileMenu__link"
          onClick={() => handleClick(onGoHero)}
        >
          About
        </button>

        <button
          type="button"
          className="mobileMenu__link"
          onClick={() => handleClick(onGoDiscover)}
        >
          Discover
        </button>

        <button
          type="button"
          className="mobileMenu__link"
          onClick={() => handleClick(onGoSearch)}
        >
          Search
        </button>

        <button
          type="button"
          className="mobileMenu__link"
          onClick={() => handleClick(onGoContact)}
        >
          Contact Us
        </button>

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