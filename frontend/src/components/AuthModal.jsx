import React, { useEffect, useMemo, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../auth/AuthContext";

export default function AuthModal({
  isOpen,
  mode,
  onClose,
  onToggleMode,
}) {
  const { login, register, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupLocation, setSignupLocation] = useState({ latitude: null, longitude: null });
  const [locatingUser, setLocatingUser] = useState(false);

  const [accountType, setAccountType] = useState(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

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
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSignupLocation({ latitude: null, longitude: null });
    setLocatingUser(false);
    setError(null);
    setAccountType(null);
    setSignupSuccess(false);
  }, [isOpen, mode]);

  useEffect(() => {
    function onKeyDown(event) {
      if (!isOpen) return;
      if (event.key === "Escape") onClose();
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

  const fetchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device.");
      return;
    }

    const isSecureContextOk =
      window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

    if (!isSecureContextOk) {
      setError("Location access requires HTTPS (or localhost). Open the site over HTTPS, then try again.");
      return;
    }

    setLocatingUser(true);
    setError(null);

    const onSuccess = (position) => {
      setSignupLocation({
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
      });
      setError("Location added successfully.");
      setLocatingUser(false);
    };

    const onFailure = (geoError, hasRetried = false) => {
      if (!hasRetried) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (retryError) => onFailure(retryError, true),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 600000 }
        );
        return;
      }

      setLocatingUser(false);
      if (geoError?.code === 1) {
        setError("Location permission was denied. Allow location for this site in browser settings, then press Use My Current Location again.");
        return;
      }
      if (geoError?.code === 2) {
        setError("Could not determine your location. Please check GPS/network and try again.");
        return;
      }
      if (geoError?.code === 3) {
        setError("Location request timed out. Please try again or enter coordinates manually.");
        return;
      }
      setError("Unable to fetch your location. You can continue without location.");
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (geoError) => onFailure(geoError, false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const continueWithoutLocation = () => {
    setSignupLocation({ latitude: null, longitude: null });
    setError("Continuing without location. Explore map will default to Beirut.");
  };

  if (!isOpen) return null;

  return (
    <div className="modal is-open" id="modal" aria-hidden="false" role="dialog" aria-modal="true">
      <div className="modal__backdrop" data-close="true" onClick={onClose} />

      <div className="modal__panel" role="document">
        <button className="modal__close" aria-label="Close" type="button" onClick={onClose}>
          X
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
            <div className="modal__successIcon" aria-hidden="true">OK</div>
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
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              setLoading(true);

              try {
                if (mode === "signup") {
                  if (!name.trim()) throw new Error("Name is required");

                  const normalizedPhone = String(phone || "").replace(/\D/g, "");
                  if (!normalizedPhone) throw new Error("Phone number is required");
                  if (normalizedPhone.length < 7) throw new Error("Please enter a valid phone number");

                  if (password !== confirmPassword) {
                    throw new Error("Password and confirm password do not match");
                  }

                  const role = accountType === "restaurant" ? "owner" : "user";
                  const data = await register(name, email, password, role, {
                    latitude: signupLocation.latitude,
                    longitude: signupLocation.longitude,
                    phone: normalizedPhone,
                  });

                  if (data?.message && !data?.token) {
                    setSignupSuccess(true);
                    setName("");
                    setEmail("");
                    setPhone("");
                    setPassword("");
                    setConfirmPassword("");
                    setSignupLocation({ latitude: null, longitude: null });
                    return;
                  }

                  setName("");
                  setEmail("");
                  setPhone("");
                  setPassword("");
                  setConfirmPassword("");
                  setSignupLocation({ latitude: null, longitude: null });
                  onClose();
                } else {
                  const data = await login(email, password);
                  const userRole = data?.user?.role;
                  setName("");
                  setEmail("");
                  setPassword("");
                  onClose();

                  if (userRole === "admin") navigate("/admin/dashboard");
                  else if (userRole === "owner") navigate("/owner/profile");
                  else navigate("/user/profile");
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
                onChange={(event) => setEmail(event.target.value)}
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
                  onChange={(event) => setName(event.target.value)}
                  disabled={loading}
                />
              </label>
            )}

            {mode === "signup" && (
              <label className="field">
                <span>Phone number</span>
                <input
                  type="tel"
                  placeholder="e.g. 03123456"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                  disabled={loading}
                />
              </label>
            )}

            <label className="field">
              <span>Password</span>
              <div className="passwordFieldWrap">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="passwordToggleBtn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </label>

            {mode === "signup" && (
              <label className="field">
                <span>Confirm password</span>
                <div className="passwordFieldWrap">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="passwordToggleBtn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>
            )}

            {mode === "signup" && (
              <>
                <button
                  type="button"
                  className="btn btn--ghost btn--xl"
                  onClick={fetchCurrentLocation}
                  disabled={loading || locatingUser}
                >
                  {locatingUser ? "Getting location..." : "Use My Current Location"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--xl"
                  onClick={continueWithoutLocation}
                  disabled={loading || locatingUser}
                >
                  Continue Without Location
                </button>
                {signupLocation.latitude != null && signupLocation.longitude != null && (
                  <div className="modal__hint" aria-live="polite">
                    Location captured.
                  </div>
                )}
              </>
            )}

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