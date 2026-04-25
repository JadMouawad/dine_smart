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
  searchable = false,
  searchPlaceholder = "Search...",
}) {
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((option) => ({
        value: option?.value ?? "",
        valueKey: String(option?.value ?? ""),
        label: option?.label ?? "",
        buttonLabel: option?.buttonLabel ?? option?.label ?? "",
        menuLabel: option?.menuLabel ?? option?.label ?? "",
        searchText: String(option?.searchText ?? option?.label ?? "")
          .toLowerCase()
          .trim(),
      })),
    [options]
  );

  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!searchable || !normalizedQuery) return normalizedOptions;
    return normalizedOptions.filter((option) => option.searchText.includes(normalizedQuery));
  }, [normalizedOptions, query, searchable]);

  const selectedOption = normalizedOptions.find(
    (option) => option.valueKey === String(value ?? "")
  );

  useEffect(() => {
    function handleDocumentClick(event) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    if (searchable) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

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
          {selectedOption?.buttonLabel || placeholder}
        </span>
        <span className={`sortDropdown__caret themedSelect__caret${open ? " is-open" : ""}`} aria-hidden="true">
          <span className="themedSelect__caretIcon" />
        </span>
      </button>

      {open && !disabled && (
        <div
          className={`sortDropdown__menu themedSelect__menu ${menuClassName}`.trim()}
          role="listbox"
          style={menuStyle}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {searchable && (
            <div className="themedSelect__searchWrap">
              <input
                ref={searchInputRef}
                className="themedSelect__searchInput"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {visibleOptions.length === 0 && (
            <div className="themedSelect__empty">No matches found.</div>
          )}
          {visibleOptions.map((option) => {
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
                {option.menuLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

