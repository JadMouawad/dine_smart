import React, { useEffect, useMemo } from "react";

export default function AuthModal({
  isOpen,
  mode, // "signup" | "login"
  onClose,
  onToggleMode,
  onSubmit,
}) {
  const copy = useMemo(() => {
    if (mode === "signup") {
      return {
        title: "Sign up",
        subtitle: "Sign up to explore restaurants and access special features",
        primary: "Create account",
        switchPrefix: "Already have an account?",
        switchAction: "Log in",
        showName: true,
      };
    }
    return {
      title: "Log in",
      subtitle: "Log in to explore restaurants and access special features",
      primary: "Log in",
      switchPrefix: "Don’t have an account?",
      switchAction: "Sign up",
      showName: false,
    };
  }, [mode]);

  useEffect(() => {
    function onKeyDown(e) {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.classList.add("modal-open");
    else document.body.classList.remove("modal-open");
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal is-open" id="modal" aria-hidden="false" role="dialog" aria-modal="true">
      <div className="modal__backdrop" data-close="true" onClick={onClose} />
      <div className="modal__panel" role="document">
        <button className="modal__close" aria-label="Close" type="button" onClick={onClose}>
          ✕
        </button>

        <div className="modal__header">
          <h2 className="modal__title">{copy.title}</h2>
          <p className="modal__subtitle">{copy.subtitle}</p>
        </div>

        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(mode);
          }}
        >
          <label className="field">
            <span>Email</span>
            <input type="email" placeholder="you@example.com" required />
          </label>

          {copy.showName && (
            <label className="field" id="nameField">
              <span>Full name</span>
              <input type="text" placeholder="Your name" />
            </label>
          )}

          <label className="field">
            <span>Password</span>
            <input type="password" placeholder="••••••••" minLength={6} required />
          </label>

          <button className="btn btn--gold btn--xl" type="submit">
            {copy.primary}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button
            className="btn btn--google"
            type="button"
            onClick={() => alert("Google auth (demo)")}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
              className="google-icon"
              alt="Google logo"
            />
            Continue with Google
          </button>

          <p className="fineprint">
            {copy.switchPrefix}{" "}
            <button className="link" type="button" onClick={onToggleMode}>
              {copy.switchAction}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
