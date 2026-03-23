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
};

