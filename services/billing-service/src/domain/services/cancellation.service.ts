/**
 * Subscription cancellation logic
 *
 * Implements REQ-F-133, REQ-F-134, REQ-BR-012
 */

import { daysBetween } from './proration.service';

export interface CancellationInput {
  unitPrice: number;
  quantity: number;
  cancellationPolicy: string; // 'end_of_period' | 'immediate'
  partialRefundPct: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface CancellationResult {
  effectiveDate: Date;
  refundAmount: number;
  creditNoteAmount: number;
}

export function computeCancellation(
  subscription: CancellationInput,
  cancelledAt: Date,
): CancellationResult {
  if (subscription.cancellationPolicy === 'end_of_period') {
    return {
      effectiveDate: subscription.currentPeriodEnd,
      refundAmount: 0,
      creditNoteAmount: 0,
    };
  }

  // Immediate cancellation: calculate remaining portion of billing period
  const remainingDays = Math.max(
    0,
    Math.round((subscription.currentPeriodEnd.getTime() - cancelledAt.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const periodDays = daysBetween(subscription.currentPeriodStart, subscription.currentPeriodEnd);
  const remainingPct = Math.min(1, Math.max(0, remainingDays / periodDays));

  const paidAmount = subscription.unitPrice * subscription.quantity;
  const refundAmount = Math.round(paidAmount * remainingPct * (subscription.partialRefundPct / 100) * 100) / 100;

  return {
    effectiveDate: cancelledAt,
    refundAmount,
    creditNoteAmount: refundAmount,
  };
}
