/*
 * Checkout order placement (COD & UPI) + Invoice generation & email dispatch.
 */
import { getCustomerSupabase } from '../lib/supabase';
import { getSupabaseConfig } from '../lib/supabaseConfig';
import { generateInvoicePdfBytes } from '../lib/pdf';
import type { BagLine } from '../store/bag';
import type { PlacedOrderItem, PlacedOrderReceipt } from '../store/orders';

export type PaymentMethod = 'cod' | 'upi';

export interface CheckoutInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  state: string;
  pincode: string;
  paymentMethod: PaymentMethod;
  upiReference?: string;
  items: BagLine[];
}

interface PlaceOrderRpcResult {
  order_id: string;
  outbox_id: string;
  order_number: string;
  invoice_number: string;
  payment_method: PaymentMethod;
  payment_status: string;
  order_status: string;
  subtotal_inr: number;
  shipping_inr: number;
  total_inr: number;
  created_at: string;
  invoice_html: string;
  items: PlacedOrderItem[];
}

export interface EmailDispatchResponse {
  dispatched: boolean;
  status: 'sent' | 'failed' | 'queued_no_provider';
  provider?: string;
  messageId?: string | null;
  message?: string;
}

/** Converts bytes to Base64 in standard environments. */
function toBase64String(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    const b = bytes[i];
    if (b !== undefined) {
      binary += String.fromCharCode(b);
    }
  }
  return typeof btoa === 'function' ? btoa(binary) : '';
}

/** Tries the local/Vercel `/api/send-invoice` endpoint first, then the Supabase Edge Function. */
export async function dispatchInvoiceEmail(payload: {
  orderId: string;
  outboxId?: string;
  orderNumber: string;
  invoiceNumber: string;
  recipientEmail: string;
  recipientName: string;
  invoiceHtml: string;
}): Promise<EmailDispatchResponse> {
  let pdfBase64: string | undefined;
  try {
    const bytes = generateInvoicePdfBytes(payload.invoiceHtml, payload.invoiceNumber);
    pdfBase64 = toBase64String(bytes);
  } catch {
    // Proceed without attachment if generation fails
  }

  const outboundPayload = {
    ...payload,
    ...(pdfBase64 ? { pdfBase64 } : {}),
  };

  // 1. Try Vercel / Vite server route (/api/send-invoice)
  try {
    const res = await fetch('/api/send-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outboundPayload),
    });
    if (res.ok) {
      const json = (await res.json()) as EmailDispatchResponse;
      if (json.dispatched) {
        await recordEmailStatus(payload.orderId, payload.outboxId, 'sent', json.provider ?? 'api', json.messageId ?? null, null);
        return json;
      }
      // If local API has no provider key, try Supabase Edge Function next in case secrets live in Supabase.
      if (json.status === 'queued_no_provider') {
        const edge = await tryEdgeFunction(payload);
        if (edge) return edge;
      }
      await recordEmailStatus(payload.orderId, payload.outboxId, json.status, json.provider ?? 'outbox', null, json.message ?? null);
      return json;
    }
  } catch {
    // Fall through to Edge Function
  }

  const edge = await tryEdgeFunction(payload);
  if (edge) return edge;

  return {
    dispatched: false,
    status: 'queued_no_provider',
    message: 'Invoice saved to Order History. Configure RESEND_API_KEY in server/Supabase secrets for automatic inbox delivery.',
  };
}

async function tryEdgeFunction(payload: {
  orderId: string;
  outboxId?: string;
  orderNumber: string;
  invoiceNumber: string;
  recipientEmail: string;
  recipientName: string;
  invoiceHtml: string;
}): Promise<EmailDispatchResponse | null> {
  try {
    const config = await getSupabaseConfig();
    if (!config.projectUrl || !config.anonKey) return null;
    const url = `${config.projectUrl.replace(/\/+$/, '')}/functions/v1/send-order-invoice`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as EmailDispatchResponse;
  } catch {
    return null;
  }
}

async function recordEmailStatus(
  orderId: string,
  outboxId: string | undefined,
  status: 'sent' | 'failed' | 'queued_no_provider',
  provider: string | null,
  messageId: string | null,
  error: string | null,
): Promise<void> {
  if (!outboxId) return;
  try {
    const client = await getCustomerSupabase();
    await client.rpc('mark_order_email_status', {
      p_order_id: orderId,
      p_outbox_id: outboxId,
      p_status: status,
      p_provider: provider,
      p_message_id: messageId,
      p_error: error,
    });
  } catch {
    // non-fatal
  }
}

export async function placeCustomerOrder(input: CheckoutInput): Promise<PlacedOrderReceipt> {
  const client = await getCustomerSupabase();
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) {
    throw new Error('Please sign in or create an account to place your order.');
  }
  const payload = {
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    customerPhone: input.customerPhone.trim(),
    shippingAddress: input.shippingAddress.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    pincode: input.pincode.trim(),
    paymentMethod: input.paymentMethod,
    upiReference: input.paymentMethod === 'upi' ? input.upiReference?.trim() : null,
    items: input.items.map((l) => ({
      slug: l.slug,
      name: l.name,
      collection: l.collection,
      sizeMl: l.sizeMl,
      sku: l.sku,
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
  };

  const { data, error } = await client.rpc('place_order', { p_payload: payload });
  if (error) throw new Error(error.message || 'Could not place order.');
  const res = data as PlaceOrderRpcResult;

  const emailRes = await dispatchInvoiceEmail({
    orderId: res.order_id,
    outboxId: res.outbox_id,
    orderNumber: res.order_number,
    invoiceNumber: res.invoice_number,
    recipientEmail: input.customerEmail.trim(),
    recipientName: input.customerName.trim(),
    invoiceHtml: res.invoice_html,
  });

  return {
    orderId: res.order_id,
    outboxId: res.outbox_id,
    orderNumber: res.order_number,
    invoiceNumber: res.invoice_number,
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    paymentMethod: res.payment_method,
    paymentStatus: res.payment_status,
    orderStatus: res.order_status,
    upiReference: input.paymentMethod === 'upi' ? input.upiReference?.trim() ?? null : null,
    subtotalInr: Number(res.subtotal_inr),
    shippingInr: Number(res.shipping_inr),
    totalInr: Number(res.total_inr),
    createdAt: res.created_at,
    invoiceHtml: res.invoice_html,
    emailStatus: emailRes.status,
    emailMessage: emailRes.message,
    items: res.items,
  };
}

export async function fetchMyOrders(): Promise<PlacedOrderReceipt[]> {
  try {
    const client = await getCustomerSupabase();
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) return [];
    const { data, error } = await client.rpc('list_my_orders');
    if (error || !Array.isArray(data)) return [];
    return data as PlacedOrderReceipt[];
  } catch {
    return [];
  }
}

