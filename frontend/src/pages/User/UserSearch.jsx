import React, { useEffect, useMemo, useRef, useState } from "react";

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

// TEMP demo data (frontend only)
const DEMO_RESTAURANTS = [
  {
    id: "r1",
    name: "Luigi's Kitchen",
    cuisine: "Italian",
    rating: 4.6,
    openingTime: "10:00",
    closingTime: "23:00",
    location: "Beirut",
    coverUrl: "",
    logoUrl: "https://i.pravatar.cc/80?img=11",
    menu: [
      {
        sectionId: "s1",
        sectionName: "Starters",
        items: [
          { id: "i1", name: "Bruschetta", price: "6.50", currency: "USD", description: "Tomato, basil, olive oil", imageUrl: "" },
          { id: "i2", name: "Arancini", price: "7.00", currency: "USD", description: "Crispy rice balls", imageUrl: "" },
          { id: "i3", name: "batata", price: "7.00", currency: "USD", description: "Crispy batata", imageUrl: "" },
          { id: "i4", name: "kebbeh", price: "20.00", currency: "USD", description: "kebbeh meshweye", imageUrl: "" },
        ],
      },
      {
        sectionId: "s2",
        sectionName: "Pasta",
        items: [{ id: "i5", name: "Spaghetti Pomodoro", price: "10.00", currency: "USD", description: "Classic tomato sauce", imageUrl: "" }],
      },
      {
        sectionId: "s3",
        sectionName: "Pizza",
        items: [{ id: "i6", name: "Pepperoni", price: "15.00", currency: "USD", description: "without vegetables", imageUrl: "" }],
      },
      {
        sectionId: "s4",
        sectionName: "Burgers",
        items: [{ id: "i7", name: "Cheese burger", price: "11.50", currency: "USD", description: "served with fries", imageUrl: "" }],
      },
    ],
    reviews: [
      { id: "rev1", userName: "Maya", userAvatar: "https://i.pravatar.cc/80?img=12", date: "2026-02-18", stars: 5, text: "Amazing food and super fast service." },
      { id: "rev2", userName: "Hussein", userAvatar: "https://i.pravatar.cc/80?img=32", date: "2026-02-15", stars: 4, text: "Great taste, portions could be bigger." },
    ],
  },
  { id: "r2", name: "Saffron House", cuisine: "Indian", rating: 4.3, openingTime: "11:00", closingTime: "22:00", location: "Hamra", coverUrl: "", menu: [], reviews: [] },
  { id: "r3", name: "Global Bites", cuisine: "International", rating: 4.1, openingTime: "09:00", closingTime: "21:00", location: "Downtown", coverUrl: "", menu: [], reviews: [] },
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

  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [detailsTab, setDetailsTab] = useState("menu"); // "menu" | "reviews"

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

  // If coming from Favorites -> open restaurant
  useEffect(() => {
    if (!restaurantToOpen) return;
    setSelectedRestaurant(restaurantToOpen);
    setDetailsTab("menu");
    clearRestaurantToOpen?.();
  }, [restaurantToOpen, clearRestaurantToOpen]);

  const filteredRestaurants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEMO_RESTAURANTS.filter((r) => {
      const matchesName = !q || r.name.toLowerCase().includes(q);
      const matchesCuisine = cuisine === "All" || r.cuisine === cuisine || r.cuisine === "International";
      return matchesName && matchesCuisine;
    });
  }, [query, cuisine]);

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
                  {selectedRestaurant.openingTime} - {selectedRestaurant.closingTime}
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
            <button className="btn btn--ghost topActionBtn" type="button" onClick={() => setSelectedRestaurant(null)}>
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
                <select className="select reviewCard__select" defaultValue="5">
                  <option value="5">5 ★</option>
                  <option value="4">4 ★</option>
                  <option value="3">3 ★</option>
                  <option value="2">2 ★</option>
                  <option value="1">1 ★</option>
                </select>

                <input className="reviewCard__input" type="text" placeholder="Write your review..." />

                <button
                  className="btn btn--gold"
                  type="button"
                  onClick={() => {
                    if (!requireAuth()) return;
                  }}
                >
                  Post
                </button>
              </div>

              <div className="reviewCard__hint">Frontend only for now.</div>
            </div>

            <div className="reviewsDivider">
              <span className="reviewsDivider__text">What Diners Say</span>
            </div>

            {selectedRestaurant.reviews?.length ? (
              <div className="reviewsStack">
                {selectedRestaurant.reviews.map((rev) => (
                  <div className="reviewCardFull" key={rev.id}>
                    <div className="reviewCardFull__left">
                      <div className="reviewCardFull__avatar">
                        <img className="reviewCardFull__avatarImg" src={rev.userAvatar} alt={rev.userName} />
                      </div>
                    </div>

                    <div className="reviewCardFull__right">
                      <div className="reviewCardFull__top">
                        <div className="reviewCardFull__userName">{rev.userName}</div>
                        <div className="reviewCardFull__date">{rev.date}</div>
                      </div>

                      <div className="reviewCardFull__stars">
                        {"★".repeat(rev.stars)}
                        {"☆".repeat(5 - rev.stars)}
                      </div>

                      <div className="reviewCardFull__text">{rev.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="menuSectionEmpty">No reviews yet.</div>
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
        {filteredRestaurants.map((r) => (
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

        {!filteredRestaurants.length && <div className="menuSectionEmpty">No restaurants match your search.</div>}
      </div>
    </div>
  );
}