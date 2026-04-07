const adminService = require("../services/adminService");

const getStats = async (req, res) => {
  try {
    const stats = await adminService.getStats();
    return res.status(200).json(stats);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getRecentAiLogs = async (req, res) => {
  try {
    const logs = await adminService.getRecentAiLogs(req.query.limit);
    return res.status(200).json(logs);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getAiSettings = async (_req, res) => {
  try {
    const settings = await adminService.getAiSettings();
    return res.status(200).json(settings);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateAiSettings = async (req, res) => {
  try {
    const result = await adminService.updateAiSettings({
      aiChatEnabled: req.body.ai_chat_enabled,
      adminId: req.user.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getRecentActivity = async (req, res) => {
  try {
    const activity = await adminService.getRecentActivity(req.query.limit);
    return res.status(200).json(activity);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getPendingRestaurants = async (req, res) => {
  try {
    const restaurants = await adminService.getPendingRestaurants();
    return res.status(200).json(restaurants);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const approveRestaurant = async (req, res) => {
  try {
    const result = await adminService.approveRestaurant({
      restaurantId: req.params.id,
      adminId: req.user.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const rejectRestaurant = async (req, res) => {
  try {
    const result = await adminService.rejectRestaurant({
      restaurantId: req.params.id,
      rejectionReason: req.body.rejection_reason,
      adminId: req.user.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const payload = await adminService.getUsers(req.query);
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const result = await adminService.getUserDetails(req.params.id);
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const suspendUser = async (req, res) => {
  try {
    const result = await adminService.suspendUser({
      userId: req.params.id,
      adminId: req.user.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const result = await adminService.deleteUser({
      userId: req.params.id,
      adminId: req.user.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getFlaggedReviews = async (req, res) => {
  try {
    const flagged = await adminService.getFlaggedReviews();
    return res.status(200).json(flagged);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const moderateFlaggedReview = async (req, res) => {
  try {
    const result = await adminService.moderateFlaggedReview({
      flagId: req.params.id,
      adminId: req.user.id,
      action: req.body.action,
      adminNotes: req.body.admin_notes,
      resolutionLabel: req.body.resolution_label,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const bulkModerateFlaggedReviews = async (req, res) => {
  try {
    const result = await adminService.bulkModerateFlaggedReviews({
      flagIds: req.body.flag_ids,
      adminId: req.user.id,
      action: req.body.action,
      adminNotes: req.body.admin_notes,
      resolutionLabel: req.body.resolution_label,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const dismissFlaggedReview = async (req, res) => {
  try {
    const result = await adminService.dismissFlaggedReview({
      flagId: req.params.id,
      adminId: req.user.id,
      adminNotes: req.body.admin_notes,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteFlaggedReview = async (req, res) => {
  try {
    const result = await adminService.deleteFlaggedReview({
      flagId: req.params.id,
      adminId: req.user.id,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(200).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const sendSubscriptionUpdate = async (req, res) => {
  try {
    const result = await adminService.sendSubscriptionUpdate({
      adminId: req.user.id,
      updateType: req.body.update_type,
      subject: req.body.subject,
      message: req.body.message,
    });
    if (!result.success) return res.status(result.status).json({ message: result.error });
    return res.status(result.status).json(result.data);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const exportStatsCsv = async (req, res) => {
  try {
    const csv = await adminService.exportStatsAsCsv();
    const filename = `dinesmart_stats_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
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
  exportStatsCsv,
};

