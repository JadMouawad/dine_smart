/**
 * Authentication Service
 * Handles authentication logic:
 * - Register users
 * - Login users
 * - Password hashing with bcrypt
 * - JWT token generation and verification
 */

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const pool = require("../config/db");
const User = require("../models/User");
const emailVerificationService = require("./emailVerificationService");
const { sendPasswordResetEmail } = require("../utils/emailSender");
const { getPasswordValidationMessage } = require("../validation/passwordValidation");

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

if (!GOOGLE_CLIENT_ID) {
  console.warn("WARNING: GOOGLE_CLIENT_ID is not set. Google OAuth will not work.");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const toDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const isBanActive = (bannedUntil) => {
  const bannedDate = toDateOnly(bannedUntil);
  if (!bannedDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return bannedDate >= today;
};

const clearExpiredBanIfNeeded = async (user) => {
  if (!user?.id) return user;
  if (!user.banned_until) return user;
  if (isBanActive(user.banned_until)) return user;
  const cleared = await User.clearBan(pool, user.id);
  return cleared ? { ...user, banned_until: null } : user;
};

const buildAuthResponse = async (user) => {
  const normalizedUser = await clearExpiredBanIfNeeded(user);
  const token = jwt.sign(
    { id: normalizedUser.id, email: normalizedUser.email, role: normalizedUser.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, jwtid: crypto.randomUUID() }
  );

  return {
    user: {
      id: normalizedUser.id,
      fullName: normalizedUser.full_name,
      email: normalizedUser.email,
      role: normalizedUser.role,
      latitude: normalizedUser.latitude,
      longitude: normalizedUser.longitude,
      noShowCount: normalizedUser.no_show_count ?? 0,
      bannedUntil: normalizedUser.banned_until || null,
      themePreference: normalizedUser.theme_preference || "dark",
    },
    token,
  };
};

/**
 * Register a new user (local only). Sends verification email. No JWT until email verified.
 * @param {string} fullName - User's full name
 * @param {string} email - User's email
 * @param {string} password - User's password (will be hashed)
 * @returns {Object} Empty object (JWT issued only after email verification)
 */
const registerUser = async (fullName, email, password, roleId = 1, location = {}) => {
  const existingUser = await User.findByEmail(pool, email);
  if (existingUser) {
    throw new Error("Email already registered");
  }

  const passwordValidationError = getPasswordValidationMessage(password);
  if (passwordValidationError) {
    throw new Error(passwordValidationError);
  }

  const normalizedPhone = location.phone
    ? `+${String(location.phone).replace(/\D/g, "")}`
    : null;
  if (normalizedPhone) {
    const existingByPhone = await User.findByPhone(pool, normalizedPhone);
    if (existingByPhone) {
      throw new Error("This phone number is already registered.");
    }
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    const normalizedPreferences = Array.isArray(location.subscriptionPreferences)
      ? location.subscriptionPreferences.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const normalizedSubscribed = location.isSubscribed === true || String(location.isSubscribed).toLowerCase() === "true";
    user = await User.create(pool, {
      fullName,
      email,
      password: hashedPassword,
      roleId,
      latitude: location.latitude,
      longitude: location.longitude,
      phone: normalizedPhone,
      isSubscribed: normalizedSubscribed,
      subscriptionPreferences: normalizedPreferences,
    });
  } catch (error) {
    if (error.code === "23505") {
      throw new Error("This phone number is already registered.");
    }
    throw error;
  }

  try {
    await emailVerificationService.createTokenAndSendEmail(user.id, email, fullName);
  } catch (error) {
    console.warn("Failed to send signup verification email:", {
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
      message: error?.message,
    });
    await User.deleteUnverifiedLocalById(pool, user.id);
    const message = error?.code === "ETIMEDOUT" || error?.code === "ESOCKET" || error?.code === "ENETUNREACH"
      ? "We could not send the verification email. Please try again in a moment."
      : "We could not send the verification email. Please check your email address and try again.";
    throw new Error(message);
  }

  return {};
};

/**
 * Login an existing user
 */
const loginUser = async (email, password) => {
  const user = await User.findByEmail(pool, email);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.password) {
    throw new Error("This account uses Google sign-in. Please use the 'Continue with Google' button.");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new Error("Invalid email or password");
  }

  if (user.provider === "local" && user.is_verified === false) {
    throw new Error("Please verify your email before logging in.");
  }
  if (user.is_suspended === true) {
    throw new Error("Your account has been suspended. Please contact support.");
  }
  return buildAuthResponse(user);
};

/**
 * Authenticate a user via Google OAuth id_token
 */
const googleAuthUser = async (idToken, role) => {
  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
  } catch (err) {
    throw new Error("Invalid Google token");
  }

  const payload = ticket.getPayload();
  const googleId = payload["sub"];
  const email = payload["email"];
  const fullName = payload["name"] || email.split("@")[0];
  const emailVerified = payload["email_verified"];

  if (!emailVerified) {
    throw new Error("Google account email is not verified");
  }

  let user = await User.findByGoogleId(pool, googleId);

  if (!user) {
    const existingByEmail = await User.findByEmail(pool, email);

    if (existingByEmail) {
      user = await User.linkGoogleId(pool, existingByEmail.id, googleId);
    } else {
      const roleId = role === "owner" ? 2 : 1;
      user = await User.createOAuthUser(pool, { fullName, email, googleId, roleId });
    }
  }

  if (user.is_suspended === true) {
    throw new Error("Your account has been suspended. Please contact support.");
  }
  return buildAuthResponse(user);
};

const findUserByPhone = async (phone) => {
  if (!phone) return null;
  return await User.findByPhone(pool, phone);
};

const buildPasswordResetLink = (token) => {
  const baseUrl = (process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
};

const requestPasswordReset = async (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Email is required");
  }

  const user = await User.findByEmail(pool, normalizedEmail);
  if (!user || user.provider === "google") {
    return {
      success: true,
      message: "If an account with that email exists, a reset link has been sent.",
    };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await pool.query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at <= NOW()`,
    [user.id]
  );

  await pool.query(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `,
    [user.id, tokenHash, expiresAt.toISOString()]
  );

  try {
    await sendPasswordResetEmail(
      user.email,
      buildPasswordResetLink(rawToken),
      user.full_name || "User"
    );
  } catch (error) {
    console.warn("Failed to send password reset email:", error.message);
  }

  return {
    success: true,
    message: "If an account with that email exists, a reset link has been sent.",
  };
};

const resetPassword = async ({ token, newPassword }) => {
  const rawToken = String(token || "").trim();
  const password = String(newPassword || "");

  if (!rawToken) throw new Error("Reset token is required");
  const passwordValidationError = getPasswordValidationMessage(password);
  if (passwordValidationError) throw new Error(passwordValidationError);

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const tokenResult = await pool.query(
    `
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tokenHash]
  );

  const resetRecord = tokenResult.rows[0];
  if (!resetRecord) {
    throw new Error("This reset link is invalid or has expired.");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users SET password = $1, provider = 'local', updated_at = NOW() WHERE id = $2`,
      [hashedPassword, resetRecord.user_id]
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [resetRecord.id]
    );
    await client.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND id <> $2`,
      [resetRecord.user_id, resetRecord.id]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { success: true, message: "Password reset successful." };
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

/**
 * Generate JWT token for a user object (e.g. after email verification)
 */
const generateTokenForUser = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, jwtid: crypto.randomUUID() }
  );
};

module.exports = {
  registerUser,
  loginUser,
  googleAuthUser,
  verifyToken,
  generateTokenForUser,
  findUserByPhone,
  requestPasswordReset,
  resetPassword,
};
