/*
 * Client helpers to download or print an order's PDF or HTML invoice cleanly.
 */

import {
  downloadInvoicePdf as downloadPdf,
  generateInvoicePdfBlob,
  generateInvoicePdfBytes,
  parseInvoiceHtml,
  type InvoiceData,
} from './pdf';

export {
  downloadPdf as downloadInvoicePdf,
  generateInvoicePdfBlob,
  generateInvoicePdfBytes,
  parseInvoiceHtml,
  type InvoiceData,
};

export function downloadInvoiceHtml(invoiceNumber: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${invoiceNumber}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printInvoiceHtml(html: string): void {
  const win = window.open('', '_blank', 'width=760,height=900');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
}


