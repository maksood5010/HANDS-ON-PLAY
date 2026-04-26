import "./Sheet.css";
import { useEffect, useId } from "react";

export default function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  ariaLabel,
  maxWidth,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="sheet-overlay"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        className="sheet-panel"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={ariaLabel}
      >
        <div className="sheet-header">
          <div className="sheet-title-row">
            {title ? <h2 id={titleId}>{title}</h2> : null}
            <button
              type="button"
              className="sheet-close"
              onClick={() => onClose?.()}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="sheet-body">{children}</div>

        {footer ? <div className="sheet-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

