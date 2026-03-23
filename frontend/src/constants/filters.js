// ── Shared filter constants used by UserSearch, SearchFilterDrawer,
//    UserExplore, OwnerProfile ────────────────────────────────────────────────

export const CUISINES = [
  "American",
  "Middle Eastern",
  "French",
  "Mexican",
  "Chinese",
  "Japanese",
  "Italian",
  "Indian",
  "International",
];

export const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Halal", "GF"];

export const PRICE_OPTIONS = ["$", "$$", "$$$", "$$$$"];

export const PRICE_LABELS = {
  $: "Budget",
  $$: "Moderate",
  $$$: "Premium",
  $$$$: "Luxury",
};

export const DIETARY_LABELS = {
  Vegetarian: "Vegetarian",
  Vegan: "Vegan",
  Halal: "Halal",
  GF: "Gluten-Free",
};

export const RATING_OPTIONS = [
  { value: 0, label: "Any" },
  { value: 3.5, label: "3.5+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

export const FILLED_STAR = "\u2605";
export const EMPTY_STAR = "\u2606";
