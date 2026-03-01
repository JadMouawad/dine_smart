import React from "react";

export default function EmptyState({
  title = "No results",
  message = "Nothing to display right now.",
  actionLabel = "",
  onAction,
}) {
  return (
    <div className="emptyState" role="status" aria-live="polite">
      <h3 className="emptyState__title">{title}</h3>
      <p className="emptyState__message">{message}</p>
      {actionLabel && typeof onAction === "function" && (
        <button type="button" className="btn btn--gold emptyState__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
