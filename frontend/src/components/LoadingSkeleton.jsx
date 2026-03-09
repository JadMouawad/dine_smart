import React from "react";

export default function LoadingSkeleton({ variant = "card", count = 3, className = "" }) {
  const items = Array.from({ length: Math.max(1, count) }, (_, index) => index);

  return (
    <div className={`loadingSkeleton loadingSkeleton--${variant} ${className}`.trim()} aria-live="polite" aria-busy="true">
      {items.map((item) => (
        <div key={`${variant}-${item}`} className="loadingSkeleton__item" />
      ))}
    </div>
  );
}
