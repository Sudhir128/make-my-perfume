/*
 * Authenticated Admin Portal API backed by Supabase Auth + RLS + SECURITY DEFINER RPCs.
 */
import { getAdminSupabase } from '../lib/supabase';
import type { AvailabilityStatus, Tier } from './catalog';
import { invalidateCatalogueCache } from './repository';
import { dispatchInvoiceEmail, type EmailDispatchResponse } from './orders';

export interface AdminStatus {
  authenticated: boolean;
  is_admin: boolean;
  has_any_admin: boolean;
  email: string | null;
}

export interface AdminVariant {
  id?: string;
  sku: string;
  size_ml: number;
  price_inr: number;
  compare_at_inr: number | null;
  compare_at_approved_at?: string | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_active: boolean;
  quantity: number | null;
  availability: AvailabilityStatus | 'unknown';
}

export interface AdminProduct {
  id: string;
  product_key: string;
  slug: string | null;
  title: string | null;
  source_title: string | null;
  tagline: string;
  description: string | null;
  notes: Record<Tier, string[]>;
  product_type: string;
  fragrance_type_id: string | null;
  fragrance_type_slug: string | null;
  fragrance_type_name: string | null;
  status: 'draft' | 'in_review' | 'published' | 'archived';
  is_featured: boolean;
  is_trending: boolean;
  is_signature: boolean;
  is_best_seller: boolean;
  popularity_score: number;
  availability: AvailabilityStatus;
  approved_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  variants: AdminVariant[];
  category_slugs: string[];
  scent_families: string[];
  primary_image: { id: string; url: string; alt_text: string | null; verification_status: string } | null;
}

export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: 'all' | 'audience' | 'type' | 'landing';
  filter_value: string | null;
  landing_path: string | null;
  is_landing: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface AdminFragranceType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category_slug: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface AdminOrder {
  id: string;
  order_number: string;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  city: string;
  state: string;
  pincode: string;
  payment_method: 'cod' | 'upi';
  payment_status: 'pending' | 'awaiting_verification' | 'paid' | 'failed' | 'refunded';
  upi_reference: string | null;
  order_status: 'placed' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
  subtotal_inr: number;
  shipping_inr: number;
  total_inr: number;
  invoice_html: string | null;
  email_status: 'pending' | 'sent' | 'failed' | 'queued_no_provider';
  email_error: string | null;
  notes: string | null;
  outbox_id?: string | null;
  created_at: string;
  items: Array<{
    id: string;
    product_slug: string;
    product_name: string;
    collection: string | null;
    size_ml: number;
    unit_price_inr: number;
    quantity: number;
    line_total_inr: number;
  }>;
}

export interface ActivityLogRow {
  id: string;
  actor_type: 'customer' | 'admin' | 'system';
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminPersonalisedOrder {
  id: string;
  request_ref: string;
  order_id: string | null;
  full_name: string;
  mobile_number: string;
  email: string | null;
  families: string[];
  fragrance_character: string;
  preferred_notes: string[];
  notes_to_avoid: string | null;
  intensity: string;
  occasion: string | null;
  bottle_size_ml: number;
  bottle_label: string | null;
  packaging: string;
  additional_instructions: string | null;
  consent_accepted: boolean;
  consent_at: string;
  request_status: string;
  quoted_price_inr: number;
  staff_notes: string | null;
  created_at: string;
  order_number: string | null;
  invoice_number: string | null;
  shipping_address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  payment_method: 'cod' | 'upi' | null;
  payment_status: string | null;
  upi_reference: string | null;
  order_status: string | null;
  total_inr: number | null;
  invoice_html: string | null;
  email_status: string | null;
  outbox_id: string | null;
}

export async function getAdminStatus(): Promise<AdminStatus> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_status');
  if (error) throw new Error(error.message);
  return data as AdminStatus;
}

export async function signInAdmin(email: string, password: string): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

export async function signUpAdmin(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(error.message);
  return { needsConfirmation: !data.session };
}

export async function signOutAdmin(): Promise<void> {
  const sb = await getAdminSupabase();
  await sb.auth.signOut();
}

export async function claimInitialAdmin(): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('claim_initial_admin');
  if (error) throw new Error(error.message);
}

export async function adminListProducts(): Promise<AdminProduct[]> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_list_products');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminProduct[];
}

export async function adminSaveProduct(payload: Record<string, unknown>): Promise<{ id: string; slug: string; status: string }> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_save_product', { p_payload: payload });
  if (error) throw new Error(error.message);
  invalidateCatalogueCache();
  return data as { id: string; slug: string; status: string };
}

export async function adminDeleteProduct(id: string): Promise<{ mode: string }> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_delete_product', { p_product_id: id });
  if (error) throw new Error(error.message);
  invalidateCatalogueCache();
  return data as { mode: string };
}

