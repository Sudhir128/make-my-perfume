-- Make My Perfume: the structural taxonomy only. No products, prices, images
-- or stock are seeded here. Safe to re-run.

insert into public.categories (slug, name, description, kind, filter_value, landing_path, is_landing, sort_order) values
  ('shop-all',              'Shop All Perfumes',     null, 'all',      null,       null,    true,  10),
  ('mens-perfumes',         'Men''s Perfumes',       null, 'audience', 'men',      null,    false, 20),
  ('womens-perfumes',       'Women''s Perfumes',     null, 'audience', 'women',    null,    false, 30),
  ('unisex-perfumes',       'Unisex Perfumes',       null, 'audience', 'unisex',   null,    false, 40),
  ('inspired-fragrances',   'Inspired Fragrances',   null, 'type',     'inspired', null,    false, 50),
  ('personalized-perfumes', 'Personalized Perfumes', null, 'landing',  null,       '/make', true,  60),
  ('gift-sets-combos',      'Gift Sets & Combos',    null, 'type',     'bundle',   null,    false, 70)
on conflict (slug) do nothing;

insert into public.scent_families (slug, name, sort_order) values
  ('fresh',   'Fresh',   10),
  ('warm',    'Warm',    20),
  ('woody',   'Woody',   30),
  ('aquatic', 'Aquatic', 40),
  ('sweet',   'Sweet',   50),
  ('floral',  'Floral',  60)
on conflict (slug) do nothing;
