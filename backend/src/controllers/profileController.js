const profileService = require("../services/profileService");
const loyaltyService = require("../services/loyaltyService");

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await profileService.getProfile(userId);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      isVerified: profile.is_verified,
      provider: profile.provider,
      phone: profile.phone || null,
      latitude: profile.latitude != null ? Number(profile.latitude) : null,
      longitude: profile.longitude != null ? Number(profile.longitude) : null,
      profilePictureUrl: profile.profile_picture_url || null,
      themePreference: profile.theme_preference || "dark",
      isSubscribed: profile.is_subscribed ?? false,
      subscriptionPreferences: Array.isArray(profile.subscription_preferences) ? profile.subscription_preferences : [],
      reservationCount: profile.reservation_count ?? 0,
      loyaltyBadge: profile.loyalty_badge || "Newcomer",
      points: profile.points ?? 0,
      rewards: profile.reward_status || null,
      noShowCount: profile.no_show_count ?? 0,
      bannedUntil: profile.banned_until || null,
      myReviews: Array.isArray(profile.my_reviews)
        ? profile.my_reviews.map((review) => ({
          id: review.id,
          restaurantId: review.restaurant_id,
          restaurantName: review.restaurant_name,
          stars: review.rating,
          text: review.comment || "",
          createdAt: review.created_at,
        }))
        : [],
      reviewsRequiringChanges: Array.isArray(profile.reviews_requiring_changes)
        ? profile.reviews_requiring_changes.map((review) => ({
          id: review.id,
          flagId: review.flag_id,
          restaurantId: review.restaurant_id,
          restaurantName: review.restaurant_name,
          stars: review.rating,
          text: review.comment || "",
          createdAt: review.created_at,
          updatedAt: review.updated_at,
          flaggedAt: review.flagged_at,
          resolvedAt: review.resolved_at,
          adminNotes: review.admin_notes || "",
          reason: review.flag_reason || "",
        }))
        : [],
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const profile = await profileService.updateProfile(userId, req.body);
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }
    const rewardStatus = await loyaltyService.getRewardStatus({ userId });
    res.json({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      isVerified: profile.is_verified,
      provider: profile.provider,
      phone: profile.phone || null,
      latitude: profile.latitude != null ? Number(profile.latitude) : null,
      longitude: profile.longitude != null ? Number(profile.longitude) : null,
      profilePictureUrl: profile.profile_picture_url || null,
      themePreference: profile.theme_preference || "dark",
      isSubscribed: profile.is_subscribed ?? false,
      subscriptionPreferences: Array.isArray(profile.subscription_preferences) ? profile.subscription_preferences : [],
      points: profile.points ?? 0,
      rewards: rewardStatus,
      noShowCount: profile.no_show_count ?? 0,
      bannedUntil: profile.banned_until || null,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const redeemReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await loyaltyService.redeemReward({ userId });
    if (!result.success) {
      return res.status(result.status).json({ message: result.error });
    }
    const rewardStatus = await loyaltyService.getRewardStatus({ userId });
    res.json({
      points: result.points ?? rewardStatus.points,
      rewards: rewardStatus,
      message: "Reward redeemed successfully.",
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  redeemReward
};
