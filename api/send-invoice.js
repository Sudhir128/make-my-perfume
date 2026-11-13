/**
 * Server-side email & invoice dispatcher (/api/send-invoice).
 * Supports Resend (RESEND_API_KEY) or SendGrid (SENDGRID_API_KEY) via fetch
 * with zero third-party SDK dependencies, and degrades honestly to
 * `queued_no_provider` when no email provider secret is present in env.
 */
export async function dispatchInvoiceEmailPayload(body) {
  const { orderNumber, invoiceNumber, recipientEmail, recipientName, invoiceHtml } = body || {};
  if (!orderNumber || !recipientEmail || !invoiceHtml) {
    return { statusCode: 400, payload: { dispatched: false, status: 'failed', message: 'Missing order invoice fields' } };
  }

  const fromEmail = process.env.ORDER_FROM_EMAIL || 'Make My Perfume <orders@makemyperfume.in>';
  const subject = `Make My Perfume — Order Confirmed (${orderNumber}) & Invoice ${invoiceNumber || ''}`.trim();
  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;

  const pdfFilename = `${invoiceNumber || orderNumber}.pdf`;
  const pdfAttachments = body.pdfBase64
    ? [{ filename: pdfFilename, content: body.pdfBase64 }]
    : [];

  if (resendKey) {
    try {
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
          ...(pdfAttachments.length > 0 ? { attachments: pdfAttachments } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        return {
          statusCode: 200,
          payload: {
            dispatched: true,
            status: 'sent',
            provider: 'resend',
            messageId: json.id || null,
            message: `Order invoice emailed to ${recipientEmail}.`,
          },
        };
      }
      return {
        statusCode: 200,
        payload: {
          dispatched: false,
          status: 'failed',
          provider: 'resend',
          message: json.message || `Resend returned HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        statusCode: 200,
        payload: {
          dispatched: false,
          status: 'failed',
          provider: 'resend',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  if (sendgridKey) {
    try {
      const rawAddr = fromEmail.includes('<') ? fromEmail.match(/<([^>]+)>/)?.[1] || 'orders@makemyperfume.in' : fromEmail;
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipientEmail, name: recipientName || recipientEmail }], subject }],
          from: { email: rawAddr, name: 'Make My Perfume' },
          content: [{ type: 'text/html', value: invoiceHtml }],
          ...(pdfAttachments.length > 0
            ? {
                attachments: pdfAttachments.map((a) => ({
                  content: a.content,
                  filename: a.filename,
                  type: 'application/pdf',
                  disposition: 'attachment',
                })),
              }
            : {}),
        }),
      });
      if (res.ok) {
        return {
          statusCode: 200,
          payload: {
            dispatched: true,
            status: 'sent',
            provider: 'sendgrid',
            messageId: res.headers.get('x-message-id'),
            message: `Order invoice emailed to ${recipientEmail}.`,
          },
        };
      }
      return {
        statusCode: 200,
        payload: {
          dispatched: false,
          status: 'failed',
          provider: 'sendgrid',
          message: `SendGrid returned HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        statusCode: 200,
        payload: {
          dispatched: false,
          status: 'failed',
          provider: 'sendgrid',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  return {
    statusCode: 200,
    payload: {
      dispatched: false,
      status: 'queued_no_provider',
      provider: 'outbox',
      message: 'Invoice queued in outbox. Set RESEND_API_KEY or SENDGRID_API_KEY in server secrets for automated inbox delivery.',
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const result = await dispatchInvoiceEmailPayload(req.body);
  res.setHeader('Content-Type', 'application/json');
  res.status(result.statusCode).send(JSON.stringify(result.payload));
}

