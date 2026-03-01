-- Sprint 3 Phase 5: seed upcoming events for Discover section

WITH event_seed AS (
  SELECT *
  FROM (
    VALUES
      ('Test Italian Restaurant', 'Pasta & Wine Night', 'Chef tasting menu with Italian wine pairing.', 2, 2),
      ('Little Italy', 'Family Pizza Workshop', 'Hands-on pizza making class for families.', 4, 4),
      ('Sushi World', 'Sushi Masterclass', 'Learn sushi rolling techniques with our head chef.', 1, 1),
      ('Burger House', 'Burger Combo Deal Day', 'Special burger + fries + drink combo all day.', 3, 3),
      ('Curry Palace', 'Spice Route Weekend', 'Regional Indian curry tasting experience.', 5, 6)
  ) AS t(restaurant_name, title, description, start_offset_days, end_offset_days)
)
INSERT INTO events (
  restaurant_id,
  title,
  description,
  image_url,
  event_date,
  start_date,
  end_date,
  is_active
)
SELECT
  r.id,
  s.title,
  s.description,
  NULL,
  (CURRENT_DATE + s.start_offset_days),
  (CURRENT_DATE + s.start_offset_days),
  (CURRENT_DATE + s.end_offset_days),
  true
FROM event_seed s
JOIN restaurants r ON r.name = s.restaurant_name
WHERE r.is_verified = true
  AND r.approval_status = 'approved'
  AND NOT EXISTS (
    SELECT 1
    FROM events e
    WHERE e.restaurant_id = r.id
      AND e.title = s.title
      AND e.start_date = (CURRENT_DATE + s.start_offset_days)
  );
