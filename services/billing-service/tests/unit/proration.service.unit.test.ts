import { describe, it, expect } from 'vitest';
import { computeProration, daysBetween } from '../../src/domain/services/proration.service';

describe('ProrationService', () => {
  it('returns 0 adjustments when prorationMode is NONE', () => {
    const result = computeProration({
      subscriptionLineId: 'sub-1',
      currentPeriodStart: new Date('2026-09-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
      changeDate: new Date('2026-09-15T00:00:00Z'),
      oldQuantity: 5,
      newQuantity: 8,
      unitPrice: 49.99,
      prorationMode: 'NONE',
    });

    expect(result.netAmount).toBe(0);
    expect(result.creditAmount).toBe(0);
    expect(result.chargeAmount).toBe(0);
    expect(result.creditNote).toBe(false);
  });

  it('CHECK-BILL-004: mid-cycle quantity increase computes correct charge and net amount', () => {
    // 30 day period, change on day 15 (15 days remaining)
    const currentPeriodStart = new Date('2026-09-01T00:00:00Z');
    const currentPeriodEnd = new Date('2026-10-01T00:00:00Z');
    const changeDate = new Date('2026-09-16T00:00:00Z'); // 15 days remaining

    const result = computeProration({
      subscriptionLineId: 'sub-1',
      currentPeriodStart,
      currentPeriodEnd,
      changeDate,
      oldQuantity: 5,
      newQuantity: 8,
      unitPrice: 49.99,
      prorationMode: 'DAILY',
    });

    // 30 days total, 15 days remaining:
    // dailyRate = 49.99 / 30 = 1.66633...
    // credit = 1.66633... * 15 * 5 = 124.98
    // charge = 1.66633... * 15 * 8 = 199.96
    // net = 199.96 - 124.98 = 74.98
    expect(result.creditAmount).toBeCloseTo(124.98, 1);
    expect(result.chargeAmount).toBeCloseTo(199.96, 1);
    expect(result.netAmount).toBeCloseTo(74.98, 1);
    expect(result.creditNote).toBe(false);
  });

  it('mid-cycle quantity decrease triggers creditNote (negative netAmount)', () => {
    const currentPeriodStart = new Date('2026-09-01T00:00:00Z');
    const currentPeriodEnd = new Date('2026-10-01T00:00:00Z');
    const changeDate = new Date('2026-09-16T00:00:00Z');

    const result = computeProration({
      subscriptionLineId: 'sub-1',
      currentPeriodStart,
      currentPeriodEnd,
      changeDate,
      oldQuantity: 8,
      newQuantity: 5,
      unitPrice: 49.99,
      prorationMode: 'DAILY',
    });

    expect(result.netAmount).toBeLessThan(0);
    expect(result.creditNote).toBe(true);
    expect(result.netAmount).toBeCloseTo(-74.98, 1);
  });

  it('correctly calculates daysBetween two dates', () => {
    const d1 = new Date('2026-09-01T00:00:00Z');
    const d2 = new Date('2026-09-11T00:00:00Z');
    expect(daysBetween(d1, d2)).toBe(10);
  });
});
