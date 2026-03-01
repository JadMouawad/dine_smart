import { Link } from "react-router-dom";

/**
 * RestaurantCard
 * Props:
 * - restaurant: { id, name, cuisine, address, rating }
 */
export default function RestaurantCard({ restaurant }) {
  if (!restaurant) return null;

  const { id, name, cuisine, address, rating } = restaurant;

  return (
    <div style={{ border: "1px solid #ddd", padding: "12px", borderRadius: "8px", marginBottom: "10px" }}>
      <h3 style={{ margin: 0 }}>{name}</h3>
      <p style={{ margin: "6px 0" }}>
        <strong>Cuisine:</strong> {cuisine || "N/A"}
      </p>
      <p style={{ margin: "6px 0" }}>
        <strong>Rating:</strong> {rating ?? "N/A"}
      </p>
      <p style={{ margin: "6px 0" }}>
        <strong>Address:</strong> {address || "N/A"}
      </p>

      {/* Link to profile page */}
      <Link to={`/restaurants/${id}`}>View Profile</Link>
    </div>
  );
}
