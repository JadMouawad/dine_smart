import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getProfile, updateProfile, deleteProfileAccount } from "../../services/profileService.js";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { useTheme } from "../../auth/ThemeContext.jsx";
import ThemedSelect from "../../components/ThemedSelect.jsx";
import { COUNTRY_OPTIONS, splitPhoneNumber } from "../../constants/countries.js";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#C9A227" />
      <stop offset="100%" stop-color="#a07a1e" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#g)" />
  <circle cx="64" cy="48" r="23" fill="#fff8e1"/>
  <path d="M24 112c5-20 20-31 40-31s35 11 40 31" fill="#fff8e1"/>
</svg>`);

export default function AdminProfile({ onAvatarPreviewChange }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const ACCOUNT_DELETE_TEXT = "Goodbye DineSmart";

  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [profilePictureDataUrl, setProfilePictureDataUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(COUNTRY_OPTIONS[0].code);
  const [accountProvider, setAccountProvider] = useState(() =>
    String(user?.provider || "local").toLowerCase()
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const normalizeDeleteText = (value) => String(value || "")
    .trim()
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const isDeleteConfirmed = normalizeDeleteText(deleteConfirmationText) === normalizeDeleteText(ACCOUNT_DELETE_TEXT);

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
      })
      .catch(() => {
        setFullName(user.name ?? user.fullName ?? "");
        setEmail(user.email ?? "");
        setAccountProvider(String(user.provider ?? "local").toLowerCase());
        setProfilePictureUrl("");
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
    setProfileError("");
    setProfileSuccess("");

    if (!isGoogleAccount && newPassword.trim()) {
      if (!confirmNewPassword.trim()) {
        setProfileError("Please confirm your new password.");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setProfileError("New password and confirm password do not match.");
        return;
      }
    }

    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim() ? `${countryCode}${phone.trim()}` : "",
      profilePictureUrl: profilePictureDataUrl || profilePictureUrl || "",
    };

    if (!isGoogleAccount && newPassword.trim()) {
      payload.password = newPassword.trim();
    }

    try {
      const updated = await updateProfile(payload);
      const savedAvatar = updated?.profilePictureUrl ?? payload.profilePictureUrl;
      setProfilePictureUrl(savedAvatar);
      setProfilePictureDataUrl("");
      setProfileSuccess("Profile saved successfully.");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowNewPassword(false);
      setShowConfirmNewPassword(false);
    } catch (err) {
      setProfileError(err.message || "Failed to save profile.");
    }
  }

  async function handleDeleteAccount() {
    if (deletingAccount) return;
    if (!isDeleteConfirmed) {
      setDeleteAccountError(`Please type ${ACCOUNT_DELETE_TEXT} to confirm.`);
      return;
    }

    setDeleteAccountError("");
    setProfileSuccess("");
    setDeletingAccount(true);
    try {
      await deleteProfileAccount(deleteConfirmationText.trim());
      setShowDeleteModal(false);
      logout();
      navigate("/");
    } catch (err) {
      setDeleteAccountError(err.message || "Failed to delete account.");
    } finally {
      setDeletingAccount(false);
    }
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
          <h1 className="userProfileHero__name">{fullName || "Admin Profile"}</h1>
          <p className="userProfileHero__email">{email}</p>
          <div className="userProfileHero__meta">
            <span className="metaPill">Role: Admin</span>
            <span className="metaPill">Access: Full</span>
          </div>
        </div>
        <label className="btn btn--gold userProfileHero__uploadBtn">
          Upload picture
          <input
            className="imageCard__input"
            type="file"
            accept="image/png, image/jpeg"
            onChange={onPickProfile}
          />
        </label>
      </section>

      {profileError && <p className="formCard__error userProfile__feedbackError">{profileError}</p>}
      {profileSuccess && <p className="formCard__success userProfile__feedbackSuccess">{profileSuccess}</p>}

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
              <ThemedSelect
                className="phoneRow__codeDropdown"
                buttonClassName="phoneRow__codeDropdownBtn"
                menuClassName="phoneRow__codeDropdownMenu"
                value={countryCode}
                onChange={setCountryCode}
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
              />
            </div>
          </label>

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
                  />
                  <button
                    type="button"
                    className="passwordToggleBtn"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
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
                  />
                  <button
                    type="button"
                    className="passwordToggleBtn"
                    onClick={() => setShowConfirmNewPassword((prev) => !prev)}
                    aria-label={showConfirmNewPassword ? "Hide confirm password" : "Show confirm password"}
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

          <div className="formCard__actions">
            <button className="btn btn--gold btn--xl" type="submit">
              Save Changes
            </button>
          </div>
        </form>

        <div className="userProfileSide">
          <div className="formCard formCard--userProfile profileExtraCard">
            <div className="formCard__title">Admin Profile</div>
            <div className="profileExtraCard__content">
              <p className="userProfileFormHint">
                Keep your admin contact details and profile image up to date for quick identification.
              </p>
            </div>
          </div>

          <div className="formCard formCard--userProfile profileExtraCard">
            <div className="formCard__title">Security</div>
            <div className="profileExtraCard__content">
              <p className="userProfileFormHint">
                Use a strong password and update it regularly to protect administrative access.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal is-open" role="dialog" aria-modal="true" aria-labelledby="admin-delete-modal-title">
          <div className="modal__backdrop" onClick={closeDeleteModal} />
          <div className="modal__panel confirmDialog accountDeleteModal">
            <h3 id="admin-delete-modal-title" className="confirmDialog__title accountDeleteModal__title">Delete Account</h3>
            <p className="confirmDialog__message accountDeleteModal__message">
              This action is permanent and cannot be undone.
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
    </div>
  );
}