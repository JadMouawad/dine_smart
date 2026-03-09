import React from "react";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Yes",
  cancelLabel = "No",
  onConfirm,
  onCancel,
  busy = false,
  busyLabel = "Processing...",
}) {
  if (!open) return null;

  return (
    <div className="modal is-open" role="dialog" aria-modal="true">
      <div className="modal__backdrop" onClick={busy ? undefined : onCancel} />
      <div className="modal__panel confirmDialog">
        <h3 className="confirmDialog__title">{title}</h3>
        {message ? <p className="confirmDialog__message">{message}</p> : null}
        <div className="confirmDialog__actions">
          <button
            className="btn btn--gold"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
