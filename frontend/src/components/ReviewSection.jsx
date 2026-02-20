// Fetches and displays reviews for a restaurant.
// Satisfies user story:
// "As a user, I want to read reviews of a restaurant."

import { useEffect, useState } from "react";
import ReviewItem from "./ReviewItem";
import NoResultsMessage from "./NoResultsMessage";
import { getReviewsByRestaurantId } from "../services/reviewService";

export default function ReviewSection({ restaurantId }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!restaurantId) return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getReviewsByRestaurantId(restaurantId);
        setReviews(Array.isArray(data) ? data : []);
      } catch (e) {
        setError("Failed to load reviews.");
        setReviews([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [restaurantId]);
  // Loading state
  if (loading) return <p>Loading reviews...</p>;
    // If it was error state
  if (error) return <p>{error}</p>;
  
// No reviews/empty state
  if (!reviews.length) {
    return (
      <NoResultsMessage
        title="No reviews yet"
        message="Be the first to write a review for this restaurant."
      />
    );
  }

  return (
    <div>
      <h3>Reviews</h3>
      {reviews.map((r) => (
        <ReviewItem key={r.id || `${r.authorName}-${r.createdAt}`} review={r} />
      ))}
    </div>
  );
}