import { useEffect, useState } from "react";
import RestaurantCard from "../components/RestaurantCard";
import { getRestaurants } from "../services/restaurantService";

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [filters, setFilters] = useState({
    q: "",
    cuisine: "",
    minRating: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(params = {}) {
    setLoading(true);
    setError("");
    try {
      const data = await getRestaurants(params);
      setRestaurants(data.restaurants || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    load({
      q: filters.q.trim() || undefined,
      cuisine: filters.cuisine.trim() || undefined,
      minRating: filters.minRating.trim() || undefined
    });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Restaurants</h1>
          <p className="muted">
            Browse verified spots and plan your next meal.
          </p>
        </div>
        <form className="filter" onSubmit={handleSubmit}>
          <input
            type="search"
            name="q"
            placeholder="Search by name"
            value={filters.q}
            onChange={handleChange}
          />
          <input
            type="text"
            name="cuisine"
            placeholder="Cuisine"
            value={filters.cuisine}
            onChange={handleChange}
          />
          <input
            type="number"
            name="minRating"
            placeholder="Min rating"
            min="0"
            max="5"
            step="0.1"
            value={filters.minRating}
            onChange={handleChange}
          />
          <button className="btn ghost" type="submit">
            Filter
          </button>
        </form>
      </div>

      {loading ? (
        <div className="card subtle">Loading restaurants...</div>
      ) : error ? (
        <div className="card subtle alert">{error}</div>
      ) : restaurants.length === 0 ? (
        <div className="card subtle">No restaurants found.</div>
      ) : (
        <div className="grid">
          {restaurants.map((restaurant) => (
            <RestaurantCard key={restaurant.id} restaurant={restaurant} />
          ))}
        </div>
      )}
    </div>
  );
}
