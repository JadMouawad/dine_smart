
// Displays a single review item.
// Used inside ReviewSection.

export default function ReviewItem({ review }) {
  if (!review) return null;

  const { authorName, rating, comment, createdAt } = review;

  return (
    <div style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
         {/* Reviewer name + rating */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong>{authorName || "Anonymous"}</strong>
        <span>{typeof rating === "number" ? `${rating}/5` : ""}</span>
      </div>

      {createdAt && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          {new Date(createdAt).toLocaleString()}
        </div>
      )}

      <p style={{ marginTop: 8, marginBottom: 0 }}>{comment || ""}</p>
    </div>
  );
}