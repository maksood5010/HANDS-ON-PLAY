import "./PasswordInput.css";
import { useId, useState } from "react";

export default function PasswordInput({
  id,
  className = "",
  inputClassName = "",
  defaultVisible = false,
  visibleLabel = "Hide password",
  hiddenLabel = "Show password",
  ...inputProps
}) {
  const autoId = useId();
  const inputId = id || `password-${autoId}`;
  const [visible, setVisible] = useState(Boolean(defaultVisible));

  return (
    <div className={`password-input ${className}`.trim()}>
      <input
        {...inputProps}
        id={inputId}
        type={visible ? "text" : "password"}
        className={`password-input__field ${inputClassName}`.trim()}
      />
      <button
        type="button"
        className="password-input__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? visibleLabel : hiddenLabel}
        aria-pressed={visible}
        tabIndex={0}
      >
        {visible ? (
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94" />
            <path d="M1 1l22 22" />
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.86 21.86 0 0 1-3.17 4.41" />
            <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

