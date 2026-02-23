const bcrypt = require("bcrypt");
const profileRepository = require("../repositories/profileRepository");

const SALT_ROUNDS = 10;

const getProfile = async (userId) => {
  return await profileRepository.getById(userId);
};

const updateProfile = async (userId, data) => {
  const updates = { ...data };
  if (updates.password != null && updates.password !== "") {
    updates.password = await bcrypt.hash(updates.password, SALT_ROUNDS);
  } else {
    delete updates.password;
  }
  return await profileRepository.updateById(userId, updates);
};

module.exports = {
  getProfile,
  updateProfile
};
