/**
 * Make My Perfume — Atelier Vector PDF Engine
 * Generates official, high-fidelity A4 PDF invoices natively without heavy external libraries.
 * Conforms to ISO 32000-1 (%PDF-1.4), rendering crisp vector layouts, luxury Atelier branding,
 * and complete order breakdowns for both standard catalog and bespoke "Create Your Perfume" orders.
 */

export interface InvoiceItem {
  name: string;
  size?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface BespokeBrief {
  families?: string;
  character?: string;
  intensity?: string;
  preferredNotes?: string;
  notesToAvoid?: string;
  occasion?: string;
  bottleSize?: string;
  labelName?: string;
  packaging?: string;
  instructions?: string;
}

export interface InvoiceData {
  orderNumber: string;
  invoiceNumber: string;
  requestRef?: string;
  date: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  items: InvoiceItem[];
  subtotal: number;
  shipping: number;
  total: number;
  isBespoke?: boolean;
  bespokeBrief?: BespokeBrief;
}

/**
 * Strips HTML tags and unescapes basic HTML entities.
 */
function cleanText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&#8377;/g, 'Rs. ')
    .replace(/&middot;/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses numeric amount from string like "&#8377;1,890" or "Rs. 1,290" or "1890".
 */
function parseAmount(val?: string | null): number {
  if (!val) return 0;
  const unescaped = cleanText(val);
  const match = unescaped.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (!match || !match[1]) return 0;
  const numStr = match[1].replace(/,/g, '');
  const parsed = parseFloat(numStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Robustly parses structured order and invoice metadata from HTML generated
 * by either `build_invoice_html` or `build_custom_perfume_invoice_html`.
 */
export function parseInvoiceHtml(html: string): InvoiceData {
  const isBespoke = /Bespoke Atelier|Personalised Perfume|Personalised Blend Brief/i.test(html);

  // Extract Invoice Number
  const invMatch = html.match(/Invoice:?<\/strong>\s*([A-Za-z0-9\-_]+)/i) ||
                   html.match(/Invoice\s*([A-Za-z0-9\-_]+)/i);
  const invoiceNumber = (invMatch && invMatch[1]) ? invMatch[1].trim() : 'INV-PROVISIONAL';

  // Extract Order Number
  const orderMatch = html.match(/Order (?:Number|No):?<\/strong>\s*([A-Za-z0-9\-_]+)/i) ||
                     html.match(/Order\s*([A-Za-z0-9\-_]+)/i);
  const orderNumber = (orderMatch && orderMatch[1]) ? orderMatch[1].trim() : invoiceNumber.replace(/^INV-/, 'MMP-');

  // Extract Request Ref (for bespoke orders)
  const reqMatch = html.match(/Request Ref:?<\/strong>\s*([A-Za-z0-9\-_]+)/i);
  const requestRef = (reqMatch && reqMatch[1]) ? reqMatch[1].trim() : undefined;

  // Extract Date
  const dateMatch = html.match(/Date:?<\/strong>\s*([^<&]+?)(?:&nbsp;|<br|\n)/i) ||
                    html.match(/Date:?<\/strong>\s*([^<]+)/i);
  const date = (dateMatch && dateMatch[1]) ? cleanText(dateMatch[1]) : 'Current';

  // Extract Payment Info
  const payMatch = html.match(/Payment:?<\/strong>\s*([^<]+)/i);
  const rawPayment = (payMatch && payMatch[1]) ? cleanText(payMatch[1]) : 'Cash on Delivery (COD)';
  const paymentMethod = /UPI/i.test(rawPayment) ? rawPayment : 'Cash on Delivery (COD)';

  // Extract Payment Status
  const statusMatch = html.match(/Status:?<\/strong>\s*([^<]+)/i) ||
                      html.match(/\((completed|pending|verified|placed|failed)\)/i);
  const paymentStatus = (statusMatch && statusMatch[1]) ? cleanText(statusMatch[1]).toUpperCase() : 'CONFIRMED';

  // Extract Customer Name from Heading or Shipping block
  let customerName = 'Valued Customer';
  const h1Match = html.match(/<h1[^>]*>Thank you for your order,\s*([^<]+)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    customerName = cleanText(h1Match[1]);
  } else {
    const shipBlockMatch = html.match(/(?:Shipping To|Billed &amp; Shipped To):?<\/strong><br\/>\s*([^<]+)/i);
    if (shipBlockMatch && shipBlockMatch[1]) {
      customerName = cleanText(shipBlockMatch[1]);
    }
  }

  // Extract Shipping / Billed block
  let address = '';
  let city = '';
  let state = '';
  let pincode = '';
  let customerPhone = '';
  let customerEmail = '';

  const phoneMatch = html.match(/Phone:?\s*([+\d\s\-]+)/i);
  if (phoneMatch && phoneMatch[1]) customerPhone = phoneMatch[1].trim();

  const emailMatch = html.match(/Email:?\s*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch && emailMatch[1]) customerEmail = emailMatch[1].trim();

  const addrBlockMatch = html.match(/(?:Shipping To|Billed &amp; Shipped To):?<\/strong>(?:<br\/>|\n)([\s\S]+?)(?:<\/p>|<\/div>)/i);
  if (addrBlockMatch && addrBlockMatch[1]) {
    const lines = addrBlockMatch[1]
      .split(/<br\s*\/?>|\n/)
      .map((l) => cleanText(l))
      .filter((l) => l.length > 0 && !/^Phone:|^Email:/i.test(l));

    if (lines.length > 1) {
      address = lines[1] || '';
      if (lines.length > 2) {
        const last = lines[lines.length - 1] || '';
        const pinFind = last.match(/(\d{4,12})/);
        if (pinFind && pinFind[1]) pincode = pinFind[1];
        const parts = last.replace(/[–\-]\s*\d{4,12}/, '').split(',');
        if (parts.length >= 2) {
          city = parts[0]?.trim() || '';
          state = parts[1]?.trim() || '';
        } else {
          city = parts[0]?.trim() || '';
        }
      }
    }
  }

  // Parse Bespoke Brief if present
  let bespokeBrief: BespokeBrief | undefined = undefined;
  if (isBespoke) {
    const famMatch = html.match(/Families:?<\/strong>\s*([^<]+)/i);
    const charMatch = html.match(/Character:?<\/strong>\s*([^<]+?)(?:&middot;|·|<br|\n)/i) ||
                      html.match(/Character:?<\/strong>\s*([^<]+)/i);
    const intMatch = html.match(/Intensity:?<\/strong>\s*([^<]+)/i);
    const notesMatch = html.match(/Preferred Notes:?<\/strong>\s*([^<]+)/i);
    const avoidMatch = html.match(/Notes to Avoid:?<\/strong>\s*([^<]+)/i);
    const occMatch = html.match(/Occasion:?<\/strong>\s*([^<]+)/i);
    const bottleMatch = html.match(/Bottle:?<\/strong>\s*([^<]+?)(?:&middot;|·|<br|\n)/i) ||
                        html.match(/Bottle:?<\/strong>\s*([^<]+)/i);
    const labelMatch = html.match(/Label Name:?<\/strong>\s*([^<]+?)(?:&middot;|·|<br|\n)/i) ||
                       html.match(/Label Name:?<\/strong>\s*([^<]+)/i);
    const pkgMatch = html.match(/Packaging:?<\/strong>\s*([^<]+)/i);
    const instrMatch = html.match(/(?:Notes \/ Instructions|Instructions):?<\/strong>\s*([^<]+)/i);

    bespokeBrief = {
      families: (famMatch && famMatch[1]) ? cleanText(famMatch[1]) : 'Studio Blend',
      character: (charMatch && charMatch[1]) ? cleanText(charMatch[1]) : 'Balanced & Versatile',
      intensity: (intMatch && intMatch[1]) ? cleanText(intMatch[1]) : 'Moderate',
      preferredNotes: (notesMatch && notesMatch[1]) ? cleanText(notesMatch[1]) : 'Bespoke Curated Notes',
      notesToAvoid: (avoidMatch && avoidMatch[1]) ? cleanText(avoidMatch[1]) : 'None noted',
      occasion: (occMatch && occMatch[1]) ? cleanText(occMatch[1]) : 'Signature Daily & Evening',
      bottleSize: (bottleMatch && bottleMatch[1]) ? cleanText(bottleMatch[1]) : '100 ml',
      labelName: (labelMatch && labelMatch[1]) ? cleanText(labelMatch[1]) : 'Personalised Blend',
      packaging: (pkgMatch && pkgMatch[1]) ? cleanText(pkgMatch[1]) : 'Standard Studio Packaging',
      instructions: (instrMatch && instrMatch[1]) ? cleanText(instrMatch[1]) : 'None',
    };
  }

  // Parse Table Items strictly from <tbody>
  const items: InvoiceItem[] = [];
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]+?)<\/tbody>/i);
  const tbodyHtml = (tbodyMatch && tbodyMatch[1]) ? tbodyMatch[1] : '';

  if (tbodyHtml) {
    const rowRegex = /<tr[^>]*>([\s\S]+?)<\/tr>/gi;
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(tbodyHtml)) !== null) {
      const rowHtml = match[1] || '';
      if (/<th/i.test(rowHtml)) continue; // skip header row

      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]+?)<\/td>/gi;
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        cells.push(cleanText(cellMatch[1]));
      }

      if (cells.length >= 4) {
        const nameRaw = cells[0] || '';
        const sizeMatch = nameRaw.match(/\((\d+)\s*ml\)/i);
        const size = sizeMatch ? `${sizeMatch[1]} ml` : undefined;
        const cleanName = nameRaw.replace(/\(\d+\s*ml\)/i, '').trim();
        const qty = parseInt(cells[1] || '1', 10) || 1;
        const unitPrice = parseAmount(cells[2]);
        const lineTotal = parseAmount(cells[3]);

        items.push({
          name: cleanName,
          size,
          quantity: qty,
          unitPrice: unitPrice || lineTotal,
          lineTotal,
        });
      } else if (cells.length >= 2) {
        const nameRaw = cells[0] || 'Personalised Perfume';
        const sizeMatch = nameRaw.match(/\((\d+)\s*ml\)/i);
        const size = sizeMatch ? `${sizeMatch[1]} ml` : undefined;
        const totalAmt = parseAmount(cells[1]);
        items.push({
          name: nameRaw,
          size,
          quantity: 1,
          unitPrice: totalAmt,
          lineTotal: totalAmt,
        });
      }
    }
  }

  // Extract Subtotal, Shipping, Total
  let total = 0;
  const tfootMatch = html.match(/<tfoot[^>]*>([\s\S]+?)<\/tfoot>/i);
  if (tfootMatch && tfootMatch[1]) {
    total = parseAmount(tfootMatch[1]);
  }
  if (!total) {
    const totalMatch = html.match(/Total(?: Amount)?:?\s*(?:&#8377;|Rs\.?)?\s*([0-9,.]+)/i);
    total = (totalMatch && totalMatch[1]) ? parseAmount(totalMatch[1]) : 0;
  }
  if (!total) {
    total = items.reduce((acc, it) => acc + it.lineTotal, 0);
  }

  const subtotalMatch = html.match(/Subtotal:?\s*(?:&#8377;|Rs\.?)?\s*([0-9,.]+)/i);
  const subtotal = (subtotalMatch && subtotalMatch[1]) ? parseAmount(subtotalMatch[1]) : total;

  const shipping = /Shipping:\s*Free/i.test(html) ? 0 : Math.max(0, total - subtotal);

  return {
    orderNumber,
    invoiceNumber,
    requestRef,
    date,
    customerName,
    customerEmail,
    customerPhone,
    address,
    city,
    state,
    pincode,
    paymentMethod,
    paymentStatus,
    items: items.length > 0 ? items : [{
      name: isBespoke ? 'Personalised Perfume Creation' : 'Make My Perfume Creation',
      size: bespokeBrief?.bottleSize || '100 ml',
      quantity: 1,
      unitPrice: total,
      lineTotal: total,
    }],
    subtotal: subtotal || total,
    shipping,
    total,
    isBespoke,
    bespokeBrief,
  };
}

/**
 * Escapes characters for PDF literal text strings: ( ... ) Tj.
 * Replaces non-ASCII chars cleanly so WinAnsi / Standard Type 1 fonts render 100% reliably.
 */
function escapePdfText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/₹/g, 'Rs. ')
    .replace(/[^\x20-\x7E]/g, (char) => {
      // Map common typographic characters to standard ASCII equivalents
      switch (char) {
        case '–':
        case '—':
          return '-';
        case '‘':
        case '’':
          return "'";
        case '“':
        case '”':
          return '"';
        case '·':
          return '*';
        case '•':
          return '*';
        case '…':
          return '...';
        default:
          return ' ';
      }
    });
}

function formatInrPdf(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Generates an official ISO 32000-1 (%PDF-1.4) vector PDF binary buffer.
 */
export function generateInvoicePdfBytes(dataOrHtml: InvoiceData | string, fallbackInvoiceNumber?: string): Uint8Array {
  const data: InvoiceData = typeof dataOrHtml === 'string'
    ? parseInvoiceHtml(dataOrHtml)
    : dataOrHtml;

  if (fallbackInvoiceNumber && !data.invoiceNumber) {
    data.invoiceNumber = fallbackInvoiceNumber;
  }

  // A4 dimensions: 595.28 x 841.89 points (72 DPI)
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2; // 515.28

  // Stream commands accumulator
  const ops: string[] = [];

  // Helper to add drawing commands
  const add = (cmd: string) => ops.push(cmd);

  // Set fill color (RGB 0..1)
  const setFill = (r: number, g: number, b: number) => add(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
  // Set stroke color (RGB 0..1)
  const setStroke = (r: number, g: number, b: number) => add(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`);
  // Set line width
  const setLineWidth = (w: number) => add(`${w.toFixed(2)} w`);

  // Draw rectangle
  const fillRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number) => {
    setFill(r, g, b);
    add(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  };

  const strokeRect = (x: number, y: number, w: number, h: number, r: number, g: number, b: number, lw = 1) => {
    setStroke(r, g, b);
    setLineWidth(lw);
    add(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re s`);
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, r: number, g: number, b: number, lw = 1) => {
    setStroke(r, g, b);
    setLineWidth(lw);
    add(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l s`);
  };

  // Text writer
  const drawText = (
    text: string,
    x: number,
    y: number,
    font: '/F1' | '/F2' | '/F3' | '/F4' | '/F5',
    size: number,
    r: number,
    g: number,
    b: number
  ) => {
    setFill(r, g, b);
    add('BT');
    add(`${font} ${size.toFixed(1)} Tf`);
    add(`${x.toFixed(2)} ${y.toFixed(2)} Td`);
    add(`(${escapePdfText(text)}) Tj`);
    add('ET');
  };

  // 1. PAGE BACKGROUND (Ivory / Paper: #FAF8F4)
  fillRect(0, 0, pageWidth, pageHeight, 0.980, 0.973, 0.957);

  // Outer framing line
  strokeRect(marginX - 10, 30, contentWidth + 20, pageHeight - 60, 0.839, 0.808, 0.757, 0.75);

  // 2. HEADER BANNER (Noir #14110E, Gold Top Accent #D5A35D)
  const headerY = pageHeight - 110;
  const headerHeight = 75;
  fillRect(marginX, headerY, contentWidth, headerHeight, 0.078, 0.067, 0.055);
  // Gold top stripe
  fillRect(marginX, headerY + headerHeight - 4, contentWidth, 4, 0.835, 0.639, 0.365);

  // Header Typography
  drawText('MAKE MY PERFUME  ·  OFFICIAL ATELIER INVOICE', marginX + 20, headerY + 48, '/F1', 9, 0.835, 0.639, 0.365);
  const titleText = data.isBespoke ? 'Personalised Perfume Order & Invoice' : 'Tax & Order Invoice';
  drawText(titleText, marginX + 20, headerY + 22, '/F4', 18, 0.949, 0.910, 0.835);

  // Right-aligned header metadata
  drawText(`ISSUED: ${data.date}`, marginX + contentWidth - 180, headerY + 48, '/F2', 8.5, 0.949, 0.910, 0.835);
  drawText('ATELIER VERIFIED', marginX + contentWidth - 180, headerY + 24, '/F1', 9, 0.835, 0.639, 0.365);

  let currentY = headerY - 14;

  // 3. ORDER METADATA BOX (3 columns)
  const metaHeight = 52;
  const metaY = currentY - metaHeight;
  fillRect(marginX, metaY, contentWidth, metaHeight, 0.945, 0.929, 0.902);
  strokeRect(marginX, metaY, contentWidth, metaHeight, 0.839, 0.808, 0.757, 0.75);

  // Col 1: Invoice & Order
  drawText('INVOICE NUMBER', marginX + 14, metaY + 36, '/F1', 7.5, 0.478, 0.353, 0.133);
  drawText(data.invoiceNumber, marginX + 14, metaY + 22, '/F1', 11, 0.078, 0.067, 0.055);
  drawText(`ORDER REF: ${data.orderNumber}`, marginX + 14, metaY + 9, '/F2', 8, 0.369, 0.333, 0.294);

  // Col 2: Request Ref / Dates
  const col2X = marginX + 185;
  if (data.requestRef) {
    drawText('REQUEST REFERENCE', col2X, metaY + 36, '/F1', 7.5, 0.478, 0.353, 0.133);
    drawText(data.requestRef, col2X, metaY + 22, '/F1', 10, 0.078, 0.067, 0.055);
  } else {
    drawText('ORDER STATUS', col2X, metaY + 36, '/F1', 7.5, 0.478, 0.353, 0.133);
    drawText('CONFIRMED', col2X, metaY + 22, '/F1', 10, 0.078, 0.067, 0.055);
  }
  drawText(`DATE: ${data.date}`, col2X, metaY + 9, '/F2', 8, 0.369, 0.333, 0.294);

  // Col 3: Payment details
  const col3X = marginX + 355;
  drawText('PAYMENT METHOD', col3X, metaY + 36, '/F1', 7.5, 0.478, 0.353, 0.133);
  drawText(data.paymentMethod || 'Cash on Delivery (COD)', col3X, metaY + 22, '/F1', 9.5, 0.078, 0.067, 0.055);
  drawText(`STATUS: ${data.paymentStatus || 'COMPLETED'}`, col3X, metaY + 9, '/F1', 8, 0.478, 0.353, 0.133);

  currentY = metaY - 14;

  // 4. BILLED & SHIPPED TO SECTION
  const billHeight = 56;
  const billY = currentY - billHeight;
  fillRect(marginX, billY, contentWidth, billHeight, 0.980, 0.973, 0.957);
  strokeRect(marginX, billY, contentWidth, billHeight, 0.839, 0.808, 0.757, 0.75);

  drawText('BILLED & SHIPPED TO', marginX + 14, billY + 42, '/F1', 8, 0.478, 0.353, 0.133);
  drawText(data.customerName, marginX + 14, billY + 28, '/F1', 11, 0.078, 0.067, 0.055);

  const fullAddr = [data.address, data.city, data.state, data.pincode].filter(Boolean).join(', ') || 'Customer Studio Address';
  drawText(fullAddr, marginX + 14, billY + 14, '/F2', 8.5, 0.2, 0.2, 0.2);

  const contactStr = [
    data.customerPhone ? `Phone: ${data.customerPhone}` : null,
    data.customerEmail ? `Email: ${data.customerEmail}` : null,
  ].filter(Boolean).join('   |   ');
  if (contactStr) {
    drawText(contactStr, marginX + 14, billY + 3, '/F2', 7.5, 0.4, 0.4, 0.4);
  }

  currentY = billY - 14;

  // 5. IF BESPOKE: PERSONALISED BLEND SPECIFICATION BOX
  if (data.isBespoke && data.bespokeBrief) {
    const brief = data.bespokeBrief;
    const briefHeight = 105;
    const briefY = currentY - briefHeight;

    // Soft parchment fill with champagne border
    fillRect(marginX, briefY, contentWidth, briefHeight, 0.965, 0.950, 0.925);
    strokeRect(marginX, briefY, contentWidth, briefHeight, 0.788, 0.604, 0.294, 1);

    // Title badge
    drawText('BESPOKE FRAGRANCE SPECIFICATION', marginX + 14, briefY + 90, '/F1', 8.5, 0.478, 0.353, 0.133);
    drawLine(marginX + 14, briefY + 84, marginX + contentWidth - 14, briefY + 84, 0.839, 0.808, 0.757, 0.5);

    // Row 1
    drawText('Scent Families:', marginX + 14, briefY + 70, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(brief.families || 'Studio Blend', marginX + 90, briefY + 70, '/F2', 8.5, 0.078, 0.067, 0.055);

    drawText('Character & Intensity:', marginX + 270, briefY + 70, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(`${brief.character || 'Balanced'}  ·  ${brief.intensity || 'Moderate'}`, marginX + 375, briefY + 70, '/F2', 8.5, 0.078, 0.067, 0.055);

    // Row 2
    drawText('Preferred Notes:', marginX + 14, briefY + 54, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(brief.preferredNotes || 'Bespoke Curated Notes', marginX + 90, briefY + 54, '/F2', 8.5, 0.078, 0.067, 0.055);

    drawText('Notes to Avoid:', marginX + 270, briefY + 54, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(brief.notesToAvoid || 'None', marginX + 375, briefY + 54, '/F2', 8.5, 0.078, 0.067, 0.055);

    // Row 3
    drawText('Occasion:', marginX + 14, briefY + 38, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(brief.occasion || 'Flexible', marginX + 90, briefY + 38, '/F2', 8.5, 0.078, 0.067, 0.055);

    drawText('Bottle & Packaging:', marginX + 270, briefY + 38, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(`${brief.bottleSize || '100 ml'}  ·  ${brief.packaging || 'Standard Packaging'}`, marginX + 375, briefY + 38, '/F2', 8.5, 0.078, 0.067, 0.055);

    // Row 4
    drawText('Custom Label:', marginX + 14, briefY + 22, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(`"${brief.labelName || 'House Signature'}"`, marginX + 90, briefY + 22, '/F4', 9.5, 0.478, 0.353, 0.133);

    drawText('Instructions:', marginX + 270, briefY + 22, '/F1', 8, 0.369, 0.333, 0.294);
    drawText(brief.instructions || 'None', marginX + 375, briefY + 22, '/F5', 8.5, 0.2, 0.2, 0.2);

    currentY = briefY - 14;
  }

  // 6. ORDER ITEMS TABLE
  const tableHeaderHeight = 22;
  const tableHeaderY = currentY - tableHeaderHeight;

  // Dark table header row
  fillRect(marginX, tableHeaderY, contentWidth, tableHeaderHeight, 0.078, 0.067, 0.055);

  drawText('ITEM DESCRIPTION', marginX + 12, tableHeaderY + 7, '/F1', 8, 0.949, 0.910, 0.835);
  drawText('SIZE', marginX + 280, tableHeaderY + 7, '/F1', 8, 0.949, 0.910, 0.835);
  drawText('QTY', marginX + 350, tableHeaderY + 7, '/F1', 8, 0.949, 0.910, 0.835);
  drawText('UNIT PRICE', marginX + 400, tableHeaderY + 7, '/F1', 8, 0.949, 0.910, 0.835);
  drawText('AMOUNT', marginX + contentWidth - 65, tableHeaderY + 7, '/F1', 8, 0.949, 0.910, 0.835);

  let rowY = tableHeaderY;
  const rowHeight = 24;

  data.items.forEach((item, idx) => {
    rowY -= rowHeight;
    // Alternating soft background
    if (idx % 2 === 1) {
      fillRect(marginX, rowY, contentWidth, rowHeight, 0.965, 0.950, 0.925);
    }
    // Bottom border
    drawLine(marginX, rowY, marginX + contentWidth, rowY, 0.839, 0.808, 0.757, 0.5);

    // Item name
    drawText(item.name, marginX + 12, rowY + 8, '/F1', 9, 0.078, 0.067, 0.055);
    // Size
    drawText(item.size || '50 ml', marginX + 280, rowY + 8, '/F2', 8.5, 0.369, 0.333, 0.294);
    // Qty
    drawText(String(item.quantity), marginX + 355, rowY + 8, '/F2', 8.5, 0.078, 0.067, 0.055);
    // Unit Price
    drawText(formatInrPdf(item.unitPrice), marginX + 400, rowY + 8, '/F2', 8.5, 0.078, 0.067, 0.055);
    // Line Total
    drawText(formatInrPdf(item.lineTotal), marginX + contentWidth - 65, rowY + 8, '/F1', 9, 0.078, 0.067, 0.055);
  });

  // Table outer vertical border
  drawLine(marginX, tableHeaderY + tableHeaderHeight, marginX, rowY, 0.839, 0.808, 0.757, 0.75);
  drawLine(marginX + contentWidth, tableHeaderY + tableHeaderHeight, marginX + contentWidth, rowY, 0.839, 0.808, 0.757, 0.75);

  currentY = rowY - 10;

  // 7. TOTALS SUMMARY BOX (Right aligned)
  const totalsWidth = 220;
  const totalsX = marginX + contentWidth - totalsWidth;
  const totalsHeight = 58;
  const totalsY = currentY - totalsHeight;

  fillRect(totalsX, totalsY, totalsWidth, totalsHeight, 0.945, 0.929, 0.902);
  strokeRect(totalsX, totalsY, totalsWidth, totalsHeight, 0.839, 0.808, 0.757, 0.75);

  drawText('Subtotal:', totalsX + 14, totalsY + 42, '/F2', 8.5, 0.369, 0.333, 0.294);
  drawText(formatInrPdf(data.subtotal), totalsX + totalsWidth - 75, totalsY + 42, '/F2', 8.5, 0.078, 0.067, 0.055);

  drawText('Shipping & Handling:', totalsX + 14, totalsY + 28, '/F2', 8.5, 0.369, 0.333, 0.294);
  const shipText = data.shipping === 0 ? 'FREE (Studio)' : formatInrPdf(data.shipping);
  drawText(shipText, totalsX + totalsWidth - 75, totalsY + 28, '/F1', 8.5, 0.478, 0.353, 0.133);

  drawLine(totalsX + 10, totalsY + 22, totalsX + totalsWidth - 10, totalsY + 22, 0.839, 0.808, 0.757, 0.5);

  drawText('TOTAL AMOUNT:', totalsX + 14, totalsY + 8, '/F1', 9.5, 0.078, 0.067, 0.055);
  drawText(formatInrPdf(data.total), totalsX + totalsWidth - 85, totalsY + 8, '/F1', 11, 0.078, 0.067, 0.055);

  // 8. LEGAL & COMPLIANCE FOOTER
  const footerY = 50;
  drawLine(marginX, footerY + 26, marginX + contentWidth, footerY + 26, 0.839, 0.808, 0.757, 0.5);

  drawText(
    'Make My Perfume Atelier  ·  Artisanal Fragrance Formulations  ·  GST & Studio Compliant',
    marginX + 14,
    footerY + 14,
    '/F1',
    7.5,
    0.478,
    0.353,
    0.133
  );

  drawText(
    'Official digital invoice. For inquiries, bespoke reorders or customer care: hello@makemyperfume.in  ·  www.makemyperfume.in',
    marginX + 14,
    footerY + 3,
    '/F2',
    7,
    0.369,
    0.333,
    0.294
  );

  // BUILD COMPLETE %PDF-1.4 DOCUMENT STREAM
  const contentStream = ops.join('\n');
  const streamLength = new TextEncoder().encode(contentStream).length;

  const pdfParts: string[] = [];
  const offsets: number[] = [0];

  const pushObj = (id: number, body: string) => {
    const currentOffset = pdfParts.join('').length;
    offsets[id] = currentOffset;
    pdfParts.push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  // Header
  pdfParts.push('%PDF-1.4\n%\\xE2\\xE3\\xCF\\xD3\n');

  // Object 1: Catalog
  pushObj(1, '<< /Type /Catalog /Pages 2 0 R >>');

  // Object 2: Pages
  pushObj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');

  // Object 3: Page
  pushObj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R /F5 9 0 R >> >> >>`
  );

  // Object 4: Contents Stream
  pushObj(4, `<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream`);

  // Fonts (Standard PDF Type 1 fonts universally supported without embedding)
  pushObj(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  pushObj(6, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pushObj(7, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  pushObj(8, '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>');
  pushObj(9, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');

  // Cross-reference table
  const startXref = pdfParts.join('').length;
  let xref = `xref\n0 10\n0000000000 65535 f \n`;
  for (let i = 1; i <= 9; i++) {
    const offsetStr = String(offsets[i]).padStart(10, '0');
    xref += `${offsetStr} 00000 n \n`;
  }

  // Trailer
  const creationDate = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const trailer = `trailer\n<< /Size 10 /Root 1 0 R /Info << /Title (${escapePdfText(data.invoiceNumber)}) /Subject (Official Order Invoice) /Author (Make My Perfume) /Creator (Make My Perfume Atelier PDF Engine) /CreationDate (D:${creationDate}) >> >>\nstartxref\n${startXref}\n%%EOF\n`;

  pdfParts.push(xref);
  pdfParts.push(trailer);

  const fullPdfStr = pdfParts.join('');
  return new TextEncoder().encode(fullPdfStr);
}

/**
 * Creates a browser-compatible Blob of type `application/pdf`.
 */
export function generateInvoicePdfBlob(dataOrHtml: InvoiceData | string, fallbackInvoiceNumber?: string): Blob {
  const bytes = generateInvoicePdfBytes(dataOrHtml, fallbackInvoiceNumber);
  return new Blob([bytes as any], { type: 'application/pdf' });
}

/**
 * Triggers an immediate browser download of the invoice as a true PDF file.
 */
export function downloadInvoicePdf(invoiceNumber: string, htmlOrData: string | InvoiceData): void {
  const blob = generateInvoicePdfBlob(htmlOrData, invoiceNumber);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber || 'invoice'}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
