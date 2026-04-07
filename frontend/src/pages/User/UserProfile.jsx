import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getProfile, updateProfile } from "../../services/profileService.js";
import { getFavorites } from "../../services/favoriteService.js";
import { getSearchHistory, clearSearchHistory } from "../../services/recentSearchService.js";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useTheme } from "../../auth/ThemeContext.jsx";
import { COUNTRY_OPTIONS, splitPhoneNumber } from "../../constants/countries.js";

import { FILLED_STAR, EMPTY_STAR } from "../../constants/filters";
import { DEFAULT_AVATAR } from "../../constants/avatar";
import ThemedSelect from "../../components/ThemedSelect.jsx";

export default function UserProfile({ onAvatarPreviewChange, onOpenRestaurant }) {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [favorites, setFavorites] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+961");
  const [accountProvider, setAccountProvider] = useState(() => String(user?.provider || "local").toLowerCase());
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [reservationCount, setReservationCount] = useState(0);
  const [loyaltyBadge, setLoyaltyBadge] = useState("Newcomer");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionPreferences, setSubscriptionPreferences] = useState([]);
  const [subscriptionSnapshot, setSubscriptionSnapshot] = useState({ isSubscribed: false, preferences: [] });
  const [profileSnapshot, setProfileSnapshot] = useState({
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+961",
    profilePictureUrl: "",
    savedLocation: { latitude: null, longitude: null },
    isSubscribed: false,
    subscriptionPreferences: [],
  });
  const [savedLocation, setSavedLocation] = useState({ latitude: null, longitude: null });
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | detecting | granted | denied
  const [profileLoading, setProfileLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Load favorites from server
  useEffect(() => {
    if (!user?.id) return;
    getFavorites()
      .then((data) => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => setFavorites([]));
  }, [user?.id]);

  // Load search history
  useEffect(() => {
    if (!user?.id) return;
    getSearchHistory()
      .then((data) => setSearchHistory(Array.isArray(data) ? data : []))
      .catch(() => setSearchHistory([]));
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setProfileLoading(true);
    getProfile()
      .then((profile) => {
        setFullName(profile.fullName ?? profile.full_name ?? user.name ?? user.fullName ?? "");
        setEmail(profile.email ?? user.email ?? "");
        const phoneParts = splitPhoneNumber(profile.phone ?? "");
        setCountryCode(phoneParts.countryCode);
        setPhone(phoneParts.localNumber);
        setAccountProvider(String(profile.provider ?? user.provider ?? "local").toLowerCase());
        setProfilePictureUrl(profile.profilePictureUrl ?? profile.profile_picture_url ?? "");
        const lat = parseFloat(profile.latitude ?? user?.latitude);
        const lng = parseFloat(profile.longitude ?? user?.longitude);
        const locationSnapshot = Number.isFinite(lat) && Number.isFinite(lng)
          ? { latitude: lat, longitude: lng }
          : { latitude: null, longitude: null };
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setSavedLocation({ latitude: lat, longitude: lng });
        }
        setReservationCount(Number(profile.reservationCount ?? 0));
        setLoyaltyBadge(profile.loyaltyBadge ?? "Newcomer");
        const prefArray = Array.isArray(profile.subscriptionPreferences) ? profile.subscriptionPreferences : [];
        setIsSubscribed(Boolean(profile.isSubscribed));
        setSubscriptionPreferences(prefArray);
        setSubscriptionSnapshot({ isSubscribed: Boolean(profile.isSubscribed), preferences: prefArray });
        setProfileSnapshot({
          fullName: profile.fullName ?? profile.full_name ?? user.name ?? user.fullName ?? "",
          email: profile.email ?? user.email ?? "",
          phone: phoneParts.localNumber,
          countryCode: phoneParts.countryCode,
          profilePictureUrl: profile.profilePictureUrl ?? profile.profile_picture_url ?? "",
          savedLocation: locationSnapshot,
          isSubscribed: Boolean(profile.isSubscribed),
          subscriptionPreferences: prefArray,
        });
        setMyReviews(
          Array.isArray(profile.myReviews)
            ? profile.myReviews.map((review) => ({
                id: review.id,
                restaurantId: review.restaurantId ?? review.restaurant_id,
                restaurantName: review.restaurantName ?? review.restaurant_name ?? "Restaurant",
                stars: Number(review.stars ?? review.rating ?? 0),
                text: review.text ?? review.comment ?? "",
                createdAt: review.createdAt ?? review.created_at,
              }))
            : []
        );
      })
      .catch(() => {
        setFullName(user.name ?? user.fullName ?? "");
        setEmail(user.email ?? "");
        setAccountProvider(String(user.provider ?? "local").toLowerCase());
        setMyReviews([]);
        setProfilePictureUrl("");
        setIsSubscribed(false);
        setSubscriptionPreferences([]);
        setSubscriptionSnapshot({ isSubscribed: false, preferences: [] });
        setProfileSnapshot({
          fullName: user.name ?? user.fullName ?? "",
          email: user.email ?? "",
          phone: "",
          countryCode: "+961",
          profilePictureUrl: "",
          savedLocation: { latitude: null, longitude: null },
          isSubscribed: false,
          subscriptionPreferences: [],
        });
      })
      .finally(() => setProfileLoading(false));
  }, [user?.id]);

  const isGoogleAccount = accountProvider === "google";

  const avatarSrc = useMemo(() => {
    return profilePictureDataUrl || profilePictureUrl || DEFAULT_AVATAR;
  }, [profilePictureDataUrl, profilePictureUrl]);

  useEffect(() => {
    if (!onAvatarPreviewChange) return;
    onAvatarPreviewChange(avatarSrc);
  }, [avatarSrc, onAvatarPreviewChange]);

  function handleDetectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSavedLocation({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
        setLocationStatus("granted");
      },
      () => setLocationStatus("denied"),
      { timeout: 8000 }
    );
  }

  function onPickProfile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const isImage = file.type && file.type.startsWith("image/");
    if (!isImage) {
      alert("Please select an image file (PNG, JPG, JPEG).");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfilePictureDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!isEditing) {
      setIsEditing(true);
      return;
    }
    if (!isGoogleAccount && newPassword.trim()) {
      if (!confirmNewPassword.trim()) {
        toast.error("Please confirm your new password.");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        toast.error("New password and confirm password do not match.");
        return;
      }
    }

    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() ? `${countryCode}${phone.trim()}` : "",
      profilePictureUrl: profilePictureDataUrl || profilePictureUrl || "",
      isSubscribed,
      subscriptionPreferences,
    };
    if (!isGoogleAccount && newPassword.trim()) payload.password = newPassword.trim();
    if (savedLocation.latitude != null && savedLocation.longitude != null) {
      payload.latitude = savedLocation.latitude;
      payload.longitude = savedLocation.longitude;
    }
    try {
      const updated = await updateProfile(payload);
      const savedAvatar = updated?.profilePictureUrl ?? payload.profilePictureUrl;
      setProfilePictureUrl(savedAvatar);
      setProfilePictureDataUrl("");
      if (subscriptionSnapshot.isSubscribed !== isSubscribed) {
        toast.success(isSubscribed ? "You have successfully subscribed to updates." : "You have unsubscribed from updates.");
      } else {
        toast.success("Profile saved successfully.");
      }
      setSubscriptionSnapshot({ isSubscribed, preferences: subscriptionPreferences });
      setProfileSnapshot({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        countryCode,
        profilePictureUrl: savedAvatar,
        savedLocation:
          savedLocation.latitude != null && savedLocation.longitude != null
            ? { latitude: savedLocation.latitude, longitude: savedLocation.longitude }
            : { latitude: null, longitude: null },
        isSubscribed,
        subscriptionPreferences,
      });
      setNewPassword("");
      setConfirmNewPassword("");
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
      setIsEditing(false);
      // Refresh user in context so Explore page picks up new coords
      refreshUser?.();
    } catch (err) {
      toast.error(err.message || "Failed to save profile.");
    }
  }

  const subscriptionOptions = [
    { key: "news", label: "News" },
    { key: "offers", label: "Offers" },
    { key: "events", label: "Events" },
  ];

  function toggleSubscriptionPreference(key) {
    setSubscriptionPreferences((prev) => {
      const next = prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key];
      setIsSubscribed(next.length > 0);
      return next;
    });
  }

  function handleCancelEdit() {
    setFullName(profileSnapshot.fullName);
    setEmail(profileSnapshot.email);
    setPhone(profileSnapshot.phone);
    setCountryCode(profileSnapshot.countryCode);
    setProfilePictureUrl(profileSnapshot.profilePictureUrl);
    setProfilePictureDataUrl("");
    setSavedLocation(profileSnapshot.savedLocation);
    setIsSubscribed(profileSnapshot.isSubscribed);
    setSubscriptionPreferences(profileSnapshot.subscriptionPreferences);
    setSubscriptionSnapshot({
      isSubscribed: profileSnapshot.isSubscribed,
      preferences: profileSnapshot.subscriptionPreferences,
    });
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setIsEditing(false);
    setLocationStatus("idle");
  }

  if (profileLoading) {
    return (
      <div className="userProfile">
        <p style={{ padding: "20px", color: "#888" }}>Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="userProfile">
      <section className="userProfileHero">
        <img className="userProfileHero__avatar" src={avatarSrc} alt="Profile avatar" />
        <div className="userProfileHero__content">
          <h1 className="userProfileHero__name">{fullName || "Your Profile"}</h1>
          <p className="userProfileHero__email">{email}</p>
          <div className="userProfileHero__meta">
            <span className="metaPill">Badge: {loyaltyBadge}</span>
            <span className="metaPill">Reservations: {reservationCount}</span>
          </div>
        </div>
        <label className="btn btn--gold userProfileHero__uploadBtn">
          Upload picture
          <input
            className="imageCard__input"
            type="file"
            accept="image/png, image/jpeg"
            onChange={onPickProfile}
            disabled={!isEditing}
          />
        </label>
      </section>

      <div className="userProfileLayout">
        <form className="formCard formCard--userProfile userProfileFormCard" onSubmit={onSubmit}>
          <div className="formCard__title">Account Settings</div>

          <label className="field">
            <span>Full Name</span>
            <input
              type="text"
              placeholder="Enter full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={!isEditing}
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!isEditing}
            />
          </label>

          <label className="field">
            <span>Phone number</span>
            <div className="phoneRow">
              <ThemedSelect
                className="phoneRow__codeDropdown"
                buttonClassName="phoneRow__codeDropdownBtn"
                menuClassName="phoneRow__codeDropdownMenu"
                value={countryCode}
                onChange={setCountryCode}
                disabled={!isEditing}
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
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                disabled={!isEditing}
              />
            </div>
          </label>

          {/* Location */}
          <div className="field">
            <span>Location</span>
            <p className="userProfileFormHint">
              Saved location helps find nearby restaurants on the Explore page.
            </p>
            {savedLocation.latitude != null && savedLocation.longitude != null ? (
              <p className="userProfileFormHint" style={{ color: "rgba(201,162,39,0.9)", marginTop: 2 }}>
                ✓ Location set ({savedLocation.latitude.toFixed(4)}, {savedLocation.longitude.toFixed(4)})
              </p>
            ) : (
              <p className="userProfileFormHint" style={{ marginTop: 2 }}>No location saved yet.</p>
            )}

            <div className="userProfileLocationToggle">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={savedLocation.latitude != null && savedLocation.longitude != null}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (next) {
                      handleDetectLocation();
                    } else {
                      setSavedLocation({ latitude: null, longitude: null });
                      setLocationStatus("idle");
                    }
                  }}
                  disabled={!isEditing || locationStatus === "detecting"}
                  aria-label="Use my current location"
                />
                <span className="switch__track">
                  <span className="switch__thumb" />
                </span>
              </label>
            </div>
            {locationStatus === "denied" && (
              <p className="fieldError" style={{ marginTop: 4, fontSize: 12 }}>
                Location access denied. Please allow location in your browser settings.
              </p>
            )}
          </div>

          {isGoogleAccount ? (
            <div className="field">
              <span>Password</span>
              <p className="userProfileFormHint">
                You signed in with Google. Password changes are managed in your Google account.
              </p>
            </div>
          ) : (
            <>
              <label className="field">
                <span>New password (leave blank to keep current)</span>
                <div className="passwordFieldWrap">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!isEditing}
                  />
                  <button
                    type="button"
                    className="passwordToggleBtn"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    disabled={!isEditing}
                  >
                    {showNewPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>

              <label className="field">
                <span>Confirm new password</span>
                <div className="passwordFieldWrap">
                  <input
                    type={showConfirmNewPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!isEditing}
                  />
                  <button
                    type="button"
                    className="passwordToggleBtn"
                    onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                    aria-label={showConfirmNewPassword ? "Hide confirm password" : "Show confirm password"}
                    disabled={!isEditing}
                  >
                    {showConfirmNewPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </label>
            </>
          )}

          <div className="appearanceSection">
            <div>
              <div className="appearanceSection__label">Appearance</div>
              <div className="appearanceSection__sub">
                {theme === "dark" ? "Dark mode is on" : "Light mode is on"}
              </div>
            </div>
            <button type="button" className="appearanceToggle" onClick={toggleTheme}>
              <span className="appearanceToggle__icon">{theme === "dark" ? "☀️" : "🌙"}</span>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>

          <div className="formCard__divider" />

          <section className="updatesSubscription">
            <div className="updatesSubscription__header">
              <div>
                <div className="updatesSubscription__title">Updates Subscription</div>
                <p className="updatesSubscription__desc">
                  Get news, special offers, and event updates from DineSmart.
                </p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isSubscribed}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (checked && subscriptionPreferences.length === 0) {
                      toast.error("Select at least one option before enabling subscription.");
                      return;
                    }
                    setIsSubscribed(checked);
                    if (!checked) setSubscriptionPreferences([]);
                  }}
                  aria-label={isSubscribed ? "Subscription on" : "Subscription off"}
                  disabled={!isEditing}
                />
                <span className="switch__track">
                  <span className="switch__thumb" />
                </span>
              </label>
            </div>

            <div className={`updatesPrefs${!isEditing ? " updatesPrefs--disabled" : ""}`}>
              <div className="updatesPrefs__grid">
                {subscriptionOptions.map((option) => (
                  <label
                    key={option.key}
                    className={`prefChip${subscriptionPreferences.includes(option.key) ? " prefChip--active" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={subscriptionPreferences.includes(option.key)}
                      onChange={() => toggleSubscriptionPreference(option.key)}
                      disabled={!isEditing}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <div className="formCard__actions">
            <button className="btn btn--gold btn--xl" type="submit">
              {isEditing ? "Save Changes" : "Edit Profile"}
            </button>
            {isEditing && (
              <button className="btn btn--ghost btn--xl" type="button" onClick={handleCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="userProfileSide">
          <div className="formCard formCard--userProfile profileExtraCard">
            <div className="formCard__title">Favorites</div>
            {favorites.length ? (
              <div className="profileExtraCard__content">
                {favorites.map((r) => (
                  <button
                    key={r.id}
                    className="profileFavoriteItem profileFavoriteItem--button"
                    type="button"
                    onClick={() => onOpenRestaurant?.(r)}
                  >
                    <div className="profileFavoriteItem__name">{r.name}</div>
                    <div className="profileFavoriteItem__meta">
                      {r.cuisine} - {FILLED_STAR} {r.rating}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="profileEmpty">No favorites yet.</div>
            )}
          </div>

          <div className="formCard formCard--userProfile profileExtraCard">
            <div className="formCard__title">My Reviews</div>
            {myReviews.length ? (
              <div className="profileExtraCard__content">
                {myReviews.map((rev, index) => (
                  <div key={rev.id ?? index} className="profileReviewItem">
                    <div className="profileReviewItem__restaurant">{rev.restaurantName}</div>
                    <div className="profileReviewItem__stars">
                      {FILLED_STAR.repeat(Math.max(0, Number(rev.stars) || 0))}
                      {EMPTY_STAR.repeat(Math.max(0, 5 - (Number(rev.stars) || 0)))}
                    </div>
                    <div className="profileReviewItem__text">{rev.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="profileEmpty">No reviews yet.</div>
            )}
          </div>

          <div className="formCard formCard--userProfile profileExtraCard">
            <div className="formCard__title">Search History</div>
            <div className="profileHistoryActions">
              <button
                type="button"
                className="profileHistory__viewBtn"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? "Hide History" : `View Full History${searchHistory.length ? ` (${searchHistory.length})` : ""}`}
              </button>
              {showHistory && searchHistory.length > 0 && (
                <button
                  type="button"
                  className="profileHistory__clearBtn"
                  onClick={() => {
                    clearSearchHistory().catch(() => {});
                    setSearchHistory([]);
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
            {showHistory && (
              searchHistory.length ? (
                <ol className="profileHistoryList">
                  {searchHistory.map((item, index) => (
                    <li key={item.id} className="profileHistoryItem">
                      <span className="profileHistoryItem__num">{index + 1}</span>
                      <span className="profileHistoryItem__query">{item.query}</span>
                      <span className="profileHistoryItem__date">
                        {new Date(item.searched_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="profileEmpty">No search history yet.</div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

