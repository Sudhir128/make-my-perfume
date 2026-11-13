-- Custom / Personalised Perfumes configurator schema, orders integration, invoice HTML, and Admin RPCs

-- 1. Relax international postal/PIN format on orders safely while preserving >= 4 char codes
alter table public.orders
  drop constraint if exists orders_pincode_check;

alter table public.orders
  add constraint orders_pincode_check check (pincode ~ '^[A-Za-z0-9 \-]{4,12}$');

alter table public.orders
  add column if not exists order_type text not null default 'catalogue'
    check (order_type in ('catalogue', 'personalised'));

-- 2. Configurable custom bottle sizes & provisional studio rates (editable in Admin)
create table if not exists public.custom_perfume_sizes (
  size_ml integer primary key check (size_ml in (50, 100, 150)),
  label text not null,
  price_inr numeric(10, 2) not null check (price_inr > 0),
  is_available boolean not null default true,
  is_provisional boolean not null default true,
  availability_note text not null default 'Provisional studio consultation rate; confirmed by team',
  updated_at timestamptz not null default now()
);

drop trigger if exists custom_perfume_sizes_updated_at on public.custom_perfume_sizes;
create trigger custom_perfume_sizes_updated_at before update on public.custom_perfume_sizes
  for each row execute function public.catalogue_set_updated_at();

insert into public.custom_perfume_sizes (size_ml, label, price_inr, is_available, is_provisional, availability_note)
values
  (50, '50 ml', 1290.00, true, true, 'Provisional custom blend estimate; confirmed by studio'),
  (100, '100 ml', 1890.00, true, true, 'Provisional custom blend estimate; confirmed by studio'),
  (150, '150 ml', 2390.00, true, true, 'Provisional custom blend estimate; confirmed by studio')
on conflict (size_ml) do nothing;

alter table public.custom_perfume_sizes enable row level security;

drop policy if exists "public read custom perfume sizes" on public.custom_perfume_sizes;
create policy "public read custom perfume sizes" on public.custom_perfume_sizes
  for select to anon, authenticated using (true);

