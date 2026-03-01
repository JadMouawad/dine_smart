const profileService = require("../services/profileService");

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
      profilePictureUrl: profile.profile_picture_url || null,
      reservationCount: profile.reservation_count ?? 0,
      loyaltyBadge: profile.loyalty_badge || "Newcomer",
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
    res.json({
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      role: profile.role,
      isVerified: profile.is_verified,
      provider: profile.provider,
      phone: profile.phone || null,
      profilePictureUrl: profile.profile_picture_url || null,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
