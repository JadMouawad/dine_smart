// backend/src/controllers/authController.js

const authService = require("../services/authService");
const { validateRegister, validateLogin } = require("../validation/authValidation");

const parseCoordinate = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// POST /auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, role, latitude, longitude } = req.body;
    const validationError = validateRegister(name, email, password);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);
    const hasLocation = parsedLatitude != null && parsedLongitude != null;
    if (!hasLocation) {
      return res.status(400).json({ message: "Location (latitude and longitude) is required for signup." });
    }
    if (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) {
      return res.status(400).json({ message: "Invalid location coordinates." });
    }

    const roleId = role === "owner" ? 2 : 1;
    await authService.registerUser(name, email, password, roleId, {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
    });

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
    const validationError = validateLogin(email, password);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    const result = await authService.loginUser(email, password);

    res.status(200).json({
      message: "Login successful",
      user: result.user,
      token: result.token
    });
  } catch (err) {
    const status =
      err.message === "Please verify your email before logging in." ||
      err.message === "Your account has been suspended. Please contact support."
        ? 403
        : 401;
    res.status(status).json({ message: err.message });
  }
};

// POST /auth/logout — invalidate token (add to blacklist)
const tokenBlacklistRepository = require("../repositories/tokenBlacklistRepository");

const logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      if (token) {
        const jwt = require("jsonwebtoken");
        const jwtSecret = process.env.JWT_SECRET || "your-secret-key-change-in-production";
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded.jti && decoded.exp) {
          await tokenBlacklistRepository.add(decoded.jti, decoded.exp);
        }
      }
    }
    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(200).json({ message: "Logged out successfully" });
  }
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
    const status = err.message === "Your account has been suspended. Please contact support." ? 403 : 401;
    res.status(status).json({ message: err.message });
  }
};

module.exports = {
  register,
  login,
  logout,
  googleSignIn
};
