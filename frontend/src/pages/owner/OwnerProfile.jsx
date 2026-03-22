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
  const [coverDataUrl, setCoverDataUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingRestaurant, setExistingRestaurant] = useState(null);
  const [isEditing, setIsEditing] = useState(true);

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
        setCoverDataUrl(restaurant.cover_url || restaurant.coverUrl || "");

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
      });
  }, []);

  const logoPreviewUrl = useMemo(
    () => logoDataUrl || existingRestaurant?.logo_url || existingRestaurant?.logoUrl || "",
    [logoDataUrl, existingRestaurant]
  );

  const coverPreviewUrl = useMemo(
    () => coverDataUrl || existingRestaurant?.cover_url || existingRestaurant?.coverUrl || "",
    [coverDataUrl, existingRestaurant]
  );

  const profileName = restaurantName.trim() || existingRestaurant?.name || "Your Restaurant";

  useEffect(() => {
    if (!onLogoPreviewChange) return;
    onLogoPreviewChange(logoPreviewUrl || "");
  }, [logoPreviewUrl, onLogoPreviewChange]);

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
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

  async function onPickCover(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      alert("Please select an image file (PNG, JPG, JPEG).");
      event.target.value = "";
      return;
    }
    try {
      setCoverDataUrl(await readFileAsDataUrl(file));
    } catch (fileError) {
      alert(fileError.message || "Failed to process image.");
    }
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
      };

      if (existingRestaurant) {
        const updated = await updateMyRestaurant(payload);
        setExistingRestaurant(updated);
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
      <h1 className="ownerProfile__title">{existingRestaurant ? "Edit Restaurant Profile" : "Set Up Restaurant Profile"}</h1>

      {existingRestaurant && !isEditing ? (
        <section className="formCard ownerProfileViewCard">
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
              <span className="ownerProfileViewLabel">Background image</span>
              <span className="ownerProfileViewValue">
                {coverPreviewUrl ? <img loading="lazy" className="ownerProfileViewImage" src={coverPreviewUrl} alt={`${profileName} background`} /> : "Not set"}
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
              <span className="ownerProfileViewLabel">Appearance</span>
              <span className="ownerProfileViewValue">
                <button type="button" className="appearanceToggle" onClick={toggleTheme}>
                  <span className="appearanceToggle__icon">{theme === "dark" ? "☀️" : "🌙"}</span>
                  {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
                </button>
              </span>
            </div>
          </div>

          <div className="formCard__actions">
            <button className="btn btn--gold btn--xl" type="button" onClick={startEditing}>
              Edit
            </button>
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
                <div className="imageCard__title">Background image</div>
                <div className="imageCard__preview imageCard__preview--equal">
                  {coverPreviewUrl ? (
                    <img loading="lazy" className="imageCard__img" src={coverPreviewUrl} alt="Background" />
                  ) : (
                    <div className="imageCard__placeholder">
                      <div className="imageCard__formats">PNG, JPG, or JPEG</div>
                    </div>
                  )}
                </div>
                <label className="btn btn--gold imageCard__btn">
                  Upload background
                  <input className="imageCard__input" type="file" accept="image/png, image/jpeg" onChange={onPickCover} />
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
