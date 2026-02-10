/**
 * Handles HTTP requests:
 * - Calls authService
 * - Sends proper responses
 */

const authService = require("../services/authServices");
const { validateRegister, validateLogin } = require("../validation/authValidation");

// POST /auth/register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    const error = validateRegister(email, password);
    if (error) {
      return res.status(400).json({ message: error });
    }

    // Call service
    const result = await authService.registerUser(name, email, password);

    res.status(201).json({
      message: "User registered successfully",
      user: result.user,
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

    // Validate input
    const error = validateLogin(email, password);
    if (error) {
      return res.status(400).json({ message: error });
    }

    // Call service
    const result = await authService.loginUser(email, password);

    res.status(200).json({
      message: "Login successful",
      user: result.user,
      token: result.token
    });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

module.exports = {
  register,
  login

};
