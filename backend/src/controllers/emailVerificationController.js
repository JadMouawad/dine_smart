const emailVerificationService = require("../services/emailVerificationService");
const authService = require("../services/authServices");

/**
 * GET /api/auth/verify-email?token=...
 * Verify email token, mark user verified, optionally return JWT for auto-login
 */
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ message: "Verification token is required" });
    }

    const { user } = await emailVerificationService.verifyToken(token);
    const jwtToken = authService.generateTokenForUser(user);

    res.status(200).json({
      message: "Email verified successfully",
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email
      },
      token: jwtToken
    });
  } catch (err) {
    const isVerificationError =
      err.message.includes("Invalid") ||
      err.message.includes("expired") ||
      err.message.includes("missing");
    const status = isVerificationError ? 400 : 500;
    res.status(status).json({ message: err.message });
  }
};

module.exports = {
  verifyEmail
};
