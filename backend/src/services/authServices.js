/**
 * Authentication Service
 * Handles authentication logic:
 * - Register users
 * - Login users
 * - Password hashing with bcrypt
 * - JWT token generation and verification
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const pool = require("../config/db");
const User = require("../models/User");

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn("WARNING: GOOGLE_CLIENT_ID is not set. Google OAuth will not work.");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Register a new user
 * @param {string} fullName - User's full name
 * @param {string} email - User's email
 * @param {string} password - User's password (will be hashed)
 * @returns {Object} User data and JWT token
 */
const registerUser = async (fullName, email, password) => {
  // Check if user already exists
  const existingUser = await User.findByEmail(pool, email);
  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Create new user (default role_id = 3 for regular user)
  const user = await User.create(pool, {
    fullName,
    email,
    password: hashedPassword,
    roleId: 1 // Default user role
  });

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email
    },
    token
  };
};

/**
 * Login an existing user
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Object} User data and JWT token
 */
const loginUser = async (email, password) => {
  // Find user by email
  const user = await User.findByEmail(pool, email);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Guard: OAuth-only users have no password
  if (!user.password) {
    throw new Error("This account uses Google sign-in. Please use the 'Continue with Google' button.");
  }

  // Compare password with hash
  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new Error("Invalid email or password");
  }

  // Generate JWT token
 const token = jwt.sign(
  {
    id: user.id,
    email: user.email,
    role: user.role
  },
  JWT_SECRET,
  { expiresIn: JWT_EXPIRES_IN }
);


  return {
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email
    },
    token
  };
};

/**
 * Authenticate a user via Google OAuth id_token
 * @param {string} idToken - The id_token JWT received from Google on the frontend
 * @returns {Object} User data and our application JWT token
 */
const googleAuthUser = async (idToken) => {
  // Verify the id_token with Google's servers
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

  // Try to find an existing user by Google ID
  let user = await User.findByGoogleId(pool, googleId);

  if (!user) {
    // Check if a user already exists with this email
    const existingByEmail = await User.findByEmail(pool, email);

    if (existingByEmail) {
      // Link the Google ID to the existing account
      user = await User.linkGoogleId(pool, existingByEmail.id, googleId);
    } else {
      // Brand new user — create an OAuth-only account
      user = await User.createOAuthUser(pool, { fullName, email, googleId });
    }
  }

  // Issue our own JWT — identical shape to loginUser
  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return {
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email
    },
    token
  };
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

module.exports = {
  registerUser,
  loginUser,
  googleAuthUser,
  verifyToken
};
