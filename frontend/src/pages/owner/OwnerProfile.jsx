import React, { useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import { deleteProfileAccount } from "../../services/profileService.js";
import { createRestaurant, getMyRestaurant, updateMyRestaurant, requestRestaurantDeletion } from "../../services/restaurantService";
import { useTheme } from "../../auth/ThemeContext.jsx";
import ThemedSelect from "../../components/ThemedSelect.jsx";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const CUISINES = [
  "American",
  "Middle Eastern",
  "French",
  "Mexican",
  "Chinese",
  "Japanese",
  "Italian",
  "Indian",
  "International",
];

const PRICE_RANGE_OPTIONS = [
  { value: "$", label: "Budget" },
  { value: "$$", label: "Moderate" },
  { value: "$$$", label: "Premium" },
  { value: "$$$$", label: "Luxury" },
];

const DIETARY_OPTIONS = [
  { value: "Vegetarian", label: "Vegetarian" },
  { value: "Vegan", label: "Vegan" },
  { value: "Halal", label: "Halal" },
  { value: "GF", label: "Gluten-Free" },
];

const DEFAULT_MAP_CENTER = { lat: 33.893791, lng: 35.501777 };
const MAX_GALLERY_PHOTOS = 8;
const VALID_DOCUMENT_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

function splitAddressAndCity(rawAddress) {
  const value = String(rawAddress || "").trim();
  if (!value) return { address: "", city: "" };

  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return { address: value, city: "" };
  }

  return {
    address: parts.slice(0, -1).join(", "),
    city: parts[parts.length - 1],
  };
}

function buildAddress(address, city) {
  const cleanAddress = String(address || "").trim();
  const cleanCity = String(city || "").trim();
  if (!cleanAddress) return "";
  if (!cleanCity) return cleanAddress;
  return `${cleanAddress}, ${cleanCity}`;
}

