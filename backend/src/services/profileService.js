const profileRepository = require("../repositories/profileRepository");

const getProfile = async (userId) => {
  return await profileRepository.getById(userId);
};

const updateProfile = async (userId, data) => {
  return await profileRepository.updateById(userId, data);
};

module.exports = {
  getProfile,
  updateProfile
};
