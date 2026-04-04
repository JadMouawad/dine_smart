const adminRepository = require("../repositories/adminRepository");
const chatRepository = require("../repositories/chatRepository");
const systemSettingsRepository = require("../repositories/systemSettingsRepository");
const {
  sendRestaurantApprovalEmail,
  sendRestaurantRejectionEmail,
} = require("../utils/emailSender");

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

const getAiSettings = async () => {
  const setting = await systemSettingsRepository.getAiChatSetting();
  return {
    ai_chat_enabled: setting.enabled,
    updated_at: setting.updated_at,
    updated_by: setting.updated_by,
  };
};

const updateAiSettings = async ({ aiChatEnabled, adminId }) => {
  if (typeof aiChatEnabled !== "boolean") {
    return { success: false, status: 400, error: "ai_chat_enabled must be a boolean" };
  }

  const updated = await systemSettingsRepository.setAiChatSetting({
    enabled: aiChatEnabled,
    updatedBy: adminId,
  });

  await adminRepository.insertAuditLog({
    adminId,
    action: updated.enabled ? "ai_chat_enabled" : "ai_chat_disabled",
    entityType: "app_setting",
    details: { ai_chat_enabled: updated.enabled },
  });

  return {
    success: true,
    data: {
      ai_chat_enabled: updated.enabled,
      updated_at: updated.updated_at,
      updated_by: updated.updated_by,
    },
  };
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

  if (updated.owner_email) {
    try {
      await sendRestaurantApprovalEmail({
        to: updated.owner_email,
        ownerName: updated.owner_name || "Restaurant owner",
        restaurantName: updated.name,
      });
    } catch (error) {
      console.warn("Failed to send restaurant approval email:", error.message);
    }
  }

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

  if (updated.owner_email) {
    try {
      await sendRestaurantRejectionEmail({
        to: updated.owner_email,
        ownerName: updated.owner_name || "Restaurant owner",
        restaurantName: updated.name,
        rejectionReason: reason,
      });
    } catch (error) {
      console.warn("Failed to send restaurant rejection email:", error.message);
    }
  }

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

const VALID_REVIEW_ACTIONS = new Set(["APPROVE_PUBLISH", "REQUIRE_CHANGES", "DELETE", "DISMISS"]);

const moderateFlaggedReview = async ({ flagId, adminId, action, adminNotes, resolutionLabel }) => {
  const parsedFlagId = parsePositiveInt(flagId, null);
  if (!parsedFlagId) return { success: false, status: 400, error: "Invalid flagged review ID" };

  const normalizedAction = String(action || "").trim().toUpperCase();
  if (!VALID_REVIEW_ACTIONS.has(normalizedAction)) {
    return {
      success: false,
      status: 400,
      error: "action must be one of APPROVE_PUBLISH, REQUIRE_CHANGES, DELETE, DISMISS",
    };
  }

  const applied = await adminRepository.applyModerationActionByFlagId({
    flagId: parsedFlagId,
    action: normalizedAction,
    adminNotes,
    resolutionLabel: resolutionLabel || null,
  });
  if (!applied) return { success: false, status: 404, error: "Flagged review not found" };

  await adminRepository.insertAuditLog({
    adminId,
    action: `flagged_review_${normalizedAction.toLowerCase()}`,
    entityType: "flagged_review",
    entityId: applied.id || parsedFlagId,
    details: { review_id: applied.review_id, moderator_action: normalizedAction },
  });

  return { success: true, data: applied };
};

const bulkModerateFlaggedReviews = async ({ flagIds, adminId, action, adminNotes, resolutionLabel }) => {
  const normalizedAction = String(action || "").trim().toUpperCase();
  if (!VALID_REVIEW_ACTIONS.has(normalizedAction)) {
    return {
      success: false,
      status: 400,
      error: "action must be one of APPROVE_PUBLISH, REQUIRE_CHANGES, DELETE, DISMISS",
    };
  }
  if (!Array.isArray(flagIds) || flagIds.length === 0) {
    return { success: false, status: 400, error: "flag_ids is required and must be a non-empty array" };
  }

  const results = await adminRepository.bulkApplyModerationAction({
    flagIds,
    action: normalizedAction,
    adminNotes,
    resolutionLabel: resolutionLabel || null,
  });

  await adminRepository.insertAuditLog({
    adminId,
    action: `flagged_review_bulk_${normalizedAction.toLowerCase()}`,
    entityType: "flagged_review",
    details: { count: results.length, moderator_action: normalizedAction },
  });

  return { success: true, data: { count: results.length, items: results } };
};

const dismissFlaggedReview = async ({ flagId, adminId, adminNotes }) => {
  return moderateFlaggedReview({
    flagId,
    adminId,
    action: "DISMISS",
    adminNotes,
    resolutionLabel: "FALSE_POSITIVE",
  });
};

const deleteFlaggedReview = async ({ flagId, adminId }) => {
  return moderateFlaggedReview({
    flagId,
    adminId,
    action: "DELETE",
  });
};

module.exports = {
  getStats,
  getRecentAiLogs,
  getAiSettings,
  updateAiSettings,
  getRecentActivity,
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getUsers,
  getUserDetails,
  suspendUser,
  deleteUser,
  getFlaggedReviews,
  moderateFlaggedReview,
  bulkModerateFlaggedReviews,
  dismissFlaggedReview,
  deleteFlaggedReview,
};

