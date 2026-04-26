import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { requestPasswordReset, resetPassword } from "../services/authService.js";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter.jsx";
import { PASSWORD_MIN_LENGTH, evaluatePasswordStrength, getPasswordValidationMessage } from "../utils/passwordStrength.js";

function useQuery() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

export default function ResetPasswordPage() {
  const query = useQuery();
  const navigate = useNavigate();
  const token = String(query.get("token") || "").trim();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);

  async function handleRequest(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result?.message || "If an account with that email exists, a reset link has been sent.");
    } catch (requestError) {
      setError(requestError.message || "Failed to request a password reset.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    if (!passwordStrength.isStrong) {
      setError(getPasswordValidationMessage());
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const result = await resetPassword({ token, password });
      setMessage(result?.message || "Password reset successful.");
      window.setTimeout(() => navigate("/"), 1200);
    } catch (resetError) {
      setError(resetError.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="resetPasswordPage">
      <section className="resetPasswordCard">
        <h1 className="resetPasswordCard__title">{token ? "Set a new password" : "Reset your password"}</h1>
        <p className="resetPasswordCard__subtitle">
          {token
            ? "Choose a new password for your DineSmart account."
            : "Enter your email and we'll send you a reset link."}
        </p>

        {message && <div className="inlineToast inlineToast--success">{message}</div>}
        {error && <div className="fieldError">{error}</div>}

        {token ? (
          <form className="form" onSubmit={handleReset}>
            <label className="field">
              <span>New password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                required
              />
              <PasswordStrengthMeter password={password} hideWhenEmpty />
            </label>
            <label className="field">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={PASSWORD_MIN_LENGTH}
                required
              />
            </label>
            <button className="btn btn--gold btn--xl" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Reset Password"}
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={handleRequest}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <button className="btn btn--gold btn--xl" type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <button className="btn btn--ghost resetPasswordCard__back" type="button" onClick={() => navigate("/")}>
          Back to home
        </button>
      </section>
    </main>
  );
}
