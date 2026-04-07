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

const getRestaurantsWithHealthCertificates = async () => {
  const list = await adminRepository.getRestaurantsWithHealthCertificates();
  return { success: true, status: 200, data: list };
};

const verifyRestaurant = async ({ restaurantId }) => {
  const result = await adminRepository.verifyRestaurant(restaurantId);
  if (!result) return { success: false, status: 404, error: "Restaurant not found" };
  return { success: true, status: 200, data: result };
};

const unverifyRestaurant = async ({ restaurantId }) => {
  const result = await adminRepository.unverifyRestaurant(restaurantId);
  if (!result) return { success: false, status: 404, error: "Restaurant not found" };
  return { success: true, status: 200, data: result };
};

const exportStatsAsCsv = async () => {
  const data = await adminRepository.getExportData();

  const escape = (val) => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const row = (arr) => arr.map(escape).join(",");
  const section = (title) => `\r\n"=== ${title} ==="\r\n`;

  const lines = [];

  // 1. Platform Overview
  lines.push(section("PLATFORM OVERVIEW"));
  lines.push(row(["Total Users","Suspended Users","Total Restaurants","Approved Restaurants","Pending Restaurants","Total Reservations","Confirmed Reservations","Cancelled Reservations","Total Reviews","Total Flagged Reviews","Pending Flags","Avg Restaurant Rating"]));
  const o = data.overview;
  lines.push(row([o.total_users, o.suspended_users, o.total_restaurants, o.approved_restaurants, o.pending_restaurants, o.total_reservations, o.confirmed_reservations, o.cancelled_reservations, o.total_reviews, o.total_flagged_reviews, o.pending_flags, o.avg_restaurant_rating]));

  // 2. Users
  lines.push(section("USERS"));
  lines.push(row(["ID","Name","Email","Role","Suspended","Joined At","Reservations","Reviews"]));
  data.users.forEach((u) => lines.push(row([u.id, u.name, u.email, u.role, u.suspended, u.joined_at, u.reservation_count, u.review_count])));

  // 3. Restaurants
  lines.push(section("RESTAURANTS"));
  lines.push(row(["ID","Name","Cuisine","Owner Name","Owner Email","Status","Address","Phone","Rating","Reviews","Reservations","Created At"]));
  data.restaurants.forEach((r) => lines.push(row([r.id, r.name, r.cuisine, r.owner_name, r.owner_email, r.approval_status, r.address, r.phone, r.rating, r.review_count, r.reservation_count, r.created_at])));

  // 4. Reservations
  lines.push(section("RESERVATIONS"));
  lines.push(row(["ID","Restaurant","User","User Email","Date","Time","Party Size","Status","Created At"]));
  data.reservations.forEach((r) => lines.push(row([r.id, r.restaurant_name, r.user_name, r.user_email, r.reservation_date, r.reservation_time, r.party_size, r.status, r.created_at])));

  // 5. Reviews
  lines.push(section("REVIEWS"));
  lines.push(row(["ID","Restaurant","Reviewer","Reviewer Email","Stars","Comment Preview","Flagged","Created At"]));
  data.reviews.forEach((r) => lines.push(row([r.id, r.restaurant_name, r.reviewer_name, r.reviewer_email, r.stars, r.comment_preview, r.flagged, r.created_at])));

  // 6. Top Searches
  lines.push(section("TOP SEARCHES"));
  lines.push(row(["Query","Search Count","Last Searched"]));
  data.topSearches.forEach((s) => lines.push(row([s.query, s.search_count, s.last_searched])));

  // 7. Daily Activity (last 30 days)
  lines.push(section("DAILY ACTIVITY (LAST 30 DAYS)"));
  lines.push(row(["Date","New Users","New Reservations","New Reviews"]));
  data.dailyActivity.forEach((d) => lines.push(row([d.date, d.new_users, d.new_reservations, d.new_reviews])));

  return lines.join("\r\n");
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
  sendSubscriptionUpdate,
  exportStatsAsCsv,
  getRestaurantsWithHealthCertificates,
  verifyRestaurant,
  unverifyRestaurant,
};

