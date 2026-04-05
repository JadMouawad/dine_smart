const normalizeMenuSections = (menuSections) => (Array.isArray(menuSections) ? menuSections : []);

const normalizeText = (value) => String(value || "").trim();

const parsePriceValue = (value) => {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const buildMenuItemKey = (item, sectionName = "") => {
  const rawId = item?.id != null ? String(item.id).trim() : "";
  if (rawId) return `id:${rawId}`;
  const name = normalizeText(item?.name);
  const section = normalizeText(sectionName);
  if (!name) return "";
  return `name:${section}|${name}`.toLowerCase();
};

const extractMenuItems = (menuSections) => {
  const items = [];
  normalizeMenuSections(menuSections).forEach((section) => {
    const sectionName = section.sectionName || section.section_name || section.name || "";
    const list = Array.isArray(section.items) ? section.items : [];
    list.forEach((item) => {
      const key = buildMenuItemKey(item, sectionName);
      if (!key) return;
      items.push({
        key,
        name: normalizeText(item.name) || "Menu item",
        price: parsePriceValue(item.price),
        currency: normalizeText(item.currency) || "USD",
      });
    });
  });
  return items;
};

module.exports = {
  normalizeMenuSections,
  parsePriceValue,
  extractMenuItems,
};
