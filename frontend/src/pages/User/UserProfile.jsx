import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getProfile, redeemReward, updateProfile, deleteProfileAccount } from "../../services/profileService.js";
import { getFavorites } from "../../services/favoriteService.js";
import { getSearchHistory, clearSearchHistory } from "../../services/recentSearchService.js";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useTheme } from "../../auth/ThemeContext.jsx";
import { COUNTRY_OPTIONS, splitPhoneNumber } from "../../constants/countries.js";

import { FILLED_STAR, EMPTY_STAR } from "../../constants/filters";
import { DEFAULT_AVATAR } from "../../constants/avatar";
import ThemedSelect from "../../components/ThemedSelect.jsx";

export default function UserProfile({ onAvatarPreviewChange, onOpenRestaurant }) {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [favorites, setFavorites] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [reviewsRequiringChanges, setReviewsRequiringChanges] = useState([]);
  const [editingRequiredReviewId, setEditingRequiredReviewId] = useState(null);
  const [requiredEditRating, setRequiredEditRating] = useState(5);
  const [requiredEditComment, setRequiredEditComment] = useState("");
  const [requiredActionBusyId, setRequiredActionBusyId] = useState(null);
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
  const [points, setPoints] = useState(0);
  const [rewardStatus, setRewardStatus] = useState({ threshold: 100, unlocked: false, redeemed: false });
  const [rewardCelebrationOpen, setRewardCelebrationOpen] = useState(false);
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
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const prevPointsRef = useRef(null);
  const prevUnlockedRef = useRef(false);
  const ACCOUNT_DELETE_TEXT = "Goodbye DineSmart";
  const normalizeDeleteText = (value) => String(value || "")
    .trim()
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const isDeleteConfirmed = normalizeDeleteText(deleteConfirmationText) === normalizeDeleteText(ACCOUNT_DELETE_TEXT);

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

  const loadProfile = async (showLoader = true) => {
    if (!user) return;
    if (showLoader) setProfileLoading(true);
    try {
      const profile = await getProfile();
      const resolvedName = profile.fullName ?? profile.full_name ?? user.name ?? user.fullName ?? "";
      const resolvedEmail = profile.email ?? user.email ?? "";
      const phoneParts = splitPhoneNumber(profile.phone ?? "");
      const lat = parseFloat(profile.latitude ?? user?.latitude);
      const lng = parseFloat(profile.longitude ?? user?.longitude);
      const locationSnapshot = Number.isFinite(lat) && Number.isFinite(lng)
        ? { latitude: lat, longitude: lng }
        : { latitude: null, longitude: null };
      const prefArray = Array.isArray(profile.subscriptionPreferences) ? profile.subscriptionPreferences : [];

      setFullName(resolvedName);
      setEmail(resolvedEmail);
      setCountryCode(phoneParts.countryCode);
      setPhone(phoneParts.localNumber);
      setAccountProvider(String(profile.provider ?? user.provider ?? "local").toLowerCase());
      setProfilePictureUrl(profile.profilePictureUrl ?? profile.profile_picture_url ?? "");
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setSavedLocation({ latitude: lat, longitude: lng });
      } else {
        setSavedLocation({ latitude: null, longitude: null });
      }
      setReservationCount(Number(profile.reservationCount ?? 0));
      setLoyaltyBadge(profile.loyaltyBadge ?? "Newcomer");
      setPoints(Number(profile.points ?? profile.rewards?.points ?? 0));
      setRewardStatus(profile.rewards ?? { threshold: 100, unlocked: false, redeemed: false });
      setIsSubscribed(Boolean(profile.isSubscribed));
      setSubscriptionPreferences(prefArray);
      setSubscriptionSnapshot({ isSubscribed: Boolean(profile.isSubscribed), preferences: prefArray });
      setProfileSnapshot({
        fullName: resolvedName,
        email: resolvedEmail,
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
      setReviewsRequiringChanges(
        Array.isArray(profile.reviews_requiring_changes)
          ? profile.reviews_requiring_changes.map((review) => ({
              id: review.id,
              restaurantId: review.restaurantId ?? review.restaurant_id,
              restaurantName: review.restaurantName ?? review.restaurant_name ?? "Restaurant",
              stars: Number(review.stars ?? review.rating ?? 0),
              text: review.text ?? review.comment ?? "",
              createdAt: review.createdAt ?? review.created_at,
            }))
          : []
      );
      setEditingRequiredReviewId(null);
      setRequiredActionBusyId(null);
    } catch {
      setFullName(user.name ?? user.fullName ?? "");
      setEmail(user.email ?? "");
      setAccountProvider(String(user.provider ?? "local").toLowerCase());
      setMyReviews([]);
      setReviewsRequiringChanges([]);
      setProfilePictureUrl("");
      setIsSubscribed(false);
      setSubscriptionPreferences([]);
      setSubscriptionSnapshot({ isSubscribed: false, preferences: [] });
      setRewardStatus({ threshold: 100, unlocked: false, redeemed: false });
      setPoints(0);
      setEditingRequiredReviewId(null);
      setRequiredActionBusyId(null);
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
    } finally {
      if (showLoader) setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadProfile(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || isEditing) return;
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadProfile(false);
      }
    }

    function onLoyaltyChanged() {
      loadProfile(false);
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadProfile(false);
    }, 30000);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("ds:loyalty-changed", onLoyaltyChanged);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("ds:loyalty-changed", onLoyaltyChanged);
    };
  }, [user?.id, isEditing]);

  const isGoogleAccount = accountProvider === "google";
  const rewardThreshold = rewardStatus?.threshold ?? 100;
  const rewardProgress = rewardThreshold > 0 ? Math.min(points, rewardThreshold) / rewardThreshold * 100 : 0;
  const rewardUnlocked = Boolean(rewardStatus?.unlocked);
  const rewardRedeemed = Boolean(rewardStatus?.redeemed);
  const rewardStatusLabel = rewardRedeemed ? "Used" : rewardUnlocked ? "Unlocked" : "Locked";

  const avatarSrc = useMemo(() => {
    return profilePictureDataUrl || profilePictureUrl || DEFAULT_AVATAR;
  }, [profilePictureDataUrl, profilePictureUrl]);

  useEffect(() => {
    if (!onAvatarPreviewChange) return;
    onAvatarPreviewChange(avatarSrc);
  }, [avatarSrc, onAvatarPreviewChange]);

  useEffect(() => {
    if (prevPointsRef.current == null) {
      prevPointsRef.current = points;
      return;
    }
    if (points > prevPointsRef.current) {
      toast.success(`+${points - prevPointsRef.current} points earned 🎉`);
    }
    prevPointsRef.current = points;
  }, [points]);

  useEffect(() => {
    const unlocked = Boolean(rewardStatus?.unlocked) && !rewardStatus?.redeemed;
    if (!prevUnlockedRef.current && unlocked) {
      setRewardCelebrationOpen(true);
    }
    prevUnlockedRef.current = unlocked;
  }, [rewardStatus]);

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

  async function handleRedeemReward() {
    if (!rewardStatus?.unlocked || rewardStatus?.redeemed) return;
    try {
      const result = await redeemReward();
      if (result?.points != null) setPoints(result.points);
      if (result?.rewards) setRewardStatus(result.rewards);
      if (result?.voucher?.unique_code) {
        toast.success(`Voucher ${result.voucher.unique_code} unlocked 🎉`);
      } else {
        toast.success("Reward redeemed! Enjoy 10% off your next booking.");
      }
      setRewardCelebrationOpen(false);
    } catch (err) {
      toast.error(err.message || "Failed to redeem reward.");
    }
  }

  async function handleUpdateRequiredReview(reviewId) {
    if (requiredActionBusyId) return;
    setRequiredActionBusyId(reviewId);
    try {
      await updateReview(reviewId, {
        rating: requiredEditRating,
        comment: requiredEditComment.trim(),
      });
      // Reload profile to get updated reviews
      await loadProfile(true);
      toast.success("Review updated successfully.");
    } catch (err) {
      toast.error(err.message || "Failed to update review.");
    } finally {
      setRequiredActionBusyId(null);
    }
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

  function openDeleteModal() {
    setDeleteConfirmationText("");
    setDeleteAccountError("");
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (deletingAccount) return;
    setShowDeleteModal(false);
    setDeleteAccountError("");
  }

  useEffect(() => {
    if (!showDeleteModal || deletingAccount) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") closeDeleteModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showDeleteModal, deletingAccount]);

  async function handleDeleteAccount() {
    if (deletingAccount) return;
    if (!isDeleteConfirmed) {
      setDeleteAccountError(`Please type ${ACCOUNT_DELETE_TEXT} to confirm.`);
      return;
    }

    setDeletingAccount(true);
    setDeleteAccountError("");
    try {
      await deleteProfileAccount(deleteConfirmationText.trim());
      setShowDeleteModal(false);
      toast.success("Your account was deleted.");
      logout();
      navigate("/");
    } catch (err) {
      setDeleteAccountError(err.message || "Failed to delete account.");
    } finally {
      setDeletingAccount(false);
    }
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
          <div className="accountSettingsHeader">
            <div className="formCard__title">Account Settings</div>
            <button
              type="button"
              className="btn btn--ghost accountDangerTriggerBtn"
              onClick={openDeleteModal}
              disabled={deletingAccount}
            >
              Delete Account
            </button>
          </div>

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
            <div className="formCard__title">Reviews Requiring Changes</div>
            {reviewsRequiringChanges.length ? (
              <div className="profileExtraCard__content">
                {reviewsRequiringChanges.map((rev, index) => (
                  <div key={rev.id ?? index} className="profileReviewItem profileReviewItem--requiresChanges">
                    <div className="profileReviewItem__restaurant">{rev.restaurantName}</div>
                    <div className="profileReviewItem__stars">
                      {FILLED_STAR.repeat(Math.max(0, Number(rev.stars) || 0))}
                      {EMPTY_STAR.repeat(Math.max(0, 5 - (Number(rev.stars) || 0)))}
                    </div>
                    <div className="profileReviewItem__text">{rev.text}</div>
                    <div className="profileReviewItem__actions">
                      {editingRequiredReviewId === rev.id ? (
                        <div className="profileReviewItem__editForm">
                          <div className="field">
                            <label>Rating</label>
                            <div className="starRating">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  className={`starRating__star ${star <= requiredEditRating ? "starRating__star--filled" : ""}`}
                                  onClick={() => setRequiredEditRating(star)}
                                  disabled={requiredActionBusyId === rev.id}
                                >
                                  {star <= requiredEditRating ? FILLED_STAR : EMPTY_STAR}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="field">
                            <label>Review Comment</label>
                            <textarea
                              className="textarea"
                              rows={3}
                              value={requiredEditComment}
                              onChange={(e) => setRequiredEditComment(e.target.value)}
                              placeholder="Share your dining experience..."
                              disabled={requiredActionBusyId === rev.id}
                            />
                          </div>
                          <div className="field">
                            <button
                              type="button"
                              className="btn btn--primary"
                              onClick={() => handleUpdateRequiredReview(rev.id)}
                              disabled={requiredActionBusyId === rev.id}
                            >
                              {requiredActionBusyId === rev.id ? "Saving..." : "Update Review"}
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              onClick={() => {
                                setEditingRequiredReviewId(null);
                                setRequiredEditRating(5);
                                setRequiredEditComment("");
                              }}
                              disabled={requiredActionBusyId === rev.id}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--primary btn--small"
                          onClick={() => {
                            setEditingRequiredReviewId(rev.id);
                            setRequiredEditRating(rev.stars);
                            setRequiredEditComment(rev.text);
                          }}
                          disabled={requiredActionBusyId === rev.id}
                        >
                          Edit Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="profileEmpty">No reviews requiring changes.</div>
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

          <section className="rewardsSection">
            <div className="rewardsHeader">
              <div>
                <div className="rewardsTitle">Rewards</div>
                <p className="rewardsSubtitle">Earn points every time you reserve a table or join an event.</p>
              </div>
              <div className="rewardsPoints">
                <div className="rewardsPoints__value">{points}</div>
                <div className="rewardsPoints__label">Points</div>
              </div>
            </div>

            <div className="rewardsProgress">
              <div className="rewardsProgress__text">{Math.min(points, rewardThreshold)} / {rewardThreshold} points</div>
              <div className="rewardsProgress__bar" aria-hidden="true">
                <div className="rewardsProgress__fill" style={{ width: `${rewardProgress}%` }} />
              </div>
            </div>

            {points === 0 && (
              <p className="rewardsEmpty">Start booking to earn rewards!</p>
            )}

            <div className="rewardsCards">
              <article className={`rewardCard${rewardUnlocked ? " is-unlocked" : " is-locked"}${rewardRedeemed ? " is-used" : ""}`}>
                <div className="rewardCard__title">10% Off</div>
                <div className="rewardCard__meta">{rewardStatusLabel}</div>
                <button
                  type="button"
                  className="btn btn--gold btn--sm rewardCard__cta"
                  onClick={handleRedeemReward}
                  disabled={!rewardUnlocked || rewardRedeemed}
                >
                  {rewardRedeemed ? "Used" : "Redeem"}
                </button>
              </article>
            </div>
          </section>

        </div>
      </div>

      {showDeleteModal && (
        <div className="modal is-open" role="dialog" aria-modal="true" aria-labelledby="user-delete-modal-title">
          <div className="modal__backdrop" onClick={closeDeleteModal} />
          <div className="modal__panel confirmDialog accountDeleteModal">
            <h3 id="user-delete-modal-title" className="confirmDialog__title accountDeleteModal__title">Delete Account</h3>
            <p className="confirmDialog__message accountDeleteModal__message">
              This action is permanent and will remove your account data.
            </p>
            <label className="field accountDeleteModal__field">
              <span>Type "{ACCOUNT_DELETE_TEXT}" to confirm</span>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(event) => {
                  setDeleteConfirmationText(event.target.value);
                  if (deleteAccountError) setDeleteAccountError("");
                }}
                placeholder={ACCOUNT_DELETE_TEXT}
                autoFocus
              />
            </label>
            {deleteAccountError && <div className="accountDeleteModal__error">{deleteAccountError}</div>}
            <div className="confirmDialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeDeleteModal}
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--ghost accountDeleteModal__confirmBtn"
                onClick={handleDeleteAccount}
                disabled={deletingAccount || !isDeleteConfirmed}
              >
                {deletingAccount ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {rewardCelebrationOpen && (
        <div className="rewardModalOverlay" role="dialog" aria-modal="true">
          <div className="rewardModalCard">
            <div className="rewardModalBadge">Congratulations</div>
            <div className="rewardModalTitle">You unlocked 10% off!</div>
            <p className="rewardModalText">Redeem your reward on your next restaurant booking.</p>
            <div className="rewardModalActions">
              <button type="button" className="btn btn--gold btn--xl" onClick={handleRedeemReward}>
                Redeem Now
              </button>
              <button type="button" className="btn btn--ghost btn--xl" onClick={() => setRewardCelebrationOpen(false)}>
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

