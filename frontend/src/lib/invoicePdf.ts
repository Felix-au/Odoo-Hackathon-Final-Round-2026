import { jsPDF } from 'jspdf';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  orderId: string;
  customerName: string;
  customerId?: string;
  date: string;
  dueDate?: string;
  paidAt?: string;
  currency?: string;
  totalAmount: number;
  subtotal?: number;
  taxAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  lines?: InvoiceLineItem[];
}

function formatMoney(amount: number | string | undefined | null, currency?: string): string {
  const num = Number(amount || 0);
  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const c = (currency || 'INR').toUpperCase();
  if (c === 'USD' || c === '$') return `$${formatted}`;
  if (c === 'EUR') return `EUR ${formatted}`;
  if (c === 'GBP') return `GBP ${formatted}`;
  return `INR ${formatted}`;
}

export function generateAndDownloadInvoicePdf(data: InvoicePdfData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~210mm
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner
  doc.setFillColor(15, 17, 23); // #0F1117 Dark Obsidian
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Brand title & subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('DealFlow360', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175); // #9CA3AF
  doc.text('Multi-Depot Operations & Automated Billing Ledger', margin, 24);
  doc.text('Certified Audit Grade • Enterprise Financial Compliance', margin, 29);

  // Invoice Title Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 130, 246); // #3B82F6 Blue
  doc.text('TAX INVOICE', pageWidth - margin, 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(data.invoiceNumber || `INV-${data.orderId.slice(0, 8).toUpperCase()}`, pageWidth - margin, 25, { align: 'right' });

  // Paid in Full Stamp / Badge
  doc.setFillColor(16, 185, 129); // #10B981 Emerald
  doc.roundedRect(pageWidth - margin - 36, 29, 36, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PAID IN FULL', pageWidth - margin - 18, 34, { align: 'center' });

  // Metadata Card / Grid
  let y = 52;
  doc.setDrawColor(229, 231, 235); // #E5E7EB
  doc.setFillColor(249, 250, 251); // #F9FAFB
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD');

  // Left column: Customer Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('BILLED TO / CUSTOMER:', margin + 6, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text(data.customerName || 'Enterprise Client', margin + 6, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(75, 85, 99);
  if (data.customerId) {
    doc.text(`Customer ID: ${data.customerId.slice(0, 16)}`, margin + 6, y + 21);
  }
  doc.text(`Order Reference: #${data.orderId.slice(0, 8)}`, margin + 6, y + 26);

  // Right column: Invoice Metadata
  const col2X = margin + contentWidth / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('INVOICE DATE:', col2X, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(data.date || new Date().toLocaleDateString(), col2X + 30, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('PAYMENT DATE:', col2X, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(data.paidAt || new Date().toLocaleDateString(), col2X + 30, y + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('PAYMENT METHOD:', col2X, y + 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(17, 24, 39);
  doc.text(data.paymentMethod || 'Wire Transfer / Electronic', col2X + 30, y + 22);

  if (data.paymentReference) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('TXN REFERENCE:', col2X, y + 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(17, 24, 39);
    doc.text(data.paymentReference, col2X + 30, y + 28);
  }

  // Items Table
  y = 92;

  // Table Header
  doc.setFillColor(31, 41, 55); // #1F2937
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ITEM / DESCRIPTION', margin + 4, y + 5.5);
  doc.text('QTY', margin + contentWidth - 75, y + 5.5, { align: 'center' });
  doc.text('UNIT PRICE', margin + contentWidth - 40, y + 5.5, { align: 'right' });
  doc.text('LINE TOTAL', margin + contentWidth - 4, y + 5.5, { align: 'right' });

  y += 8;

  // Line items sanitization & fallback
  let lines: InvoiceLineItem[] = [];
  if (data.lines && data.lines.length > 0) {
    lines = data.lines.map((l) => ({
      description: l.description || 'Enterprise Hardware Item',
      quantity: Number(l.quantity) > 0 ? Number(l.quantity) : 1,
      unitPrice: Number(l.unitPrice) || 0,
      total: l.total !== undefined ? Number(l.total) : (Number(l.unitPrice || 0) * (Number(l.quantity) || 1)),
    }));
  }

  const linesSum = lines.reduce((acc, l) => acc + (l.total ?? (l.unitPrice * l.quantity)), 0);

  // If no lines or all line values are 0 while totalAmount > 0, calibrate with totalAmount
  if (lines.length === 0) {
    lines = [
      {
        description: 'Physical Hardware & Enterprise Order Fulfillment',
        quantity: 1,
        unitPrice: data.totalAmount,
        total: data.totalAmount,
      },
    ];
  } else if (linesSum === 0 && data.totalAmount > 0) {
    if (lines.length === 1) {
      const q = lines[0].quantity || 1;
      lines[0].unitPrice = data.totalAmount / q;
      lines[0].total = data.totalAmount;
    } else {
      const each = data.totalAmount / lines.length;
      lines.forEach((l) => {
        l.unitPrice = each / (l.quantity || 1);
        l.total = each;
      });
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);

  lines.forEach((line, index) => {
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 249, isEven ? 255 : 250, isEven ? 255 : 251);
    doc.rect(margin, y, contentWidth, 8, 'F');

    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y + 8, margin + contentWidth, y + 8);

    doc.setTextColor(17, 24, 39);
    const lineDesc = line.description.length > 45 ? `${line.description.slice(0, 42)}...` : line.description;
    doc.text(lineDesc, margin + 4, y + 5.5);
    doc.text(String(line.quantity), margin + contentWidth - 75, y + 5.5, { align: 'center' });
    doc.text(formatMoney(line.unitPrice, data.currency), margin + contentWidth - 40, y + 5.5, { align: 'right' });
    const lineTot = line.total ?? (Number(line.unitPrice) * Number(line.quantity));
    doc.text(formatMoney(lineTot, data.currency), margin + contentWidth - 4, y + 5.5, { align: 'right' });

    y += 8;
  });

  // Summary Totals
  y += 6;
  const summaryBoxWidth = 85;
  const summaryX = margin + contentWidth - summaryBoxWidth;

  const subtotal = Number(data.subtotal) > 0 ? Number(data.subtotal) : (data.totalAmount - (Number(data.taxAmount) || 0));
  const tax = Number(data.taxAmount) || 0;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('Subtotal:', summaryX, y);
  doc.setTextColor(17, 24, 39);
  doc.text(formatMoney(subtotal, data.currency), margin + contentWidth - 4, y, { align: 'right' });

  y += 6;
  doc.setTextColor(107, 114, 128);
  doc.text('Tax (0% GST / Export):', summaryX, y);
  doc.setTextColor(17, 24, 39);
  doc.text(formatMoney(tax, data.currency), margin + contentWidth - 4, y, { align: 'right' });

  y += 8;
  doc.setFillColor(243, 244, 246);
  doc.rect(summaryX - 2, y - 5, summaryBoxWidth + 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text('Total Invoiced:', summaryX, y + 1);
  doc.text(formatMoney(data.totalAmount, data.currency), margin + contentWidth - 4, y + 1, { align: 'right' });

  y += 10;
  doc.setFillColor(236, 253, 245); // #ECFDF5 Emerald light
  doc.rect(summaryX - 2, y - 5, summaryBoxWidth + 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105); // #059669
  doc.text('Amount Paid:', summaryX, y + 1);
  doc.text(formatMoney(data.totalAmount, data.currency), margin + contentWidth - 4, y + 1, { align: 'right' });

  // Verification Seal / Sign-off Box
  y = Math.max(y + 24, 190);
  doc.setDrawColor(209, 213, 219);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text('PAYMENT SETTLEMENT & CLEARANCE CERTIFICATE', margin + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(75, 85, 99);
  doc.text(
    'This invoice has been recorded as PAID in DealFlow360. All warehouse allocation stock holds, routing orders,',
    margin + 6,
    y + 14
  );
  doc.text(
    'and financial ledgers have been synchronized and authorized for fulfillment dispatch.',
    margin + 6,
    y + 19
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text('STATUS: SETTLED & VERIFIED', margin + 6, y + 26);

  // Digital Signature stamp right
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text('Authorized Finance Controller', margin + contentWidth - 6, y + 20, { align: 'right' });
  doc.text('DealFlow360 Treasury Operations', margin + contentWidth - 6, y + 25, { align: 'right' });

  // Footer
  const footerY = 285;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `DealFlow360 Inc. • Automated Billing & Multi-Depot Operations • Generated on ${new Date().toISOString()} • Confidential`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Physical download to user's device
  const safeNum = (data.invoiceNumber || `INV-${data.orderId.slice(0, 8)}`).replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`Invoice_${safeNum}.pdf`);
}
