import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FiArrowLeft, FiClock, FiMapPin, FiStar, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext.jsx";
import { getReviewsByRestaurantId, createReview, deleteReview } from "../../services/reviewService";
import { getRestaurantById } from "../../services/restaurantService";
import { getReservationAvailability } from "../../services/reservationService";
import ReservationForm from "../../components/ReservationForm.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";

import { getCurrentSlotParams, formatTimeLabel } from "../../utils/timeUtils";
import { getCrowdMeterMeta } from "../../utils/crowdMeter";
import { FILLED_STAR, EMPTY_STAR } from "../../constants/filters";
import { DEFAULT_AVATAR } from "../../constants/avatar";

/**
 * RestaurantDetailPanel
 *
 * Self-contained detail view for a restaurant. Manages its own
 * reviews, reservation-slot, and availability state internally.
 *
 * Props:
 *   restaurant      – the full restaurant object
 *   isFavorited(id) – function returning boolean
 *   onToggleFavorite(restaurant) – function
 *   requireAuth()   – returns false and fires a side-effect if user must log in
 *   onBack()        – called when the user clicks "Back to Search"
 */
export default function RestaurantDetailPanel({
  restaurant,
  isFavorited,
  onToggleFavorite,
  requireAuth,
  reservationIntentToken = 0,
  onRestaurantUpdated,
  onBack,
}) {
  const mergeCrowdFields = (previous, next) => {
    if (!next || typeof next !== "object") return previous;
    const hasCrowdData = next.crowd_level != null || next.crowdLevel != null || next.crowd_pct != null || next.crowdPct != null;
    if (hasCrowdData || !previous) return next;
    return {
      ...next,
      crowd_level: previous.crowd_level ?? previous.crowdLevel ?? null,
      crowd_pct: previous.crowd_pct ?? previous.crowdPct ?? null,
      crowd_booked_seats: previous.crowd_booked_seats ?? previous.crowdBookedSeats ?? null,
      crowd_total_capacity: previous.crowd_total_capacity ?? previous.crowdTotalCapacity ?? null,
    };
  };

  const { user } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [reviewPosting, setReviewPosting] = useState(false);
  const [deleteReviewTarget, setDeleteReviewTarget] = useState(null);
  const [deleteReviewBusy, setDeleteReviewBusy] = useState(false);

  const [detailsTab, setDetailsTab] = useState("menu");
  const [reservationInlineOpen, setReservationInlineOpen] = useState(false);
  const [reservationSlot, setReservationSlot] = useState(null);
  const [reservationAvailability, setReservationAvailability] = useState(null);
  const [reservationAvailabilityLoading, setReservationAvailabilityLoading] = useState(false);
  const [reservationAvailabilityError, setReservationAvailabilityError] = useState("");
  const [currentRestaurant, setCurrentRestaurant] = useState(restaurant);
  const [activeHeroImageIndex, setActiveHeroImageIndex] = useState(0);

  function pushRestaurantUpdate(nextRestaurant, nextReviews = null) {
    if (!nextRestaurant || typeof onRestaurantUpdated !== "function") return;

    const safeReviewCount = Array.isArray(nextReviews)
      ? nextReviews.length
      : (() => {
          const parsed = Number(nextRestaurant.review_count);
          return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
        })();

    onRestaurantUpdated({
      ...nextRestaurant,
      review_count: safeReviewCount,
    });
  }

  const [expandedSections, setExpandedSections] = useState({});

  const reservationInlineRef = useRef(null);
  const menuSectionRef = useRef(null);
  const reviewsSectionRef = useRef(null);

  useEffect(() => { setCurrentRestaurant(restaurant); }, [restaurant]);

  useEffect(() => {
    if (!currentRestaurant?.id) return;
    setReviewsLoading(true);
    setReviews([]);
    getReviewsByRestaurantId(currentRestaurant.id)
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [currentRestaurant?.id]);

  useEffect(() => {
    if (!currentRestaurant?.id) {
      setReservationAvailability(null);
      setReservationAvailabilityError("");
      return;
    }
    const { date, time } = reservationSlot || getCurrentSlotParams();
    setReservationAvailabilityLoading(true);
    getReservationAvailability({ restaurantId: currentRestaurant.id, date, time })
      .then((a) => {
        setReservationAvailability(a);
        setReservationAvailabilityError("");
      })
      .catch(() => {
        setReservationAvailability(null);
        setReservationAvailabilityError("Availability is temporarily unavailable.");
      })
      .finally(() => setReservationAvailabilityLoading(false));
  }, [currentRestaurant?.id, reservationSlot]);

  useEffect(() => {
    function handler(e) {
      const detail = e?.detail || {};
      if (detail.restaurantId != null && Number(detail.restaurantId) !== Number(currentRestaurant?.id)) return;

      const date = detail.date
        ? String(detail.date).slice(0, 10)
        : (reservationSlot?.date || getCurrentSlotParams().date);

      const time = detail.time
        ? String(detail.time).slice(0, 5)
        : (reservationSlot?.time || getCurrentSlotParams().time);

      setReservationSlot({ date, time });
      setReservationAvailabilityLoading(true);

      getReservationAvailability({ restaurantId: currentRestaurant.id, date, time })
        .then((a) => {
          setReservationAvailability(a);
          setReservationAvailabilityError("");
        })
        .catch(() => {
          setReservationAvailability(null);
          setReservationAvailabilityError("Availability is temporarily unavailable.");
        })
        .finally(() => setReservationAvailabilityLoading(false));

      getRestaurantById(currentRestaurant.id)
        .then((updated) => {
          setCurrentRestaurant((prev) => mergeCrowdFields(prev, updated));
        })
        .catch(() => {});
    }

    window.addEventListener("ds:reservation-changed", handler);
    return () => window.removeEventListener("ds:reservation-changed", handler);
  }, [currentRestaurant?.id, reservationSlot?.date, reservationSlot?.time]);

  const restaurantMenu = useMemo(() => {
    const raw = currentRestaurant?.menu_sections ?? currentRestaurant?.menu;
    return Array.isArray(raw) ? raw : [];
  }, [currentRestaurant]);

  useEffect(() => {
    if (!restaurantMenu.length) {
      setExpandedSections({});
      return;
    }
    setExpandedSections((prev) => {
      const hasExisting = restaurantMenu.some((s) => prev[s.sectionId] != null);
      if (hasExisting) return prev;
      return Object.fromEntries(restaurantMenu.map((s) => [s.sectionId, true]));
    });
  }, [restaurantMenu]);

  const ratingValue = useMemo(() => {
    const v = Number(currentRestaurant?.rating ?? 0);
    return Number.isFinite(v) ? Math.max(0, Math.min(5, Math.round(v))) : 0;
  }, [currentRestaurant?.rating]);

  const ratingStars = `${FILLED_STAR.repeat(ratingValue)}${EMPTY_STAR.repeat(Math.max(0, 5 - ratingValue))}`;
  const reviewCount = useMemo(() => {
    const directCount = Number(currentRestaurant?.review_count);
    if (Number.isFinite(directCount) && directCount >= 0) return directCount;
    return Array.isArray(reviews) ? reviews.length : 0;
  }, [currentRestaurant?.review_count, reviews]);
  const ratingDisplay = currentRestaurant?.rating ?? "N/A";
  const crowdMeta = useMemo(() => getCrowdMeterMeta(currentRestaurant || {}), [currentRestaurant]);

  const restaurantHoursLabel = useMemo(() => {
    if (!currentRestaurant) return "Hours unavailable";
    const opening = currentRestaurant.opening_time ?? currentRestaurant.openingTime;
    const closing = currentRestaurant.closing_time ?? currentRestaurant.closingTime;
    if (!opening || !closing) return "Hours unavailable";
    return `${String(opening).slice(0, 5)} - ${String(closing).slice(0, 5)}`;
  }, [currentRestaurant]);

  const restaurantGalleryUrls = useMemo(() => {
    const directGallery = Array.isArray(currentRestaurant?.gallery_urls)
      ? currentRestaurant.gallery_urls
      : Array.isArray(currentRestaurant?.galleryUrls)
        ? currentRestaurant.galleryUrls
        : [];

    const cleanedGallery = directGallery
      .map((url) => String(url || "").trim())
      .filter(Boolean);

    if (cleanedGallery.length) return cleanedGallery;

    const fallbackImage = [
      currentRestaurant?.coverUrl,
      currentRestaurant?.cover_url,
      currentRestaurant?.logoUrl,
      currentRestaurant?.logo_url,
    ]
      .map((url) => String(url || "").trim())
      .find(Boolean);

    return fallbackImage ? [fallbackImage] : [];
  }, [currentRestaurant]);

  useEffect(() => {
    if (restaurantGalleryUrls.length === 0) {
      setActiveHeroImageIndex(0);
      return;
    }
    setActiveHeroImageIndex((prev) => {
      if (prev < 0) return 0;
      if (prev >= restaurantGalleryUrls.length) return restaurantGalleryUrls.length - 1;
      return prev;
    });
  }, [restaurantGalleryUrls]);

  function showPreviousHeroImage() {
    if (restaurantGalleryUrls.length <= 1) return;
    setActiveHeroImageIndex((prev) => (prev - 1 + restaurantGalleryUrls.length) % restaurantGalleryUrls.length);
  }

  function showNextHeroImage() {
    if (restaurantGalleryUrls.length <= 1) return;
    setActiveHeroImageIndex((prev) => (prev + 1) % restaurantGalleryUrls.length);
  }

  const availabilityBadge = useMemo(() => {
    if (reservationAvailabilityLoading) return { label: "Checking availability...", tone: "neutral" };
    if (reservationAvailabilityError) return { label: reservationAvailabilityError, tone: "warn" };
    if (!reservationAvailability) return null;

    const availableSeats = Number(reservationAvailability.available_seats || 0);
    const totalCapacity = Number(reservationAvailability.total_capacity || 0);
    const slotTime = String(reservationSlot?.time || reservationAvailability.reservation_time || getCurrentSlotParams().time).slice(0, 5);
    const slotLabel = formatTimeLabel(slotTime);

    if (totalCapacity <= 0) return { label: `Availability unavailable for ${slotLabel}`, tone: "warn" };

    const ratio = availableSeats / totalCapacity;
    if (ratio >= 0.6) return { label: `${availableSeats} seats available at ${slotLabel}`, tone: "good" };
    if (ratio >= 0.25) return { label: `${availableSeats} seats available at ${slotLabel}`, tone: "warn" };
    return { label: `${availableSeats} seats available at ${slotLabel}`, tone: "danger" };
  }, [reservationAvailability, reservationSlot?.time, reservationAvailabilityLoading, reservationAvailabilityError]);

  function toggleMenuSection(sectionId) {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }

  function openInlineReservation() {
    setReservationInlineOpen(true);
    window.requestAnimationFrame(() => {
      reservationInlineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    if (!reservationIntentToken) return;
    if (!requireAuth()) return;
    setDetailsTab("menu");
    openInlineReservation();
  }, [reservationIntentToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePostReview() {
    if (!requireAuth()) return;
    if (!reviewComment.trim()) { setReviewError("Please write a comment."); return; }
    if (reviewComment.trim().length > 500) { setReviewError("Review must be at most 500 characters."); return; }

    setReviewError("");
    setReviewSuccess("");
    setReviewPosting(true);

    try {
      const response = await createReview(currentRestaurant.id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });

      setReviewComment("");
      setReviewRating(5);

      if (response?.flagged) {
        setReviewSuccess(response?.message || "Your review was flagged for moderation.");
      }

      const [reviewsData, updated] = await Promise.all([
        getReviewsByRestaurantId(currentRestaurant.id),
        getRestaurantById(currentRestaurant.id),
      ]);

      const nextReviews = Array.isArray(reviewsData) ? reviewsData : [];
      const nextRestaurant = mergeCrowdFields(currentRestaurant, updated);

      setReviews(nextReviews);
      setCurrentRestaurant(nextRestaurant);
      pushRestaurantUpdate(nextRestaurant, nextReviews);

      window.dispatchEvent(
        new CustomEvent("ds:review-changed", {
          detail: { restaurantId: currentRestaurant.id, action: "created" },
        })
      );
    } catch (err) {
      setReviewError(err.message || "Failed to post review.");
    } finally {
      setReviewPosting(false);
    }
  }

  async function handleDeleteReview() {
    if (!deleteReviewTarget || !currentRestaurant) return;
    setDeleteReviewBusy(true);

    try {
      await deleteReview(currentRestaurant.id, deleteReviewTarget.id);

      const [reviewsData, updated] = await Promise.all([
        getReviewsByRestaurantId(currentRestaurant.id),
        getRestaurantById(currentRestaurant.id),
      ]);

      const nextReviews = Array.isArray(reviewsData) ? reviewsData : [];
      const nextRestaurant = mergeCrowdFields(currentRestaurant, updated);

      setReviews(nextReviews);
      setCurrentRestaurant(nextRestaurant);
      pushRestaurantUpdate(nextRestaurant, nextReviews);

      window.dispatchEvent(
        new CustomEvent("ds:review-changed", {
          detail: { restaurantId: currentRestaurant.id, action: "deleted" },
        })
      );
    } catch (err) {
      setReviewError(err.message || "Failed to delete review.");
    } finally {
      setDeleteReviewBusy(false);
      setDeleteReviewTarget(null);
    }
  }

  return (
    <div className="userSearchPage">
      <header className="restaurantPageHeader">
        <button
          className="btn btn--ghost restaurantPageHeader__backBtn"
          type="button"
          onClick={onBack}
          aria-label="Back to Search"
        >
          <FiArrowLeft />
          <span>Back to Search</span>
        </button>
        <h2 className="restaurantPageHeader__title">Restaurant Page</h2>
      </header>

      <section className="restaurantProfileHero restaurantProfileHero--splitLayout">
        <div className="restaurantProfileHero__titleRow">
          <div className="restaurantProfileHero__logo">
            {(currentRestaurant.logoUrl || currentRestaurant.logo_url || currentRestaurant.coverUrl || currentRestaurant.cover_url) ? (
              <img
                loading="lazy"
                className="restaurantProfileHero__logoImg"
                src={currentRestaurant.logoUrl || currentRestaurant.logo_url || currentRestaurant.coverUrl || currentRestaurant.cover_url}
                alt={`${currentRestaurant.name} logo`}
              />
            ) : (
              <span className="restaurantProfileHero__logoFallback">
                {(currentRestaurant.name || "R")[0]?.toUpperCase?.() || "R"}
              </span>
            )}
          </div>
          <h1 className="restaurantProfileHero__name">{currentRestaurant.name}</h1>
        </div>

        <div className="restaurantHeroInfoCard">
          <div className="restaurantHeroInfoItem">
            <span className="restaurantHeroInfoIcon">🍽</span>
            <div className="restaurantHeroInfoText">
              <span className="restaurantHeroInfoLabel">Cuisine</span>
              <span className="restaurantHeroInfoValue">{currentRestaurant.cuisine || "Not set"}</span>
            </div>
          </div>

          <div className="restaurantHeroInfoItem">
            <FiStar className="restaurantHeroInfoIcon" />
            <div className="restaurantHeroInfoText">
              <span className="restaurantHeroInfoLabel">Rating</span>
              <span className="restaurantHeroInfoValue">{ratingDisplay} ({reviewCount})</span>
              <span className="restaurantHeroInfoSub">{ratingStars}</span>
            </div>
          </div>

          <div className="restaurantHeroInfoItem">
            <FiMapPin className="restaurantHeroInfoIcon" />
            <div className="restaurantHeroInfoText">
              <span className="restaurantHeroInfoLabel">Distance</span>
              <span className="restaurantHeroInfoValue">
                {currentRestaurant.distance_km != null ? `${currentRestaurant.distance_km} km` : "Unavailable"}
              </span>
            </div>
          </div>

          <div className="restaurantHeroInfoItem">
            <span className="restaurantHeroInfoIcon">🪑</span>
            <div className="restaurantHeroInfoText">
              <span className="restaurantHeroInfoLabel">Availability</span>
              <span className="restaurantHeroInfoValue">
                {availabilityBadge ? availabilityBadge.label : "Seats unavailable"}
              </span>
            </div>
          </div>

          <div className="restaurantHeroInfoItem">
            <FiClock className="restaurantHeroInfoIcon" />
            <div className="restaurantHeroInfoText">
              <span className="restaurantHeroInfoLabel">Hours</span>
              <span className="restaurantHeroInfoValue">{restaurantHoursLabel}</span>
            </div>
          </div>

          <div className={`restaurantHeroInfoItem restaurantHeroInfoItem--crowd restaurantHeroInfoItem--${crowdMeta.level}`}>
            <span className="restaurantHeroInfoIcon">👥</span>
            <div className="restaurantHeroInfoText">
              <span className="restaurantHeroInfoLabel">Live Crowd</span>
              <span className="restaurantHeroInfoValue">
                {crowdMeta.label}{crowdMeta.pct != null ? ` (${crowdMeta.pct}%)` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="restaurantProfileHero__media">
          {restaurantGalleryUrls.length ? (
            <>
              <img
                loading="lazy"
                className="restaurantProfileHero__img"
                src={restaurantGalleryUrls[activeHeroImageIndex]}
                alt={`${currentRestaurant.name} background ${activeHeroImageIndex + 1}`}
              />
              {restaurantGalleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="restaurantProfileHero__carouselArrow restaurantProfileHero__carouselArrow--left"
                    aria-label="Previous background image"
                    onClick={showPreviousHeroImage}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="restaurantProfileHero__carouselArrow restaurantProfileHero__carouselArrow--right"
                    aria-label="Next background image"
                    onClick={showNextHeroImage}
                  >
                    ›
                  </button>
                  <div className="restaurantProfileHero__carouselIndex">
                    {activeHeroImageIndex + 1} / {restaurantGalleryUrls.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="restaurantProfileHero__placeholder">DineSmart • {currentRestaurant.name}</div>
          )}
        </div>

        <div className="restaurantActionBar">
          <div className="restaurantActionTabs">
            <button
              className={`restaurantActionTab ${detailsTab === "menu" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                setDetailsTab("menu");
                setReservationInlineOpen(false);
                setExpandedSections({});
                menuSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Menu
            </button>

            <button
              className={`restaurantActionTab ${detailsTab === "reviews" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                setDetailsTab("reviews");
                setReservationInlineOpen(false);
                reviewsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Reviews
            </button>

            <button
              className={`restaurantActionTab ${reservationInlineOpen ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                if (!requireAuth()) return;
                setDetailsTab("reserve");
                openInlineReservation();
              }}
            >
              Reserve
            </button>
          </div>

          <button
            className={`favoriteHeartBtn restaurantActionFavorite ${isFavorited(currentRestaurant.id) ? "is-active" : ""}`}
            type="button"
            onClick={() => { if (!requireAuth()) return; onToggleFavorite(currentRestaurant); }}
            aria-label={isFavorited(currentRestaurant.id) ? "Remove from favorites" : "Add to favorites"}
          >
            <svg viewBox="0 0 24 24" className="favoriteHeartIcon" aria-hidden="true">
              <path d="M12 21s-7.2-4.6-9.6-9C.7 8.7 2.1 5.5 5.4 4.6c1.8-.5 3.6.1 4.8 1.4L12 7.8l1.8-1.8c1.2-1.3 3-1.9 4.8-1.4 3.3.9 4.7 4.1 3 7.4C19.2 16.4 12 21 12 21z" />
            </svg>
          </button>
        </div>
      </section>

      {reservationInlineOpen && (
        <section className="restaurantInlineReserve" ref={reservationInlineRef}>
          <h2 className="restaurantInlineReserve__title">Reserve a Table</h2>
          <ReservationForm
            isOpen={true}
            inline
            restaurant={currentRestaurant}
            onClose={() => {}}
            onReserved={(reservation) => {
              toast.success("Booked successfully! 🎉");
              const date = reservation?.reservation_date || reservationSlot?.date || getCurrentSlotParams().date;
              const time = String(reservation?.reservation_time || reservationSlot?.time || getCurrentSlotParams().time).slice(0, 5);
              setReservationSlot({ date, time });
              getReservationAvailability({ restaurantId: currentRestaurant.id, date, time })
                .then(setReservationAvailability)
                .catch(() => setReservationAvailability(null));
              window.dispatchEvent(new CustomEvent("ds:reservation-changed", {
                detail: { reservationId: reservation?.id ?? null, restaurantId: currentRestaurant.id, date, time, action: "created" },
              }));
            }}
          />
        </section>
      )}

      {detailsTab === "menu" ? (
        <div className="userMenuView" ref={menuSectionRef}>
          <h2 className="userMenuView__title">Menu</h2>
          {restaurantMenu.length ? (
            <div className="userMenuSections userMenuAccordion">
              {restaurantMenu.map((sec) => (
                <div className="menuSectionBlock userMenuSectionBlock" key={sec.sectionId}>
                  <div className="menuSectionHeader">
                    <button
                      className={`userMenuAccordion__header ${expandedSections[sec.sectionId] ? "is-open" : ""}`}
                      type="button"
                      onClick={() => toggleMenuSection(sec.sectionId)}
                      aria-expanded={expandedSections[sec.sectionId] ? "true" : "false"}
                    >
                      {sec.sectionName}
                      <span className="userMenuAccordion__chevron" aria-hidden="true">
                        {expandedSections[sec.sectionId] ? "−" : "+"}
                      </span>
                    </button>
                  </div>
                  {expandedSections[sec.sectionId] && (
                    <div className="ownerMenuItemsGrid">
                      {sec.items.map((it) => (
                        <div className="menuItemCard" key={it.id}>
                          <div className="menuItemCard__media">
                            {(it.imageUrl || it.image_url) ? (
                              <img loading="lazy" className="menuItemCard__img" src={it.imageUrl || it.image_url} alt={it.name} />
                            ) : (
                              <div className="menuItemCard__imgPlaceholder">PNG, JPG, or JPEG</div>
                            )}
                          </div>
                          <div className="menuItemCard__info">
                            <div className="menuItemCard__name">{it.name}</div>
                            <div className="menuItemCard__price">{it.price} {it.currency}</div>
                            {it.description && <div className="menuItemCard__desc">{it.description}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="menuSectionEmpty">No menu uploaded yet.</div>
          )}
        </div>
      ) : detailsTab === "reviews" ? (
        <div className="restaurantReviewsPage" ref={reviewsSectionRef}>
          <div className="restaurantReviewsHeader">
            <div className="restaurantReviewsHeader__name">{currentRestaurant.name}</div>
            <div className="restaurantReviewsHeader__meta">
              <span className="metaPill">{FILLED_STAR} {ratingDisplay} ({reviewCount})</span>
            </div>
          </div>

          <div className="reviewCard">
            <div className="reviewCard__title">Add a review</div>
            <div className="reviewComposer">
              <div className="reviewComposer__top">
                <select
                  className="select reviewCard__select"
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  disabled={reviewPosting}
                >
                  <option value="5">5 {FILLED_STAR}</option>
                  <option value="4">4 {FILLED_STAR}</option>
                  <option value="3">3 {FILLED_STAR}</option>
                  <option value="2">2 {FILLED_STAR}</option>
                  <option value="1">1 {FILLED_STAR}</option>
                </select>

                <button
                  className="btn btn--gold reviewComposer__post"
                  type="button"
                  disabled={reviewPosting}
                  onClick={handlePostReview}
                >
                  {reviewPosting ? "Posting..." : "Post"}
                </button>
              </div>

              <textarea
                className="reviewCard__input reviewCard__input--textarea"
                placeholder="Write your review (max 500 characters)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                maxLength={500}
                rows={4}
                disabled={reviewPosting}
              />
              <span className="reviewCard__charCount">{reviewComment.length}/500</span>
            </div>

            {reviewError && <div className="fieldError reviewCard__status">{reviewError}</div>}
            {reviewSuccess && <div className="formCard__success reviewCard__status">{reviewSuccess}</div>}
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
  <img
    className="reviewCardFull__avatarImg"
    src={rev.profilePictureUrl || rev.profile_picture_url || DEFAULT_AVATAR}
    alt={`${rev.user_name || rev.authorName || "User"} avatar`}
  />
</div>
                  </div>

                  <div className="reviewCardFull__right">
                    <div className="reviewCardFull__top">
                      <div className="reviewCardFull__userName">{rev.user_name || rev.authorName || "Anonymous"}</div>
                      <div className="reviewCardFull__date">
                        {(rev.created_at || rev.createdAt) ? new Date(rev.created_at || rev.createdAt).toLocaleDateString() : ""}
                      </div>
                    </div>

                    <div className="reviewCardFull__stars">
                      {FILLED_STAR.repeat(Math.max(0, Number(rev.rating) || 0))}
                      {EMPTY_STAR.repeat(Math.max(0, 5 - (Number(rev.rating) || 0)))}
                    </div>

                    <div className="reviewCardFull__text">{rev.comment}</div>

                    {user?.id && Number(rev.user_id) === Number(user.id) && (
                      <button
                        className="btn btn--ghost reviewCardFull__delete"
                        type="button"
                        onClick={() => setDeleteReviewTarget(rev)}
                        aria-label="Delete your review"
                      >
                        <FiTrash2 /> Delete
                      </button>
                    )}

                    {rev.owner_response && (
                      <div className="ownerResponseBlock">
                        <div className="ownerResponseBlock__label">Restaurant response</div>
                        <div className="ownerResponseBlock__text">{rev.owner_response}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="menuSectionEmpty">No reviews yet. Be the first!</div>
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteReviewTarget)}
        title="Delete review?"
        message="Are you sure you want to delete your review?"
        confirmLabel="Yes"
        cancelLabel="No"
        busy={deleteReviewBusy}
        busyLabel="Deleting..."
        onConfirm={handleDeleteReview}
        onCancel={() => { if (!deleteReviewBusy) setDeleteReviewTarget(null); }}
      />
    </div>
  );
}