import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthModal({
  isOpen,
  mode, // "signup" | "login"
  onClose,
  onToggleMode,
}) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [accountType, setAccountType] = useState(null); // "user" | "restaurant" | null

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
      switchPrefix: "Don't have an account?",
      switchAction: "Sign up",
      showName: false,
    };
  }, [mode]);

  useEffect(() => {
    if (!isOpen) return;
    setEmail("");
    setName("");
    setPassword("");
    setError(null);
    setAccountType(null);
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
      <div className="modal__backdrop" data-close="true" onClick={onClose} />

      <div className="modal__panel" role="document">
        <button className="modal__close" aria-label="Close" type="button" onClick={onClose}>
          ✕
        </button>

        <div className="modal__header">
          <h2 className="modal__title">{copy.title}</h2>
          <p className="modal__subtitle">{copy.subtitle}</p>
        </div>

        {error && (
          <div className="error-message" style={{ color: "red", padding: "10px", margin: "10px 0" }}>
            {error}
          </div>
        )}

        {mode === "signup" && !accountType ? (
          <div className="account-type-select">
            <button
              type="button"
              className="btn btn--ghost account-btn"
              onClick={() => setAccountType("user")}
            >
              Sign up as User
            </button>

            <button
              type="button"
              className="btn btn--gold account-btn"
              onClick={() => setAccountType("restaurant")}
            >
              Sign up as Restaurant
            </button>
          </div>
        ) : (

          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setLoading(true);
              try {
                if (mode === "signup") {
                  if (!name.trim()) throw new Error("Name is required");
                  await register(name, email, password);
                } else {
                  await login(email, password);
                }
                setName("");
                setEmail("");
                setPassword("");
                onClose();
                if (mode === "signup" && accountType === "restaurant") {
                  navigate("/owner/profile");
                }
              } catch (err) {
                setError(err.message || "Authentication failed");
              } finally {
                setLoading(false);
              }
            }}
          >
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
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
                  disabled={loading}
                />
              </label>
            )}

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </label>

            <button className="btn btn--gold btn--xl" type="submit" disabled={loading}>
              {loading ? "Loading..." : copy.primary}
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            <button
              className="btn btn--google"
              type="button"
              onClick={() => alert("Google auth coming soon")}
              disabled={loading}
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
              <button className="link" type="button" onClick={onToggleMode} disabled={loading}>
                {copy.switchAction}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
