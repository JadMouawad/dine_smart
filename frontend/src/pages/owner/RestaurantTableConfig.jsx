import React, { useEffect, useMemo, useState } from "react";
import {
  getMyRestaurant,
  getOwnerRestaurantTableConfig,
  saveOwnerRestaurantTableConfig,
} from "../../services/restaurantService";

const INITIAL_FORM = {
  total_capacity: "38",
  table_2_person: "5",
  table_4_person: "5",
  table_6_person: "3",
  indoor_capacity: "24",
  outdoor_capacity: "14",
};

const toNumber = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function RestaurantTableConfig() {
  const [restaurant, setRestaurant] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const ownedRestaurant = await getMyRestaurant();
        if (cancelled) return;
        setRestaurant(ownedRestaurant);

        const config = await getOwnerRestaurantTableConfig(ownedRestaurant.id);
        if (cancelled) return;
        if (config) {
          setForm({
            total_capacity: String(config.total_capacity ?? 0),
            table_2_person: String(config.table_2_person ?? 0),
            table_4_person: String(config.table_4_person ?? 0),
            table_6_person: String(config.table_6_person ?? 0),
            indoor_capacity: String(config.indoor_capacity ?? 0),
            outdoor_capacity: String(config.outdoor_capacity ?? 0),
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load table configuration.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => {
    const total = toNumber(form.total_capacity);
    const table2 = toNumber(form.table_2_person);
    const table4 = toNumber(form.table_4_person);
    const table6 = toNumber(form.table_6_person);
    const indoor = toNumber(form.indoor_capacity);
    const outdoor = toNumber(form.outdoor_capacity);

    const tableBased = (table2 * 2) + (table4 * 4) + (table6 * 6);
    const effective = tableBased > 0 ? tableBased : total;
    const zonesValid = (indoor + outdoor) <= total;

    return {
      total,
      tableBased,
      effective,
      zonesValid,
      zoneTotal: indoor + outdoor,
    };
  }, [form]);

  function applyTableBasedCapacity() {
    const table2 = toNumber(form.table_2_person);
    const table4 = toNumber(form.table_4_person);
    const table6 = toNumber(form.table_6_person);
    const computed = (table2 * 2) + (table4 * 4) + (table6 * 6);
    setForm((prev) => ({ ...prev, total_capacity: String(Math.max(computed, 1)) }));
  }

  function updateField(field, value) {
    if (value === "") {
      setForm((prev) => ({ ...prev, [field]: "" }));
      return;
    }
    if (/^\d+$/.test(value)) {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        // Auto-sync total_capacity whenever table counts change
        if (["table_2_person", "table_4_person", "table_6_person"].includes(field)) {
          const t2 = field === "table_2_person" ? parseInt(value, 10) || 0 : toNumber(prev.table_2_person);
          const t4 = field === "table_4_person" ? parseInt(value, 10) || 0 : toNumber(prev.table_4_person);
          const t6 = field === "table_6_person" ? parseInt(value, 10) || 0 : toNumber(prev.table_6_person);
          const computed = (t2 * 2) + (t4 * 4) + (t6 * 6);
          if (computed > 0) next.total_capacity = String(computed);
        }
        return next;
      });
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!restaurant?.id) return;

    const payload = {
      total_capacity: toNumber(form.total_capacity),
      table_2_person: toNumber(form.table_2_person),
      table_4_person: toNumber(form.table_4_person),
      table_6_person: toNumber(form.table_6_person),
      indoor_capacity: toNumber(form.indoor_capacity),
      outdoor_capacity: toNumber(form.outdoor_capacity),
    };

    const tableBased = (payload.table_2_person * 2) + (payload.table_4_person * 4) + (payload.table_6_person * 6);
    const effectiveTotal = tableBased > 0 ? tableBased : payload.total_capacity;

    if (effectiveTotal <= 0) {
      setError("Total seat capacity must be greater than 0. Enter at least one table or set a total capacity.");
      setSuccess("");
      return;
    }

    // Keep total_capacity in sync with table-based seats
    if (tableBased > 0) payload.total_capacity = tableBased;

    const zoneTotal = payload.indoor_capacity + payload.outdoor_capacity;
    if (zoneTotal > 0 && zoneTotal !== effectiveTotal) {
      setError(`Indoor seats (${payload.indoor_capacity}) + outdoor seats (${payload.outdoor_capacity}) = ${zoneTotal}, but total seats = ${effectiveTotal}. They must match.`);
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await saveOwnerRestaurantTableConfig(restaurant.id, payload);
      setForm({
        total_capacity: String(saved.total_capacity ?? payload.total_capacity),
        table_2_person: String(saved.table_2_person ?? payload.table_2_person),
        table_4_person: String(saved.table_4_person ?? payload.table_4_person),
        table_6_person: String(saved.table_6_person ?? payload.table_6_person),
        indoor_capacity: String(saved.indoor_capacity ?? payload.indoor_capacity),
        outdoor_capacity: String(saved.outdoor_capacity ?? payload.outdoor_capacity),
      });
      setSuccess("Configuration updated.");
    } catch (err) {
      setError(err.message || "Failed to save table configuration.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Table Configuration</h1>
        <p className="placeholderPage__text">Loading configuration...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="placeholderPage">
        <h1 className="placeholderPage__title">Table Configuration</h1>
        <p className="placeholderPage__text">Create your restaurant profile first.</p>
      </div>
    );
  }

  return (
    <div className="ownerTableConfigPage">
      <h1 className="ownerProfile__title">Table Capacity Configuration</h1>
      {success && <div className="inlineToast">{success}</div>}
      {error && <div className="fieldError">{error}</div>}

      <form className="formCard ownerTableConfigCard" onSubmit={onSubmit}>
        <div className="ownerTableConfigSummary">
          <div className="capacityPreview">
            {preview.tableBased > 0
              ? <>Total seats from tables: <strong>{preview.tableBased}</strong> seats</>
              : <>Total capacity: <strong>{preview.total}</strong> seats</>}
          </div>
          {preview.tableBased > 0 && preview.zoneTotal > 0 && (
            <div className={`capacityPreview ${preview.zoneTotal === preview.tableBased ? "" : "capacityPreview--warn"}`}>
              Indoor + outdoor: {preview.zoneTotal} / {preview.tableBased} seats
              {preview.zoneTotal !== preview.tableBased && " ⚠ must equal total seats"}
            </div>
          )}
        </div>

        <div className="ownerTableConfigSectionTitle">Table Distribution</div>
        <p className="slotAdjustHint">Enter the number of physical tables. Seats are calculated automatically.</p>
        <div className="ownerTableConfigColumns">
          <label className="field">
            <span>2-person tables</span>
            <input
              type="number"
              min="0"
              value={form.table_2_person}
              onChange={(e) => updateField("table_2_person", e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>4-person tables</span>
            <input
              type="number"
              min="0"
              value={form.table_4_person}
              onChange={(e) => updateField("table_4_person", e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>6-person tables</span>
            <input
              type="number"
              min="0"
              value={form.table_6_person}
              onChange={(e) => updateField("table_6_person", e.target.value)}
              required
            />
          </label>
        </div>

        <div className="ownerTableConfigSectionTitle">Seating Zones (optional)</div>
        <p className="slotAdjustHint">If you have both indoor and outdoor seating, enter how many seats are in each zone. They must add up to your total seats above. Leave both as 0 if you don't distinguish.</p>
        <div className="twoCols">
          <label className="field">
            <span>Indoor seats</span>
            <input
              type="number"
              min="0"
              value={form.indoor_capacity}
              onChange={(e) => updateField("indoor_capacity", e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Outdoor seats</span>
            <input
              type="number"
              min="0"
              value={form.outdoor_capacity}
              onChange={(e) => updateField("outdoor_capacity", e.target.value)}
              required
            />
          </label>
        </div>

        <div className={`capacityPreview ${preview.tableBased > 0 && preview.zoneTotal > 0 && preview.zoneTotal !== preview.tableBased ? "capacityPreview--warn" : ""}`}>
          {preview.tableBased > 0
            ? <>System will allow <strong>{preview.tableBased} seats</strong> per time slot.</>
            : <>System will allow <strong>{preview.total} seats</strong> per time slot.</>}
        </div>

        <div className="formCard__actions">
          <button className="btn btn--gold btn--xl" type="submit" disabled={saving}>
            {saving ? "Saving..." : "SAVE CONFIGURATION"}
          </button>
        </div>
      </form>
    </div>
  );
}

