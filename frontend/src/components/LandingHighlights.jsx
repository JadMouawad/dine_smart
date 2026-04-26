import React from "react";
import { HiArrowRight } from "react-icons/hi2";
import DineyImage from "../assets/landing/Diney.png";
import ReservationImage from "../assets/landing/FrontReservation.png";
import MapImage from "../assets/landing/FrontMap.png";

export default function LandingHighlights({
  onBookNow,
  onAskDiney,
  onExploreMap,
}) {
  return (
    <section className="landingHighlights" aria-label="DineSmart highlights">
      <div className="landingHighlights__inner">
        <div className="landingHighlights__grid">
          <article className="landingHighlights__card">
            <div className="landingHighlights__art">
              <div className="landingHighlights__wave" aria-hidden="true" />
              <img
                src={ReservationImage}
                alt="Book reservations"
                className="landingHighlights__image landingHighlights__image--reservation"
                loading="lazy"
                decoding="async"
              />
            </div>

            <h3 className="landingHighlights__title">Book a Table</h3>
            <div className="landingHighlights__rule" aria-hidden="true" />
            <p className="landingHighlights__desc">
              Reserve your table in seconds and plan your perfect dining experience.
            </p>

            <button
              type="button"
              className="landingHighlights__cta"
              onClick={onBookNow}
            >
              <span>Book now</span>
              <HiArrowRight />
            </button>
          </article>

          <article className="landingHighlights__card">
            <div className="landingHighlights__art">
              <div className="landingHighlights__wave" aria-hidden="true" />
              <img
                src={DineyImage}
                alt="Chat with Diney"
                className="landingHighlights__image landingHighlights__image--diney"
                loading="lazy"
                decoding="async"
              />
            </div>

            <h3 className="landingHighlights__title">Chat with Diney</h3>
            <div className="landingHighlights__rule" aria-hidden="true" />
            <p className="landingHighlights__desc">
              Get smart dining help, instant recommendations, and quick answers from our AI assistant.
            </p>

            <button
              type="button"
              className="landingHighlights__cta"
              onClick={onAskDiney}
            >
              <span>Ask Diney</span>
              <HiArrowRight />
            </button>
          </article>

          <article className="landingHighlights__card">
            <div className="landingHighlights__art">
              <div className="landingHighlights__wave" aria-hidden="true" />
              <img
                src={MapImage}
                alt="Explore on map"
                className="landingHighlights__image landingHighlights__image--map"
                loading="lazy"
                decoding="async"
              />
            </div>

            <h3 className="landingHighlights__title">Explore on Map</h3>
            <div className="landingHighlights__rule" aria-hidden="true" />
            <p className="landingHighlights__desc">
              Find nearby restaurants, discover new spots, and explore dining options visually.
            </p>

            <button
              type="button"
              className="landingHighlights__cta"
              onClick={onExploreMap}
            >
              <span>Explore map</span>
              <HiArrowRight />
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}
