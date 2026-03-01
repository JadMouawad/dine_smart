import React, { useEffect, useState } from "react";
import {
  deleteAdminUser,
  getAdminUserDetails,
  getAdminUsers,
  suspendAdminUser,
} from "../../services/adminService";

const PAGE_SIZE = 10;

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [suspended, setSuspended] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getAdminUsers({
          page: pagination.page,
          limit: PAGE_SIZE,
          search: search.trim(),
          role,
          suspended,
        });
        if (cancelled) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
        setPagination((prev) => ({
          ...prev,
          total_pages: data.pagination?.total_pages || 1,
          total: data.pagination?.total || 0,
        }));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [pagination.page, search, role, suspended]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserDetails(null);
      setDetailsError("");
      return;
    }

    let cancelled = false;
    async function loadDetails() {
      setDetailsLoading(true);
      setDetailsError("");
      try {
        const data = await getAdminUserDetails(selectedUserId);
        if (!cancelled) setSelectedUserDetails(data);
      } catch (err) {
        if (!cancelled) setDetailsError(err.message || "Failed to load user details.");
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }
    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  async function handleSuspend(userId) {
    setMessage("");
    setError("");
    setBusyId(userId);
    try {
      await suspendAdminUser(userId);
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, is_suspended: true, suspended_at: new Date().toISOString() }
            : user
        )
      );
      if (selectedUserDetails?.id === userId) {
        setSelectedUserDetails((prev) => (prev ? { ...prev, is_suspended: true } : prev));
      }
      setMessage("User suspended.");
    } catch (err) {
      setError(err.message || "Failed to suspend user.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(userId) {
    if (!window.confirm("Delete this user and related data?")) return;

    setMessage("");
    setError("");
    setBusyId(userId);
    try {
      await deleteAdminUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      if (selectedUserId === userId) {
        setSelectedUserId(null);
        setSelectedUserDetails(null);
      }
      setMessage("User deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete user.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="adminPage">
      <h1 className="ownerProfile__title">User Management</h1>
      {message && <div className="inlineToast">{message}</div>}
      {error && <div className="fieldError">{error}</div>}

      <div className="formCard adminFilters">
        <input
          type="text"
          className="searchInput"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => {
            setPagination((prev) => ({ ...prev, page: 1 }));
            setSearch(e.target.value);
          }}
        />
        <select
          className="select"
          value={role}
          onChange={(e) => {
            setPagination((prev) => ({ ...prev, page: 1 }));
            setRole(e.target.value);
          }}
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="owner">Owner</option>
          <option value="admin">Admin</option>
        </select>
        <select
          className="select"
          value={suspended}
          onChange={(e) => {
            setPagination((prev) => ({ ...prev, page: 1 }));
            setSuspended(e.target.value);
          }}
        >
          <option value="">All status</option>
          <option value="false">Active</option>
          <option value="true">Suspended</option>
        </select>
      </div>

      <div className="adminUsersLayout">
        <div className="formCard adminUsersTableCard">
          {loading ? (
            <p className="placeholderPage__text">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="placeholderPage__text">No users found.</p>
          ) : (
            <table className="adminTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={selectedUserId === user.id ? "is-active" : ""}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span className={`statusBadge ${user.is_suspended ? "statusBadge--cancelled" : "statusBadge--confirmed"}`}>
                        {user.is_suspended ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div className="adminTableActions">
                        <button
                          className="btn btn--ghost"
                          type="button"
                          disabled={busyId === user.id || user.is_suspended}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSuspend(user.id);
                          }}
                        >
                          Suspend
                        </button>
                        <button
                          className="btn btn--ghost"
                          type="button"
                          disabled={busyId === user.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(user.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="adminPagination">
            <button
              className="btn btn--ghost"
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <button
              className="btn btn--ghost"
              type="button"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>

        <div className="formCard adminUserDetailsCard">
          {!selectedUserId ? (
            <p className="placeholderPage__text">Select a user to view profile and review history.</p>
          ) : detailsLoading ? (
            <p className="placeholderPage__text">Loading user details...</p>
          ) : detailsError ? (
            <div className="fieldError">{detailsError}</div>
          ) : selectedUserDetails ? (
            <>
              <div className="ownerTableConfigSectionTitle">Profile</div>
              <div className="adminDetailLine"><strong>Name:</strong> {selectedUserDetails.full_name}</div>
              <div className="adminDetailLine"><strong>Email:</strong> {selectedUserDetails.email}</div>
              <div className="adminDetailLine"><strong>Role:</strong> {selectedUserDetails.role}</div>
              <div className="adminDetailLine">
                <strong>Status:</strong> {selectedUserDetails.is_suspended ? "Suspended" : "Active"}
              </div>

              <div className="ownerTableConfigSectionTitle">Review History</div>
              {selectedUserDetails.reviews?.length ? (
                <div className="adminReviewHistory">
                  {selectedUserDetails.reviews.map((review) => (
                    <div className="adminReviewItem" key={review.id}>
                      <div className="adminReviewItem__title">{review.restaurant_name}</div>
                      <div className="adminReviewItem__meta">
                        Rating {review.rating} • {new Date(review.created_at).toLocaleDateString()}
                      </div>
                      <div className="adminReviewItem__text">{review.comment || "No comment"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="placeholderPage__text">No reviews found for this user.</p>
              )}
            </>
          ) : (
            <p className="placeholderPage__text">No details found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

