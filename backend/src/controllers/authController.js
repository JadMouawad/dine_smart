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
    const { name, email, password, role, latitude, longitude, phone, admin_signup_key: adminSignupKey } = req.body;
    const validationError = validateRegister(name, email, password);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const parsedLatitude = parseCoordinate(latitude);
    const parsedLongitude = parseCoordinate(longitude);
    const hasLocation = parsedLatitude != null && parsedLongitude != null;
    const hasPartialLocation = (parsedLatitude != null && parsedLongitude == null) || (parsedLatitude == null && parsedLongitude != null);
    if (hasPartialLocation) {
      return res.status(400).json({ message: "Please provide both latitude and longitude, or skip location." });
    }
    if (hasLocation && (parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180)) {
      return res.status(400).json({ message: "Invalid location coordinates." });
    }
    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    const isAdminSignup = role === "admin";
    if (!isAdminSignup && (!normalizedPhone || normalizedPhone.length < 7)) {
      return res.status(400).json({ message: "Valid phone number is required for signup." });
    }

    let roleId = 1;
    if (role === "owner") {
      roleId = 2;
    } else if (role === "admin") {
      const expectedAdminKey = String(process.env.ADMIN_SIGNUP_KEY || "").trim();
      const providedAdminKey = String(adminSignupKey || "").trim();
      if (!expectedAdminKey || providedAdminKey !== expectedAdminKey) {
        return res.status(403).json({ message: "Invalid admin access key." });
      }
      roleId = 3;
    }
    await authService.registerUser(name, email, password, roleId, {
      latitude: hasLocation ? parsedLatitude : null,
      longitude: hasLocation ? parsedLongitude : null,
      phone: isAdminSignup ? null : `+${normalizedPhone}`,
    });

    res.status(201).json({
      message: "Verification email sent. Please verify your email."
    });
  } catch (err) {
    const message = err.message === "This phone number is already registered."
      ? err.message
      : err.message;
    res.status(400).json({ message });
  }
};

// GET /auth/phone-exists?phone=+961...
const phoneExists = async (req, res) => {
  try {
    const raw = String(req.query.phone || "");
    const digits = raw.replace(/\D/g, "");
    if (!digits || digits.length < 7) {
      return res.status(200).json({ exists: false });
    }
    const normalized = `+${digits}`;
    const existing = await authService.findUserByPhone(normalized);
    return res.status(200).json({ exists: Boolean(existing) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
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
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google id_token is required" });
    }

    const result = await authService.googleAuthUser(idToken, role);

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
  googleSignIn,
  phoneExists
};
