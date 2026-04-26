import React from "react";
import { evaluatePasswordStrength, getStrengthTone } from "../utils/passwordStrength.js";

const STRENGTH_LABELS = {
  "very-weak": "Very weak",
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
  excellent: "Excellent",
};

export default function PasswordStrengthMeter({ password, className = "", hideWhenEmpty = false }) {
  const strength = evaluatePasswordStrength(password);
  const tone = getStrengthTone(strength.score, strength.maxScore);
  const label = STRENGTH_LABELS[tone] || "Weak";
  const progress = strength.maxScore > 0 ? (strength.score / strength.maxScore) * 100 : 0;

  if (hideWhenEmpty && !password) return null;

  return (
    <section className={`passwordStrength ${className}`.trim()} aria-live="polite">
      <div className="passwordStrength__topRow">
        <span>Password strength</span>
        <span className={`passwordStrength__score passwordStrength__score--${tone}`}>
          {password ? `${strength.displayScore}/${strength.maxScore}` : `0/${strength.maxScore}`} {label}
        </span>
      </div>

      <div className="passwordStrength__bar" role="progressbar" aria-valuemin={0} aria-valuemax={strength.maxScore} aria-valuenow={strength.score}>
        <div className={`passwordStrength__fill passwordStrength__fill--${tone}`} style={{ width: `${progress}%` }} />
      </div>

      <ul className="passwordStrength__list">
        {strength.criteria.map((item) => (
          <li key={item.key} className={`passwordStrength__item ${item.met ? "is-met" : ""}`}>
            <span aria-hidden="true">{item.met ? "✓" : "○"}</span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
