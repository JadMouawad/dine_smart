/**
 * Handles authentication logic:
 * - Register users
 * - Login users
 * - Password hashing
 * - JWT generation
 */

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // User model
const SALT_ROUNDS = 10; // bcrypt salt rounds

// Register a new user
const registerUser = async (name, email, password) => {
  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  // Create new user
  const user = await User.create({
    name,
    email,
    password: hashedPassword
  });

  // Generate JWT
  const token = jwt.sign(
    { id: user._id, email: user.email }, 
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { user, token };
};

// Login an existing user
const loginUser = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("User not found");
  }

  // Compare password
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new Error("Incorrect password");
  }

  // Generate JWT
  const token = jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  return { user, token };
};

module.exports = {
  registerUser,
  loginUser
};
