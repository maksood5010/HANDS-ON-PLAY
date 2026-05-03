import { useState } from "react";
import Sheet from "../Sheet/Sheet";

/**
 * Bottom-sheet friendly confirm dialog (uses Sheet — matches mobile modal overrides).
 */
export default function ConfirmSheet({
  open,
  title = "Confirm",
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  danger,
  onClose,
  onConfirm,
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy || !onConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="modal-actions confirm-sheet__actions">
      <button type="button" className="cancel-btn" onClick={onClose} disabled={busy}>
        {cancelLabel}
      </button>
      <button
        type="button"
        className={`submit-btn${danger ? " confirm-sheet__confirm--danger" : ""}`}
        onClick={handleConfirm}
        disabled={busy}
      >
        {confirmLabel}
      </button>
    </div>
  );

  return (
    <Sheet open={open} title={title} onClose={onClose} footer={footer} maxWidth="480px">
      <p className="confirm-sheet__message">{message}</p>
    </Sheet>
  );
}
