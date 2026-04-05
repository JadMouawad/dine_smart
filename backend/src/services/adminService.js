const adminRepository = require("../repositories/adminRepository");
const chatRepository = require("../repositories/chatRepository");
const systemSettingsRepository = require("../repositories/systemSettingsRepository");
const {
  sendRestaurantApprovalEmail,
  sendRestaurantRejectionEmail,
} = require("../utils/emailSender");
const subscriptionService = require("./subscriptionService");

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

  try {
    await subscriptionService.sendSubscriptionUpdateOnce({
      updateType: "news",
      subject: `New restaurant on DineSmart: ${updated.name}`,
      message: `Say hello to ${updated.name}! Check out their menu and reserve your table now.`,
      entityType: "restaurant",
      entityId: updated.id,
      fingerprint: `approved:${updated.id}`,
    });
  } catch (error) {
    console.warn("Failed to send restaurant launch subscription update:", error.message);
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

const sendSubscriptionUpdate = async ({ adminId, updateType, subject, message }) => {
  const result = await subscriptionService.sendSubscriptionUpdate({ updateType, subject, message });
  if (!result.success) return result;
  const { sent, total, failed } = result.data;
  const normalizedType = String(updateType || "").trim().toLowerCase();
  const safeSubject = String(subject || "").trim();

  await adminRepository.insertAuditLog({
    adminId,
    action: "subscription_update_sent",
    entityType: "subscription_update",
    details: {
      type: normalizedType,
      subject: safeSubject,
      total,
      sent,
      failed,
    },
  });

  return { success: true, status: 200, data: { sent, total, failed } };
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
  dismissFlaggedReview,
  deleteFlaggedReview,
  sendSubscriptionUpdate,
};

