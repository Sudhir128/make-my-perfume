-- Manual rollback for the three catalogue migrations. NOT run by the
-- Supabase CLI. It drops only what those migrations created, and destroys
-- any catalogue or import data stored in them. Take a backup first.
-- After running it, also delete the three rows for versions
-- 20261110061340, 20261110061345 and 20261110061349 from
-- supabase_migrations.schema_migrations so the migrations can be re-applied.

drop view if exists public.v_active_sales;
drop view if exists public.v_storefront_products;
drop view if exists public.v_public_categories;

drop table if exists public.product_import_rows;
drop table if exists public.product_import_batches;
drop table if exists public.inventory;
drop table if exists public.product_images;
drop table if exists public.product_scent_families;
drop table if exists public.product_categories;
drop table if exists public.product_variants;
drop table if exists public.products;
drop table if exists public.scent_families;
drop table if exists public.categories;

drop function if exists public.catalogue_require_active_variant();
drop function if exists public.catalogue_set_updated_at();
