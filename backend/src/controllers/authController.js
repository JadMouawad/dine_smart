// backend/src/controllers/authController.js

const authService = require("../services/authServices");

// POST /auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const result = await authService.registerUser(name, email, password);

    res.status(201).json({
      message: "User registered successfully",
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      token: result.token
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// POST /auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);

    res.status(200).json({
      message: "Login successful",
      user: { id: result.user.id, name: result.user.name, email: result.user.email },
      token: result.token
    });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

// GET /user/me
const me = async (req, res) => {
  try {
    // user info is added by requireAuth middleware
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    res.status(200).json({
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, me };
