// backend/src/controllers/authController.js

const authService = require("../services/authServices");
const { validateRegister, validateLogin } = require("../validation/authValidation");

// POST /auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    // role: "user" -> roleId 1, "owner" -> roleId 2, default user
    const roleId = role === "owner" ? 2 : 1;
    await authService.registerUser(name, email, password, roleId);

    res.status(201).json({
      message: "Verification email sent. Please verify your email."
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
      user: result.user,
      token: result.token
    });
  } catch (err) {
    const status = err.message === "Please verify your email before logging in." ? 403 : 401;
    res.status(status).json({ message: err.message });
  }
};

// POST /auth/logout
const logout = (req, res) => {
  res.status(200).json({ message: "Logged out successfully" });
};

// POST /auth/google
const googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google id_token is required" });
    }

    const result = await authService.googleAuthUser(idToken);

    res.status(200).json({
      message: "Google sign-in successful",
      user: result.user,
      token: result.token
    });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

module.exports = {
  register,
  login,
  logout,
  googleSignIn
};
