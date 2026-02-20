
// Displays the average rating of a restaurant.
// Satisfies user story:
// "As a user, I want to see the average rating of a restaurant."
export default function AverageRatingDisplay({ average, count }) {
  const hasRating = typeof average === "number" && count > 0;

  if (!hasRating) {
    return (
      <div>
        <strong>Average rating:</strong> <span>No ratings yet</span>
      </div>
    );
  }

  return (
    <div>
      <strong>Average rating:</strong>{" "}
      <span>
        {average.toFixed(1)} / 5 ({count})
      </span>
    </div>
  );
}