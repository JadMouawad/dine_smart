-- Menu data for restaurants (sections + items stored as JSONB)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS menu_sections JSONB DEFAULT '[]';

COMMENT ON COLUMN restaurants.menu_sections IS 'Array of { sectionId, sectionName, items: [{ id, name, price, currency, description, imageUrl }] }';
