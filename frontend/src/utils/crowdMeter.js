const LEVELS = new Set(["free", "moderate", "busy", "unknown"]);

export function normalizeCrowdLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return LEVELS.has(normalized) ? normalized : "unknown";
}

export function getCrowdLabel(level) {
  const normalized = normalizeCrowdLevel(level);
  if (normalized === "free") return "Free";
  if (normalized === "moderate") return "Moderate";
  if (normalized === "busy") return "Busy";
  return "Unknown";
}

export function getCrowdMeterMeta(restaurant = {}) {
  const level = normalizeCrowdLevel(restaurant.crowd_level || restaurant.crowdLevel);
  const parsedPct = Number(restaurant.crowd_pct ?? restaurant.crowdPct);
  const pct = Number.isFinite(parsedPct) ? Math.max(0, Math.min(100, Math.round(parsedPct))) : null;
  return {
    level,
    label: getCrowdLabel(level),
    pct: level === "unknown" ? null : pct,
  };
}
