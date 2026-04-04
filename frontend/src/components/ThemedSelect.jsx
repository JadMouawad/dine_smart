import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  itemClassName = "",
  fullWidth = true,
  ariaLabel,
  align = "left",
  minMenuWidth = "100%",
}) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  const normalizedOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((option) => ({
        value: option?.value ?? "",
        valueKey: String(option?.value ?? ""),
        label: option?.label ?? "",
      })),
    [options]
  );

  const selectedOption = normalizedOptions.find(
    (option) => option.valueKey === String(value ?? "")
  );

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const menuStyle =
    align === "right"
      ? { right: 0, left: "auto", minWidth: minMenuWidth }
      : { left: 0, right: "auto", minWidth: minMenuWidth };

  return (
    <div
      ref={rootRef}
      className={`sortDropdown themedSelect ${
        fullWidth ? "themedSelect--full" : ""
      } ${className}`.trim()}
    >
      <button
        type="button"
        className={`sortDropdown__btn themedSelect__btn ${buttonClassName}`.trim()}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="themedSelect__label">
          {selectedOption?.label || placeholder}
        </span>
        <span className={`sortDropdown__caret themedSelect__caret${open ? " is-open" : ""}`}>
          ⌄
        </span>
      </button>

      {open && !disabled && (
        <div
          className={`sortDropdown__menu themedSelect__menu ${menuClassName}`.trim()}
          role="listbox"
          style={menuStyle}
        >
          {normalizedOptions.map((option) => {
            const isActive = option.valueKey === String(value ?? "");
            return (
              <button
                key={`${option.valueKey}-${String(option.label)}`}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`sortDropdown__item themedSelect__item${
                  isActive ? " is-active" : ""
                } ${itemClassName}`.trim()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
