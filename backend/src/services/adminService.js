const adminRepository = require("../repositories/adminRepository");
const chatRepository = require("../repositories/chatRepository");

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const getStats = async () => {
  const stats = await adminRepository.getDashboardStats();
  return {
    total_users: stats.total_users || 0,
    total_restaurants: stats.total_restaurants || 0,
    pending_approvals: stats.pending_approvals || 0,
    flagged_reviews: stats.flagged_reviews || 0,
    todays_reservations: stats.todays_reservations || 0,
  };
};

const getRecentAiLogs = async (limit = 20) => {
  const safeLimit = Math.min(parsePositiveInt(limit, 20), 100);
  return chatRepository.getRecentConversationLogs(safeLimit);
};

const getRecentActivity = async (limit = 10) => {
  const safeLimit = Math.min(parsePositiveInt(limit, 10), 25);
  return adminRepository.getRecentActivity(safeLimit);
};

const getPendingRestaurants = async () => {
  return adminRepository.getPendingRestaurants();
};

const approveRestaurant = async ({ restaurantId, adminId }) => {
  const parsedRestaurantId = parsePositiveInt(restaurantId, null);
  if (!parsedRestaurantId) return { success: false, status: 400, error: "Invalid restaurant ID" };

  const updated = await adminRepository.approveRestaurant(parsedRestaurantId);
  if (!updated) return { success: false, status: 404, error: "Pending restaurant not found" };

  await adminRepository.insertAuditLog({
    adminId,
    action: "restaurant_approved",
    entityType: "restaurant",
    entityId: updated.id,
    details: { name: updated.name },
  });

  return { success: true, data: updated };
};

const rejectRestaurant = async ({ restaurantId, rejectionReason, adminId }) => {
  const parsedRestaurantId = parsePositiveInt(restaurantId, null);
  if (!parsedRestaurantId) return { success: false, status: 400, error: "Invalid restaurant ID" };

  const reason = String(rejectionReason || "").trim();
  if (reason.length < 20) {
    return { success: false, status: 400, error: "rejection_reason must be at least 20 characters" };
  }

  const updated = await adminRepository.rejectRestaurant(parsedRestaurantId, reason);
  if (!updated) return { success: false, status: 404, error: "Pending restaurant not found" };

  await adminRepository.insertAuditLog({
    adminId,
    action: "restaurant_rejected",
    entityType: "restaurant",
    entityId: updated.id,
    details: { reason },
  });

  return { success: true, data: updated };
};

const getUsers = async (query) => {
  const page = parsePositiveInt(query.page, 1);
  const limit = Math.min(parsePositiveInt(query.limit, 10), 50);
  const search = query.search ? String(query.search).trim() : "";
  const role = query.role ? String(query.role).trim().toLowerCase() : "";

  let suspended = null;
  if (query.suspended != null) {
    const value = String(query.suspended).toLowerCase();
    if (value === "true") suspended = true;
    if (value === "false") suspended = false;
  }

  const result = await adminRepository.listUsers({
    page,
    limit,
    search: search || null,
    role: role || null,
    suspended,
  });

  return {
    users: result.users,
    pagination: {
      page,
      limit,
      total: result.total,
      total_pages: Math.ceil(result.total / limit) || 1,
    },
  };
};

const getUserDetails = async (userId) => {
  const parsedUserId = parsePositiveInt(userId, null);
  if (!parsedUserId) return { success: false, status: 400, error: "Invalid user ID" };

  const details = await adminRepository.getUserDetails(parsedUserId);
  if (!details) return { success: false, status: 404, error: "User not found" };

  return { success: true, data: details };
};

const suspendUser = async ({ userId, adminId }) => {
  const parsedUserId = parsePositiveInt(userId, null);
  if (!parsedUserId) return { success: false, status: 400, error: "Invalid user ID" };
  if (parsedUserId === parseInt(adminId, 10)) {
    return { success: false, status: 400, error: "You cannot suspend your own account" };
  }

  const suspended = await adminRepository.suspendUser(parsedUserId);
  if (!suspended) return { success: false, status: 404, error: "User not found" };

  await adminRepository.insertAuditLog({
    adminId,
    action: "user_suspended",
    entityType: "user",
    entityId: suspended.id,
    details: { email: suspended.email },
  });

  return { success: true, data: suspended };
};

const deleteUser = async ({ userId, adminId }) => {
  const parsedUserId = parsePositiveInt(userId, null);
  if (!parsedUserId) return { success: false, status: 400, error: "Invalid user ID" };
  if (parsedUserId === parseInt(adminId, 10)) {
    return { success: false, status: 400, error: "You cannot delete your own account" };
  }

  const deleted = await adminRepository.deleteUserAndOwnedData(parsedUserId);
  if (!deleted) return { success: false, status: 404, error: "User not found" };

  await adminRepository.insertAuditLog({
    adminId,
    action: "user_deleted",
    entityType: "user",
    entityId: deleted.id,
    details: { email: deleted.email },
  });

  return { success: true, data: deleted };
};

const getFlaggedReviews = async () => {
  return adminRepository.getFlaggedReviews();
};

const dismissFlaggedReview = async ({ flagId, adminId, adminNotes }) => {
  const parsedFlagId = parsePositiveInt(flagId, null);
  if (!parsedFlagId) return { success: false, status: 400, error: "Invalid flagged review ID" };

  const dismissed = await adminRepository.dismissFlaggedReview(parsedFlagId, adminNotes);
  if (!dismissed) return { success: false, status: 404, error: "Flagged review not found" };

  await adminRepository.insertAuditLog({
    adminId,
    action: "flagged_review_dismissed",
    entityType: "flagged_review",
    entityId: dismissed.id,
    details: { review_id: dismissed.review_id },
  });

  return { success: true, data: dismissed };
};

const deleteFlaggedReview = async ({ flagId, adminId }) => {
  const parsedFlagId = parsePositiveInt(flagId, null);
  if (!parsedFlagId) return { success: false, status: 400, error: "Invalid flagged review ID" };

  const deleted = await adminRepository.deleteReviewByFlagId(parsedFlagId);
  if (!deleted) return { success: false, status: 404, error: "Flagged review not found" };

  await adminRepository.insertAuditLog({
    adminId,
    action: "flagged_review_deleted",
    entityType: "review",
    entityId: deleted.review_id,
    details: { flag_id: deleted.flag_id, restaurant_id: deleted.restaurant_id },
  });

  return { success: true, data: deleted };
};

module.exports = {
  getStats,
  getRecentAiLogs,
  getRecentActivity,
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getUsers,
  getUserDetails,
  suspendUser,
  deleteUser,
  getFlaggedReviews,
  dismissFlaggedReview,
  deleteFlaggedReview,
};

