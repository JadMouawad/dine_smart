import React, { useEffect, useMemo, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRestaurant, getMyRestaurant, updateMyRestaurant } from "../../services/restaurantService";
import { useTheme } from "../../auth/ThemeContext.jsx";

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
  const { theme, toggleTheme } = useTheme();
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
  const [documentPreviewUrls, setDocumentPreviewUrls] = useState({});

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
        setIsEditing(false);
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
  }, []);

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
        setIsEditing(false);
        if (onSaved) onSaved();
      } else {
        const created = await createRestaurant(payload);
        setExistingRestaurant(created);
        setSuccess("Restaurant created successfully!");
        setIsEditing(false);
        if (onSaved) onSaved();
      }
    } catch (submitError) {
      setError(submitError.message || "Failed to save restaurant.");
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    setError("");
    setSuccess("");
    setIsEditing(true);
  }

  return (
    <div className="ownerProfile">
      {!existingRestaurant && initialLoadComplete && error && (
        <div className="ownerProfile__feedback ownerProfile__feedback--error">{error}</div>
      )}

      {existingRestaurant && !isEditing ? (
        <section className="formCard ownerProfileViewCard">
          <div className="ownerProfileViewCard__topActions">
            <button className="btn btn--gold" type="button" onClick={startEditing}>
              Edit profile & photos
            </button>
          </div>
          <div className="ownerProfileViewGrid">
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Restaurant name</span>
              <span className="ownerProfileViewValue">{existingRestaurant.name || "Not set"}</span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Logo</span>
              <span className="ownerProfileViewValue">
                {logoPreviewUrl ? <img className="ownerProfileViewImage ownerProfileViewImage--logo" src={logoPreviewUrl} alt={`${profileName} logo`} /> : "Not set"}
              </span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Restaurant photos</span>
              <span className="ownerProfileViewValue">
                {galleryPreviewUrls.length ? (
                  <div className="ownerProfileViewGallery">
                    {galleryPreviewUrls.map((photoUrl, index) => (
                      <img
                        key={`${photoUrl}-${index}`}
                        loading="lazy"
                        className="ownerProfileViewImage ownerProfileViewImage--gallery"
                        src={photoUrl}
                        alt={`${profileName} photo ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : "Not set"}
              </span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Cuisine</span>
              <span className="ownerProfileViewValue">{existingRestaurant.cuisine || "Not set"}</span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Hours</span>
              <span className="ownerProfileViewValue">
                {(existingRestaurant.opening_time || "").slice(0, 5) || "--:--"} - {(existingRestaurant.closing_time || "").slice(0, 5) || "--:--"}
              </span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Address</span>
              <span className="ownerProfileViewValue">{address || "Not set"}</span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">City</span>
              <span className="ownerProfileViewValue">{city || "Not set"}</span>
            </div>
            <div className="ownerProfileViewRow ownerProfileViewRow--map">
              <span className="ownerProfileViewLabel">Location</span>
              <div className="ownerProfileViewValue ownerProfileViewMapWrap">
                {latitude != null && longitude != null ? (
                  <Map
                    longitude={longitude}
                    latitude={latitude}
                    zoom={14}
                    interactive={false}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: "100%", height: "180px" }}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                  >
                    <Marker longitude={longitude} latitude={latitude} anchor="bottom">
                      <div className="ownerMapPin">📍</div>
                    </Marker>
                  </Map>
                ) : (
                  <span className="ownerProfileViewEmpty">Not set — click Edit to pin location</span>
                )}
              </div>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Price category</span>
              <span className="ownerProfileViewValue">{existingRestaurant.price_range || "Not set"}</span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Dietary support</span>
              <span className="ownerProfileViewValue">
                {Array.isArray(existingRestaurant.dietary_support) && existingRestaurant.dietary_support.length
                  ? existingRestaurant.dietary_support.join(", ")
                  : "Not set"}
              </span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Business license</span>
              <span className="ownerProfileViewValue">
                {businessLicenseUrl ? (
                  <a href={getPreviewHref(businessLicenseUrl, "business-license")} target="_blank" rel="noreferrer">
                    {businessLicenseName || "View file"}
                  </a>
                ) : "Not uploaded"}
              </span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Health certificate</span>
              <span className="ownerProfileViewValue">
                {healthCertificateUrl ? (
                  <a href={getPreviewHref(healthCertificateUrl, "health-certificate")} target="_blank" rel="noreferrer">
                    {healthCertificateName || "View file"}
                  </a>
                ) : "Not uploaded"}
              </span>
            </div>
            <div className="ownerProfileViewRow">
              <span className="ownerProfileViewLabel">Appearance</span>
              <span className="ownerProfileViewValue">
                <button type="button" className="appearanceToggle" onClick={toggleTheme}>
                  <span className="appearanceToggle__icon">{theme === "dark" ? "☀️" : "🌙"}</span>
                  {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
                </button>
              </span>
            </div>
          </div>

        </section>
      ) : (
        <form className="ownerProfile__form" onSubmit={onSubmit}>
          <div className="ownerProfileGrid">
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
                <label className="btn btn--gold imageCard__btn imageCard__btn--logo">
                  Upload logo
                  <input className="imageCard__input" type="file" accept="image/png, image/jpeg" onChange={onPickLogo} />
                </label>
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
                            ‹
                          </button>
                          <button
                            type="button"
                            className="imageCard__carouselArrow imageCard__carouselArrow--right"
                            onClick={showNextGalleryPhoto}
                            aria-label="Next photo"
                          >
                            ›
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
                  <input className="imageCard__input" type="file" accept="image/png, image/jpeg" multiple onChange={onPickGallery} />
                </label>
              </div>

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
                  <input className="imageCard__input" type="file" accept="application/pdf,image/png,image/jpeg" onChange={onPickBusinessLicense} />
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
                  <input className="imageCard__input" type="file" accept="application/pdf,image/png,image/jpeg" onChange={onPickHealthCertificate} />
                </label>
              </div>
            </div>

            <div className="formCard formCard--matchHeight">
              <label className="field">
                <span>Restaurant name</span>
                <input
                  type="text"
                  placeholder="Enter restaurant name"
                  value={restaurantName}
                  onChange={(event) => setRestaurantName(event.target.value)}
                  required
                />
              </label>

              <div className="twoCols">
                <label className="field">
                  <span>Opening time</span>
                  <input type="time" value={openingTime} onChange={(event) => setOpeningTime(event.target.value)} required />
                </label>
                <label className="field">
                  <span>Closing time</span>
                  <input type="time" value={closingTime} onChange={(event) => setClosingTime(event.target.value)} required />
                </label>
              </div>

              <label className="field">
                <span>Cuisine type</span>
                <select className="select" value={cuisineType} onChange={(event) => setCuisineType(event.target.value)} required>
                  <option value="" disabled>Select cuisine type</option>
                  {CUISINES.map((cuisine) => (
                    <option key={cuisine} value={cuisine}>{cuisine}</option>
                  ))}
                </select>
              </label>

              <div className="ownerProfileFilterGroup">
                <span>Price category</span>
                <div className="ownerFilterChipRow">
                  {PRICE_RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.value} type="button"
                      className={`ownerFilterChip ownerFilterChip--button ${priceRange === option.value ? "is-active" : ""}`}
                      onClick={() => setPriceRange((prev) => (prev === option.value ? "" : option.value))}
                    >{option.label}</button>
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
                          className="ownerFilterChip__input" type="checkbox" checked={isActive}
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
                  <span className="appearanceToggle__icon">{theme === "dark" ? "☀️" : "🌙"}</span>
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </button>
              </div>

              <div className="twoCols">
                <label className="field">
                  <span>Address</span>
                  <input
                    className="ownerProfile__locationInput" type="text" placeholder="Street address"
                    value={address} onChange={(event) => setAddress(event.target.value)} required
                  />
                </label>
                <label className="field">
                  <span>City</span>
                  <input
                    className="ownerProfile__locationInput" type="text" placeholder="City"
                    value={city} onChange={(event) => setCity(event.target.value)} required
                  />
                </label>
              </div>

              {/* ── Map location picker (Mapbox) ── */}
              <div className="ownerProfileMapField">
                <div className="ownerProfileMapField__header">
                  <span>Map location picker</span>
                  <button type="button" className="btn btn--ghost" onClick={useCurrentLocation} disabled={locationLoading}>
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
                    onClick={handleMapClick}
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle="mapbox://styles/mapbox/streets-v12"
                    cursor="crosshair"
                  >
                    <NavigationControl position="top-right" />

                    {/* Restaurant pin */}
                    {latitude != null && longitude != null && (
                      <Marker longitude={longitude} latitude={latitude} anchor="bottom">
                        <div className="ownerMapPin" title={`${latitude}, ${longitude}`}>📍</div>
                      </Marker>
                    )}
                  </Map>
                </div>

                <div className="ownerProfileMapCoords">
                  Latitude: {latitude != null ? latitude : "--"} | Longitude: {longitude != null ? longitude : "--"}
                </div>
              </div>

              {error && <div className="ownerProfile__feedback ownerProfile__feedback--error">{error}</div>}
              {success && <div className="ownerProfile__feedback ownerProfile__feedback--success">{success}</div>}

              <div className="formCard__actions">
                <button className="btn btn--gold btn--xl" type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
