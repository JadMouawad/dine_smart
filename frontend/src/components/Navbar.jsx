import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="nav">
      <Link to="/" className="brand">
        DineSmart
      </Link>

      <nav className="nav-links">
        <NavLink to="/restaurants">Restaurants</NavLink>
        {user && <NavLink to="/profile">Profile</NavLink>}
      </nav>

      <div className="nav-actions">
        {loading ? (
          <span className="muted">Checking session…</span>
        ) : user ? (
          <>
            <span className="pill">Hi {user.name}</span>
            <button className="btn ghost" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink className="btn ghost" to="/login">
              Log in
            </NavLink>
            <NavLink className="btn primary" to="/register">
              Get started
            </NavLink>
          </>
        )}
      </div>
    </header>
  );
}
