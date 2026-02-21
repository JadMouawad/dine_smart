import React, { useEffect, useMemo, useState } from "react";

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

export default function OwnerProfile({ onLogoPreviewChange }) {
    const [restaurantName, setRestaurantName] = useState("");
    const [openingTime, setOpeningTime] = useState("");
    const [closingTime, setClosingTime] = useState("");
    const [cuisineType, setCuisineType] = useState("");
    const [location, setLocation] = useState("");
    const [logoFile, setLogoFile] = useState(null);
    const [coverFile, setCoverFile] = useState(null);

    const logoPreviewUrl = useMemo(() => {
        if (!logoFile) return "";
        return URL.createObjectURL(logoFile);
    }, [logoFile]);

    const coverPreviewUrl = useMemo(() => {
        if (!coverFile) return "";
        return URL.createObjectURL(coverFile);
    }, [coverFile]);

    useEffect(() => {
        if (!onLogoPreviewChange) return;

        if (logoPreviewUrl) onLogoPreviewChange(logoPreviewUrl);
        else onLogoPreviewChange("");
    }, [logoPreviewUrl, onLogoPreviewChange]);

    function onPickLogo(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const isImage = file.type && file.type.startsWith("image/");
        if (!isImage) {
            alert("Please select an image file (PNG, JPG, JPEG).");
            e.target.value = "";
            return;
        }

        setLogoFile(file);
    }

    function onPickCover(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const isImage = file.type && file.type.startsWith("image/");
        if (!isImage) {
            alert("Please select an image file (PNG, JPG, JPEG).");
            e.target.value = "";
            return;
        }

        setCoverFile(file);
    }

    function onSubmit(e) {
        e.preventDefault();

        const payload = {
            restaurantName,
            openingTime,
            closingTime,
            cuisineType,
            location,
            logoFile,
            coverFile,
        };

        console.log("Restaurant profile payload:", payload);
        alert("Saved (frontend only). Check console for payload.");
    }

    return (
        <div className="ownerProfile">
            <h1 className="ownerProfile__title">Set Up Restaurant Profile</h1>

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

                        <label className="field">
                            <span>Location</span>
                            <input
                                type="text"
                                placeholder="Enter location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                required
                            />
                        </label>

                        <div className="formCard__actions">
                            <button className="btn btn--gold btn--xl" type="submit">
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}