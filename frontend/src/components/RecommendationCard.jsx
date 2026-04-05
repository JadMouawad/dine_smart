import React from "react";
import { getCrowdMeterMeta } from "../utils/crowdMeter";

export default function RecommendationCard({ recommendation, onOpenRestaurant }) {
  if (!recommendation) return null;
  const crowd = getCrowdMeterMeta(recommendation);

  return (
    <article
      className="restaurantCard discoverFeedCard recommendationCard"
      onClick={() => onOpenRestaurant?.(recommendation)}
    >
      <div className="restaurantCard__body">
        <div className="restaurantCard__nameRow">
          <div className="restaurantCard__name">{recommendation.name}</div>
          <div className="restaurantCard__ratingCol">
            <div className="restaurantCard__rating">Rating {recommendation.rating ?? "N/A"}</div>
          </div>
        </div>
        <div className="restaurantCard__cuisine">{recommendation.cuisine || "Cuisine not set"}</div>
        <div className="discoverFeedCard__meta">
          {recommendation.distance_km != null ? `${recommendation.distance_km} km away` : "Distance unavailable"}
          {recommendation.price_range ? ` • ${recommendation.price_range}` : ""}
        </div>
        <div className={`crowdMeter crowdMeter--${crowd.level}`}>
          <span className="crowdMeter__dot" />
          <span>Live Crowd: {crowd.label}{crowd.pct != null ? ` (${crowd.pct}%)` : ""}</span>
        </div>
        {recommendation.description && (
          <p className="recommendationCard__description">{recommendation.description}</p>
        )}
        {recommendation.reason && (
          <p className="recommendationCard__reason">{recommendation.reason}</p>
        )}
      </div>
    </article>
  );
}
