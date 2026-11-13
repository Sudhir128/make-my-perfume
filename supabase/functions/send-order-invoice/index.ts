// Supabase Edge Function: send-order-invoice
// Sends an order confirmation email with HTML invoice via Resend (RESEND_API_KEY)
// or SendGrid (SENDGRID_API_KEY). Falls back cleanly to 'queued_no_provider' if
// no email API key has been configured in Supabase secrets yet.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DispatchRequest {
  orderId: string;
  outboxId: string;
  orderNumber: string;
  invoiceNumber: string;
  recipientEmail: string;
  recipientName: string;
  invoiceHtml: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as DispatchRequest;
    const { orderId, outboxId, orderNumber, invoiceNumber, recipientEmail, recipientName, invoiceHtml } = body;
    if (!orderId || !outboxId || !recipientEmail || !invoiceHtml) {
      return new Response(JSON.stringify({ error: 'Missing required invoice fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fromEmail = Deno.env.get('ORDER_FROM_EMAIL') || 'Make My Perfume <orders@makemyperfume.in>';
    const subject = `Make My Perfume — Order Confirmed (${orderNumber}) & Invoice ${invoiceNumber}`;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const sendgridKey = Deno.env.get('SENDGRID_API_KEY');

    let dispatched = false;
    let status: 'sent' | 'failed' | 'queued_no_provider' = 'queued_no_provider';
    let provider: string | null = 'outbox';
    let messageId: string | null = null;
    let errorMsg: string | null = null;

    if (resendKey) {
      provider = 'resend';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [recipientEmail],
          subject,
          html: invoiceHtml,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        dispatched = true;
        status = 'sent';
        messageId = json.id ?? null;
      } else {
        status = 'failed';
        errorMsg = json.message || `Resend returned ${res.status}`;
      }
    } else if (sendgridKey) {
      provider = 'sendgrid';
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipientEmail, name: recipientName }], subject }],
          from: { email: fromEmail.includes('<') ? fromEmail.match(/<([^>]+)>/)?.[1] ?? 'orders@makemyperfume.in' : fromEmail, name: 'Make My Perfume' },
          content: [{ type: 'text/html', value: invoiceHtml }],
        }),
      });
      if (res.ok) {
        dispatched = true;
        status = 'sent';
        messageId = res.headers.get('x-message-id');
      } else {
        status = 'failed';
        errorMsg = `SendGrid returned ${res.status}`;
      }
    } else {
      errorMsg = 'Email provider key (RESEND_API_KEY or SENDGRID_API_KEY) not configured yet; invoice saved in outbox.';
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    if (supabaseUrl && supabaseKey) {
      const sb = createClient(supabaseUrl, supabaseKey);
      await sb.rpc('mark_order_email_status', {
        p_order_id: orderId,
        p_outbox_id: outboxId,
        p_status: status,
        p_provider: provider,
        p_message_id: messageId,
        p_error: errorMsg,
      });
    }

    return new Response(JSON.stringify({ dispatched, status, provider, messageId, message: errorMsg || 'Invoice sent.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ dispatched: false, status: 'failed', message: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

