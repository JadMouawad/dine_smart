import React, { useEffect, useState } from "react";
import { getAdminRecentActivity, getAdminStats } from "../../services/adminService";

function formatActivityType(type) {
  if (type === "user_registration") return "New user registration";
  if (type === "restaurant_submission") return "Restaurant submission";
  if (type === "flagged_review") return "Flagged review";
  return type;
}

export default function AdminDashboard({ onOpenPending, onOpenFlags, onOpenUsers, onStatsLoaded }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [statsData, activityData] = await Promise.all([
          getAdminStats(),
          getAdminRecentActivity(10),
        ]);
        if (cancelled) return;
        setStats(statsData);
        setActivity(Array.isArray(activityData) ? activityData : []);
        onStatsLoaded?.(statsData);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load admin dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [onStatsLoaded]);

  return (
    <div className="adminPage">
      <h1 className="ownerProfile__title">Admin Dashboard</h1>

      {error && <div className="fieldError">{error}</div>}

      <div className="adminStatsGrid">
        <div className="formCard adminStatCard">
          <div className="adminStatCard__label">Users</div>
          <div className="adminStatCard__value">{loading ? "..." : stats?.total_users ?? 0}</div>
        </div>
        <div className="formCard adminStatCard">
          <div className="adminStatCard__label">Restaurants</div>
          <div className="adminStatCard__value">{loading ? "..." : stats?.total_restaurants ?? 0}</div>
        </div>
        <div className="formCard adminStatCard">
          <div className="adminStatCard__label">Pending</div>
          <div className="adminStatCard__value">{loading ? "..." : stats?.pending_approvals ?? 0}</div>
        </div>
        <div className="formCard adminStatCard">
          <div className="adminStatCard__label">Flags</div>
          <div className="adminStatCard__value">{loading ? "..." : stats?.flagged_reviews ?? 0}</div>
        </div>
      </div>

      <div className="formCard">
        <div className="ownerTableConfigSectionTitle">Quick Actions</div>
        <div className="adminQuickActions">
          <button className="btn btn--gold" type="button" onClick={onOpenPending}>Review Pending Restaurants</button>
          <button className="btn btn--ghost" type="button" onClick={onOpenFlags}>Moderate Flagged Reviews</button>
          <button className="btn btn--ghost" type="button" onClick={onOpenUsers}>Manage Users</button>
        </div>
      </div>

      <div className="formCard adminActivityCard">
        <div className="ownerTableConfigSectionTitle">Recent Activity</div>
        {loading ? (
          <p className="placeholderPage__text">Loading activity...</p>
        ) : activity.length ? (
          <div className="adminActivityList">
            {activity.map((item) => (
              <div className="adminActivityItem" key={`${item.type}-${item.entity_id}-${item.created_at}`}>
                <div className="adminActivityItem__title">{formatActivityType(item.type)}</div>
                <div className="adminActivityItem__subtitle">{item.title}</div>
                <div className="adminActivityItem__meta">
                  {item.subtitle} • {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="placeholderPage__text">No recent activity.</p>
        )}
      </div>
    </div>
  );
}

