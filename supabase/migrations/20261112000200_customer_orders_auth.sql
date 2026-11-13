-- Require signed-in customer account to place orders & link orders to auth.users

alter table public.orders
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_user_idx
  on public.orders (customer_user_id, created_at desc);

create or replace function public.place_order(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
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
  if v_uid is null then
    raise exception 'Please sign in or create an account to place an order.';
  end if;
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
    customer_user_id, order_number, invoice_number, customer_name, customer_email, customer_phone,
    shipping_address, city, state, pincode,
    payment_method, payment_status, upi_reference, order_status,
    subtotal_inr, shipping_inr, total_inr, invoice_html, email_status, created_at
  ) values (
    v_uid, v_order_num, v_inv_num, v_name, v_email, v_phone,
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
      'customer_user_id', v_uid,
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

revoke execute on function public.place_order(jsonb) from anon;
grant execute on function public.place_order(jsonb) to authenticated;

create or replace function public.list_my_orders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(public.current_jwt_claims() ->> 'email', ''));
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'orderId', o.id,
        'orderNumber', o.order_number,
        'invoiceNumber', o.invoice_number,
        'customerName', o.customer_name,
        'customerEmail', o.customer_email,
        'paymentMethod', o.payment_method,
        'paymentStatus', o.payment_status,
        'orderStatus', o.order_status,
        'upiReference', o.upi_reference,
        'subtotalInr', o.subtotal_inr,
        'shippingInr', o.shipping_inr,
        'totalInr', o.total_inr,
        'createdAt', o.created_at,
        'invoiceHtml', coalesce(o.invoice_html, ''),
        'emailStatus', o.email_status,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'product_slug', oi.product_slug,
              'product_name', oi.product_name,
              'collection', oi.collection,
              'size_ml', oi.size_ml,
              'unit_price_inr', oi.unit_price_inr,
              'quantity', oi.quantity,
              'line_total_inr', oi.line_total_inr
            )
          )
          from public.order_items oi
          where oi.order_id = o.id
        ), '[]'::jsonb)
      )
      order by o.created_at desc
    )
    from public.orders o
    where o.customer_user_id = v_uid
       or (o.customer_user_id is null and v_email is not null and lower(o.customer_email) = v_email)
  ), '[]'::jsonb);
end
$$;

grant execute on function public.list_my_orders() to authenticated;

