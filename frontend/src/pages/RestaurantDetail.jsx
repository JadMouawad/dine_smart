import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRestaurantById } from "../services/restaurantService";

export default function RestaurantDetail() {
  const { id } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getRestaurantById(id);
        setRestaurant(data.restaurant);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  return (
    <div className="page">
      <Link className="btn ghost back" to="/restaurants">
        ← Back to restaurants
      </Link>

      {loading ? (
        <div className="card subtle">Loading restaurant...</div>
      ) : error ? (
        <div className="card subtle alert">{error}</div>
      ) : !restaurant ? (
        <div className="card subtle">Restaurant not found.</div>
      ) : (
        <div className="card detail-card">
          <div className="detail-header">
            <div>
              <h1>{restaurant.name}</h1>
              <p className="muted">
                {restaurant.cuisine || "Global cuisine"}
              </p>
            </div>
            <span className="badge">
              {restaurant.verified_status === "verified"
                ? "Verified"
                : restaurant.verified_status}
            </span>
          </div>

          <div className="detail-grid">
            <div>
              <p className="muted">Rating</p>
              <p className="stat">{restaurant.rating ?? "—"}</p>
            </div>
            <div>
              <p className="muted">Address</p>
              <p>{restaurant.address || "Address coming soon."}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
