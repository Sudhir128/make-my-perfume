import { describe, expect, it } from 'vitest';
import { parseInvoiceHtml, generateInvoicePdfBytes } from './pdf';

const SAMPLE_CATALOG_HTML = `<!doctype html><html><body style="margin:0;padding:24px;background:#F1EDE6;color:#1A1612;font-family:Georgia,serif;">
<div style="max-width:640px;margin:0 auto;background:#FAF8F4;border:1px solid #D6CEC1;border-radius:16px;overflow:hidden;">
<div style="background:#14110E;color:#F2E8D5;padding:24px 28px;">
<p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#D5A35D;">Make My Perfume &middot; Official Order Invoice</p>
<h1 style="margin:8px 0 0;font-size:26px;font-weight:500;">Thank you for your order, Meera Krishnan</h1>
</div>
<div style="padding:24px 28px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">
<p style="margin:0 0 16px;"><strong>Order Number:</strong> MMP-20261112-XY7890 &nbsp;|&nbsp; <strong>Invoice:</strong> INV-20261112-XY7890<br/>
<strong>Date:</strong> 12 Nov 2026 18:30 IST &nbsp;|&nbsp; <strong>Payment:</strong> UPI (412890123456) (completed)</p>
<p style="margin:0 0 20px;padding:12px 14px;background:#F1EDE6;border-radius:8px;"><strong>Shipping To:</strong><br/>Meera Krishnan<br/>14 Boat Club Road<br/>Chennai, Tamil Nadu – 600001<br/>Phone: +91 98765 43210 &middot; Email: meera@example.com</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
<thead><tr style="border-bottom:2px solid #1A1612;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">
<th style="padding:8px;">Fragrance</th><th style="padding:8px;text-align:center;">Qty</th><th style="padding:8px;text-align:right;">Price</th><th style="padding:8px;text-align:right;">Total</th>
</tr></thead>
<tbody>
<tr><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;">Velvet Fig (50 ml)</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:center;">1</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:right;">&#8377;1,290</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:right;">&#8377;1,290</td></tr>
<tr><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;">Saffron Neroli (100 ml)</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:center;">1</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:right;">&#8377;1,890</td><td style="padding:10px 8px;border-bottom:1px solid #D6CEC1;text-align:right;">&#8377;1,890</td></tr>
</tbody></table>
<div style="text-align:right;font-size:15px;">
Subtotal: &#8377;3,180<br/>
Shipping: Free<br/>
<strong style="font-size:18px;">Total: &#8377;3,180</strong>
</div>
</div></div></body></html>`;

const SAMPLE_BESPOKE_HTML = `<!doctype html><html><body style="margin:0;padding:24px;background:#F1EDE6;color:#1A1612;font-family:Georgia,serif;">
<div style="max-width:680px;margin:0 auto;background:#FAF8F4;border:1px solid #D6CEC1;border-radius:12px;padding:32px;">
<div style="border-bottom:1px solid #D6CEC1;padding-bottom:16px;margin-bottom:20px;">
<p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#7A5A22;font-family:sans-serif;">Make My Perfume · Bespoke Atelier</p>
<h1 style="margin:6px 0 0;font-size:26px;font-weight:500;">Personalised Perfume Invoice &amp; Order</h1>
</div>
<table style="width:100%;font-family:sans-serif;font-size:13px;margin-bottom:18px;">
<tr><td><strong>Request Ref:</strong> MMP-REQ-20261112-AB12CD<br/><strong>Order No:</strong> MMP-CUS-20261112-XY7890<br/><strong>Invoice:</strong> INV-20261112-XY7890</td>
<td style="text-align:right;"><strong>Date:</strong> 12 Nov 2026 18:30 IST<br/><strong>Payment:</strong> UPI (412890123456)<br/><strong>Status:</strong> completed</td></tr>
</table>
<div style="background:#F1EDE6;border-radius:8px;padding:12px 16px;margin-bottom:18px;font-family:sans-serif;font-size:13px;">
<strong>Billed &amp; Shipped To:</strong><br/>Meera Krishnan<br/>14 Boat Club Road, Chennai, Tamil Nadu 600001<br/>Phone: +971 50 123 4567 · Email: meera@example.com
</div>
<div style="border:1px solid #D6CEC1;border-radius:8px;padding:14px 16px;margin-bottom:18px;font-family:sans-serif;font-size:13px;line-height:1.55;">
<p style="margin:0 0 8px;font-weight:600;color:#7A5A22;text-transform:uppercase;letter-spacing:0.12em;font-size:11px;">Personalised Blend Brief</p>
<strong>Families:</strong> Warm, Woody<br/>
<strong>Character:</strong> Balanced &amp; Versatile · <strong>Intensity:</strong> Moderate<br/>
<strong>Preferred Notes:</strong> Bergamot, Sandalwood<br/>
<strong>Notes to Avoid:</strong> Heavy vanilla<br/>
<strong>Occasion:</strong> Evening / Special Occasion<br/>
<strong>Bottle:</strong> 100 ml · <strong>Label Name:</strong> Midnight Silk · <strong>Packaging:</strong> Gift Packaging<br/>
<strong>Notes / Instructions:</strong> Prefer dry cedar drydown.
</div>
<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:13px;">
<thead><tr style="background:#14110E;color:#F2E8D5;"><th style="text-align:left;padding:10px;">Custom Order Item</th><th style="text-align:right;padding:10px;">Amount</th></tr></thead>
<tbody><tr><td style="padding:10px;border-bottom:1px solid #D6CEC1;">Personalised Perfume (100 ml) — Midnight Silk</td><td style="text-align:right;padding:10px;border-bottom:1px solid #D6CEC1;">&#8377;1,890</td></tr></tbody>
<tfoot><tr><td style="padding:12px 10px;font-size:16px;font-weight:600;">Total Amount</td><td style="padding:12px 10px;text-align:right;font-size:16px;font-weight:600;">&#8377;1,890</td></tr></tfoot>
</table>
<p style="margin:24px 0 0;font-family:sans-serif;font-size:12px;color:#5E554B;">Thank you for creating your signature fragrance with Make My Perfume. Support: hello@makemyperfume.in</p>
</div></body></html>`;