export async function adminSaveSale(payload: {
  variantId: string;
  priceInr: number;
  compareAtInr: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
}): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_save_sale', {
    p_variant_id: payload.variantId,
    p_price_inr: payload.priceInr,
    p_compare_at_inr: payload.compareAtInr,
    p_sale_starts_at: payload.saleStartsAt ?? null,
    p_sale_ends_at: payload.saleEndsAt ?? null,
  });
  if (error) throw new Error(error.message);
  invalidateCatalogueCache();
}

export async function adminListTaxonomy(): Promise<{
  categories: AdminCategory[];
  fragrance_types: AdminFragranceType[];
  scent_families: Array<{ id: string; slug: string; name: string; sort_order: number }>;
}> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_list_taxonomy');
  if (error) throw new Error(error.message);
  return data as {
    categories: AdminCategory[];
    fragrance_types: AdminFragranceType[];
    scent_families: Array<{ id: string; slug: string; name: string; sort_order: number }>;
  };
}

export async function adminSaveCategory(payload: Record<string, unknown>): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_save_category', { p_payload: payload });
  if (error) throw new Error(error.message);
  invalidateCatalogueCache();
}

export async function adminDeleteCategory(id: string): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_delete_category', { p_id: id });
  if (error) throw new Error(error.message);
  invalidateCatalogueCache();
}

export async function adminSaveFragranceType(payload: Record<string, unknown>): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_save_fragrance_type', { p_payload: payload });
  if (error) throw new Error(error.message);
  invalidateCatalogueCache();
}

export async function adminDeleteFragranceType(id: string): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_delete_fragrance_type', { p_id: id });
  if (error) throw new Error(error.message);
  invalidateCatalogueCache();
}

export async function adminListOrders(): Promise<AdminOrder[]> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_list_orders');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminOrder[];
}

export async function adminUpdateOrder(orderId: string, orderStatus: string, paymentStatus: string, notes?: string): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_update_order', {
    p_order_id: orderId,
    p_order_status: orderStatus,
    p_payment_status: paymentStatus,
    p_notes: notes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function adminResendInvoice(order: AdminOrder): Promise<EmailDispatchResponse> {
  if (!order.invoice_html) {
    return { dispatched: false, status: 'failed', message: 'Order has no stored invoice HTML.' };
  }
  return dispatchInvoiceEmail({
    orderId: order.id,
    outboxId: order.outbox_id ?? undefined,
    orderNumber: order.order_number,
    invoiceNumber: order.invoice_number,
    recipientEmail: order.customer_email,
    recipientName: order.customer_name,
    invoiceHtml: order.invoice_html,
  });
}

export async function adminListActivityLogs(limit = 120, actorType: string | null = null): Promise<ActivityLogRow[]> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_list_activity_logs', {
    p_limit: limit,
    p_actor_type: actorType,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ActivityLogRow[];
}

export async function adminListAdmins(): Promise<Array<{ id: string; email: string; role: string; is_active: boolean; created_at: string }>> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_list_admins');
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; email: string; role: string; is_active: boolean; created_at: string }>;
}

export async function adminAddAdmin(email: string, role: 'owner' | 'admin' = 'admin'): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_add_admin', { p_email: email, p_role: role });
  if (error) throw new Error(error.message);
}

export async function adminListPersonalisedOrders(): Promise<AdminPersonalisedOrder[]> {
  const sb = await getAdminSupabase();
  const { data, error } = await sb.rpc('admin_list_personalised_orders');
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminPersonalisedOrder[];
}

export async function adminUpdatePersonalisedOrder(params: {
  requestId: string;
  requestStatus: string;
  orderStatus: string;
  paymentStatus: string;
  quotedPriceInr: number;
  staffNotes?: string;
}): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_update_personalised_order', {
    p_request_id: params.requestId,
    p_request_status: params.requestStatus,
    p_order_status: params.orderStatus,
    p_payment_status: params.paymentStatus,
    p_quoted_price_inr: params.quotedPriceInr,
    p_staff_notes: params.staffNotes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function adminResendPersonalisedInvoice(order: AdminPersonalisedOrder): Promise<EmailDispatchResponse> {
  if (!order.order_id || !order.order_number || !order.invoice_number || !order.email || !order.invoice_html) {
    return { dispatched: false, status: 'failed', message: 'Missing recipient email or stored invoice HTML.' };
  }
  return dispatchInvoiceEmail({
    orderId: order.order_id,
    outboxId: order.outbox_id ?? undefined,
    orderNumber: order.order_number,
    invoiceNumber: order.invoice_number,
    recipientEmail: order.email,
    recipientName: order.full_name,
    invoiceHtml: order.invoice_html,
  });
}

export async function adminSaveCustomPerfumeSizes(
  sizes: Array<{ size_ml: number; price_inr: number; is_available: boolean; is_provisional: boolean; availability_note: string }>,
): Promise<void> {
  const sb = await getAdminSupabase();
  const { error } = await sb.rpc('admin_save_custom_perfume_sizes', { p_sizes: sizes });
  if (error) throw new Error(error.message);
}

