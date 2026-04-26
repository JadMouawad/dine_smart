const { getPasswordValidationMessage } = require("./passwordValidation");

// Validate email using a simple regex pattern
const isValidEmail = (email) => {
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validation for registration input
const validateRegister = (name, email, password) => {
  if (!name || typeof name !== "string") {
    return "Full name is required";
  }
  if (!name.trim()) {
    return "Full name cannot be empty";
  }
  if (!email || !password) {
    return "Email and password are required";
  }
  if (!isValidEmail(email)) {
    return "Invalid email format";
  }
  const passwordError = getPasswordValidationMessage(password);
  if (passwordError) {
    return passwordError;
  }
  return null;
};

// Validation for login input
const validateLogin = (email, password) => {
  if (!email || !password) {
    return "Email and password are required";
  }

  if (!isValidEmail(email)) {
    return "Invalid email format";
  }

  return null;
};

// Export validation functions
module.exports = {
  validateRegister,
  validateLogin
};