describe('Atelier Vector PDF Engine', () => {
  it('parses standard catalog order invoice HTML correctly', () => {
    const data = parseInvoiceHtml(SAMPLE_CATALOG_HTML);
    expect(data.invoiceNumber).toBe('INV-20261112-XY7890');
    expect(data.orderNumber).toBe('MMP-20261112-XY7890');
    expect(data.customerName).toBe('Meera Krishnan');
    expect(data.customerEmail).toBe('meera@example.com');
    expect(data.customerPhone).toBe('+91 98765 43210');
    expect(data.isBespoke).toBe(false);
    expect(data.items.length).toBe(2);
    expect(data.items[0]?.name).toBe('Velvet Fig');
    expect(data.items[0]?.size).toBe('50 ml');
    expect(data.items[0]?.unitPrice).toBe(1290);
    expect(data.total).toBe(3180);
  });

  it('parses bespoke "Create Your Perfume" order invoice HTML correctly', () => {
    const data = parseInvoiceHtml(SAMPLE_BESPOKE_HTML);
    expect(data.invoiceNumber).toBe('INV-20261112-XY7890');
    expect(data.orderNumber).toBe('MMP-CUS-20261112-XY7890');
    expect(data.requestRef).toBe('MMP-REQ-20261112-AB12CD');
    expect(data.customerName).toBe('Meera Krishnan');
    expect(data.isBespoke).toBe(true);
    expect(data.bespokeBrief).toBeDefined();
    expect(data.bespokeBrief?.families).toBe('Warm, Woody');
    expect(data.bespokeBrief?.character).toBe('Balanced & Versatile');
    expect(data.bespokeBrief?.labelName).toBe('Midnight Silk');
    expect(data.bespokeBrief?.bottleSize).toBe('100 ml');
    expect(data.bespokeBrief?.packaging).toBe('Gift Packaging');
    expect(data.total).toBe(1890);
  });

  it('generates valid %PDF-1.4 binary bytes for standard catalog orders', () => {
    const bytes = generateInvoicePdfBytes(SAMPLE_CATALOG_HTML);
    const text = new TextDecoder('utf-8').decode(bytes);

    // Validate PDF specification headers & trailer
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.includes('%%EOF')).toBe(true);
    expect(text.includes('xref')).toBe(true);
    expect(text.includes('/Type /Catalog')).toBe(true);
    expect(text.includes('/Type /Page')).toBe(true);
    expect(text.includes('INV-20261112-XY7890')).toBe(true);
    expect(text.includes('MMP-20261112-XY7890')).toBe(true);
    expect(text.includes('Meera Krishnan')).toBe(true);
    expect(text.includes('Velvet Fig')).toBe(true);
  });

  it('generates valid %PDF-1.4 binary bytes for bespoke "Create Your Perfume" orders', () => {
    const bytes = generateInvoicePdfBytes(SAMPLE_BESPOKE_HTML);
    const text = new TextDecoder('utf-8').decode(bytes);

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.includes('%%EOF')).toBe(true);
    expect(text.includes('INV-20261112-XY7890')).toBe(true);
    expect(text.includes('MMP-REQ-20261112-AB12CD')).toBe(true);
    expect(text.includes('Midnight Silk')).toBe(true);
    expect(text.includes('Warm, Woody')).toBe(true);
    expect(text.includes('Gift Packaging')).toBe(true);
    expect(text.includes('BESPOKE FRAGRANCE SPECIFICATION')).toBe(true);
  });
});
