-- Make My Perfume: E-Commerce Full-Stack Schema (Admin Portal, Fragrance Types CRUD,
-- Merchandising Carousels, Orders (COD & UPI), Invoices, Email Outbox & Activity Log)
-- Additive and idempotent. Preserves all Phase A catalogue tables and RLS protections.

create or replace function public.current_jwt_claims()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  raw text;
begin
  raw := nullif(current_setting('request.jwt.claims', true), '');
  if raw is null then
    return '{}'::jsonb;
  end if;
  return raw::jsonb;
exception when others then
  return '{}'::jsonb;
end
$$;

-- ── 1. Extend categories & add fragrance_types CRUD table ─────────────────
alter table public.categories drop constraint if exists categories_type_ck;
alter table public.categories
  add constraint categories_type_ck
  check (kind <> 'type' or (filter_value is not null and filter_value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));

update public.categories
set name = 'Gifting & Combos'
where slug = 'gift-sets-combos' and name = 'Gift Sets & Combos';

create table if not exists public.fragrance_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (length(btrim(name)) > 0),
  description text,
  category_slug text references public.categories (slug) on update cascade on delete set null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists fragrance_types_updated_at on public.fragrance_types;
create trigger fragrance_types_updated_at before update on public.fragrance_types
  for each row execute function public.catalogue_set_updated_at();

insert into public.fragrance_types (slug, name, description, category_slug, is_active, sort_order) values
  ('eau-de-parfum',       'Eau de Parfum',       'Concentrated daily signature compositions.',        'shop-all',            true, 10),
  ('extrait-de-parfum',   'Extrait de Parfum',   'Richly layered evening extrait concentrations.',  'shop-all',            true, 20),
  ('eau-de-toilette',     'Eau de Toilette',     'Crisp, airy compositions for daylight wear.',     'shop-all',            true, 30),
  ('inspired-fragrance',  'Inspired Fragrance',  'House interpretations inspired by classic profiles.', 'inspired-fragrances', true, 40),
  ('gift-set-combo',      'Gift Set & Combo',    'Curated discovery sets and multi-bottle pairings.', 'gift-sets-combos',   true, 50)
on conflict (slug) do nothing;

alter table public.fragrance_types enable row level security;
revoke all on public.fragrance_types from anon, authenticated;
grant select on public.fragrance_types to anon, authenticated;

drop policy if exists "public reads active fragrance types" on public.fragrance_types;
create policy "public reads active fragrance types" on public.fragrance_types
  for select to anon, authenticated using (is_active);

-- ── 2. Extend products with merchandising, availability & fragrance metadata ─
alter table public.products
  add column if not exists tagline text not null default '',
  add column if not exists notes jsonb not null default '{"top":[],"heart":[],"base":[]}'::jsonb,
  add column if not exists fragrance_type_id uuid references public.fragrance_types (id) on delete set null,
  add column if not exists is_trending boolean not null default false,
  add column if not exists is_signature boolean not null default false,
  add column if not exists is_best_seller boolean not null default false,
  add column if not exists popularity_score integer not null default 0,
  add column if not exists availability text not null default 'in_stock';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_popularity_score_ck'
  ) then
    alter table public.products add constraint products_popularity_score_ck check (popularity_score >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'products_availability_ck'
  ) then
    alter table public.products add constraint products_availability_ck
      check (availability in ('in_stock', 'low_stock', 'out_of_stock', 'preorder'));
  end if;
end
$$;

grant select (tagline, notes, fragrance_type_id, is_trending, is_signature, is_best_seller, popularity_score, availability)
  on public.products to anon, authenticated;

-- ── 3. Admin allowlist & role verifier ─────────────────────────────────────
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  email text not null unique,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Link to auth.users only when Supabase auth schema is present (keeps local PGlite tests portable).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users')
     and not exists (select 1 from pg_constraint where conname = 'admin_users_user_id_fkey') then
    alter table public.admin_users
      add constraint admin_users_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
  end if;
end
$$;

drop trigger if exists admin_users_updated_at on public.admin_users;
create trigger admin_users_updated_at before update on public.admin_users
  for each row execute function public.catalogue_set_updated_at();

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb;
  v_uid uuid;
  v_email text;
begin
  if current_user = 'service_role' then
    return true;
  end if;
  claims := public.current_jwt_claims();
  begin
    v_uid := nullif(claims ->> 'sub', '')::uuid;
  exception when others then
    v_uid := null;
  end;
  v_email := lower(nullif(claims ->> 'email', ''));
  if v_uid is null and v_email is null then
    return false;
  end if;
  return exists (
    select 1
    from public.admin_users a
    where a.is_active
      and ((v_uid is not null and a.user_id = v_uid) or (v_email is not null and lower(a.email) = v_email))
  );
end
$$;

-- Admin RLS policies on taxonomy tables (keep non-admin authenticated denied!)
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage fragrance types" on public.fragrance_types;
create policy "admins manage fragrance types" on public.fragrance_types
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage scent families" on public.scent_families;
create policy "admins manage scent families" on public.scent_families
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 4. Orders, Order Items, Email Outbox & Activity Log ────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  invoice_number text not null unique,
  customer_name text not null check (length(btrim(customer_name)) >= 2),
  customer_email text not null check (customer_email ~* '^\S+@\S+\.\S+$'),
  customer_phone text not null check (length(btrim(customer_phone)) >= 10),
  shipping_address text not null check (length(btrim(shipping_address)) >= 5),
  city text not null check (length(btrim(city)) >= 2),
  state text not null check (length(btrim(state)) >= 2),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  payment_method text not null check (payment_method in ('cod', 'upi')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'awaiting_verification', 'paid', 'failed', 'refunded')),
  upi_reference text,
  order_status text not null default 'placed'
    check (order_status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  subtotal_inr numeric(10, 2) not null check (subtotal_inr > 0),
  shipping_inr numeric(10, 2) not null default 0 check (shipping_inr >= 0),
  total_inr numeric(10, 2) not null check (total_inr > 0),
  invoice_html text,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed', 'queued_no_provider')),
  email_error text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_upi_ref_ck check (payment_method <> 'upi' or (upi_reference is not null and length(btrim(upi_reference)) >= 6))
);

