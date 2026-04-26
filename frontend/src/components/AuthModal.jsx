import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useAuth } from "../auth/AuthContext";
import { phoneExists } from "../services/authService";
import ThemedSelect from "./ThemedSelect.jsx";
import { COUNTRY_OPTIONS } from "../constants/countries.js";
import PasswordStrengthMeter from "./PasswordStrengthMeter.jsx";
import { PASSWORD_MIN_LENGTH, evaluatePasswordStrength, getPasswordValidationMessage } from "../utils/passwordStrength.js";

export default function AuthModal({
  isOpen,
  mode,
  onClose,
  onToggleMode,
  forceRole = null,
}) {
  const { login, register, googleLogin } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(COUNTRY_OPTIONS[0].code);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupLocation, setSignupLocation] = useState({ latitude: null, longitude: null });
  const [locatingUser, setLocatingUser] = useState(false);
  const [locationChoice, setLocationChoice] = useState("");
  const [signupSubscribed, setSignupSubscribed] = useState(false);
  const [signupPreferences, setSignupPreferences] = useState([]);

  const [accountType, setAccountType] = useState(null);
  const [adminSignupKey, setAdminSignupKey] = useState("");
  const [signupSuccess, setSignupSuccess] = useState(false);

  const isRestaurantSignup = mode === "signup" && (forceRole === "owner" || accountType === "restaurant");
  const passwordStrength = useMemo(() => evaluatePasswordStrength(password), [password]);

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
    setLocationChoice("");
    setSignupSubscribed(false);
    setSignupPreferences([]);
    setError(null);
    setAccountType(forceRole === "admin" ? "admin" : null);
    setAdminSignupKey("");
    setSignupSuccess(false);
  }, [isOpen, mode, forceRole]);

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
      const role = forceRole || (accountType === "restaurant" ? "owner" : "user");
      const data = await googleLogin(credentialResponse.credential, role);
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
      setError("");
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
      setError("Unable to fetch your location. You can continue without it.");
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (geoError) => onFailure(geoError, false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal is-open" id="modal" aria-hidden="false" role="dialog" aria-modal="true">
      <div className="modal__backdrop" data-close="true" onClick={onClose} />

      <motion.div
        className="modal__panel"
        role="document"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      >
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
        ) : mode === "signup" && !accountType && !forceRole ? (
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
                  const role = forceRole || (accountType === "restaurant" ? "owner" : "user");
                  const isAdminSignup = role === "admin";
                  if (!isAdminSignup) {
                    if (!normalizedPhone) throw new Error("Phone number is required");
                    if (normalizedPhone.length < 7) throw new Error("Please enter a valid phone number");
                  }
                  if (!passwordStrength.isStrong) {
                    throw new Error(getPasswordValidationMessage());
                  }
                  if (password !== confirmPassword) {
                    throw new Error("Password and confirm password do not match");
                  }

                  const fullPhone = isAdminSignup ? "" : `${countryCode}${normalizedPhone}`;
                  if (!isAdminSignup) {
                    const exists = await phoneExists(fullPhone);
                    if (exists?.exists) {
                      throw new Error("This phone number is already registered.");
                    }
                  }

                  const data = await register(name, email, password, role, {
                    latitude: signupLocation.latitude,
                    longitude: signupLocation.longitude,
                    phone: fullPhone,
                    adminSignupKey,
                    isSubscribed: role === "user" ? signupSubscribed : undefined,
                    subscriptionPreferences: role === "user" ? signupPreferences : undefined,
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
                  else if (userRole === "owner") {
                    const onboarding = localStorage.getItem("owner_onboarding") === "1";
                    navigate(onboarding ? "/owner/profile?onboarding=1" : "/owner/profile");
                  }
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
              <>
                {forceRole === "admin" && (
                  <label className="field">
                    <span>Admin access key</span>
                    <input
                      type="password"
                      placeholder="Enter admin access key"
                      value={adminSignupKey}
                      onChange={(event) => setAdminSignupKey(event.target.value)}
                      required
                      disabled={loading}
                    />
                  </label>
                )}
              </>
            )}

            {mode === "signup" && forceRole !== "admin" && (
              <label className="field">
                <span>Phone number</span>
                <div className="phoneRow">
                  <ThemedSelect
                    className="phoneRow__codeDropdown"
                    buttonClassName="phoneRow__codeDropdownBtn"
                    menuClassName="phoneRow__codeDropdownMenu"
                    value={countryCode}
                    onChange={setCountryCode}
                    disabled={loading}
                    options={COUNTRY_OPTIONS.map((country) => ({
                      value: country.code,
                      label: `${country.label} ${country.code}`,
                      searchText: `${country.label} ${country.code} ${country.iso}`,
                      buttonLabel: (
                        <span className="phoneCountryButton">
                          <img className="phoneCountryButton__flag" src={country.flagIconUrl} alt="" aria-hidden="true" />
                          <span className="phoneCountryButton__code">{country.code}</span>
                        </span>
                      ),
                      menuLabel: (
                        <span className="phoneCountryOption">
                          <img className="phoneCountryOption__flag" src={country.flagIconUrl} alt="" aria-hidden="true" />
                          <span>{country.label} {country.code}</span>
                        </span>
                      ),
                    }))}
                    fullWidth={false}
                    ariaLabel="Select country code"
                    searchable
                    searchPlaceholder="Search country"
                    minMenuWidth="240px"
                  />
                  <input
                    className="phoneRow__number"
                    type="tel"
                    placeholder="Phone number"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                    required
                    disabled={loading}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </div>
              </label>
            )}

            <label className="field">
              <span>Password</span>
              <div className="passwordFieldWrap">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
                  minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
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
              {mode === "signup" && (
                <PasswordStrengthMeter password={password} hideWhenEmpty />
              )}
            </label>

            {mode === "signup" && (
              <label className="field">
                <span>Confirm password</span>
                <div className="passwordFieldWrap">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    minLength={PASSWORD_MIN_LENGTH}
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

            {mode === "signup" && forceRole !== "admin" && !isRestaurantSignup && (
              <div className="locationChoiceGroup" aria-label="Location preference">
                <div className="locationChoiceRow">
                  <div className="locationChoiceRow__label">
                    {locatingUser && locationChoice === "current" ? "Getting location..." : "Use My Current Location"}
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={locationChoice === "current"}
                      onChange={() => {
                        const next = locationChoice === "current" ? "" : "current";
                        setLocationChoice(next);
                        if (next === "current") {
                          fetchCurrentLocation();
                        } else {
                          setSignupLocation({ latitude: null, longitude: null });
                          setError("");
                        }
                      }}
                      disabled={loading || locatingUser}
                      aria-label="Use my current location"
                    />
                    <span className="switch__track">
                      <span className="switch__thumb" />
                    </span>
                  </label>
                </div>

                {signupLocation.latitude != null && signupLocation.longitude != null && (
                  <div className="modal__hint" aria-live="polite">
                    Location captured.
                  </div>
                )}
              </div>
            )}

            {mode === "signup" && !isRestaurantSignup && (
              <section className="updatesSubscription">
                <div className="updatesSubscription__header">
                  <div>
                    <div className="updatesSubscription__title">Updates Subscription</div>
                    <p className="updatesSubscription__desc">
                      Choose what you want to receive from DineSmart.
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={signupSubscribed}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked && signupPreferences.length === 0) {
                          toast.error("Please choose at least one update option before enabling subscription.");
                          return;
                        }
                        setSignupSubscribed(checked);
                        if (!checked) setSignupPreferences([]);
                      }}
                      aria-label={signupSubscribed ? "Subscription on" : "Subscription off"}
                    />
                    <span className="switch__track">
                      <span className="switch__thumb" />
                    </span>
                  </label>
                </div>

                <div className="updatesPrefs">
                  <div className="updatesPrefs__grid">
                    {["news", "offers", "events"].map((key) => (
                      <label
                        key={key}
                        className={`prefChip${signupPreferences.includes(key) ? " prefChip--active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={signupPreferences.includes(key)}
                          onChange={() => {
                            setSignupPreferences((prev) => {
                              const next = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key];
                              setSignupSubscribed(next.length > 0);
                              return next;
                            });
                          }}
                          disabled={loading}
                        />
                        <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <button className="btn btn--gold btn--xl" type="submit" disabled={loading}>
              {loading ? "Loading..." : copy.primary}
            </button>

            {forceRole !== "admin" && (
              <>
                <div className="divider">
                  <span>or</span>
                </div>

                <div className="modal__googleWrap">
                  <div className="modal__googleButtonShell">
                    <div className="modal__googleButtonFace" aria-hidden="true">
                      <svg className="modal__googleButtonIcon" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span>{mode === "login" ? "Sign in with Google" : "Sign up with Google"}</span>
                    </div>
                    <div className="modal__googleButtonNative">
                      <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        text="signup_with"
                        shape="pill"
                        theme="outline"
                        size="large"
                        width="360"
                        locale="en"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <p className="fineprint">
              {copy.switchPrefix}{" "}
              <button className="link" type="button" onClick={onToggleMode} disabled={loading}>
                {copy.switchAction}
              </button>
            </p>
            {mode === "login" && (
              <p className="fineprint">
                <button
                  className="link"
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate("/reset-password");
                  }}
                  disabled={loading}
                >
                  Forgot your password?
                </button>
              </p>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}
