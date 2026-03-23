import React, { useEffect, useRef, useState } from "react";
import { getTodayDateValue, getCurrentSlotParams } from "../../utils/timeUtils";
import { CUISINES, DIETARY_OPTIONS, PRICE_OPTIONS, PRICE_LABELS, DIETARY_LABELS } from "../../constants/filters";

/**
 * SearchFilterDrawer
 *
 * Props:
 *   isOpen          – boolean
 *   initialFilters  – the currently-applied filters object (used to seed local state on open)
 *   effectiveGeo    – { latitude, longitude } or { latitude: null, longitude: null }
 *   optionCounts    – { cuisine, price, dietary, topRated, openNow, availableToday }
 *   onClose()
 *   onApply(filters) – called with the updated filters when the user clicks Apply
 */
export default function SearchFilterDrawer({
  isOpen,
  initialFilters,
  effectiveGeo,
  optionCounts,
  onClose,
  onApply,
}) {
  const panelRef = useRef(null);
  const [local, setLocal] = useState(initialFilters);

  // Re-seed local state each time the drawer opens
  useEffect(() => {
    if (isOpen) setLocal(initialFilters);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previousActive = document.activeElement;
    const focusableSelector = [
      "button:not([disabled])", "input:not([disabled])",
      "select:not([disabled])", "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusable = Array.from(panel.querySelectorAll(focusableSelector));
    focusable[0]?.focus();

    function onKeyDown(e) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousActive?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const clampRating = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(5, Math.round(parsed * 10) / 10));
  };

  function toggleArray(key, value) {
    setLocal((prev) => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(value)
          ? current.filter((item) => item !== value)
          : [...current, value],
      };
    });
  }

  function handleReset() {
    setLocal(initialFilters);
  }

  return (
    <div
      className="filterDrawer"
      role="dialog"
      aria-modal="true"
      aria-label="Filters"
    >
      <div className="filterDrawer__backdrop" onClick={onClose} />
      <aside className="filterDrawer__panel" ref={panelRef}>
        <header className="filterDrawer__header">
          <h2>Filters</h2>
          <button
            type="button"
            className="filterDrawer__closeBtn"
            onClick={onClose}
            aria-label="Close filters"
          >✕</button>
        </header>

        <div className="filterDrawer__body">
          {/* Quick toggles */}
          <section className="filterDrawer__section">
            <div className="filterDrawer__label">Quick</div>
            <div className="filterDrawer__quickToggles">
              <button
                type="button"
                className={`filterQuickChip${local.minRating >= 4 ? " is-on" : ""}`}
                onClick={() => setLocal((p) => ({ ...p, minRating: p.minRating >= 4 ? 0 : 4 }))}
              >⭐ Top Rated</button>
              <button
                type="button"
                className={`filterQuickChip${local.openNow ? " is-on" : ""}`}
                onClick={() => setLocal((p) => ({ ...p, openNow: !p.openNow }))}
              >🟢 Open Now</button>
              <button
                type="button"
                className={`filterQuickChip${local.availabilityDate === getTodayDateValue() ? " is-on" : ""}`}
                onClick={() => setLocal((p) => {
                  const on = p.availabilityDate === getTodayDateValue();
                  return { ...p, availabilityDate: on ? "" : getTodayDateValue(), availabilityTime: on ? "" : getCurrentSlotParams().time };
                })}
              >📅 Available Today</button>
              <button
                type="button"
                className={`filterQuickChip${local.distanceEnabled ? " is-on" : ""}`}
                disabled={effectiveGeo.latitude == null}
                onClick={() => setLocal((p) => ({ ...p, distanceEnabled: !p.distanceEnabled }))}
              >📍 Near Me</button>
            </div>
          </section>

          <section className="filterDrawer__section">
            <label className="filterDrawer__label" htmlFor="drawer-rating">
              Rating ({Number(local.minRating || 0).toFixed(1)}+)
            </label>
            <div className="filterDrawer__ratingRow">
              <input
                id="drawer-rating"
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={local.minRating}
                onChange={(e) => setLocal((p) => ({ ...p, minRating: clampRating(e.target.value) }))}
                aria-label="Minimum rating"
              />
              <input
                className="filterDrawer__ratingInput"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={Number(local.minRating || 0).toFixed(1)}
                onChange={(e) => setLocal((p) => ({ ...p, minRating: clampRating(e.target.value) }))}
                aria-label="Minimum rating exact value"
              />
            </div>
            <div className="filterDrawer__hint">Decimal ratings supported (e.g. 4.7)</div>
          </section>

          <section className="filterDrawer__section">
            <div className="filterDrawer__label">Price Range</div>
            <div className="filterDrawer__options">
              {PRICE_OPTIONS.map((price) => {
                const count = optionCounts.price[price] || 0;
                const selected = local.priceRange.includes(price);
                const disabled = count === 0 && !selected;
                return (
                  <label key={price} className={`filterOption ${disabled ? "is-disabled" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleArray("priceRange", price)}
                      aria-label={`Price ${price}`}
                    />
                    <span>{PRICE_LABELS[price] || price} ({count})</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="filterDrawer__section">
            <div className="filterDrawer__label">Dietary Support</div>
            <div className="filterDrawer__options">
              {DIETARY_OPTIONS.map((dietary) => {
                const count = optionCounts.dietary[dietary] || 0;
                const selected = local.dietarySupport.includes(dietary);
                const disabled = count === 0 && !selected;
                return (
                  <label key={dietary} className={`filterOption ${disabled ? "is-disabled" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleArray("dietarySupport", dietary)}
                      aria-label={`Dietary ${dietary}`}
                    />
                    <span>{DIETARY_LABELS[dietary] || dietary} ({count})</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="filterDrawer__section">
            <div className="filterDrawer__label">Distance Radius</div>
            <label className="filterOption">
              <input
                type="checkbox"
                checked={local.distanceEnabled}
                onChange={(e) => setLocal((p) => ({ ...p, distanceEnabled: e.target.checked }))}
                disabled={effectiveGeo.latitude == null || effectiveGeo.longitude == null}
                aria-label="Enable distance radius"
              />
              <span>Enable distance filter</span>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={local.distanceRadius}
              disabled={!local.distanceEnabled || effectiveGeo.latitude == null}
              onChange={(e) => setLocal((p) => ({ ...p, distanceRadius: Number(e.target.value) }))}
              aria-label="Distance radius in kilometers"
            />
            <div className="filterDrawer__hint">{local.distanceRadius} km</div>
          </section>

          <section className="filterDrawer__section">
            <div className="filterDrawer__label">Availability</div>
            <div className="filterDrawer__grid">
              <label className="filterDrawer__field">
                <span>Date</span>
                <input
                  type="date"
                  value={local.availabilityDate}
                  onChange={(e) => setLocal((p) => ({ ...p, availabilityDate: e.target.value }))}
                  aria-label="Availability date"
                />
              </label>
              <label className="filterDrawer__field">
                <span>Time</span>
                <input
                  type="time"
                  value={local.availabilityTime}
                  onChange={(e) => setLocal((p) => ({ ...p, availabilityTime: e.target.value }))}
                  aria-label="Availability time"
                />
              </label>
            </div>
          </section>

          <section className="filterDrawer__section">
            <label className="filterOption">
              <input
                type="checkbox"
                checked={local.verifiedOnly}
                onChange={(e) => setLocal((p) => ({ ...p, verifiedOnly: e.target.checked }))}
                aria-label="Verified restaurants only"
              />
              <span>Verified only</span>
            </label>
          </section>

          <section className="filterDrawer__section">
            <div className="filterDrawer__label">Cuisine</div>
            <div className="filterDrawer__options filterDrawer__options--multi">
              {CUISINES.map((cuisine) => {
                const count = optionCounts.cuisine[cuisine] || 0;
                const selected = local.cuisines.includes(cuisine);
                const disabled = count === 0 && !selected;
                return (
                  <label key={cuisine} className={`filterOption ${disabled ? "is-disabled" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={disabled}
                      onChange={() => toggleArray("cuisines", cuisine)}
                      aria-label={`Cuisine ${cuisine}`}
                    />
                    <span>{cuisine} ({count})</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="filterDrawer__footer">
          <button type="button" className="btn btn--ghost" onClick={handleReset}>Reset</button>
          <button type="button" className="btn btn--gold" onClick={() => onApply(local)}>Apply Filters</button>
        </footer>
      </aside>
    </div>
  );
}
