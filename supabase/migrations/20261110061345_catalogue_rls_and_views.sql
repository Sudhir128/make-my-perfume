-- Make My Perfume: catalogue security and storefront views.
--
-- Public visitors (anon and signed-in users alike) may only READ approved,
-- published catalogue rows. Nobody can write through the API: there are no
-- insert/update/delete policies or grants. Catalogue management happens with
-- the service role (which bypasses RLS) or the Supabase SQL editor, never
-- from the browser. Draft products, source titles and URLs, import logs and
-- stock quantities are not readable by the public.

alter table public.categories enable row level security;
alter table public.scent_families enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_scent_families enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory enable row level security;
alter table public.product_import_batches enable row level security;
alter table public.product_import_rows enable row level security;

-- Supabase grants new public tables to the API roles by default. Start from
-- nothing, then grant only the reads the storefront needs.
revoke all on
  public.categories, public.scent_families, public.products, public.product_variants,
  public.product_categories, public.product_scent_families, public.product_images,
  public.inventory, public.product_import_batches, public.product_import_rows
from anon, authenticated;

grant select on public.categories, public.scent_families, public.product_categories,
  public.product_scent_families, public.product_images to anon, authenticated;

-- Column grants keep source titles/URLs, internal keys and timestamps private.
grant select (id, slug, title, description, product_type, is_featured, status, approved_at, published_at)
  on public.products to anon, authenticated;
grant select (id, product_id, sku, size_ml, price_inr, compare_at_inr, sale_starts_at, sale_ends_at, is_active)
  on public.product_variants to anon, authenticated;
grant select (variant_id, availability) on public.inventory to anon, authenticated;
-- product_import_batches / product_import_rows: no grants, no policies.

-- ── Read policies ────────────────────────────────────────────────────
-- Child tables ask "can the caller see the parent product?", which applies
-- the products policy itself, so one rule defines what "published" means.
create policy "public reads active categories" on public.categories
  for select to anon, authenticated using (is_active);

create policy "public reads scent families" on public.scent_families
  for select to anon, authenticated using (true);

create policy "public reads published products" on public.products
  for select to anon, authenticated
  using (status = 'published' and approved_at is not null and published_at <= now());

create policy "public reads active variants of published products" on public.product_variants
  for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_id));

create policy "public reads categories of published products" on public.product_categories
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));

create policy "public reads families of published products" on public.product_scent_families
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));

create policy "public reads verified images of published products" on public.product_images
  for select to anon, authenticated
  using (verification_status = 'verified' and exists (select 1 from public.products p where p.id = product_id));

create policy "public reads availability of visible variants" on public.inventory
  for select to anon, authenticated
  using (exists (select 1 from public.product_variants v where v.id = variant_id));

-- ── Storefront views ─────────────────────────────────────────────────
-- security_invoker: the views run with the caller's rights, so the policies
-- above always apply and a view can never widen access.

-- Navigation: a category shows once it has published products, or if it is
-- an approved landing page.
create view public.v_public_categories with (security_invoker = true) as
select
  c.id, c.slug, c.name, c.description, c.kind, c.filter_value, c.landing_path, c.sort_order,
  (select count(*) from public.product_categories pc where pc.category_id = c.id) as product_count
from public.categories c
where c.is_active
  and (c.is_landing or exists (select 1 from public.product_categories pc where pc.category_id = c.id));

-- One row per published product that has at least one active variant.
-- "Latest Arrivals" is this view ordered by published_at.
create view public.v_storefront_products with (security_invoker = true) as
select
  p.id, p.slug, p.title, p.description, p.product_type, p.is_featured, p.published_at,
  min(v.price_inr) as from_price_inr,
  array_agg(v.size_ml order by v.size_ml) as sizes_ml
from public.products p
join public.product_variants v on v.product_id = p.id
group by p.id;

-- "On Sale": a variant qualifies only with an approved compare-at price above
-- its selling price, inside its sale window when one is set.
create view public.v_active_sales with (security_invoker = true) as
select
  v.id as variant_id, v.product_id, v.sku, v.size_ml, v.price_inr, v.compare_at_inr,
  round((1 - v.price_inr / v.compare_at_inr) * 100)::integer as discount_pct,
  v.sale_starts_at, v.sale_ends_at
from public.product_variants v
where v.compare_at_inr is not null
  and v.compare_at_inr > v.price_inr
  and (v.sale_starts_at is null or v.sale_starts_at <= now())
  and (v.sale_ends_at is null or v.sale_ends_at > now());

revoke all on public.v_public_categories, public.v_storefront_products, public.v_active_sales from anon, authenticated;
grant select on public.v_public_categories, public.v_storefront_products, public.v_active_sales to anon, authenticated;
