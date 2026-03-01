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

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn("WARNING: GOOGLE_CLIENT_ID is not set. Google OAuth will not work.");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

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

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create(pool, {
    fullName,
    email,
    password: hashedPassword,
    roleId,
    latitude: location.latitude,
    longitude: location.longitude,
  });

  await emailVerificationService.createTokenAndSendEmail(user.id, email, fullName);

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

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, jwtid: crypto.randomUUID() }
  );

  return {
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      latitude: user.latitude,
      longitude: user.longitude,
    },
    token
  };
};

/**
 * Authenticate a user via Google OAuth id_token
 */
const googleAuthUser = async (idToken) => {
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
      user = await User.createOAuthUser(pool, { fullName, email, googleId });
    }
  }

  if (user.is_suspended === true) {
    throw new Error("Your account has been suspended. Please contact support.");
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, jwtid: crypto.randomUUID() }
  );

  return {
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      latitude: user.latitude,
      longitude: user.longitude,
    },
    token
  };
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
  generateTokenForUser
};
