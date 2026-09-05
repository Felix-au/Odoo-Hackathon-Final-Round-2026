import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | undefined | null, currency = 'INR'): string {
  if (amount === undefined || amount === null) return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(value: number | string | undefined | null): string {
  if (value === undefined || value === null) return '0%';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0%';
  return `${num.toFixed(1)}%`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatQuotationNumber(quote?: { quotationNumber?: string; id?: string } | string | null): string {
  if (!quote) return 'QTN-0001';
  if (typeof quote === 'string') {
    if (quote.startsWith('quot-')) {
      const parts = quote.split('-');
      const last = parts[parts.length - 1];
      if (/^\d+$/.test(last)) {
        return `QTN-${last.slice(-4).padStart(4, '0')}`;
      }
    }
    return `QTN-${quote.slice(0, 6).toUpperCase()}`;
  }
  if (quote.quotationNumber && quote.quotationNumber.trim() !== '') {
    return quote.quotationNumber;
  }
  if (quote.id) {
    if (quote.id.startsWith('quot-')) {
      const parts = quote.id.split('-');
      const last = parts[parts.length - 1];
      if (/^\d+$/.test(last)) {
        return `QTN-${last.slice(-4).padStart(4, '0')}`;
      }
    }
    return `QTN-${quote.id.slice(0, 6).toUpperCase()}`;
  }
  return 'QTN-0001';
}
