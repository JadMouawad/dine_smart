import { Link } from "react-router-dom";

export default function RestaurantCard({ restaurant }) {
  return (
    <div className="card restaurant-card">
      <div className="card-header">
        <div>
          <h3>{restaurant.name}</h3>
          <p className="muted">{restaurant.cuisine || "Global cuisine"}</p>
        </div>
        <span className="badge">
          {restaurant.verified_status === "verified"
            ? "Verified"
            : restaurant.verified_status}
        </span>
      </div>
      <div className="card-body">
        <div className="rating">
          <span className="rating-number">{restaurant.rating ?? "—"}</span>
          <span className="muted">rating</span>
        </div>
        <Link className="btn ghost" to={`/restaurants/${restaurant.id}`}>
          View profile
        </Link>
      </div>
    </div>
  );
}