create index if not exists orders_created_idx on public.orders (created_at desc);

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at before update on public.orders
  for each row execute function public.catalogue_set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_sku text,
  product_slug text not null,
  product_name text not null,
  collection text,
  size_ml integer not null check (size_ml > 0),
  unit_price_inr numeric(10, 2) not null check (unit_price_inr > 0),
  quantity integer not null check (quantity > 0 and quantity <= 20),
  line_total_inr numeric(10, 2) not null check (line_total_inr > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  invoice_html text not null,
  provider text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'queued_no_provider')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_outbox_order_idx on public.email_outbox (order_id);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('customer', 'admin', 'system')),
  actor_email text,
  action text not null check (length(btrim(action)) > 0),
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id text,
  summary text not null check (length(btrim(summary)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_actor_idx on public.activity_logs (actor_type, created_at desc);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.email_outbox enable row level security;
alter table public.activity_logs enable row level security;

revoke all on public.orders, public.order_items, public.email_outbox, public.activity_logs from anon, authenticated;

-- ── 5. Public RPC: log_site_activity & place_order ─────────────────────────
create or replace function public.log_site_activity(
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_summary text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if p_action not in ('catalogue.searched', 'product.viewed', 'bag.item_added', 'checkout.started', 'page.visited') then
    return;
  end if;
  v_email := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'customer',
    v_email,
    left(btrim(p_action), 64),
    left(btrim(coalesce(p_entity_type, 'site')), 64),
    left(btrim(coalesce(p_entity_id, '')), 120),
    left(btrim(coalesce(nullif(p_summary, ''), p_action)), 240),
    coalesce(p_metadata, '{}'::jsonb)
  );
end
$$;

grant execute on function public.log_site_activity(text, text, text, text, jsonb) to anon, authenticated;

create or replace function public.build_invoice_html(
  p_order_number text,
  p_invoice_number text,
  p_created_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_address text,
  p_city text,
  p_state text,
  p_pincode text,
  p_payment_method text,
  p_payment_status text,
  p_upi_reference text,
  p_items jsonb,
  p_subtotal numeric,
  p_shipping numeric,
  p_total numeric
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rows text := '';
  v_item jsonb;
  v_pay_label text;
begin
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_rows := v_rows || format(
      '<tr><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;">%s (%s ml)</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:center;">%s</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:right;">&#8377;%s</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:right;">&#8377;%s</td></tr>',
      replace(replace(coalesce(v_item ->> 'product_name', ''), '<', '&lt;'), '>', '&gt;'),
      coalesce((v_item ->> 'size_ml'), '50'),
      coalesce((v_item ->> 'quantity'), '1'),
      to_char(coalesce((v_item ->> 'unit_price_inr')::numeric, 0), 'FM9,99,990'),
      to_char(coalesce((v_item ->> 'line_total_inr')::numeric, 0), 'FM9,99,990')
    );
  end loop;

  v_pay_label := case when p_payment_method = 'upi'
    then 'UPI (' || coalesce(p_upi_reference, 'UTR Pending') || ')'
    else 'Cash on Delivery (COD)'
  end;

  return format(
    '<!doctype html><html><body style="margin:0;padding:24px;background:#F1EDE6;color:#1A1612;font-family:Georgia,serif;">'
    || '<div style="max-width:640px;margin:0 auto;background:#FAF8F4;border:1px solid #D6CEC1;border-radius:16px;overflow:hidden;">'
    || '<div style="background:#14110E;color:#F2E8D5;padding:24px 28px;">'
    || '<p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D5A35D;">Make My Perfume &middot; Official Order Invoice</p>'
    || '<h1 style="margin:8px 0 0;font-size:26px;font-weight:500;">Thank you for your order, %s</h1>'
    || '</div>'
    || '<div style="padding:24px 28px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">'
    || '<p style="margin:0 0 16px;"><strong>Order Number:</strong> %s &nbsp;|&nbsp; <strong>Invoice:</strong> %s<br/>'
    || '<strong>Date:</strong> %s &nbsp;|&nbsp; <strong>Payment:</strong> %s (%s)</p>'
    || '<p style="margin:0 0 20px;padding:12px 14px;background:#F1EDE6;border-radius:8px;"><strong>Shipping To:</strong><br/>%s<br/>%s, %s &ndash; %s<br/>Phone: %s &middot; Email: %s</p>'
    || '<table style="width:100%%;border-collapse:collapse;margin-bottom:20px;">'
    || '<thead><tr style="border-bottom:2px solid #1A1612;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">'
    || '<th style="padding:8px;">Fragrance</th><th style="padding:8px;text-align:center;">Qty</th><th style="padding:8px;text-align:right;">Price</th><th style="padding:8px;text-align:right;">Total</th>'
    || '</tr></thead><tbody>%s</tbody></table>'
    || '<div style="text-align:right;font-size:15px;">'
    || '<div>Subtotal: <strong>&#8377;%s</strong></div>'
    || '<div>Shipping: <strong>%s</strong></div>'
    || '<div style="margin-top:6px;font-size:18px;color:#7A5A22;">Grand Total: <strong>&#8377;%s</strong></div>'
    || '</div>'
    || '<p style="margin:24px 0 0;font-size:12px;color:#5E554B;">Questions? Reply to hello@makemyperfume.in &middot; Make My Perfume</p>'
    || '</div></div></body></html>',
    replace(replace(p_customer_name, '<', '&lt;'), '>', '&gt;'),
    p_order_number,
    p_invoice_number,
    to_char(p_created_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI IST'),
    replace(replace(v_pay_label, '<', '&lt;'), '>', '&gt;'),
    replace(p_payment_status, '_', ' '),
    replace(replace(p_address, '<', '&lt;'), '>', '&gt;'),
    replace(replace(p_city, '<', '&lt;'), '>', '&gt;'),
    replace(replace(p_state, '<', '&lt;'), '>', '&gt;'),
    p_pincode,
    replace(replace(p_customer_phone, '<', '&lt;'), '>', '&gt;'),
    replace(replace(p_customer_email, '<', '&lt;'), '>', '&gt;'),
    v_rows,
    to_char(p_subtotal, 'FM9,99,990'),
    case when p_shipping = 0 then 'Complimentary' else '&#8377;' || to_char(p_shipping, 'FM9,99,990') end,
    to_char(p_total, 'FM9,99,990')
  );
end
$$;

create or replace function public.place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_payload ->> 'customerName', ''));
  v_email text := btrim(coalesce(p_payload ->> 'customerEmail', ''));
  v_phone text := btrim(coalesce(p_payload ->> 'customerPhone', ''));
  v_address text := btrim(coalesce(p_payload ->> 'shippingAddress', ''));
  v_city text := btrim(coalesce(p_payload ->> 'city', ''));
  v_state text := btrim(coalesce(p_payload ->> 'state', ''));
  v_pincode text := btrim(coalesce(p_payload ->> 'pincode', ''));
  v_payment_method text := lower(btrim(coalesce(p_payload ->> 'paymentMethod', '')));
  v_upi_ref text := nullif(btrim(coalesce(p_payload ->> 'upiReference', '')), '');
  v_items_in jsonb := coalesce(p_payload -> 'items', '[]'::jsonb);
  v_item jsonb;
  v_resolved_items jsonb := '[]'::jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_variant_sku text;
  v_size_ml integer;
  v_qty integer;
  v_unit_price numeric(10, 2);
  v_line_total numeric(10, 2);
  v_subtotal numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2);
  v_order_id uuid;
  v_outbox_id uuid;
  v_order_num text;
  v_inv_num text;
  v_payment_status text;
  v_now timestamptz := now();
  v_invoice_html text;
  v_item_slug text;
  v_item_name text;
  v_item_collection text;
  v_avail text;
begin
  if length(v_name) < 2 then raise exception 'Full name is required'; end if;
  if v_email !~* '^\S+@\S+\.\S+$' then raise exception 'Valid email address is required for invoice delivery'; end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 10 then raise exception 'Valid 10-digit mobile number is required'; end if;
  if length(v_address) < 5 or length(v_city) < 2 or length(v_state) < 2 then raise exception 'Complete shipping address is required'; end if;
  if v_pincode !~ '^[1-9][0-9]{5}$' then raise exception 'Valid 6-digit PIN code is required'; end if;
  if v_payment_method not in ('cod', 'upi') then raise exception 'Select COD or UPI payment method'; end if;
  if v_payment_method = 'upi' and (v_upi_ref is null or length(v_upi_ref) < 6) then
    raise exception 'Enter a valid UPI transaction reference / UTR number';
  end if;
  if jsonb_typeof(v_items_in) <> 'array' or jsonb_array_length(v_items_in) = 0 then
    raise exception 'Order must contain at least one fragrance';
  end if;

  for v_item in select * from jsonb_array_elements(v_items_in)
  loop
    v_item_slug := btrim(coalesce(v_item ->> 'slug', ''));
    v_item_name := btrim(coalesce(v_item ->> 'name', ''));
    v_item_collection := btrim(coalesce(v_item ->> 'collection', ''));
    v_size_ml := greatest(1, coalesce((v_item ->> 'sizeMl')::integer, 50));
    v_qty := greatest(1, least(20, coalesce((v_item ->> 'qty')::integer, 1)));
    v_unit_price := coalesce((v_item ->> 'unitPrice')::numeric, 0);
    v_product_id := null;
    v_variant_id := null;
    v_variant_sku := nullif(btrim(coalesce(v_item ->> 'sku', '')), '');

    -- Look up published DB product & active variant to lock authoritative price & check stock.
    select p.id, v.id, v.sku, v.price_inr, p.title, p.availability
      into v_product_id, v_variant_id, v_variant_sku, v_unit_price, v_item_name, v_avail
    from public.products p
    join public.product_variants v on v.product_id = p.id
    where p.status = 'published'
      and v.is_active
      and (
        (v_variant_sku is not null and v.sku = v_variant_sku)
        or (p.slug = v_item_slug and v.size_ml = v_size_ml)
      )
    limit 1;

    if v_product_id is not null then
      if v_avail = 'out_of_stock' then
        raise exception '% (% ml) is currently out of stock', v_item_name, v_size_ml;
      end if;
      -- Decrement inventory if tracked
      update public.inventory
      set quantity = case when quantity is not null then greatest(0, quantity - v_qty) else null end,
          availability = case
            when quantity is not null and greatest(0, quantity - v_qty) = 0 then 'out_of_stock'
            when quantity is not null and greatest(0, quantity - v_qty) <= 5 then 'low_stock'
            else availability
          end
      where variant_id = v_variant_id;

      update public.products
      set popularity_score = popularity_score + v_qty
      where id = v_product_id;
    else
      if v_unit_price <= 0 or length(v_item_name) = 0 or length(v_item_slug) = 0 then
        raise exception 'Invalid line item: %', coalesce(nullif(v_item_name, ''), 'unknown');
      end if;
    end if;

    v_line_total := v_unit_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_resolved_items := v_resolved_items || jsonb_build_object(
      'product_id', v_product_id,
      'variant_sku', v_variant_sku,
      'product_slug', v_item_slug,
      'product_name', v_item_name,
      'collection', v_item_collection,
      'size_ml', v_size_ml,
      'unit_price_inr', v_unit_price,
      'quantity', v_qty,
      'line_total_inr', v_line_total
    );
  end loop;

  v_total := v_subtotal + v_shipping;
  v_order_num := 'MMP-' || to_char(v_now at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_inv_num := 'INV-' || to_char(v_now at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_payment_status := case when v_payment_method = 'upi' then 'awaiting_verification' else 'pending' end;

  v_invoice_html := public.build_invoice_html(
    v_order_num, v_inv_num, v_now, v_name, v_email, v_phone,
    v_address, v_city, v_state, v_pincode,
    v_payment_method, v_payment_status, v_upi_ref,
    v_resolved_items, v_subtotal, v_shipping, v_total
  );

  insert into public.orders (
    order_number, invoice_number, customer_name, customer_email, customer_phone,
    shipping_address, city, state, pincode,
    payment_method, payment_status, upi_reference, order_status,
    subtotal_inr, shipping_inr, total_inr, invoice_html, email_status, created_at
  ) values (
    v_order_num, v_inv_num, v_name, v_email, v_phone,
    v_address, v_city, v_state, v_pincode,
    v_payment_method, v_payment_status, v_upi_ref, 'placed',
    v_subtotal, v_shipping, v_total, v_invoice_html, 'pending', v_now
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, variant_sku, product_slug, product_name, collection,
    size_ml, unit_price_inr, quantity, line_total_inr
  )
  select
    v_order_id,
    nullif(x ->> 'product_id', '')::uuid,
    nullif(x ->> 'variant_sku', ''),
    x ->> 'product_slug',
    x ->> 'product_name',
    nullif(x ->> 'collection', ''),
    (x ->> 'size_ml')::integer,
    (x ->> 'unit_price_inr')::numeric,
    (x ->> 'quantity')::integer,
    (x ->> 'line_total_inr')::numeric
  from jsonb_array_elements(v_resolved_items) as x;

  insert into public.email_outbox (order_id, recipient_email, subject, invoice_html, status)
  values (
    v_order_id,
    v_email,
    'Make My Perfume — Order Confirmed (' || v_order_num || ') & Invoice ' || v_inv_num,
    v_invoice_html,
    'pending'
  )
  returning id into v_outbox_id;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'customer',
    v_email,
    'order.placed',
    'order',
    v_order_id::text,
    'Order ' || v_order_num || ' placed via ' || upper(v_payment_method) || ' for ₹' || to_char(v_total, 'FM9,99,990'),
    jsonb_build_object(
      'order_number', v_order_num,
      'invoice_number', v_inv_num,
      'payment_method', v_payment_method,
      'upi_reference', v_upi_ref,
      'total_inr', v_total,
      'item_count', jsonb_array_length(v_resolved_items)
    )
  );

  return jsonb_build_object(
    'order_id', v_order_id,
    'outbox_id', v_outbox_id,
    'order_number', v_order_num,
    'invoice_number', v_inv_num,
    'payment_method', v_payment_method,
    'payment_status', v_payment_status,
    'order_status', 'placed',
    'subtotal_inr', v_subtotal,
    'shipping_inr', v_shipping,
    'total_inr', v_total,
    'created_at', v_now,
    'invoice_html', v_invoice_html,
    'items', v_resolved_items
  );
end
$$;

grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Safe status updater callable only with matching order_id + outbox_id (never leaks data)
create or replace function public.mark_order_email_status(
  p_order_id uuid,
  p_outbox_id uuid,
  p_status text,
  p_provider text default null,
  p_message_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_order_num text;
begin
  if p_status not in ('sent', 'failed', 'queued_no_provider') then
    raise exception 'Invalid email status';
  end if;
  update public.email_outbox
  set status = p_status,
      provider = coalesce(p_provider, provider),
      provider_message_id = coalesce(p_message_id, provider_message_id),
      error_message = p_error,
      sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_outbox_id and order_id = p_order_id
  returning recipient_email into v_email;

  if v_email is null then
    return;
  end if;

  update public.orders
  set email_status = p_status,
      email_error = p_error
  where id = p_order_id
  returning order_number into v_order_num;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'system',
    v_email,
    'email.' || p_status,
    'order',
    p_order_id::text,
    'Invoice email status for ' || coalesce(v_order_num, p_order_id::text) || ': ' || p_status,
    jsonb_build_object('provider', p_provider, 'message_id', p_message_id, 'error', p_error)
  );
end
$$;

grant execute on function public.mark_order_email_status(uuid, uuid, text, text, text, text) to anon, authenticated;

-- ── 6. Admin RPCs (Strict is_admin() check + Transactional Audit Logs) ─────
create or replace function public.admin_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claims jsonb := public.current_jwt_claims();
  v_uid text := nullif(claims ->> 'sub', '');
  v_email text := lower(nullif(claims ->> 'email', ''));
begin
  return jsonb_build_object(
    'authenticated', v_uid is not null,
    'is_admin', public.is_admin(),
    'has_any_admin', exists (select 1 from public.admin_users where is_active),
    'email', v_email
  );
end
$$;

grant execute on function public.admin_status() to anon, authenticated;

create or replace function public.claim_initial_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb := public.current_jwt_claims();
  v_uid uuid;
  v_email text := lower(nullif(claims ->> 'email', ''));
begin
  begin
    v_uid := nullif(claims ->> 'sub', '')::uuid;
  exception when others then
    v_uid := null;
  end;
  if v_uid is null or v_email is null then
    raise exception 'Sign in first to claim admin access';
  end if;
  if exists (select 1 from public.admin_users) then
    raise exception 'An admin already exists. Ask an existing admin to grant access.';
  end if;

  insert into public.admin_users (user_id, email, role, is_active)
  values (v_uid, v_email, 'owner', true);

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
  values ('admin', v_email, 'admin.claimed', 'auth', v_uid::text, 'Initial owner admin access claimed by ' || v_email);

  return jsonb_build_object('ok', true, 'email', v_email);
end
$$;

grant execute on function public.claim_initial_admin() to authenticated;

create or replace function public.admin_list_products()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(q)::jsonb)
    from (
      select
        p.id,
        p.product_key,
        p.slug,
        p.title,
        p.source_title,
        p.tagline,
        p.description,
        p.notes,
        p.product_type,
        p.fragrance_type_id,
        ft.slug as fragrance_type_slug,
        ft.name as fragrance_type_name,
        p.status,
        p.is_featured,
        p.is_trending,
        p.is_signature,
        p.is_best_seller,
        p.popularity_score,
        p.availability,
        p.approved_at,
        p.published_at,
        p.created_at,
        p.updated_at,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', v.id,
            'sku', v.sku,
            'size_ml', v.size_ml,
            'price_inr', v.price_inr,
            'compare_at_inr', v.compare_at_inr,
            'compare_at_approved_at', v.compare_at_approved_at,
            'sale_starts_at', v.sale_starts_at,
            'sale_ends_at', v.sale_ends_at,
            'is_active', v.is_active,
            'quantity', inv.quantity,
            'availability', coalesce(inv.availability, 'unknown')
          ) order by v.size_ml)
          from public.product_variants v
          left join public.inventory inv on inv.variant_id = v.id
          where v.product_id = p.id
        ), '[]'::jsonb) as variants,
        coalesce((
          select jsonb_agg(c.slug order by c.sort_order)
          from public.product_categories pc
          join public.categories c on c.id = pc.category_id
          where pc.product_id = p.id
        ), '[]'::jsonb) as category_slugs,
        coalesce((
          select jsonb_agg(sf.name order by sf.sort_order)
          from public.product_scent_families psf
          join public.scent_families sf on sf.id = psf.family_id
          where psf.product_id = p.id
        ), '[]'::jsonb) as scent_families,
        (
          select jsonb_build_object('id', pi.id, 'url', pi.url, 'alt_text', pi.alt_text, 'verification_status', pi.verification_status)
          from public.product_images pi
          where pi.product_id = p.id
          order by pi.sort_order
          limit 1
        ) as primary_image
      from public.products p
      left join public.fragrance_types ft on ft.id = p.fragrance_type_id
      order by p.updated_at desc
    ) q
  ), '[]'::jsonb);
