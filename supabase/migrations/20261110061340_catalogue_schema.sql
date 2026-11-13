-- Make My Perfume: catalogue schema (additive).
--
-- Parent products, size variants, categories, scent families, images,
-- inventory and import tracking. Nothing here modifies or deletes existing
-- data: if any of these tables already exists, the migration stops before
-- changing anything, so an existing catalogue can be reviewed and reused
-- instead of being shadowed (see supabase/preflight.sql).
--
-- Row Level Security and grants are in the next migration; the tables are
-- not exposed until that one has run.

do $$
declare
  existing text;
begin
  select string_agg(table_name, ', ' order by table_name)
    into existing
  from information_schema.tables
  where table_schema = 'public'
    and table_name in (
      'categories', 'scent_families', 'products', 'product_variants',
      'product_categories', 'product_scent_families', 'product_images',
      'inventory', 'product_import_batches', 'product_import_rows'
    );
  if existing is not null then
    raise exception
      'Catalogue tables already exist in schema public: %. Nothing was changed. Review them with supabase/preflight.sql and reuse or rename before applying this migration.',
      existing;
  end if;
end
$$;

create function public.catalogue_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

-- ── Categories (shopping categories and landing pages) ───────────────
-- kind 'all'      : every published product (/collection)
-- kind 'audience' : filter_value men | women | unisex  (?audience=)
-- kind 'type'     : filter_value inspired | bundle      (?type=)
-- kind 'landing'  : a page, not a product list (landing_path, e.g. /make)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  description text,
  kind text not null check (kind in ('all', 'audience', 'type', 'landing')),
  filter_value text,
  landing_path text,
  -- Shown in public navigation even with no published products.
  is_landing boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_filter_ck check ((kind in ('audience', 'type')) = (filter_value is not null)),
  constraint categories_audience_ck check (kind <> 'audience' or filter_value in ('men', 'women', 'unisex')),
  constraint categories_type_ck check (kind <> 'type' or filter_value in ('inspired', 'bundle')),
  constraint categories_landing_ck check ((kind = 'landing') = (landing_path is not null)),
  constraint categories_landing_path_ck check (landing_path is null or landing_path like '/%')
);

-- ── Scent families: discovery filters, not top-level categories ──────
create table public.scent_families (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Products (one row per fragrance) ─────────────────────────────────
-- title and slug stay empty until a human reviews the public name, so an
-- imported draft never carries a public name by accident. source_* keep
-- the original listing for traceability and are never shown publicly.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique check (length(btrim(product_key)) > 0),
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text check (title is null or length(btrim(title)) > 0),
  source_title text,
  source_url text,
  description text,
  product_type text not null default 'fragrance' check (product_type in ('fragrance', 'bundle', 'personalized', 'accessory')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  is_featured boolean not null default false,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_published_ck check (
    status <> 'published'
    or (title is not null and slug is not null and approved_at is not null and published_at is not null)
  )
);

create index products_published_idx on public.products (published_at desc) where status = 'published';

-- ── Variants (one row per bottle size, each with its own SKU and price) ──
-- A price of zero or less cannot be stored. A compare-at price can only be
-- stored once it has been approved, so an unverified "was" price can never
-- reach the storefront.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  sku text not null unique check (sku ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'),
  size_ml integer not null check (size_ml > 0 and size_ml <= 1000),
  price_inr numeric(10, 2) not null check (price_inr > 0),
  compare_at_inr numeric(10, 2),
  compare_at_approved_at timestamptz,
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size_ml),
  constraint variants_compare_at_ck check (compare_at_inr is null or compare_at_inr > price_inr),
  constraint variants_compare_at_approved_ck check (compare_at_inr is null or compare_at_approved_at is not null),
  constraint variants_sale_window_ck check (sale_starts_at is null or sale_ends_at is null or sale_ends_at > sale_starts_at)
);

create index product_variants_product_idx on public.product_variants (product_id);

-- ── Links ────────────────────────────────────────────────────────────
create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories (category_id);

-- A product may carry several families. A row exists only once the notes
-- have been verified; no row means the family is still pending.
create table public.product_scent_families (
  product_id uuid not null references public.products (id) on delete cascade,
  family_id uuid not null references public.scent_families (id) on delete restrict,
  primary key (product_id, family_id)
);
create index product_scent_families_family_idx on public.product_scent_families (family_id);

-- ── Images ───────────────────────────────────────────────────────────
-- Only verified images are ever shown. Nothing is verified by default.
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text,
  url text,
  alt_text text,
  sort_order integer not null default 0,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'rejected')),
  source text,
  created_at timestamptz not null default now(),
  constraint product_images_location_ck check (storage_path is not null or url is not null),
  unique (product_id, sort_order)
);

-- ── Inventory ────────────────────────────────────────────────────────
-- Unknown until the business says otherwise: no invented stock.
create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  quantity integer check (quantity is null or quantity >= 0),
  availability text not null default 'unknown' check (availability in ('unknown', 'in_stock', 'low_stock', 'out_of_stock', 'preorder')),
  updated_at timestamptz not null default now()
);

-- ── Import tracking ──────────────────────────────────────────────────
create table public.product_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_file text not null,
  source_sha256 text unique,
  source_label text,
  status text not null default 'staged' check (status in ('staged', 'reviewed', 'applied', 'failed')),
  row_count integer not null default 0 check (row_count >= 0),
  notes text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.product_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.product_import_batches (id) on delete cascade,
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  source_url text,
  original jsonb not null,
  normalized jsonb,
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  review_status text not null default 'pending' check (review_status in ('pending', 'flagged', 'rejected', 'approved')),
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  imported_at timestamptz not null default now(),
  unique (batch_id, source_sheet, source_row)
);
create index product_import_rows_status_idx on public.product_import_rows (batch_id, review_status);

-- ── Triggers ─────────────────────────────────────────────────────────
create trigger categories_updated_at before update on public.categories
  for each row execute function public.catalogue_set_updated_at();
create trigger products_updated_at before update on public.products
  for each row execute function public.catalogue_set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants
  for each row execute function public.catalogue_set_updated_at();
create trigger inventory_updated_at before update on public.inventory
  for each row execute function public.catalogue_set_updated_at();

-- A product cannot be published before it has an active, priced variant.
create function public.catalogue_require_active_variant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and not exists (
    select 1 from public.product_variants v where v.product_id = new.id and v.is_active
  ) then
    raise exception 'Product % cannot be published without an active variant', new.product_key;
  end if;
  return new;
end
$$;

create trigger products_require_active_variant before insert or update of status on public.products
  for each row execute function public.catalogue_require_active_variant();
