import React, { useEffect, useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AuthModal({
  isOpen,
  mode, // "signup" | "login"
  onClose,
  onToggleMode,
}) {
  const { login, register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [accountType, setAccountType] = useState(null); // "user" | "restaurant" | null
  const [signupSuccess, setSignupSuccess] = useState(false); // show "check your email" after non-Google signup

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
    setSignupSuccess(false);
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

  const handleGoogleSuccess = async (credentialResponse) => {
    setError(null);
    setLoading(true);
    try {
      const data = await googleLogin(credentialResponse.credential);
      const userRole = data?.user?.role;
      onClose();
      if (userRole === "admin") navigate("/admin/dashboard");
      else if (userRole === "owner") navigate("/owner/profile");
      else navigate("/user/profile");
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign-in was cancelled or failed. Please try again.");
  };

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
          <div className="modal__error" role="alert">
            {error}
          </div>
        )}

        {signupSuccess ? (
          <div className="modal__success" data-testid="signup-verification-message">
            <div className="modal__successIcon" aria-hidden="true">✓</div>
            <h3 className="modal__successTitle">Check your email</h3>
            <p className="modal__successText">
              We sent a verification link to your email. Click the link to verify your account, then you can log in.
            </p>
            <button type="button" className="btn btn--gold btn--xl" onClick={onClose}>
              Got it
            </button>
          </div>
        ) : mode === "signup" && !accountType ? (
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
                  const role = accountType === "restaurant" ? "owner" : "user";
                  const data = await register(name, email, password, role);
                  // Backend sends verification email and returns message (no token until verified)
                  if (data?.message && !data?.token) {
                    setSignupSuccess(true);
                    setName("");
                    setEmail("");
                    setPassword("");
                    return;
                  }
                  setName("");
                  setEmail("");
                  setPassword("");
                  onClose();
                } else {
                  const data = await login(email, password);
                  const userRole = data?.user?.role;
                  setName(""); setEmail(""); setPassword("");
                  onClose();
                  if (userRole === "admin") navigate("/admin/dashboard");
                  else if (userRole === "owner") navigate("/owner/profile");
                  else navigate("/user/profile");
                  return;
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

            <div className="modal__googleWrap">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                text={mode === "signup" ? "signup_with" : "signin_with"}
                shape="pill"
                theme="outline"
                size="large"
                width="360"
                locale="en"
              />
            </div>

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