drop policy if exists "admins manage custom perfume sizes" on public.custom_perfume_sizes;
create policy "admins manage custom perfume sizes" on public.custom_perfume_sizes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. Dedicated custom perfume requests linked to personalised orders
create table if not exists public.perfume_custom_requests (
  id uuid primary key default gen_random_uuid(),
  request_ref text not null unique,
  order_id uuid unique references public.orders (id) on delete set null,
  customer_user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (length(btrim(full_name)) >= 2),
  mobile_number text not null check (length(regexp_replace(mobile_number, '[^0-9]', '', 'g')) between 7 and 15),
  email text check (email is null or email ~* '^\S+@\S+\.\S+$'),
  families text[] not null check (coalesce(array_length(families, 1), 0) >= 1),
  fragrance_character text not null check (fragrance_character in ('Soft & Subtle', 'Balanced & Versatile', 'Bold & Expressive')),
  preferred_notes text[] not null default '{}',
  notes_to_avoid text,
  intensity text not null check (intensity in ('Light', 'Moderate', 'Strong')),
  occasion text check (occasion is null or occasion in ('Everyday Wear', 'Office / Professional', 'Evening / Special Occasion', 'Gifting', 'Versatile / All Occasions')),
  bottle_size_ml integer not null references public.custom_perfume_sizes (size_ml),
  bottle_label text check (bottle_label is null or length(bottle_label) <= 30),
  packaging text not null check (packaging in ('Standard Packaging', 'Gift Packaging')),
  additional_instructions text,
  consent_accepted boolean not null check (consent_accepted = true),
  consent_at timestamptz not null default now(),
  request_status text not null default 'pending_review'
    check (request_status in ('pending_review', 'under_review', 'quotation_prepared', 'awaiting_customer_approval', 'approved', 'rejected', 'closed')),
  quoted_price_inr numeric(10, 2) not null check (quoted_price_inr > 0),
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perfume_custom_requests_created_idx
  on public.perfume_custom_requests (created_at desc);

create index if not exists perfume_custom_requests_user_idx
  on public.perfume_custom_requests (customer_user_id, created_at desc);

drop trigger if exists perfume_custom_requests_updated_at on public.perfume_custom_requests;
create trigger perfume_custom_requests_updated_at before update on public.perfume_custom_requests
  for each row execute function public.catalogue_set_updated_at();

alter table public.perfume_custom_requests enable row level security;

drop policy if exists "admins manage custom requests" on public.perfume_custom_requests;
create policy "admins manage custom requests" on public.perfume_custom_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "customers read own custom requests" on public.perfume_custom_requests;
create policy "customers read own custom requests" on public.perfume_custom_requests
  for select to authenticated using (customer_user_id = auth.uid());

-- 4. Custom invoice HTML builder with bespoke perfume specifications
create or replace function public.build_custom_perfume_invoice_html(
  p_request_ref text,
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
  p_upi_ref text,
  p_families text[],
  p_character text,
  p_notes text[],
  p_avoid text,
  p_intensity text,
  p_occasion text,
  p_size_ml integer,
  p_bottle_label text,
  p_packaging text,
  p_instructions text,
  p_total numeric
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_esc_name text := replace(replace(coalesce(p_customer_name, ''), '<', '&lt;'), '>', '&gt;');
  v_esc_label text := replace(replace(coalesce(nullif(p_bottle_label, ''), 'House Signature Label'), '<', '&lt;'), '>', '&gt;');
  v_esc_families text := replace(replace(array_to_string(p_families, ', '), '<', '&lt;'), '>', '&gt;');
  v_esc_notes text := case when coalesce(array_length(p_notes, 1), 0) > 0
    then replace(replace(array_to_string(p_notes, ', '), '<', '&lt;'), '>', '&gt;')
    else 'No specific note preferences' end;
  v_esc_avoid text := replace(replace(coalesce(nullif(p_avoid, ''), 'None noted'), '<', '&lt;'), '>', '&gt;');
  v_esc_occasion text := replace(replace(coalesce(nullif(p_occasion, ''), 'Flexible'), '<', '&lt;'), '>', '&gt;');
  v_esc_pkg text := replace(replace(coalesce(p_packaging, 'Standard Packaging'), '<', '&lt;'), '>', '&gt;');
  v_esc_instr text := replace(replace(coalesce(nullif(p_instructions, ''), 'None'), '<', '&lt;'), '>', '&gt;');
  v_pay_label text := case when p_payment_method = 'upi'
    then 'UPI (' || coalesce(p_upi_ref, 'pending verification') || ')'
    else 'Cash on Delivery (COD)' end;
begin
  return format(
    '<!doctype html><html><body style="margin:0;padding:24px;background:#F1EDE6;color:#1A1612;font-family:Georgia,serif;">'
    || '<div style="max-width:680px;margin:0 auto;background:#FAF8F4;border:1px solid #D6CEC1;border-radius:12px;padding:32px;">'
    || '<div style="border-bottom:1px solid #D6CEC1;padding-bottom:16px;margin-bottom:20px;">'
    || '<p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7A5A22;font-family:sans-serif;">Make My Perfume · Bespoke Atelier</p>'
    || '<h1 style="margin:6px 0 0;font-size:26px;font-weight:500;">Personalised Perfume Invoice &amp; Order</h1>'
    || '</div>'
    || '<table style="width:100%%;font-family:sans-serif;font-size:13px;margin-bottom:18px;">'
    || '<tr><td><strong>Request Ref:</strong> %s<br/><strong>Order No:</strong> %s<br/><strong>Invoice:</strong> %s</td>'
    || '<td style="text-align:right;"><strong>Date:</strong> %s<br/><strong>Payment:</strong> %s<br/><strong>Status:</strong> %s</td></tr>'
    || '</table>'
    || '<div style="background:#F1EDE6;border-radius:8px;padding:12px 16px;margin-bottom:18px;font-family:sans-serif;font-size:13px;">'
    || '<strong>Billed &amp; Shipped To:</strong><br/>%s<br/>%s, %s, %s %s<br/>Phone: %s · Email: %s'
    || '</div>'
    || '<div style="border:1px solid #D6CEC1;border-radius:8px;padding:14px 16px;margin-bottom:18px;font-family:sans-serif;font-size:13px;line-height:1.55;">'
    || '<p style="margin:0 0 8px;font-weight:600;color:#7A5A22;text-transform:uppercase;letter-spacing:0.12em;font-size:11px;">Personalised Blend Brief</p>'
    || '<strong>Families:</strong> %s<br/>'
    || '<strong>Character:</strong> %s · <strong>Intensity:</strong> %s<br/>'
    || '<strong>Preferred Notes:</strong> %s<br/>'
    || '<strong>Notes to Avoid:</strong> %s<br/>'
    || '<strong>Occasion:</strong> %s<br/>'
    || '<strong>Bottle:</strong> %s ml · <strong>Label Name:</strong> %s · <strong>Packaging:</strong> %s<br/>'
    || '<strong>Notes / Instructions:</strong> %s'
    || '</div>'
    || '<table style="width:100%%;border-collapse:collapse;font-family:sans-serif;font-size:13px;">'
    || '<thead><tr style="background:#14110E;color:#F2E8D5;"><th style="text-align:left;padding:10px;">Custom Order Item</th><th style="text-align:right;padding:10px;">Amount</th></tr></thead>'
    || '<tbody><tr><td style="padding:10px;border-bottom:1px solid #D6CEC1;">Personalised Perfume (%s ml) — %s</td><td style="text-align:right;padding:10px;border-bottom:1px solid #D6CEC1;">&#8377;%s</td></tr></tbody>'
    || '<tfoot><tr><td style="padding:12px 10px;font-size:16px;font-weight:600;">Total Amount</td><td style="padding:12px 10px;text-align:right;font-size:16px;font-weight:600;">&#8377;%s</td></tr></tfoot>'
    || '</table>'
    || '<p style="margin:24px 0 0;font-family:sans-serif;font-size:12px;color:#5E554B;">Thank you for creating your signature fragrance with Make My Perfume. Support: hello@makemyperfume.in</p>'
    || '</div></body></html>',
    replace(replace(p_request_ref, '<', '&lt;'), '>', '&gt;'),
    replace(replace(p_order_number, '<', '&lt;'), '>', '&gt;'),
    replace(replace(p_invoice_number, '<', '&lt;'), '>', '&gt;'),
    to_char(p_created_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI IST'),
    replace(replace(v_pay_label, '<', '&lt;'), '>', '&gt;'),
    replace(p_payment_status, '_', ' '),
    v_esc_name,
    replace(replace(coalesce(p_address, ''), '<', '&lt;'), '>', '&gt;'),
    replace(replace(coalesce(p_city, ''), '<', '&lt;'), '>', '&gt;'),
    replace(replace(coalesce(p_state, ''), '<', '&lt;'), '>', '&gt;'),
    replace(replace(coalesce(p_pincode, ''), '<', '&lt;'), '>', '&gt;'),
    replace(replace(coalesce(p_customer_phone, ''), '<', '&lt;'), '>', '&gt;'),
    replace(replace(coalesce(p_customer_email, ''), '<', '&lt;'), '>', '&gt;'),
    v_esc_families,
    p_character,
    p_intensity,
    v_esc_notes,
    v_esc_avoid,
    v_esc_occasion,
    p_size_ml,
    v_esc_label,
    v_esc_pkg,
    v_esc_instr,
    p_size_ml,
    v_esc_label,
    to_char(p_total, 'FM9,99,990'),
    to_char(p_total, 'FM9,99,990')
  );
end
$$;

-- 5. Validated, rate-limited SECURITY DEFINER RPC to place a Personalised Perfume order + request
create or replace function public.create_custom_perfume_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_recent_count integer := 0;
  v_full_name text := btrim(coalesce(p_payload ->> 'fullName', ''));
  v_phone text := btrim(coalesce(p_payload ->> 'mobileNumber', ''));
  v_phone_digits text := regexp_replace(coalesce(p_payload ->> 'mobileNumber', ''), '[^0-9]', '', 'g');
  v_email text := btrim(coalesce(p_payload ->> 'email', ''));
  v_address text := btrim(coalesce(p_payload ->> 'shippingAddress', ''));
  v_city text := btrim(coalesce(p_payload ->> 'city', ''));
  v_state text := btrim(coalesce(p_payload ->> 'state', ''));
  v_pincode text := btrim(coalesce(p_payload ->> 'pincode', ''));
  v_payment_method text := lower(btrim(coalesce(p_payload ->> 'paymentMethod', '')));
  v_upi_ref text := nullif(btrim(coalesce(p_payload ->> 'upiReference', '')), '');
  v_families text[];
  v_character text := btrim(coalesce(p_payload ->> 'fragranceCharacter', ''));
  v_notes text[];
  v_avoid text := nullif(left(btrim(coalesce(p_payload ->> 'notesToAvoid', '')), 250), '');
  v_intensity text := btrim(coalesce(p_payload ->> 'intensity', ''));
  v_occasion text := nullif(btrim(coalesce(p_payload ->> 'occasion', '')), '');
  v_size_ml integer := coalesce((p_payload ->> 'bottleSizeMl')::integer, 0);
  v_bottle_label text := nullif(btrim(coalesce(p_payload ->> 'bottleLabel', '')), '');
  v_packaging text := btrim(coalesce(p_payload ->> 'packaging', ''));
  v_instructions text := nullif(left(btrim(coalesce(p_payload ->> 'additionalInstructions', '')), 600), '');
  v_consent boolean := coalesce((p_payload ->> 'consentAccepted')::boolean, false);
  v_unit_price numeric(10, 2);
  v_size_avail boolean;
  v_now timestamptz := now();
  v_req_ref text;
  v_order_num text;
  v_inv_num text;
  v_pay_status text;
  v_invoice_html text;
  v_order_id uuid;
  v_request_id uuid;
  v_outbox_id uuid;
  v_item_name text;
begin
  if v_uid is null then
    raise exception 'Please sign in or create an account to place your personalised perfume order.';
  end if;

  -- Basic abuse & duplicate-burst rate limit per authenticated customer
  select count(*) into v_recent_count
  from public.perfume_custom_requests r
  where r.customer_user_id = v_uid
    and r.created_at > (v_now - interval '10 minutes');
  if v_recent_count >= 5 then
    raise exception 'Too many custom requests submitted recently. Please wait a few minutes before submitting another.';
  end if;

  if length(v_full_name) < 2 then raise exception 'Full name is required.'; end if;
  if length(v_phone_digits) < 7 or length(v_phone_digits) > 15 then
    raise exception 'Enter a valid mobile / WhatsApp number (7 to 15 digits).';
  end if;
  if v_email !~* '^\S+@\S+\.\S+$' then
    raise exception 'Valid email address is required to send price and invoice details.';
  end if;
  if not v_consent then
    raise exception 'Please accept the contact and privacy consent to continue.';
  end if;
  if length(v_address) < 5 or length(v_city) < 2 or length(v_state) < 2 then
    raise exception 'Complete delivery address is required.';
  end if;
  if v_pincode !~ '^[A-Za-z0-9 \-]{4,12}$' then
    raise exception 'Enter a valid PIN / postal code.';
  end if;
  if v_payment_method not in ('cod', 'upi') then
    raise exception 'Choose Cash on Delivery (COD) or UPI payment.';
  end if;
  if v_payment_method = 'upi' and (v_upi_ref is null or length(v_upi_ref) < 6) then
    raise exception 'Enter a valid 6–18 character UPI Transaction ID / UTR reference.';
  end if;

  select coalesce(array_agg(x order by ord), '{}'::text[])
    into v_families
  from jsonb_array_elements_text(coalesce(p_payload -> 'families', '[]'::jsonb)) with ordinality as t(x, ord)
  where x in ('Fresh', 'Warm', 'Woody', 'Aquatic', 'Sweet', 'Floral');
  if coalesce(array_length(v_families, 1), 0) < 1 then
    raise exception 'Select at least one fragrance family.';
  end if;

  if v_character not in ('Soft & Subtle', 'Balanced & Versatile', 'Bold & Expressive') then
    raise exception 'Select a valid fragrance character.';
  end if;
  if v_intensity not in ('Light', 'Moderate', 'Strong') then
    raise exception 'Select a valid fragrance intensity.';
  end if;
  if v_occasion is not null and v_occasion not in ('Everyday Wear', 'Office / Professional', 'Evening / Special Occasion', 'Gifting', 'Versatile / All Occasions') then
    raise exception 'Invalid occasion option.';
  end if;

  select coalesce(array_agg(x order by ord), '{}'::text[])
    into v_notes
  from jsonb_array_elements_text(coalesce(p_payload -> 'preferredNotes', '[]'::jsonb)) with ordinality as t(x, ord)
  where length(btrim(x)) > 0;

  if v_bottle_label is not null then
    if length(v_bottle_label) > 30 then
      raise exception 'Bottle label name cannot exceed 30 characters.';
    end if;
    if v_bottle_label !~ '^[A-Za-z0-9 ''\-&.,!]+$' then
      raise exception 'Bottle label contains unsupported characters.';
    end if;
  end if;

  if v_packaging not in ('Standard Packaging', 'Gift Packaging') then
    raise exception 'Choose Standard Packaging or Gift Packaging.';
  end if;

  select s.price_inr, s.is_available
    into v_unit_price, v_size_avail
  from public.custom_perfume_sizes s
  where s.size_ml = v_size_ml;

  if v_unit_price is null or not v_size_avail then
    raise exception 'Selected bottle size (% ml) is not currently available.', v_size_ml;
  end if;

  v_req_ref := 'MMP-REQ-' || to_char(v_now at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_order_num := 'MMP-CUS-' || to_char(v_now at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_inv_num := 'INV-' || to_char(v_now at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_pay_status := case when v_payment_method = 'upi' then 'awaiting_verification' else 'pending' end;

  v_invoice_html := public.build_custom_perfume_invoice_html(
    v_req_ref, v_order_num, v_inv_num, v_now, v_full_name, v_email, v_phone,
    v_address, v_city, v_state, v_pincode, v_payment_method, v_pay_status, v_upi_ref,
    v_families, v_character, v_notes, v_avoid, v_intensity, v_occasion,
    v_size_ml, v_bottle_label, v_packaging, v_instructions, v_unit_price
  );

  insert into public.orders (
    customer_user_id, order_type, order_number, invoice_number,
    customer_name, customer_email, customer_phone,
    shipping_address, city, state, pincode,
    payment_method, payment_status, upi_reference, order_status,
    subtotal_inr, shipping_inr, total_inr, invoice_html, email_status, notes, created_at
  ) values (
    v_uid, 'personalised', v_order_num, v_inv_num,
    v_full_name, v_email, v_phone,
    v_address, v_city, v_state, v_pincode,
    v_payment_method, v_pay_status, v_upi_ref, 'placed',
    v_unit_price, 0, v_unit_price, v_invoice_html, 'pending',
    'Custom Blend Request ' || v_req_ref, v_now
  )
  returning id into v_order_id;

  v_item_name := 'Personalised Perfume' || case when v_bottle_label is not null then ' — ' || v_bottle_label else '' end;

  insert into public.order_items (
    order_id, product_id, variant_sku, product_slug, product_name, collection,
    size_ml, unit_price_inr, quantity, line_total_inr
  ) values (
    v_order_id, null, 'BESPOKE-' || v_size_ml, 'make', v_item_name, array_to_string(v_families, ', '),
    v_size_ml, v_unit_price, 1, v_unit_price
  );

  insert into public.perfume_custom_requests (
    request_ref, order_id, customer_user_id, full_name, mobile_number, email,
    families, fragrance_character, preferred_notes, notes_to_avoid,
    intensity, occasion, bottle_size_ml, bottle_label, packaging,
    additional_instructions, consent_accepted, consent_at,
    request_status, quoted_price_inr, created_at
  ) values (
    v_req_ref, v_order_id, v_uid, v_full_name, v_phone, v_email,
    v_families, v_character, v_notes, v_avoid,
    v_intensity, v_occasion, v_size_ml, v_bottle_label, v_packaging,
    v_instructions, true, v_now,
    'pending_review', v_unit_price, v_now
  )
  returning id into v_request_id;

  insert into public.email_outbox (order_id, recipient_email, subject, invoice_html, status)
  values (
    v_order_id,
    v_email,
    'Make My Perfume — Personalised Perfume Order (' || v_order_num || ') & Invoice ' || v_inv_num,
    v_invoice_html,
    'pending'
  )
  returning id into v_outbox_id;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'customer',
    v_email,
    'custom_perfume.ordered',
    'perfume_custom_requests',
    v_request_id::text,
    'Personalised perfume ' || v_req_ref || ' (' || v_size_ml || ' ml) ordered via ' || upper(v_payment_method) || ' for ₹' || to_char(v_unit_price, 'FM9,99,990'),
    jsonb_build_object(
      'request_ref', v_req_ref,
      'order_number', v_order_num,
      'invoice_number', v_inv_num,
      'families', v_families,
      'size_ml', v_size_ml,
      'payment_method', v_payment_method
    )
  );

  return jsonb_build_object(
    'request_id', v_request_id,
    'request_ref', v_req_ref,
    'order_id', v_order_id,
    'outbox_id', v_outbox_id,
    'order_number', v_order_num,
    'invoice_number', v_inv_num,
    'payment_method', v_payment_method,
    'payment_status', v_pay_status,
    'order_status', 'placed',
    'request_status', 'pending_review',
    'subtotal_inr', v_unit_price,
    'shipping_inr', 0,
    'total_inr', v_unit_price,
    'created_at', v_now,
    'invoice_html', v_invoice_html,
    'items', jsonb_build_array(jsonb_build_object(
      'product_slug', 'make',
      'product_name', v_item_name,
      'collection', array_to_string(v_families, ', '),
      'size_ml', v_size_ml,
      'unit_price_inr', v_unit_price,
      'quantity', 1,
      'line_total_inr', v_unit_price
    ))
  );
end
$$;

grant execute on function public.create_custom_perfume_order(jsonb) to authenticated;

-- 6. Admin RPCs for Personalised Perfumes management
create or replace function public.admin_list_personalised_orders()
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
        r.id,
        r.request_ref,
        r.order_id,
        r.full_name,
        r.mobile_number,
        r.email,
        r.families,
        r.fragrance_character,
        r.preferred_notes,
        r.notes_to_avoid,
        r.intensity,
        r.occasion,
        r.bottle_size_ml,
        r.bottle_label,
        r.packaging,
        r.additional_instructions,
        r.consent_accepted,
        r.consent_at,
        r.request_status,
        r.quoted_price_inr,
        r.staff_notes,
        r.created_at,
        o.order_number,
        o.invoice_number,
        o.shipping_address,
        o.city,
        o.state,
        o.pincode,
        o.payment_method,
        o.payment_status,
        o.upi_reference,
        o.order_status,
        o.total_inr,
        o.invoice_html,
        o.email_status,
        (select eo.id from public.email_outbox eo where eo.order_id = o.id order by eo.created_at desc limit 1) as outbox_id
      from public.perfume_custom_requests r
      left join public.orders o on o.id = r.order_id
      order by r.created_at desc
    ) q
  ), '[]'::jsonb);
end
$$;

grant execute on function public.admin_list_personalised_orders() to authenticated;

create or replace function public.admin_update_personalised_order(
  p_request_id uuid,
  p_request_status text,
  p_order_status text,
  p_payment_status text,
  p_quoted_price_inr numeric,
  p_staff_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
  v_req public.perfume_custom_requests%rowtype;
  v_ord public.orders%rowtype;
  v_invoice_html text;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;

  update public.perfume_custom_requests
  set request_status = p_request_status,
      quoted_price_inr = greatest(1, coalesce(p_quoted_price_inr, quoted_price_inr)),
      staff_notes = p_staff_notes
  where id = p_request_id
  returning * into v_req;

  if v_req.id is null then
    raise exception 'Custom request not found';
  end if;

  if v_req.order_id is not null then
    select * into v_ord from public.orders where id = v_req.order_id;
    if v_ord.id is not null then
      v_invoice_html := public.build_custom_perfume_invoice_html(
        v_req.request_ref, v_ord.order_number, v_ord.invoice_number, v_ord.created_at,
        v_ord.customer_name, v_ord.customer_email, v_ord.customer_phone,
        v_ord.shipping_address, v_ord.city, v_ord.state, v_ord.pincode,
        v_ord.payment_method, p_payment_status, v_ord.upi_reference,
        v_req.families, v_req.fragrance_character, v_req.preferred_notes, v_req.notes_to_avoid,
        v_req.intensity, v_req.occasion, v_req.bottle_size_ml, v_req.bottle_label,
        v_req.packaging, v_req.additional_instructions, v_req.quoted_price_inr
      );

      update public.orders
      set order_status = p_order_status,
          payment_status = p_payment_status,
          subtotal_inr = v_req.quoted_price_inr,
          total_inr = v_req.quoted_price_inr,
          invoice_html = v_invoice_html,
          notes = coalesce(p_staff_notes, notes)
      where id = v_ord.id;

      update public.order_items
      set unit_price_inr = v_req.quoted_price_inr,
          line_total_inr = v_req.quoted_price_inr
      where order_id = v_ord.id;
    end if;
  end if;

  insert into public.activity_logs (actor_type, actor_email, action, entity_type, entity_id, summary, metadata)
  values (
    'admin',
    v_admin_email,
    'custom_perfume.updated',
    'perfume_custom_requests',
    p_request_id::text,
    'Updated bespoke request ' || v_req.request_ref || ' -> ' || p_request_status || ' (₹' || to_char(v_req.quoted_price_inr, 'FM9,99,990') || ')',
    jsonb_build_object(
      'request_status', p_request_status,
      'order_status', p_order_status,
      'payment_status', p_payment_status,
      'quoted_price_inr', v_req.quoted_price_inr
    )
  );

  return jsonb_build_object('ok', true);
end
$$;

grant execute on function public.admin_update_personalised_order(uuid, text, text, text, numeric, text) to authenticated;

create or replace function public.admin_save_custom_perfume_sizes(p_sizes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden: admin access required';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_sizes, '[]'::jsonb))
  loop
    update public.custom_perfume_sizes
    set price_inr = greatest(1, coalesce((v_row ->> 'price_inr')::numeric, price_inr)),
        is_available = coalesce((v_row ->> 'is_available')::boolean, is_available),
        is_provisional = coalesce((v_row ->> 'is_provisional')::boolean, is_provisional),
        availability_note = coalesce(nullif(btrim(v_row ->> 'availability_note'), ''), availability_note)
    where size_ml = (v_row ->> 'size_ml')::integer;
  end loop;

  return jsonb_build_object('ok', true);
end
$$;

grant execute on function public.admin_save_custom_perfume_sizes(jsonb) to authenticated;

