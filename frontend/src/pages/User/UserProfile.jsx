import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getProfile, updateProfile } from "../../services/profileService.js";

export default function UserProfile({ onAvatarPreviewChange, onOpenRestaurant }) {
  const { user } = useAuth();
  const FAVORITES_KEY = "ds_favorites";
  const MY_REVIEWS_KEY = "ds_my_reviews";

  function loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function loadMyReviews() {
    try {
      return JSON.parse(localStorage.getItem(MY_REVIEWS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [myReviews, setMyReviews] = useState(() => loadMyReviews());

  useEffect(() => {
    setFavorites(loadFavorites());
    setMyReviews(loadMyReviews());
  }, []);

  const [profileFile, setProfileFile] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+961");
  const [newPassword, setNewPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  // Load profile from API when user is available
  useEffect(() => {
    if (!user) return;
    setProfileLoading(true);
    getProfile()
      .then((profile) => {
        setFullName(profile.fullName ?? profile.full_name ?? user.name ?? user.fullName ?? "");
        setEmail(profile.email ?? user.email ?? "");
        setPhone(profile.phone ?? "");
      })
      .catch(() => {
        setFullName(user.name ?? user.fullName ?? "");
        setEmail(user.email ?? "");
      })
      .finally(() => setProfileLoading(false));
  }, [user?.id]);

  const profilePreviewUrl = useMemo(() => {
    if (profileFile) return URL.createObjectURL(profileFile);
    return "";
  }, [profileFile]);

  useEffect(() => {
    if (!onAvatarPreviewChange) return;
    if (profilePreviewUrl) onAvatarPreviewChange(profilePreviewUrl);
    else onAvatarPreviewChange("");
  }, [profilePreviewUrl, onAvatarPreviewChange]);

  function onPickProfile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const isImage = file.type && file.type.startsWith("image/");
    if (!isImage) {
      alert("Please select an image file (PNG, JPG, JPEG).");
      e.target.value = "";
      return;
    }
    setProfileFile(file);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() ? `${countryCode}${phone.trim()}` : "",
    };
    if (newPassword.trim()) payload.password = newPassword.trim();
    try {
      await updateProfile(payload);
      setProfileSuccess("Profile saved successfully.");
      setNewPassword("");
    } catch (err) {
      setProfileError(err.message || "Failed to save profile.");
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
      <h1 className="userProfile__title">Your Profile</h1>
      {profileError && <p className="formCard__error" style={{ color: "#c00", marginBottom: "12px" }}>{profileError}</p>}
      {profileSuccess && <p className="formCard__success" style={{ color: "#0a0", marginBottom: "12px" }}>{profileSuccess}</p>}

      <div className="userProfile__stack">
        {/* Image Card */}
        <div className="imageCard imageCard--userProfile">
          <div className="imageCard__title">Profile picture</div>

          <div className="imageCard__preview imageCard__preview--userProfile">
            {profilePreviewUrl ? (
              <img className="imageCard__img imageCard__img--logo" src={profilePreviewUrl} alt="Profile" />
            ) : (
              <div className="imageCard__placeholder">
                <div className="imageCard__formats">PNG, JPG, or JPEG</div>
              </div>
            )}
          </div>

          <label className="btn btn--gold imageCard__btn imageCard__btn--userProfile">
            Upload picture
            <input
              className="imageCard__input"
              type="file"
              accept="image/png, image/jpeg"
              onChange={onPickProfile}
            />
          </label>
        </div>

        {/* Form Card under it */}
        <form className="formCard formCard--userProfile" onSubmit={onSubmit}>
          <label className="field">
            <span>Full Name</span>
            <input
              type="text"
              placeholder="Enter full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
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
            />
          </label>

          <label className="field">
  <span>Phone number</span>

  <div className="phoneRow">
    <select
      className="select phoneRow__code"
      value={countryCode}
      onChange={(e) => setCountryCode(e.target.value)}
    >
      <option value="+961">+961</option>
      <option value="+1">+1</option>
      <option value="+33">+33</option>
      <option value="+44">+44</option>
      <option value="+49">+49</option>
      <option value="+971">+971</option>
      <option value="+966">+966</option>
    </select>

    <input
      className="phoneRow__number"
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder="Enter number"
      value={phone}
      onChange={(e) => {
        // keep digits only
        const digitsOnly = e.target.value.replace(/\D/g, "");
        setPhone(digitsOnly);
      }}
    />
  </div>
</label>

          <label className="field">
            <span>New password (leave blank to keep current)</span>
            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          <div className="formCard__actions">
            <button className="btn btn--gold btn--xl" type="submit">
              Save
            </button>
          </div>
          
        </form>
        {/* Favorites Card */}
<div className="formCard formCard--userProfile profileExtraCard">
  <div className="formCard__title">Favorites</div>

  {favorites.length ? (
    <div className="profileExtraCard__content">
      {favorites.map((r) => (
        <div
    key={r.id}
    className="profileFavoriteItem"
    onClick={() => onOpenRestaurant?.(r)}
    style={{ cursor: "pointer" }}
  >
          <div className="profileFavoriteItem__name">{r.name}</div>
          <div className="profileFavoriteItem__meta">
            {r.cuisine} • ⭐ {r.rating}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="profileEmpty">No favorites yet.</div>
  )}
</div>


{/* My Reviews Card */}
<div className="formCard formCard--userProfile profileExtraCard">
  <div className="formCard__title">My Reviews</div>

  {myReviews.length ? (
    <div className="profileExtraCard__content">
      {myReviews.map((rev, index) => (
        <div key={index} className="profileReviewItem">
          <div className="profileReviewItem__restaurant">
            {rev.restaurantName}
          </div>

          <div className="profileReviewItem__stars">
            {"★".repeat(rev.stars)}
            {"☆".repeat(5 - rev.stars)}
          </div>

          <div className="profileReviewItem__text">
            {rev.text}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="profileEmpty">No reviews yet.</div>
  )}
</div>
      </div>
      
      {/* ===================== DASHBOARD CARDS ===================== */}
    </div>
  );
}