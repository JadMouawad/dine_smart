
// Displays a single review item.
// Used inside ReviewSection.

export default function ReviewItem({ review }) {
  if (!review) return null;

  const {
    authorName,
    user_name: userName,
    rating,
    comment,
    createdAt,
    created_at: createdAtRaw,
    owner_response: ownerResponse,
  } = review;
  const created = createdAt || createdAtRaw;

  return (
    <div style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
         {/* Reviewer name + rating */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>{authorName || userName || "Anonymous"}</strong>
        <span>{typeof rating === "number" ? `${rating}/5` : ""}</span>
      </div>

      {created && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          {new Date(created).toLocaleString()}
        </div>
      )}

      <p style={{ marginTop: 8, marginBottom: 0 }}>{comment || ""}</p>

      {ownerResponse && (
        <div style={{ marginTop: 8, padding: "8px 10px", borderLeft: "3px solid #c9a227", background: "rgba(201, 162, 39, 0.12)", borderRadius: 8 }}>
          <strong>Restaurant response:</strong> {ownerResponse}
        </div>
      )}
    </div>
  );
}
