export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_CRITERIA = [
  {
    key: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (value) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    key: "uppercase",
    label: "At least one uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    key: "lowercase",
    label: "At least one lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    key: "number",
    label: "At least one number",
    test: (value) => /\d/.test(value),
  },
  {
    key: "symbol",
    label: "At least one symbol (e.g. !@#$%)",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

export function evaluatePasswordStrength(password) {
  const value = String(password || "");
  const criteria = PASSWORD_CRITERIA.map((item) => ({
    key: item.key,
    label: item.label,
    met: item.test(value),
  }));
  const score = criteria.filter((item) => item.met).length;
  const displayScore = value ? Math.max(score, 1) : 0;

  return {
    score,
    displayScore,
    maxScore: PASSWORD_CRITERIA.length,
    criteria,
    isStrong: criteria.every((item) => item.met),
  };
}

export function getPasswordValidationMessage() {
  return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include uppercase, lowercase, number, and symbol.`;
}

export function getStrengthTone(score, maxScore = PASSWORD_CRITERIA.length) {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio >= 0.95) return "excellent";
  if (ratio >= 0.75) return "strong";
  if (ratio >= 0.55) return "fair";
  if (ratio >= 0.35) return "weak";
  return "very-weak";
}
