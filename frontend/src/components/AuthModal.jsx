import React, { useEffect, useMemo, useState } from "react";
//random comment
//force 

export default function AuthModal({
  isOpen,
  mode, // "signup" | "login"
  onClose,
  onToggleMode,
  onSubmit, // expects onSubmit({ email, password, name? })
  error, // optional string from App.jsx
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

  // Local form state (so we can pass values to App/AuthContext)
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  // Reset fields when opening / switching mode (matches expected UX)
  useEffect(() => {
    if (!isOpen) return;
    setEmail("");
    setName("");
    setPassword("");
  }, [isOpen, mode]);

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
      {/* Backdrop click closes (same behavior as original) */}
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
            onSubmit?.({
              email,
              password,
              name: copy.showName ? name : undefined,
            });
          }}
        >
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          {copy.showName && (
            <label className="field" id="nameField">
              <span>Full name</span>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              placeholder="••••••••"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {/* Optional error display (won’t affect layout much; uses existing styling) */}
          {error ? (
            <p className="fineprint" style={{ color: "rgba(255,255,255,0.9)" }}>
              {error}
            </p>
          ) : null}

          <button className="btn btn--gold btn--xl" type="submit">
            {copy.primary}
          </button>

          <div className="divider">
            <span>or</span>
          </div>

          <button className="btn btn--google" type="button" onClick={() => alert("Google auth (demo)")}>
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