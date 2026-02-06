import RestaurantCard from "../components/RestaurantCard";

export default function Restaurants() {
  // Placeholder data for UI testing (remove later when API is ready)
  const mockRestaurants = [
    { id: 1, name: "Mailos", cuisine: "Italian", address: "Hamra", rating: 4.5 },
    { id: 2, name: "Kampai", cuisine: "Japanese", address: "Achrafieh", rating: 4.3 },
  ];

  return (
    <div>
      <h1>Restaurants</h1>

      {/* TODO: Replace mockRestaurants with API response */}
      {mockRestaurants.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} />
      ))}
    </div>
  );
}