function normalizeGalleryUrls(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((url) => String(url || "").trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function dataUrlToBlobUrl(dataUrl) {
  const raw = String(dataUrl || "").trim();
  if (!raw.startsWith("data:")) return raw;

  const [meta, content] = raw.split(",", 2);
  if (!meta || content == null) return raw;

  const mimeMatch = meta.match(/^data:([^;]+)(;base64)?$/i);
  const mimeType = mimeMatch?.[1] || "application/octet-stream";
  const isBase64 = /;base64$/i.test(meta);

  try {
    const byteString = isBase64 ? atob(content) : decodeURIComponent(content);
    const bytes = new Uint8Array(byteString.length);
    for (let index = 0; index < byteString.length; index += 1) {
      bytes[index] = byteString.charCodeAt(index);
    }
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  } catch {
    return raw;
  }
}

export default function OwnerProfile({ onLogoPreviewChange, onSaved }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const ACCOUNT_DELETE_TEXT = "Goodbye DineSmart";
  const [restaurantName, setRestaurantName] = useState("");
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");
  const [cuisineType, setCuisineType] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [priceRange, setPriceRange] = useState("");
  const [dietarySupport, setDietarySupport] = useState([]);
  const [logoDataUrl, setLogoDataUrl] = useState("");
  const [galleryDataUrls, setGalleryDataUrls] = useState([]);
  const [businessLicenseUrl, setBusinessLicenseUrl] = useState("");
  const [businessLicenseName, setBusinessLicenseName] = useState("");
  const [healthCertificateUrl, setHealthCertificateUrl] = useState("");
  const [healthCertificateName, setHealthCertificateName] = useState("");
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingRestaurant, setExistingRestaurant] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [searchParams] = useSearchParams();
  const onboardingParam = searchParams.get("onboarding") === "1" || searchParams.get("edit") === "1";
  const onboardingFlag = typeof window !== "undefined" && localStorage.getItem("owner_onboarding") === "1";
  const forceEdit = onboardingParam || onboardingFlag;
  const [documentPreviewUrls, setDocumentPreviewUrls] = useState({});
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [showRestaurantDeleteModal, setShowRestaurantDeleteModal] = useState(false);
  const [restaurantDeleteConfirmText, setRestaurantDeleteConfirmText] = useState("");
  const [restaurantDeleteError, setRestaurantDeleteError] = useState("");
  const [requestingRestaurantDeletion, setRequestingRestaurantDeletion] = useState(false);
  const [restaurantDeletionRequested, setRestaurantDeletionRequested] = useState(false);
  const normalizeDeleteText = (value) => String(value || "")
    .trim()
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const isDeleteConfirmed = normalizeDeleteText(deleteConfirmationText) === normalizeDeleteText(ACCOUNT_DELETE_TEXT);

  // Mapbox controlled view state
  const [viewState, setViewState] = useState({
    longitude: DEFAULT_MAP_CENTER.lng,
    latitude:  DEFAULT_MAP_CENTER.lat,
    zoom: 13,
  });

  useEffect(() => {
    getMyRestaurant()
      .then((restaurant) => {
        setExistingRestaurant(restaurant);
        setRestaurantDeletionRequested(Boolean(restaurant?.deletion_requested));
        setIsEditing(forceEdit || String(restaurant?.approval_status || "").toLowerCase() === "pending");
        setRestaurantName(restaurant.name || "");
        setCuisineType(restaurant.cuisine || "");

        const parsedAddress = splitAddressAndCity(restaurant.address || "");
        setAddress(parsedAddress.address);
        setCity(parsedAddress.city);

        setOpeningTime(restaurant.opening_time || "");
        setClosingTime(restaurant.closing_time || "");
        setPriceRange(restaurant.price_range || "");
        setDietarySupport(Array.isArray(restaurant.dietary_support) ? restaurant.dietary_support : []);
        setLogoDataUrl(restaurant.logo_url || restaurant.logoUrl || "");
        setBusinessLicenseUrl(restaurant.business_license_url || "");
        setBusinessLicenseName(restaurant.business_license_name || "");
        setHealthCertificateUrl(restaurant.health_certificate_url || "");
        setHealthCertificateName(restaurant.health_certificate_name || "");
        const storedGallery = normalizeGalleryUrls(restaurant.gallery_urls || restaurant.galleryUrls || []);
        const legacyCover = String(restaurant.cover_url || restaurant.coverUrl || "").trim();
        setGalleryDataUrls(storedGallery.length ? storedGallery : (legacyCover ? [legacyCover] : []));

        const lat = Number(restaurant.latitude);
        const lng = Number(restaurant.longitude);
        // Exclude (0, 0) — means "not set", not actual null island
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
          setLatitude(lat);
          setLongitude(lng);
          setViewState({ longitude: lng, latitude: lat, zoom: 14 });
        }
      })
      .catch((err) => {
        console.error("getMyRestaurant error:", err.message);
        if (err?.status === 404) {
          // Owner has no restaurant yet -> show create form without scary error.
          setExistingRestaurant(null);
          setIsEditing(true);
          setError("");
          return;
        }
        setError((prev) => prev || "We couldn't refresh your restaurant profile right now.");
      })
      .finally(() => {
        setInitialLoadComplete(true);
      });
  }, [forceEdit]);

  useEffect(() => {
    if (!forceEdit) return;
    localStorage.removeItem("owner_onboarding");
  }, [forceEdit]);


  const logoPreviewUrl = useMemo(
    () => logoDataUrl || existingRestaurant?.logo_url || existingRestaurant?.logoUrl || "",
    [logoDataUrl, existingRestaurant]
  );

  const galleryPreviewUrls = useMemo(() => {
    if (galleryDataUrls.length > 0) return normalizeGalleryUrls(galleryDataUrls);
    const existingGallery = normalizeGalleryUrls(existingRestaurant?.gallery_urls || existingRestaurant?.galleryUrls || []);
    if (existingGallery.length > 0) return existingGallery;
    const legacyCover = String(existingRestaurant?.cover_url || existingRestaurant?.coverUrl || "").trim();
    return legacyCover ? [legacyCover] : [];
  }, [galleryDataUrls, existingRestaurant]);

  const coverPreviewUrl = galleryPreviewUrls[0] || "";
  const activeGalleryPhoto = galleryPreviewUrls[activeGalleryIndex] || "";

  const profileName = restaurantName.trim() || existingRestaurant?.name || "Your Restaurant";
  const isPendingApproval = String(existingRestaurant?.approval_status || "").toLowerCase() === "pending";

  useEffect(() => {
    if (!onLogoPreviewChange) return;
    onLogoPreviewChange(logoPreviewUrl || "");
  }, [logoPreviewUrl, onLogoPreviewChange]);

  useEffect(() => {
    if (galleryPreviewUrls.length === 0) {
      setActiveGalleryIndex(0);
      return;
    }
    setActiveGalleryIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= galleryPreviewUrls.length) return galleryPreviewUrls.length - 1;
      return prev;
    });
  }, [galleryPreviewUrls]);

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    return () => {
      Object.values(documentPreviewUrls).forEach((url) => {
        if (String(url || "").startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [documentPreviewUrls]);

  function getPreviewHref(sourceUrl, key) {
    const safeUrl = String(sourceUrl || "").trim();
    if (!safeUrl) return "";
    if (!safeUrl.startsWith("data:")) return safeUrl;

    if (documentPreviewUrls[key]) return documentPreviewUrls[key];

    const blobUrl = dataUrlToBlobUrl(safeUrl);
    if (blobUrl !== safeUrl) {
      setDocumentPreviewUrls((prev) => ({ ...prev, [key]: blobUrl }));
    }
    return blobUrl;
  }

  async function onPickLogo(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      alert("Please select an image file (PNG, JPG, JPEG).");
      event.target.value = "";
      return;
    }
    try {
      setLogoDataUrl(await readFileAsDataUrl(file));
    } catch (fileError) {
      alert(fileError.message || "Failed to process image.");
    }
  }

  async function onPickGallery(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const imageFiles = files.filter((file) => file.type?.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      alert("Only image files are allowed (PNG, JPG, JPEG).");
    }
    if (!imageFiles.length) {
      event.target.value = "";
      return;
    }

    try {
      const pickedUrls = await Promise.all(imageFiles.map((file) => readFileAsDataUrl(file)));
      setGalleryDataUrls((prev) => {
        const merged = [...prev, ...pickedUrls]
          .map((url) => String(url || "").trim())
          .filter(Boolean);
        const deduped = [...new Set(merged)];
        if (deduped.length > MAX_GALLERY_PHOTOS) {
          alert(`You can upload up to ${MAX_GALLERY_PHOTOS} photos.`);
          return deduped.slice(0, MAX_GALLERY_PHOTOS);
        }
        return deduped;
      });
      setActiveGalleryIndex((prev) => (prev < 0 ? 0 : prev));
    } catch (fileError) {
      alert(fileError.message || "Failed to process image.");
    } finally {
      event.target.value = "";
    }
  }

  async function onPickBusinessLicense(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!VALID_DOCUMENT_TYPES.has(file.type)) {
      alert("Please select a PDF, PNG, or JPG file.");
      event.target.value = "";
      return;
    }
    try {
      setBusinessLicenseUrl(await readFileAsDataUrl(file));
      setBusinessLicenseName(file.name);
    } catch (fileError) {
      alert(fileError.message || "Failed to process file.");
    } finally {
      event.target.value = "";
    }
  }

  async function onPickHealthCertificate(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!VALID_DOCUMENT_TYPES.has(file.type)) {
      alert("Please select a PDF, PNG, or JPG file.");
      event.target.value = "";
      return;
    }
    try {
      setHealthCertificateUrl(await readFileAsDataUrl(file));
      setHealthCertificateName(file.name);
    } catch (fileError) {
      alert(fileError.message || "Failed to process file.");
    } finally {
      event.target.value = "";
    }
  }

  function removeGalleryPhoto(indexToRemove) {
    setGalleryDataUrls((prev) => {
      const next = prev.filter((_, index) => index !== indexToRemove);
      setActiveGalleryIndex((current) => {
        if (next.length === 0) return 0;
        if (indexToRemove < current) return current - 1;
        if (current >= next.length) return next.length - 1;
        return current;
      });
      return next;
    });
  }

  function showPreviousGalleryPhoto() {
    if (galleryPreviewUrls.length <= 1) return;
    setActiveGalleryIndex((prev) => (prev - 1 + galleryPreviewUrls.length) % galleryPreviewUrls.length);
  }

  function showNextGalleryPhoto() {
    if (galleryPreviewUrls.length <= 1) return;
    setActiveGalleryIndex((prev) => (prev + 1) % galleryPreviewUrls.length);
  }

  // Handle map click → pin restaurant location
  function handleMapClick(evt) {
    const { lngLat } = evt;
    setLatitude(Number(lngLat.lat.toFixed(6)));
    setLongitude(Number(lngLat.lng.toFixed(6)));
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this browser.");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setViewState((vs) => ({ ...vs, latitude: lat, longitude: lng, zoom: 15 }));
        setLocationLoading(false);
      },
      () => {
        setError("Unable to fetch your current location.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!address.trim()) { setError("Address is required."); return; }
    if (!city.trim()) { setError("City is required."); return; }
    if (latitude == null || longitude == null) {
      setError("Select your restaurant location on the map.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: restaurantName,
        description: "",
        cuisine: cuisineType,
        address: buildAddress(address, city),
        opening_time: openingTime,
        closing_time: closingTime,
        latitude,
        longitude,
        price_range: priceRange || null,
        dietary_support: dietarySupport,
        logo_url: logoPreviewUrl || null,
        cover_url: coverPreviewUrl || null,
        gallery_urls: galleryPreviewUrls,
        business_license_url: businessLicenseUrl || null,
        business_license_name: businessLicenseName || null,
        health_certificate_url: healthCertificateUrl || null,
        health_certificate_name: healthCertificateName || null,
      };

      if (existingRestaurant) {
        const updated = await updateMyRestaurant(payload);
        setExistingRestaurant((prev) => ({ ...(prev || {}), ...updated }));
        setSuccess("Restaurant updated successfully!");
        setIsEditing(String(updated?.approval_status || existingRestaurant?.approval_status || "").toLowerCase() === "pending");
        if (onSaved) onSaved();
      } else {
        const created = await createRestaurant(payload);
        setExistingRestaurant(created);
        setSuccess("Restaurant created successfully!");
        setIsEditing(String(created?.approval_status || "").toLowerCase() === "pending");
        if (onSaved) onSaved();
      }
    } catch (submitError) {
      setError(submitError.message || "Failed to save restaurant.");
    } finally {
      setLoading(false);
    }
  }

  function startEditing(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setError("");
    setSuccess("");
    setIsEditing(true);
  }

  function cancelEditing() {
    if (!existingRestaurant) return;
    const parsedAddress = splitAddressAndCity(existingRestaurant.address || "");
    const lat = Number(existingRestaurant.latitude);
    const lng = Number(existingRestaurant.longitude);
    const storedGallery = normalizeGalleryUrls(existingRestaurant.gallery_urls || existingRestaurant.galleryUrls || []);
    const legacyCover = String(existingRestaurant.cover_url || existingRestaurant.coverUrl || "").trim();

    setError("");
    setSuccess("");
    setRestaurantName(existingRestaurant.name || "");
    setCuisineType(existingRestaurant.cuisine || "");
    setAddress(parsedAddress.address);
    setCity(parsedAddress.city);
    setOpeningTime(existingRestaurant.opening_time || "");
    setClosingTime(existingRestaurant.closing_time || "");
    setPriceRange(existingRestaurant.price_range || "");
    setDietarySupport(Array.isArray(existingRestaurant.dietary_support) ? existingRestaurant.dietary_support : []);
    setLogoDataUrl(existingRestaurant.logo_url || existingRestaurant.logoUrl || "");
    setBusinessLicenseUrl(existingRestaurant.business_license_url || "");
    setBusinessLicenseName(existingRestaurant.business_license_name || "");
    setHealthCertificateUrl(existingRestaurant.health_certificate_url || "");
    setHealthCertificateName(existingRestaurant.health_certificate_name || "");
    setGalleryDataUrls(storedGallery.length ? storedGallery : (legacyCover ? [legacyCover] : []));
    if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
      setLatitude(lat);
      setLongitude(lng);
      setViewState({ longitude: lng, latitude: lat, zoom: 14 });
    } else {
      setLatitude(null);
      setLongitude(null);
    }
    setIsEditing(false);
  }

  function formatProfileTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return "--:--";
    const parsed = new Date(`2000-01-01T${raw.slice(0, 8)}`);
    if (Number.isNaN(parsed.getTime())) return raw.slice(0, 5);
    return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  }

  function openDeleteModal() {
    setDeleteAccountError("");
    setDeleteConfirmationText("");
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
      if (event.key === "Escape") {
        closeDeleteModal();
      }
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
      logout();
      navigate("/");
    } catch (deleteError) {
      setDeleteAccountError(deleteError.message || "Failed to delete account.");
    } finally {
      setDeletingAccount(false);
    }
  }

  const RESTAURANT_DELETE_TEXT = "DELETE RESTAURANT";
  const isRestaurantDeleteConfirmed = restaurantDeleteConfirmText.trim().toUpperCase() === RESTAURANT_DELETE_TEXT;

  async function handleRequestRestaurantDeletion() {
    if (!isRestaurantDeleteConfirmed) {
      setRestaurantDeleteError(`Please type ${RESTAURANT_DELETE_TEXT} to confirm.`);
      return;
    }
    setRequestingRestaurantDeletion(true);
    setRestaurantDeleteError("");
    try {
      await requestRestaurantDeletion();
      setRestaurantDeletionRequested(true);
      setShowRestaurantDeleteModal(false);
      setRestaurantDeleteConfirmText("");
    } catch (err) {
      setRestaurantDeleteError(err.message || "Failed to submit deletion request.");
    } finally {
      setRequestingRestaurantDeletion(false);
    }
  }

  if (!initialLoadComplete) {
    return (
      <div className="userProfile">
        <p style={{ padding: "20px", color: "#888" }}>Loading restaurant profile...</p>
      </div>
    );
  }

  const viewOnly = Boolean(existingRestaurant && !isEditing && !isPendingApproval);
  const heroSubtitle = buildAddress(address, city) || existingRestaurant?.address || "Restaurant profile";
  const heroHours = `${formatProfileTime(openingTime || existingRestaurant?.opening_time || "")} - ${formatProfileTime(
    closingTime || existingRestaurant?.closing_time || ""
  )}`;
  const dietaryLabel = Array.isArray(dietarySupport) && dietarySupport.length ? dietarySupport.join(", ") : "Not set";

  return (
    <div className="userProfile ownerProfile ownerProfile--aligned">
      <section className="userProfileHero ownerProfileHero">
        {logoPreviewUrl ? (
          <img className="userProfileHero__avatar ownerProfileHero__avatar" src={logoPreviewUrl} alt={`${profileName} logo`} />
        ) : (
          <div className="userProfileHero__avatar ownerProfileHero__avatar ownerProfileHero__avatar--fallback">
            {profileName.charAt(0).toUpperCase() || "R"}
          </div>
        )}
        <div className="userProfileHero__content">
          <h1 className="userProfileHero__name">{profileName}</h1>
          <p className="userProfileHero__email">{heroSubtitle}</p>
          <div className="userProfileHero__meta">
            <span className="metaPill">Cuisine: {cuisineType || existingRestaurant?.cuisine || "Not set"}</span>
            <span className="metaPill">Hours: {heroHours}</span>
          </div>
        </div>
        <label className="btn btn--gold userProfileHero__uploadBtn">
          Upload logo
          <input
            className="imageCard__input"
            type="file"
            accept="image/png, image/jpeg"
            onChange={onPickLogo}
            disabled={viewOnly}
          />
        </label>
      </section>

      {!existingRestaurant && initialLoadComplete && error && (
        <div className="ownerProfile__feedback ownerProfile__feedback--error userProfile__feedbackError">{error}</div>
      )}

      <div className="userProfileLayout ownerProfileLayout">
        <form className="formCard formCard--userProfile userProfileFormCard ownerProfileFormCard" onSubmit={onSubmit}>
          <div className="ownerProfileSettingsHeader">
            <div className="formCard__title">Restaurant Settings</div>
            <div className="ownerProfileSettingsHeader__actions">
              {viewOnly ? (
                <>
                  <button
                    key="edit-profile"
                    className="btn btn--gold ownerProfileSettingsHeader__actionBtn"
                    type="button"
                    onClick={startEditing}
                  >
                    Edit Profile
                  </button>
                  {existingRestaurant && (
                    restaurantDeletionRequested ? (
                      <span className="statusBadge statusBadge--pending ownerProfileSettingsHeader__status">
                        Deletion Pending
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost ownerDangerTriggerBtn ownerProfileSettingsHeader__actionBtn"
                        onClick={() => {
                          setRestaurantDeleteError("");
                          setRestaurantDeleteConfirmText("");
                          setShowRestaurantDeleteModal(true);
                        }}
                      >
                        Delete Restaurant
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost ownerDangerTriggerBtn ownerProfileSettingsHeader__actionBtn"
                    onClick={openDeleteModal}
                    disabled={deletingAccount}
                  >
                    Delete Account
                  </button>
                </>
              ) : (
                <>
                  <button
                    key="save-profile"
                    className="btn btn--gold ownerProfileSettingsHeader__actionBtn"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save"}
                  </button>
                  {existingRestaurant && !isPendingApproval && (
                    <button
                      className="btn btn--ghost ownerProfileSettingsHeader__actionBtn"
                      type="button"
                      onClick={cancelEditing}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <label className="field">
            <span>Restaurant name</span>
            <input
              type="text"
              placeholder="Enter restaurant name"
              value={restaurantName}
              onChange={(event) => setRestaurantName(event.target.value)}
              required
              disabled={viewOnly}
            />
          </label>

          <div className="twoCols">
            <label className="field">
              <span>Opening time</span>
              <input type="time" value={openingTime} onChange={(event) => setOpeningTime(event.target.value)} required disabled={viewOnly} />
            </label>
            <label className="field">
              <span>Closing time</span>
              <input type="time" value={closingTime} onChange={(event) => setClosingTime(event.target.value)} required disabled={viewOnly} />
            </label>
          </div>

          <label className="field">
            <span>Cuisine type</span>
            <ThemedSelect
              value={cuisineType}
              onChange={setCuisineType}
              options={CUISINES.map((cuisine) => ({ value: cuisine, label: cuisine }))}
              placeholder="Select cuisine type"
              ariaLabel="Select cuisine type"
              disabled={viewOnly}
            />
          </label>

          <div className="ownerProfileFilterGroup">
            <span>Price category</span>
            <div className="ownerFilterChipRow">
              {PRICE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`ownerFilterChip ownerFilterChip--button ${priceRange === option.value ? "is-active" : ""}`}
                  onClick={() => setPriceRange((prev) => (prev === option.value ? "" : option.value))}
                  disabled={viewOnly}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ownerProfileFilterGroup">
            <span>Dietary support</span>
            <div className="ownerFilterChipRow">
              {DIETARY_OPTIONS.map((option) => {
                const isActive = dietarySupport.includes(option.value);
                return (
                  <label key={option.value} className={`ownerFilterChip ${isActive ? "is-active" : ""}`}>
                    <input
                      className="ownerFilterChip__input"
                      type="checkbox"
                      checked={isActive}
                      disabled={viewOnly}
                      onChange={() => {
                        setDietarySupport((prev) => (
                          prev.includes(option.value)
                            ? prev.filter((item) => item !== option.value)
                            : [...prev, option.value]
                        ));
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="appearanceSection">
            <div>
              <div className="appearanceSection__label">Appearance</div>
              <div className="appearanceSection__sub">
                {theme === "dark" ? "Dark mode is on" : "Light mode is on"}
              </div>
            </div>
            <button type="button" className="appearanceToggle" onClick={toggleTheme}>
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>

          <div className="twoCols">
            <label className="field">
              <span>Address</span>
              <input
                className="ownerProfile__locationInput"
                type="text"
                placeholder="Street address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                required
                disabled={viewOnly}
              />
            </label>
            <label className="field">
              <span>City</span>
              <input
                className="ownerProfile__locationInput"
                type="text"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                required
                disabled={viewOnly}
              />
            </label>
          </div>

          <div className="ownerProfileMapField">
            <div className="ownerProfileMapField__header">
              <span>Map location picker</span>
              <button type="button" className="btn btn--ghost" onClick={useCurrentLocation} disabled={locationLoading || viewOnly}>
                {locationLoading ? "Locating..." : "Use My Current Location"}
              </button>
            </div>
            <div className="ownerProfileMapField__hint">
              Click on the map to pin your restaurant location.
            </div>

            <div className="ownerProfileMapPicker">
              <Map
                {...viewState}
                onMove={(evt) => setViewState(evt.viewState)}
                onClick={viewOnly ? undefined : handleMapClick}
                mapboxAccessToken={MAPBOX_TOKEN}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                cursor={viewOnly ? "grab" : "crosshair"}
              >
                <NavigationControl position="top-right" />
                {latitude != null && longitude != null && (
                  <Marker longitude={longitude} latitude={latitude} anchor="bottom">
                    <div className="ownerMapPin" title={`${latitude}, ${longitude}`}>Pin</div>
                  </Marker>
                )}
              </Map>
            </div>

            <div className="ownerProfileMapCoords">
              Latitude: {latitude != null ? latitude : "--"} | Longitude: {longitude != null ? longitude : "--"}
            </div>
          </div>

          {!viewOnly && (
            <>
              {error && <div className="ownerProfile__feedback ownerProfile__feedback--error">{error}</div>}
              {success && <div className="ownerProfile__feedback ownerProfile__feedback--success">{success}</div>}
            </>
          )}
        </form>

        <div className="userProfileSide ownerProfileSide">
          <div className="formCard formCard--userProfile profileExtraCard ownerProfileMediaCard">
            <div className="formCard__title">Branding</div>
            <div className="ownerProfileGrid__media">
              <div className="imageCard imageCard--equal">
                <div className="imageCard__title">Logo image</div>
                <div className="imageCard__preview imageCard__preview--equal imageCard__preview--logo">
                  {logoPreviewUrl ? (
                    <img className="imageCard__img imageCard__img--logo" src={logoPreviewUrl} alt="Logo" />
                  ) : (
                    <div className="imageCard__placeholder">
                      <div className="imageCard__formats">PNG, JPG, or JPEG</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="imageCard imageCard--equal">
                <div className="imageCard__title">Restaurant photos</div>
                <div className="imageCard__preview imageCard__preview--equal">
                  {galleryPreviewUrls.length ? (
                    <div className="imageCard__carousel">
                      <img
                        loading="lazy"
                        className="imageCard__img imageCard__img--gallery"
                        src={activeGalleryPhoto}
                        alt={`Restaurant photo ${activeGalleryIndex + 1}`}
                      />
                      {galleryPreviewUrls.length > 1 && (
                        <>
                          <button
                            type="button"
                            className="imageCard__carouselArrow imageCard__carouselArrow--left"
                            onClick={showPreviousGalleryPhoto}
                            aria-label="Previous photo"
                          >
                            {"<"}
                          </button>
                          <button
                            type="button"
                            className="imageCard__carouselArrow imageCard__carouselArrow--right"
                            onClick={showNextGalleryPhoto}
                            aria-label="Next photo"
                          >
                            {">"}
                          </button>
                        </>
                      )}
                      <div className="imageCard__carouselMeta">
                        <span>{activeGalleryIndex + 1} / {galleryPreviewUrls.length}</span>
                        <button
                          type="button"
                          className="imageCard__removeBtn"
                          onClick={() => removeGalleryPhoto(activeGalleryIndex)}
                          aria-label={`Remove photo ${activeGalleryIndex + 1}`}
                          disabled={viewOnly}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="imageCard__placeholder">
                      <div className="imageCard__formats">PNG, JPG, or JPEG (up to {MAX_GALLERY_PHOTOS} photos)</div>
                    </div>
                  )}
                </div>
                <label className="btn btn--gold imageCard__btn">
                  Upload photos
                  <input className="imageCard__input" type="file" accept="image/png, image/jpeg" multiple onChange={onPickGallery} disabled={viewOnly} />
                </label>
              </div>
            </div>
          </div>

          <div className="formCard formCard--userProfile profileExtraCard ownerProfileMediaCard">
            <div className="formCard__title">Documents</div>
            <div className="ownerProfileGrid__media">
              <div className="imageCard imageCard--equal">
                <div className="imageCard__title">Business license</div>
                <div className="imageCard__preview imageCard__preview--equal">
                  {businessLicenseName ? (
                    <div className="documentCard">
                      <div className="documentCard__name">{businessLicenseName}</div>
                      {businessLicenseUrl && (
                        <a className="documentCard__link" href={getPreviewHref(businessLicenseUrl, "business-license")} target="_blank" rel="noreferrer">
                          Preview file
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="imageCard__placeholder">
                      <div className="imageCard__formats">PDF, PNG, or JPG</div>
                    </div>
                  )}
                </div>
                <label className="btn btn--gold imageCard__btn">
                  Upload license
                  <input className="imageCard__input" type="file" accept="application/pdf,image/png,image/jpeg" onChange={onPickBusinessLicense} disabled={viewOnly} />
                </label>
              </div>

              <div className="imageCard imageCard--equal">
                <div className="imageCard__title">Health certificate</div>
                <div className="imageCard__preview imageCard__preview--equal">
                  {healthCertificateName ? (
                    <div className="documentCard">
                      <div className="documentCard__name">{healthCertificateName}</div>
                      {healthCertificateUrl && (
                        <a className="documentCard__link" href={getPreviewHref(healthCertificateUrl, "health-certificate")} target="_blank" rel="noreferrer">
                          Preview file
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="imageCard__placeholder">
                      <div className="imageCard__formats">PDF, PNG, or JPG</div>
                    </div>
                  )}
                </div>
                <label className="btn btn--gold imageCard__btn">
                  Upload certificate
                  <input className="imageCard__input" type="file" accept="application/pdf,image/png,image/jpeg" onChange={onPickHealthCertificate} disabled={viewOnly} />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRestaurantDeleteModal && (
        <div className="modal is-open" role="dialog" aria-modal="true">
          <div className="modal__backdrop" onClick={() => { if (!requestingRestaurantDeletion) setShowRestaurantDeleteModal(false); }} />
          <div className="modal__panel confirmDialog ownerDeleteModal">
            <h3 className="confirmDialog__title ownerDangerCard__title">Delete Restaurant</h3>
            <p className="confirmDialog__message ownerDeleteModal__message">
              This will send a deletion request to the admin. Your restaurant will be permanently deleted once approved. You can still use your account while the request is pending.
            </p>
            <label className="field ownerDeleteModal__field">
              <span>Type "DELETE RESTAURANT" to confirm</span>
              <input
                type="text"
                value={restaurantDeleteConfirmText}
                onChange={(e) => { setRestaurantDeleteConfirmText(e.target.value); if (restaurantDeleteError) setRestaurantDeleteError(""); }}
                placeholder="DELETE RESTAURANT"
                autoFocus
              />
            </label>
            {restaurantDeleteError && <div className="ownerDeleteModal__error">{restaurantDeleteError}</div>}
            <div className="confirmDialog__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowRestaurantDeleteModal(false)}
                disabled={requestingRestaurantDeletion}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--ghost ownerDangerCard__btn"
                onClick={handleRequestRestaurantDeletion}
                disabled={requestingRestaurantDeletion || !isRestaurantDeleteConfirmed}
              >
                {requestingRestaurantDeletion ? "Submitting..." : "Submit Deletion Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal is-open" role="dialog" aria-modal="true" aria-labelledby="owner-delete-modal-title">
          <div className="modal__backdrop" onClick={closeDeleteModal} />
          <div className="modal__panel confirmDialog ownerDeleteModal">
            <h3 id="owner-delete-modal-title" className="confirmDialog__title ownerDangerCard__title">Delete Account</h3>
            <p className="confirmDialog__message ownerDeleteModal__message">
              This permanently deletes your owner account and owned restaurant data.
            </p>
            <label className="field ownerDeleteModal__field">
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
            {deleteAccountError && <div className="ownerDeleteModal__error">{deleteAccountError}</div>}
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
                className="btn btn--ghost ownerDangerCard__btn"
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
