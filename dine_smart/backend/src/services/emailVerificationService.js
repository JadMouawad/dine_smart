const crypto = require("crypto");
const pool = require("../config/db");
const EmailVerificationToken = require("../models/EmailVerificationToken");
const User = require("../models/User");
const { sendVerificationEmail } = require("../utils/emailSender");

const TOKEN_EXPIRY_HOURS = 1;

/**
 * Create verification token and send email for local registration
 * @param {number} userId - User ID
 * @param {string} email - User email
 * @param {string} fullName - User full name
 */
const createTokenAndSendEmail = async (userId, email, fullName) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await EmailVerificationToken.create(userId, token, expiresAt);

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verificationLink = `${frontendUrl}/verify-email?token=${token}`;

  await sendVerificationEmail(email, verificationLink, fullName);
};

/**
 * Verify token, mark user as verified, delete token
 * @param {string} token - Verification token from URL
 * @returns {Object} { user } for JWT generation
 */
const verifyToken = async (token) => {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid or missing verification token");
  }

  const record = await EmailVerificationToken.findByToken(token);

  if (!record) {
    const expiredRecord = await EmailVerificationToken.findByTokenAny(token);
    if (expiredRecord) {
      throw new Error("Verification token has expired. Please request a new one.");
    }
    throw new Error("Invalid verification token");
  }

  await User.markVerified(pool, record.user_id);
  await EmailVerificationToken.deleteByToken(token);

  const user = await User.findById(pool, record.user_id);
  return { user };
};

module.exports = {
  createTokenAndSendEmail,
  verifyToken
};