end
$$;

grant execute on function public.admin_list_products() to authenticated;

create or replace function public.admin_save_product(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_is_create boolean := v_id is null;
  v_title text := nullif(btrim(coalesce(p_payload ->> 'title', '')), '');
  v_slug text := nullif(lower(btrim(coalesce(p_payload ->> 'slug', ''))), '');
  v_product_key text := nullif(btrim(coalesce(p_payload ->> 'product_key', '')), '');
  v_tagline text := coalesce(p_payload ->> 'tagline', '');
  v_description text := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  v_notes jsonb := coalesce(p_payload -> 'notes', '{"top":[],"heart":[],"base":[]}'::jsonb);
  v_product_type text := coalesce(nullif(btrim(coalesce(p_payload ->> 'product_type', '')), ''), 'fragrance');
  v_fragrance_type_id uuid := nullif(p_payload ->> 'fragrance_type_id', '')::uuid;
  v_target_status text := coalesce(nullif(btrim(coalesce(p_payload ->> 'status', '')), ''), 'draft');
  v_is_featured boolean := coalesce((p_payload ->> 'is_featured')::boolean, false);
  v_is_trending boolean := coalesce((p_payload ->> 'is_trending')::boolean, false);
  v_is_signature boolean := coalesce((p_payload ->> 'is_signature')::boolean, false);
  v_is_best_seller boolean := coalesce((p_payload ->> 'is_best_seller')::boolean, false);
  v_popularity integer := greatest(0, coalesce((p_payload ->> 'popularity_score')::integer, 0));
  v_availability text := coalesce(nullif(btrim(coalesce(p_payload ->> 'availability', '')), ''), 'in_stock');
  v_published_at timestamptz;
  v_approved_at timestamptz;
  v_variants jsonb := coalesce(p_payload -> 'variants', '[]'::jsonb);
  v_var jsonb;
  v_var_id uuid;
  v_sku text;
  v_compare_at numeric(10, 2);
  v_compare_approved timestamptz;
  v_sale_start timestamptz;
  v_sale_end timestamptz;
  v_img_url text := nullif(btrim(coalesce(p_payload ->> 'image_url', '')), '');
  v_img_alt text := nullif(btrim(coalesce(p_payload ->> 'image_alt', '')), '');
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;

  if v_slug is null and v_title is not null then
    v_slug := regexp_replace(regexp_replace(lower(v_title), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g');
  end if;

  if v_is_create then
    v_product_key := coalesce(v_product_key, coalesce(v_slug, 'product-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));
    -- Insert initially as draft so active variants can be inserted before publishing trigger fires.
    insert into public.products (
      product_key, slug, title, tagline, description, notes, product_type, fragrance_type_id,
      status, is_featured, is_trending, is_signature, is_best_seller, popularity_score, availability
    ) values (
      v_product_key, v_slug, v_title, v_tagline, v_description, v_notes, v_product_type, v_fragrance_type_id,
      'draft', v_is_featured, v_is_trending, v_is_signature, v_is_best_seller, v_popularity, v_availability
    )
    returning id into v_id;
  else
    update public.products
    set slug = v_slug,
        title = v_title,
        tagline = v_tagline,
        description = v_description,
        notes = v_notes,
        product_type = v_product_type,
        fragrance_type_id = v_fragrance_type_id,
        status = case when v_target_status = 'published' then status else v_target_status end,
        is_featured = v_is_featured,
        is_trending = v_is_trending,
        is_signature = v_is_signature,
        is_best_seller = v_is_best_seller,
        popularity_score = v_popularity,
        availability = v_availability
    where id = v_id;
    if not found then
      raise exception 'Product not found';
    end if;
  end if;

  -- Upsert variants (size_ml, price_inr, compare_at_inr + sale windows + inventory)
  for v_var in select * from jsonb_array_elements(v_variants)
  loop
    v_var_id := nullif(v_var ->> 'id', '')::uuid;
    v_sku := upper(nullif(btrim(coalesce(v_var ->> 'sku', '')), ''));
    if v_sku is null then
      v_sku := upper(regexp_replace(coalesce(v_slug, 'MMP'), '[^A-Z0-9]+', '-', 'g')) || '-' || ((v_var ->> 'size_ml')::integer)::text;
    end if;
    v_compare_at := nullif(v_var ->> 'compare_at_inr', '')::numeric;
    v_compare_approved := case when v_compare_at is not null and v_compare_at > (v_var ->> 'price_inr')::numeric then now() else null end;
    if v_compare_at is not null and v_compare_at <= (v_var ->> 'price_inr')::numeric then
      v_compare_at := null;
    end if;
    v_sale_start := nullif(v_var ->> 'sale_starts_at', '')::timestamptz;
    v_sale_end := nullif(v_var ->> 'sale_ends_at', '')::timestamptz;

    if v_var_id is not null then
      update public.product_variants
      set sku = v_sku,
          size_ml = (v_var ->> 'size_ml')::integer,
          price_inr = (v_var ->> 'price_inr')::numeric,
          compare_at_inr = v_compare_at,
          compare_at_approved_at = v_compare_approved,
          sale_starts_at = v_sale_start,
          sale_ends_at = v_sale_end,
          is_active = coalesce((v_var ->> 'is_active')::boolean, true)
      where id = v_var_id and product_id = v_id;
    else
      insert into public.product_variants (
        product_id, sku, size_ml, price_inr, compare_at_inr, compare_at_approved_at,
        sale_starts_at, sale_ends_at, is_active
      ) values (
        v_id, v_sku, (v_var ->> 'size_ml')::integer, (v_var ->> 'price_inr')::numeric,
        v_compare_at, v_compare_approved, v_sale_start, v_sale_end,
        coalesce((v_var ->> 'is_active')::boolean, true)
      )
      on conflict (product_id, size_ml) do update set
        sku = excluded.sku,
        price_inr = excluded.price_inr,
        compare_at_inr = excluded.compare_at_inr,
        compare_at_approved_at = excluded.compare_at_approved_at,
        sale_starts_at = excluded.sale_starts_at,
        sale_ends_at = excluded.sale_ends_at,
        is_active = excluded.is_active
      returning id into v_var_id;
    end if;

    insert into public.inventory (variant_id, quantity, availability)
    values (
      v_var_id,
      nullif(v_var ->> 'quantity', '')::integer,
      coalesce(nullif(v_var ->> 'availability', ''), v_availability, 'in_stock')
    )
    on conflict (variant_id) do update set
      quantity = excluded.quantity,
      availability = excluded.availability;
  end loop;

  -- Sync categories
  if p_payload ? 'category_slugs' then
    delete from public.product_categories where product_id = v_id;
    insert into public.product_categories (product_id, category_id)
    select v_id, c.id
    from public.categories c
    where c.slug = any(array(select jsonb_array_elements_text(p_payload -> 'category_slugs')))
    on conflict do nothing;
  end if;

  -- Sync scent families
  if p_payload ? 'scent_families' then
    delete from public.product_scent_families where product_id = v_id;
    insert into public.product_scent_families (product_id, family_id)
    select v_id, sf.id
    from public.scent_families sf
    where sf.name = any(array(select jsonb_array_elements_text(p_payload -> 'scent_families')))
    on conflict do nothing;
  end if;

  -- Sync primary verified image if provided
  if v_img_url is not null then
    insert into public.product_images (product_id, url, alt_text, sort_order, verification_status, source)
    values (v_id, v_img_url, coalesce(v_img_alt, v_title), 0, 'verified', 'admin')
    on conflict (product_id, sort_order) do update set
      url = excluded.url,
      alt_text = excluded.alt_text,
      verification_status = 'verified';
  end if;

  -- Apply published status cleanly after variants exist
  if v_target_status = 'published' then
    v_approved_at := coalesce(nullif(p_payload ->> 'approved_at', '')::timestamptz, now());
    v_published_at := coalesce(nullif(p_payload ->> 'published_at', '')::timestamptz, now());
    update public.products
    set approved_at = coalesce(approved_at, v_approved_at),
        published_at = coalesce(published_at, v_published_at),
        status = 'published'
    where id = v_id;
  end if;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'admin',
    v_admin_email,
    case when v_is_create then 'product.created' else 'product.updated' end,
    'product',
    v_id::text,
    (case when v_is_create then 'Created ' else 'Updated ' end) || coalesce(v_title, v_product_key) || ' (' || v_target_status || ')',
    jsonb_build_object('slug', v_slug, 'status', v_target_status, 'is_trending', v_is_trending, 'is_signature', v_is_signature)
  );

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug, 'status', v_target_status);
end
$$;

grant execute on function public.admin_save_product(jsonb) to authenticated;

create or replace function public.admin_delete_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;

  select coalesce(title, source_title, product_key) into v_name from public.products where id = p_product_id;
  if v_name is null then
    raise exception 'Product not found';
  end if;

  if exists (select 1 from public.order_items where product_id = p_product_id) then
    update public.products set status = 'archived' where id = p_product_id;
    update public.product_variants set is_active = false where product_id = p_product_id;
    insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
    values ('admin', v_admin_email, 'product.archived', 'product', p_product_id::text, 'Archived product with existing orders: ' || v_name);
    return jsonb_build_object('ok', true, 'mode', 'archived');
  else
    delete from public.product_variants where product_id = p_product_id;
    delete from public.products where id = p_product_id;
    insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
    values ('admin', v_admin_email, 'product.deleted', 'product', p_product_id::text, 'Deleted product: ' || v_name);
    return jsonb_build_object('ok', true, 'mode', 'deleted');
  end if;
end
$$;

grant execute on function public.admin_delete_product(uuid) to authenticated;

create or replace function public.admin_list_taxonomy()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;
  return jsonb_build_object(
    'categories', coalesce((select jsonb_agg(c order by c.sort_order, c.name) from public.categories c), '[]'::jsonb),
    'fragrance_types', coalesce((select jsonb_agg(ft order by ft.sort_order, ft.name) from public.fragrance_types ft), '[]'::jsonb),
    'scent_families', coalesce((select jsonb_agg(sf order by sf.sort_order, sf.name) from public.scent_families sf), '[]'::jsonb)
  );
end
$$;

grant execute on function public.admin_list_taxonomy() to authenticated;

create or replace function public.admin_save_category(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_slug text := regexp_replace(regexp_replace(lower(btrim(coalesce(p_payload ->> 'slug', p_payload ->> 'name', ''))), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g');
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_kind text := coalesce(nullif(p_payload ->> 'kind', ''), 'type');
  v_filter text := nullif(btrim(coalesce(p_payload ->> 'filter_value', '')), '');
  v_landing text := nullif(btrim(coalesce(p_payload ->> 'landing_path', '')), '');
  v_sort integer := coalesce((p_payload ->> 'sort_order')::integer, 50);
  v_active boolean := coalesce((p_payload ->> 'is_active')::boolean, true);
  v_is_landing boolean := coalesce((p_payload ->> 'is_landing')::boolean, v_kind in ('all', 'landing'));
begin
  if not public.is_admin() then raise exception 'Forbidden: admin access required'; end if;
  if length(v_name) = 0 then raise exception 'Category name is required'; end if;
  if v_kind = 'type' and v_filter is null then v_filter := v_slug; end if;

  if v_id is null then
    insert into public.categories (slug, name, description, kind, filter_value, landing_path, is_landing, is_active, sort_order)
    values (v_slug, v_name, p_payload ->> 'description', v_kind, v_filter, v_landing, v_is_landing, v_active, v_sort)
    returning id into v_id;
  else
    update public.categories
    set slug = v_slug, name = v_name, description = p_payload ->> 'description',
        kind = v_kind, filter_value = v_filter, landing_path = v_landing,
        is_landing = v_is_landing, is_active = v_active, sort_order = v_sort
    where id = v_id;
  end if;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
  values ('admin', v_admin_email, 'category.saved', 'category', v_id::text, 'Saved category: ' || v_name);

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
end
$$;

grant execute on function public.admin_save_category(jsonb) to authenticated;

create or replace function public.admin_delete_category(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_name text;
begin
  if not public.is_admin() then raise exception 'Forbidden: admin access required'; end if;
  select name into v_name from public.categories where id = p_id;
  delete from public.product_categories where category_id = p_id;
  delete from public.categories where id = p_id;
  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
  values ('admin', v_admin_email, 'category.deleted', 'category', p_id::text, 'Deleted category: ' || coalesce(v_name, p_id::text));
  return jsonb_build_object('ok', true);
end
$$;

grant execute on function public.admin_delete_category(uuid) to authenticated;

create or replace function public.admin_save_fragrance_type(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_slug text := regexp_replace(regexp_replace(lower(btrim(coalesce(p_payload ->> 'slug', v_name))), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g');
  v_cat text := nullif(btrim(coalesce(p_payload ->> 'category_slug', '')), '');
  v_desc text := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  v_sort integer := coalesce((p_payload ->> 'sort_order')::integer, 50);
  v_active boolean := coalesce((p_payload ->> 'is_active')::boolean, true);
begin
  if not public.is_admin() then raise exception 'Forbidden: admin access required'; end if;
  if length(v_name) = 0 then raise exception 'Fragrance type name is required'; end if;

  if v_id is null then
    insert into public.fragrance_types (slug, name, description, category_slug, is_active, sort_order)
    values (v_slug, v_name, v_desc, v_cat, v_active, v_sort)
    returning id into v_id;
  else
    update public.fragrance_types
    set slug = v_slug, name = v_name, description = v_desc, category_slug = v_cat, is_active = v_active, sort_order = v_sort
    where id = v_id;
  end if;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
  values ('admin', v_admin_email, 'fragrance_type.saved', 'fragrance_type', v_id::text, 'Saved fragrance type: ' || v_name || coalesce(' (category: ' || v_cat || ')', ''));

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_slug);
end
$$;

grant execute on function public.admin_save_fragrance_type(jsonb) to authenticated;

create or replace function public.admin_delete_fragrance_type(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_name text;
begin
  if not public.is_admin() then raise exception 'Forbidden: admin access required'; end if;
  select name into v_name from public.fragrance_types where id = p_id;
  update public.products set fragrance_type_id = null where fragrance_type_id = p_id;
  delete from public.fragrance_types where id = p_id;
  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
  values ('admin', v_admin_email, 'fragrance_type.deleted', 'fragrance_type', p_id::text, 'Deleted fragrance type: ' || coalesce(v_name, p_id::text));
  return jsonb_build_object('ok', true);
end
$$;

grant execute on function public.admin_delete_fragrance_type(uuid) to authenticated;

create or replace function public.admin_list_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(q)::jsonb)
    from (
      select
        o.id, o.order_number, o.invoice_number, o.customer_name, o.customer_email, o.customer_phone,
        o.shipping_address, o.city, o.state, o.pincode,
        o.payment_method, o.payment_status, o.upi_reference, o.order_status,
        o.subtotal_inr, o.shipping_inr, o.total_inr, o.invoice_html,
        o.email_status, o.email_error, o.notes, o.created_at, o.updated_at,
        (select eo.id from public.email_outbox eo where eo.order_id = o.id order by eo.created_at desc limit 1) as outbox_id,
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', oi.id,
            'product_slug', oi.product_slug,
            'product_name', oi.product_name,
            'collection', oi.collection,
            'size_ml', oi.size_ml,
            'unit_price_inr', oi.unit_price_inr,
            'quantity', oi.quantity,
            'line_total_inr', oi.line_total_inr
          ))
          from public.order_items oi
          where oi.order_id = o.id
        ), '[]'::jsonb) as items
      from public.orders o
      order by o.created_at desc
    ) q
  ), '[]'::jsonb);
end
$$;

grant execute on function public.admin_list_orders() to authenticated;

create or replace function public.admin_update_order(
  p_order_id uuid,
  p_order_status text,
  p_payment_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_order_num text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;
  update public.orders
  set order_status = p_order_status,
      payment_status = p_payment_status,
      notes = coalesce(p_notes, notes)
  where id = p_order_id
  returning order_number into v_order_num;

  if v_order_num is null then
    raise exception 'Order not found';
  end if;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'admin',
    v_admin_email,
    'order.status_updated',
    'order',
    p_order_id::text,
    'Order ' || v_order_num || ' updated -> order: ' || p_order_status || ', payment: ' || p_payment_status,
    jsonb_build_object('order_status', p_order_status, 'payment_status', p_payment_status)
  );

  return jsonb_build_object('ok', true);
end
$$;

grant execute on function public.admin_update_order(uuid, text, text, text) to authenticated;

create or replace function public.admin_list_activity_logs(
  p_limit integer default 120,
  p_actor_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(q)::jsonb)
    from (
      select id, actor_type, actor_email, action, entity_type, entity_id, summary, metadata, created_at
      from public.activity_logs
      where p_actor_type is null or actor_type = p_actor_type
      order by created_at desc
      limit greatest(1, least(500, coalesce(p_limit, 120)))
    ) q
  ), '[]'::jsonb);
end
$$;

grant execute on function public.admin_list_activity_logs(integer, text) to authenticated;

-- ── 7. Dedicated Sale Promotion & Admin Access Helpers ─────────────────────
create or replace function public.admin_save_sale(
  p_variant_id uuid,
  p_price_inr numeric,
  p_compare_at_inr numeric default null,
  p_sale_starts_at timestamptz default null,
  p_sale_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_sku text;
  v_compare numeric(10, 2);
begin
  if not public.is_admin() then raise exception 'Forbidden: admin access required'; end if;
  if p_price_inr is null or p_price_inr <= 0 then raise exception 'Selling price must be positive'; end if;

  v_compare := case when p_compare_at_inr is not null and p_compare_at_inr > p_price_inr then p_compare_at_inr else null end;

  update public.product_variants
  set price_inr = p_price_inr,
      compare_at_inr = v_compare,
      compare_at_approved_at = case when v_compare is not null then now() else null end,
      sale_starts_at = case when v_compare is not null then p_sale_starts_at else null end,
      sale_ends_at = case when v_compare is not null then p_sale_ends_at else null end
  where id = p_variant_id
  returning sku into v_sku;

  if v_sku is null then raise exception 'Variant not found'; end if;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'admin',
    v_admin_email,
    'sale.updated',
    'sale',
    p_variant_id::text,
    case when v_compare is not null
      then 'Updated sale on ' || v_sku || ': ₹' || p_price_inr::text || ' (was ₹' || v_compare::text || ')'
      else 'Cleared sale on ' || v_sku || ': ₹' || p_price_inr::text
    end,
    jsonb_build_object('sku', v_sku, 'price_inr', p_price_inr, 'compare_at_inr', v_compare)
  );

  return jsonb_build_object('ok', true, 'sku', v_sku, 'compare_at_inr', v_compare);
end
$$;

grant execute on function public.admin_save_sale(uuid, numeric, numeric, timestamptz, timestamptz) to authenticated;

create or replace function public.admin_list_admins()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Forbidden: admin access required'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'email', email, 'role', role, 'is_active', is_active, 'created_at', created_at) order by created_at) from public.admin_users), '[]'::jsonb);
end
$$;

grant execute on function public.admin_list_admins() to authenticated;

create or replace function public.admin_add_admin(p_email text, p_role text default 'admin')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_target text := lower(btrim(coalesce(p_email, '')));
begin
  if not public.is_admin() then raise exception 'Forbidden: admin access required'; end if;
  if v_target !~* '^\S+@\S+\.\S+$' then raise exception 'Enter a valid email address'; end if;
  if p_role not in ('owner', 'admin') then raise exception 'Invalid role'; end if;

  insert into public.admin_users (email, role, is_active)
  values (v_target, p_role, true)
  on conflict (email) do update set is_active = true, role = excluded.role;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary)
  values ('admin', v_admin_email, 'admin.granted', 'auth', v_target, 'Granted ' || p_role || ' access to ' || v_target);

  return jsonb_build_object('ok', true, 'email', v_target);
end
$$;

grant execute on function public.admin_add_admin(text, text) to authenticated;
