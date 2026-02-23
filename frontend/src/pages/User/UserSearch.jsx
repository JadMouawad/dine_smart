import React, { useEffect, useMemo, useRef, useState } from "react";
import { getReviewsByRestaurantId, createReview } from "../../services/reviewService";
import { searchRestaurants, getRestaurantById } from "../../services/restaurantService";

const CUISINES = [
  "All",
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

const FAVORITES_KEY = "ds_favorites";

export default function UserSearch({
  goReservations,
  isGuest = false,
  onRequireSignup,
  restaurantToOpen,
  clearRestaurantToOpen,
  onSearchActiveChange
}) {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("All");

  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);

  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantNotFound, setRestaurantNotFound] = useState(false);
  const [detailsTab, setDetailsTab] = useState("menu"); // "menu" | "reviews"

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewPosting, setReviewPosting] = useState(false);

  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [activeSectionId, setActiveSectionId] = useState(null);

  const sectionRefs = useRef({});
  const sliderTrackRef = useRef(null);

  function requireAuth() {
    if (isGuest) {
      onRequireSignup?.();
      return false;
    }
    return true;
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(list) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  }

  function isFavorited(restaurantId) {
    return favorites.some((r) => r.id === restaurantId);
  }

  function toggleFavorite(restaurant) {
    setFavorites((prev) => {
      const exists = prev.some((r) => r.id === restaurant.id);
      const next = exists ? prev.filter((x) => x.id !== restaurant.id) : [...prev, restaurant];
      saveFavorites(next);
      return next;
    });
  }

  // Fetch restaurants from search API (query + cuisine)
  useEffect(() => {
    setRestaurantsLoading(true);
    const cuisineParam = cuisine === "All" ? null : cuisine;
    searchRestaurants(query.trim(), cuisineParam)
      .then((data) => setRestaurants(Array.isArray(data) ? data : []))
      .catch(() => setRestaurants([]))
      .finally(() => setRestaurantsLoading(false));
  }, [query, cuisine]);

  // If coming from Favorites -> open restaurant (validate by ID if needed)
  useEffect(() => {
    if (!restaurantToOpen) return;
    setRestaurantNotFound(false);
    if (restaurantToOpen.name != null) {
      setSelectedRestaurant(restaurantToOpen);
      setDetailsTab("menu");
      clearRestaurantToOpen?.();
      return;
    }
    const id = restaurantToOpen.id ?? restaurantToOpen;
    getRestaurantById(id)
      .then((r) => {
        setSelectedRestaurant(r);
        setDetailsTab("menu");
      })
      .catch(() => setRestaurantNotFound(true))
      .finally(() => clearRestaurantToOpen?.());
  }, [restaurantToOpen, clearRestaurantToOpen]);

  // Fetch real reviews from backend when reviews tab is opened
  useEffect(() => {
    if (!selectedRestaurant || detailsTab !== "reviews") return;
    setReviewsLoading(true);
    setReviews([]);
    getReviewsByRestaurantId(selectedRestaurant.id)
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [selectedRestaurant, detailsTab]);

  const filteredRestaurants = restaurants;

  useEffect(() => {
  const active = query.trim().length > 0 || cuisine !== "All";
  onSearchActiveChange?.(active);
}, [query, cuisine, onSearchActiveChange]);

  // ✅ IMPORTANT: Disable sticky navbar ONLY while inside restaurant details (menu/reviews)
  useEffect(() => {
    const inDetails = !!selectedRestaurant;
    document.body.classList.toggle("ds-nav-not-sticky", inDetails);
    return () => document.body.classList.remove("ds-nav-not-sticky");
  }, [selectedRestaurant]);

  // Active section tracking
  useEffect(() => {
    if (!selectedRestaurant) return;
    if (detailsTab !== "menu") return;

    const sections = selectedRestaurant.menu || [];
    if (!sections.length) return;

    setActiveSectionId((prev) => prev || sections[0].sectionId);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio || 0) - (a.intersectionRatio || 0))[0];

        if (visible) {
          const id = visible.target.getAttribute("data-section-id");
          if (id) setActiveSectionId(id);
        }
      },
      { threshold: 0.35 }
    );

    sections.forEach((sec) => {
      const el = sectionRefs.current[sec.sectionId];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [selectedRestaurant, detailsTab]);

  function scrollToSection(sectionId) {
    const el = sectionRefs.current[sectionId];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function slideSections(dir) {
    const el = sliderTrackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.6, behavior: "smooth" });
  }

  // =========================
  // Invalid restaurant ID
  // =========================
  if (restaurantNotFound) {
    return (
      <div className="userSearchPage">
        <div className="formCard formCard--userProfile" style={{ maxWidth: "400px", margin: "20px auto", textAlign: "center" }}>
          <p style={{ marginBottom: "16px", color: "#666" }}>Restaurant not found or no longer available.</p>
          <button type="button" className="btn btn--gold" onClick={() => setRestaurantNotFound(false)}>
            Back to search
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // Details view (restaurant)
  // =========================
  if (selectedRestaurant) {
    return (
      <div className="userSearchPage">
        <div className="userSearchTopCard">
          <div className="userSearchTopCard__left">
            <div className="restaurantAvatar" aria-label="Restaurant logo">
              {selectedRestaurant.logoUrl ? (
                <img className="restaurantAvatar__img" src={selectedRestaurant.logoUrl} alt={`${selectedRestaurant.name} logo`} />
              ) : (
                <span className="restaurantAvatar__fallback">{selectedRestaurant.name?.[0]?.toUpperCase() || "R"}</span>
              )}
            </div>

            <div className="userSearchTopCard__identity">
              <h1 className="userSearchTopCard__title">{selectedRestaurant.name}</h1>

              <div className="userSearchTopCard__meta">
                <span className="metaPill">{selectedRestaurant.cuisine}</span>
                <span className="metaPill">⭐ {selectedRestaurant.rating}</span>
                <span className="metaPill">
                  {(selectedRestaurant.opening_time ?? selectedRestaurant.openingTime) || "—"} – {(selectedRestaurant.closing_time ?? selectedRestaurant.closingTime) || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="userSearchTopCard__right userSearchTopCard__right--row">
            {/* Heart */}
            <button
              className={`favoriteHeartBtn favoriteHeartBtn--top ${isFavorited(selectedRestaurant.id) ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                if (!requireAuth()) return;
                toggleFavorite(selectedRestaurant);
              }}
              aria-label={isFavorited(selectedRestaurant.id) ? "Remove from favorites" : "Add to favorites"}
            >
              <svg viewBox="0 0 24 24" className="favoriteHeartIcon">
                <path d="M12 21s-7.2-4.6-9.6-9C.7 8.7 2.1 5.5 5.4 4.6c1.8-.5 3.6.1 4.8 1.4L12 7.8l1.8-1.8c1.2-1.3 3-1.9 4.8-1.4 3.3.9 4.7 4.1 3 7.4C19.2 16.4 12 21 12 21z" />
              </svg>
            </button>

            {/* Tabs */}
            <div className="detailsTabs detailsTabs--inline">
              <button
                className={`btn ${detailsTab === "menu" ? "btn--gold" : "btn--ghost"} detailsTabBtn`}
                type="button"
                onClick={() => setDetailsTab("menu")}
              >
                Menu
              </button>

              <button
                className={`btn ${detailsTab === "reviews" ? "btn--gold" : "btn--ghost"} detailsTabBtn`}
                type="button"
                onClick={() => setDetailsTab("reviews")}
              >
                Reviews
              </button>
            </div>

            {/* Reserve */}
            <button
              className="btn btn--ghost topActionBtn"
              type="button"
              onClick={() => {
                if (!requireAuth()) return;
                goReservations?.();
              }}
            >
              Reserve
            </button>

            {/* Back */}
            <button className="btn btn--ghost topActionBtn" type="button" onClick={() => { setSelectedRestaurant(null); setRestaurantNotFound(false); }}>
              Back
            </button>
          </div>
        </div>

        {detailsTab === "menu" ? (
          <div className="userMenuView">
            <h2 className="userMenuView__title">Menu</h2>

            {selectedRestaurant.menu?.length ? (
              <div className="menuSectionSlider">
                <button className="menuSectionSlider__arrow" type="button" onClick={() => slideSections(-1)} aria-label="Scroll sections left">
                  ‹
                </button>

                <div className="menuSectionSlider__pill" aria-label="Menu sections">
                  <div className="menuSectionSlider__track" ref={sliderTrackRef}>
                    {selectedRestaurant.menu.map((sec) => (
                      <button
                        key={sec.sectionId}
                        type="button"
                        className={`menuSectionSlider__btn ${activeSectionId === sec.sectionId ? "is-active" : ""}`}
                        onClick={() => scrollToSection(sec.sectionId)}
                      >
                        {sec.sectionName}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="menuSectionSlider__arrow" type="button" onClick={() => slideSections(1)} aria-label="Scroll sections right">
                  ›
                </button>
              </div>
            ) : null}

            {selectedRestaurant.menu?.length ? (
              <div className="userMenuSections">
                {selectedRestaurant.menu.map((sec) => (
                  <div
                    className="menuSectionBlock userMenuSectionBlock"
                    key={sec.sectionId}
                    data-section-id={sec.sectionId}
                    ref={(el) => {
                      if (el) sectionRefs.current[sec.sectionId] = el;
                    }}
                  >
                    <div className="menuSectionHeader">
                      <button className="btn btn--gold ownerMenuSectionBtn" type="button">
                        {sec.sectionName}
                      </button>
                    </div>

                    <div className="ownerMenuItemsGrid">
                      {sec.items.map((it) => (
                        <div className="menuItemCard" key={it.id}>
                          <div className="menuItemCard__media">
                            {it.imageUrl ? (
                              <img className="menuItemCard__img" src={it.imageUrl} alt={it.name} />
                            ) : (
                              <div className="menuItemCard__imgPlaceholder">PNG, JPG, or JPEG</div>
                            )}
                          </div>

                          <div className="menuItemCard__info">
                            <div className="menuItemCard__name">{it.name}</div>
                            <div className="menuItemCard__price">
                              {it.price} {it.currency}
                            </div>
                            {it.description && <div className="menuItemCard__desc">{it.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="menuSectionEmpty">No menu uploaded yet.</div>
            )}
          </div>
        ) : (
          <div className="restaurantReviewsPage">
            <div className="reviewCard">
              <div className="reviewCard__title">Add a review</div>

              <div className="reviewCard__row">
                <select
                  className="select reviewCard__select"
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  disabled={reviewPosting}
                >
                  <option value="5">5 ★</option>
                  <option value="4">4 ★</option>
                  <option value="3">3 ★</option>
                  <option value="2">2 ★</option>
                  <option value="1">1 ★</option>
                </select>

                <input
                  className="reviewCard__input"
                  type="text"
                  placeholder="Write your review (max 500 characters)"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  maxLength={500}
                  disabled={reviewPosting}
                />
                {reviewComment.length > 0 && (
                  <span className="reviewCard__charCount" style={{ fontSize: 12, color: "#888" }}>
                    {reviewComment.length}/500
                  </span>
                )}

                <button
                  className="btn btn--gold"
                  type="button"
                  disabled={reviewPosting}
                  onClick={async () => {
                    if (!requireAuth()) return;
                    if (!reviewComment.trim()) {
                      setReviewError("Please write a comment.");
                      return;
                    }
                    if (reviewComment.trim().length > 500) {
                      setReviewError("Review must be at most 500 characters.");
                      return;
                    }
                    setReviewError("");
                    setReviewPosting(true);
                    try {
                      await createReview(selectedRestaurant.id, {
                        rating: reviewRating,
                        comment: reviewComment.trim(),
                      });
                      setReviewComment("");
                      setReviewRating(5);
                      const [reviewsData, updatedRestaurant] = await Promise.all([
                        getReviewsByRestaurantId(selectedRestaurant.id),
                        getRestaurantById(selectedRestaurant.id),
                      ]);
                      setReviews(Array.isArray(reviewsData) ? reviewsData : []);
                      setSelectedRestaurant(updatedRestaurant);
                    } catch (err) {
                      setReviewError(err.message || "Failed to post review.");
                    } finally {
                      setReviewPosting(false);
                    }
                  }}
                >
                  {reviewPosting ? "Posting..." : "Post"}
                </button>
              </div>

              {reviewError && (
                <div style={{ color: "red", fontSize: 13, marginTop: 6 }}>{reviewError}</div>
              )}
            </div>

            <div className="reviewsDivider">
              <span className="reviewsDivider__text">What Diners Say</span>
            </div>

            {reviewsLoading ? (
              <div className="menuSectionEmpty">Loading reviews...</div>
            ) : reviews.length ? (
              <div className="reviewsStack">
                {reviews.map((rev) => (
                  <div className="reviewCardFull" key={rev.id}>
                    <div className="reviewCardFull__left">
                      <div className="reviewCardFull__avatar">
                        <span className="reviewCardFull__avatarFallback">
                          {(rev.user_name || rev.authorName || "?")[0].toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="reviewCardFull__right">
                      <div className="reviewCardFull__top">
                        <div className="reviewCardFull__userName">{rev.user_name || rev.authorName || "Anonymous"}</div>
                        <div className="reviewCardFull__date">
                          {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : ""}
                        </div>
                      </div>

                      <div className="reviewCardFull__stars">
                        {"★".repeat(rev.rating)}
                        {"☆".repeat(5 - rev.rating)}
                      </div>

                      <div className="reviewCardFull__text">{rev.comment}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="menuSectionEmpty">No reviews yet. Be the first!</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // =========================
  // Search/list view
  // =========================
  return (
    <div className="userSearchPage">
      <h1 className="userSearchPage__title">Search Restaurants</h1>

      <div className="searchBarCard">
        <input
          className="searchInput"
          type="text"
          placeholder="Type restaurant name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <select className="select searchCuisineSelect" value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
          {CUISINES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="restaurantGrid">
        {restaurantsLoading ? (
          <p style={{ padding: "20px", color: "#888" }}>Loading restaurants...</p>
        ) : filteredRestaurants.length === 0 ? (
          <p style={{ padding: "20px", color: "#888" }}>No restaurants found.</p>
        ) : null}
        {!restaurantsLoading && filteredRestaurants.map((r) => (
          <div
            key={r.id}
            className="restaurantCard"
            onClick={() => {
              setSelectedRestaurant(r);
              setDetailsTab("menu");
            }}
          >
            <div className="restaurantCard__cover">
              {r.coverUrl ? <img className="restaurantCard__coverImg" src={r.coverUrl} alt={r.name} /> : <div className="restaurantCard__coverPlaceholder">PNG, JPG, or JPEG</div>}
            </div>

            <div className="restaurantCard__body">
              <div className="restaurantCard__nameRow">
                <div className="restaurantCard__name">{r.name}</div>

                <div className="restaurantCard__ratingCol">
                  <button
                    className="btn btn--gold reserveMiniBtn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!requireAuth()) return;
                      goReservations?.();
                    }}
                  >
                    Reserve
                  </button>

                  <div className="restaurantCard__rating">⭐ {r.rating}</div>

                  <button
                    className={`favoriteHeartBtn ${isFavorited(r.id) ? "is-active" : ""}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!requireAuth()) return;
                      toggleFavorite(r);
                    }}
                    aria-label={isFavorited(r.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <svg viewBox="0 0 24 24" className="favoriteHeartIcon">
                      <path d="M12 21s-7.2-4.6-9.6-9C.7 8.7 2.1 5.5 5.4 4.6c1.8-.5 3.6.1 4.8 1.4L12 7.8l1.8-1.8c1.2-1.3 3-1.9 4.8-1.4 3.3.9 4.7 4.1 3 7.4C19.2 16.4 12 21 12 21z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="restaurantCard__cuisine">{r.cuisine}</div>
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}