import React, { useEffect, useMemo, useState } from "react";
import { createRestaurant, getMyRestaurant, updateMyRestaurant } from "../../services/restaurantService";

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

export default function OwnerProfile({ onLogoPreviewChange }) {
    const [restaurantName, setRestaurantName] = useState("");
    const [openingTime, setOpeningTime] = useState("");
    const [closingTime, setClosingTime] = useState("");
    const [cuisineType, setCuisineType] = useState("");
    const [location, setLocation] = useState("");
    const [priceRange, setPriceRange] = useState("");
    const [dietarySupport, setDietarySupport] = useState([]);
    const [logoDataUrl, setLogoDataUrl] = useState("");
    const [coverDataUrl, setCoverDataUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [existingRestaurant, setExistingRestaurant] = useState(null);
    const [isEditing, setIsEditing] = useState(true);

    // Load existing restaurant on mount
    useEffect(() => {
        getMyRestaurant()
            .then((restaurant) => {
                setExistingRestaurant(restaurant);
                setIsEditing(false);
                setRestaurantName(restaurant.name || "");
                setCuisineType(restaurant.cuisine || "");
                setLocation(restaurant.address || "");
                setOpeningTime(restaurant.opening_time || "");
                setClosingTime(restaurant.closing_time || "");
                setPriceRange(restaurant.price_range || "");
                setDietarySupport(Array.isArray(restaurant.dietary_support) ? restaurant.dietary_support : []);
                setLogoDataUrl(restaurant.logo_url || restaurant.logoUrl || "");
                setCoverDataUrl(restaurant.cover_url || restaurant.coverUrl || "");
            })
            .catch((err) => {
                console.error("getMyRestaurant error:", err.message);
            });
    }, []);

    const logoPreviewUrl = useMemo(() => (
        logoDataUrl || existingRestaurant?.logo_url || existingRestaurant?.logoUrl || ""
    ), [logoDataUrl, existingRestaurant]);

    const coverPreviewUrl = useMemo(() => (
        coverDataUrl || existingRestaurant?.cover_url || existingRestaurant?.coverUrl || ""
    ), [coverDataUrl, existingRestaurant]);

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

    async function onPickLogo(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const isImage = file.type && file.type.startsWith("image/");
        if (!isImage) {
            alert("Please select an image file (PNG, JPG, JPEG).");
            e.target.value = "";
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setLogoDataUrl(dataUrl);
        } catch (error) {
            alert(error.message || "Failed to process image.");
        }
    }

    async function onPickCover(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const isImage = file.type && file.type.startsWith("image/");
        if (!isImage) {
            alert("Please select an image file (PNG, JPG, JPEG).");
            e.target.value = "";
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setCoverDataUrl(dataUrl);
        } catch (error) {
            alert(error.message || "Failed to process image.");
        }
    }

    async function onSubmit(e) {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);
        try {
            const payload = {
                name: restaurantName,
                description: "",
                cuisine: cuisineType,
                address: location,
                opening_time: openingTime,
                closing_time: closingTime,
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
            } else {
                const created = await createRestaurant(payload);
                setExistingRestaurant(created);
                setSuccess("Restaurant created successfully!");
                setIsEditing(false);
            }
        } catch (err) {
            setError(err.message || "Failed to save restaurant.");
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
                                {coverPreviewUrl ? <img className="ownerProfileViewImage" src={coverPreviewUrl} alt={`${profileName} background`} /> : "Not set"}
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
                            <span className="ownerProfileViewLabel">Location</span>
                            <span className="ownerProfileViewValue">{existingRestaurant.address || "Not set"}</span>
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
                                <input
                                    className="imageCard__input"
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    onChange={onPickLogo}
                                />
                            </label>
                        </div>

                        <div className="imageCard imageCard--equal">
                            <div className="imageCard__title">Background image</div>

                            <div className="imageCard__preview imageCard__preview--equal">
                                {coverPreviewUrl ? (
                                    <img className="imageCard__img" src={coverPreviewUrl} alt="Background" />
                                ) : (
                                    <div className="imageCard__placeholder">
                                        <div className="imageCard__formats">PNG, JPG, or JPEG</div>
                                    </div>
                                )}
                            </div>

                            <label className="btn btn--gold imageCard__btn">
                                Upload background
                                <input
                                    className="imageCard__input"
                                    type="file"
                                    accept="image/png, image/jpeg"
                                    onChange={onPickCover}
                                />
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
                                onChange={(e) => setRestaurantName(e.target.value)}
                                required
                            />
                        </label>

                        <div className="twoCols">
                            <label className="field">
                                <span>Opening time</span>
                                <input
                                    type="time"
                                    value={openingTime}
                                    onChange={(e) => setOpeningTime(e.target.value)}
                                    required
                                />
                            </label>

                            <label className="field">
                                <span>Closing time</span>
                                <input
                                    type="time"
                                    value={closingTime}
                                    onChange={(e) => setClosingTime(e.target.value)}
                                    required
                                />
                            </label>
                        </div>

                        <label className="field">
                            <span>Cuisine type</span>
                            <select
                                className="select"
                                value={cuisineType}
                                onChange={(e) => setCuisineType(e.target.value)}
                                required
                            >
                                <option value="" disabled>
                                    Select cuisine type
                                </option>
                                {CUISINES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
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
                                        <label
                                            key={option.value}
                                            className={`ownerFilterChip ${isActive ? "is-active" : ""}`}
                                        >
                                            <input
                                                className="ownerFilterChip__input"
                                                type="checkbox"
                                                checked={isActive}
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

                        <label className="field">
                            <span>Location</span>
                            <input
                                className="ownerProfile__locationInput"
                                type="text"
                                placeholder="Enter Your Location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                required
                            />
                        </label>

                        

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
