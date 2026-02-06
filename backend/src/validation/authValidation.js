// Validate email using a simple regex pattern
const isValidEmail = (email) => {
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate password rules
const isValidPassword = (password) => {
  // Password must be at least 6 characters long
  return password && password.length >= 6;
};

// Validation for registration input
const validateRegister = (email, password) => {
  // Check if fields exist
  if (!email || !password) {
    return "Email and password are required";
  }

  // Check email format
  if (!isValidEmail(email)) {
    return "Invalid email format";
  }

  // Check password strength
  if (!isValidPassword(password)) {
    return "Password must be at least 6 characters long";
  }

  // If everything is valid, return null
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
