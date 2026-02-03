import { useParams } from "react-router-dom";

export default function RestaurantProfile() {
  const { id } = useParams();

  return (
    <div>
      <h1>Restaurant Profile</h1>
      <p>Restaurant ID: {id}</p>
      <p>Restaurant details will appear here.</p>
    </div>
  );
}
{/* These are currently placeholders. To be changed later */}