import { describe, it, expect } from 'vitest';
import { computeCancellation } from '../../src/domain/services/cancellation.service';

describe('CancellationService', () => {
  it('returns refund 0 and effectiveDate = currentPeriodEnd when policy is end_of_period', () => {
    const currentPeriodStart = new Date('2026-09-01T00:00:00Z');
    const currentPeriodEnd = new Date('2026-10-01T00:00:00Z');
    const cancelledAt = new Date('2026-09-15T00:00:00Z');

    const result = computeCancellation(
      {
        unitPrice: 100,
        quantity: 2,
        cancellationPolicy: 'end_of_period',
        partialRefundPct: 50,
        currentPeriodStart,
        currentPeriodEnd,
      },
      cancelledAt,
    );

    expect(result.refundAmount).toBe(0);
    expect(result.creditNoteAmount).toBe(0);
    expect(result.effectiveDate).toEqual(currentPeriodEnd);
  });

  it('CHECK-BILL-005: immediate cancellation with partialRefundPct=50 generates credit note for 50% of unused period', () => {
    // 30 days total, cancelled on day 15 (15 days remaining = 50% of period remaining)
    // paidAmount = 100 * 2 = 200
    // refund = 200 * (15/30) * 0.50 = 50.00
    const currentPeriodStart = new Date('2026-09-01T00:00:00Z');
    const currentPeriodEnd = new Date('2026-10-01T00:00:00Z');
    const cancelledAt = new Date('2026-09-16T00:00:00Z'); // 15 days remaining

    const result = computeCancellation(
      {
        unitPrice: 100,
        quantity: 2,
        cancellationPolicy: 'immediate',
        partialRefundPct: 50,
        currentPeriodStart,
        currentPeriodEnd,
      },
      cancelledAt,
    );

    expect(result.effectiveDate).toEqual(cancelledAt);
    expect(result.refundAmount).toBeCloseTo(50.0, 1);
    expect(result.creditNoteAmount).toBeCloseTo(50.0, 1);
  });

  it('immediate cancellation with partialRefundPct=0 returns credit note 0', () => {
    const currentPeriodStart = new Date('2026-09-01T00:00:00Z');
    const currentPeriodEnd = new Date('2026-10-01T00:00:00Z');
    const cancelledAt = new Date('2026-09-16T00:00:00Z');

    const result = computeCancellation(
      {
        unitPrice: 200,
        quantity: 1,
        cancellationPolicy: 'immediate',
        partialRefundPct: 0,
        currentPeriodStart,
        currentPeriodEnd,
      },
      cancelledAt,
    );

    expect(result.refundAmount).toBe(0);
    expect(result.creditNoteAmount).toBe(0);
  });
});
