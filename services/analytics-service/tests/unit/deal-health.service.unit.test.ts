import { describe, it, expect } from 'vitest';
import {
  mean,
  standardDeviation,
  calculateStalledSeverity,
  isDiscountAnomaly,
  daysBetween,
} from '../../src/domain/services/deal-health.service';

describe('Deal Health Calculation Service', () => {
  describe('mean and standardDeviation', () => {
    it('computes mean accurately', () => {
      expect(mean([])).toBe(0);
      expect(mean([10, 20, 30])).toBe(20);
      expect(mean([12, 14, 16, 18])).toBe(15);
    });

    it('computes standard deviation accurately', () => {
      expect(standardDeviation([])).toBe(0);
      expect(standardDeviation([10])).toBe(0);
      // Sample dataset: [10, 10, 10] -> stdDev = 0
      expect(standardDeviation([10, 10, 10])).toBe(0);
      // Dataset: [10, 20] -> mean=15, diffs=[-5, 5], sq=[25, 25], var=25, stdDev=5
      expect(standardDeviation([10, 20])).toBe(5);
    });
  });

  describe('calculateStalledSeverity', () => {
    it('returns LOW when activity is under 1.5x stall threshold', () => {
      expect(calculateStalledSeverity(8, 7)).toBe('LOW');
      expect(calculateStalledSeverity(10, 7)).toBe('LOW');
    });

    it('returns MEDIUM when activity is between 1.5x and 2x stall threshold', () => {
      expect(calculateStalledSeverity(11, 7)).toBe('MEDIUM');
      expect(calculateStalledSeverity(13, 7)).toBe('MEDIUM');
    });

    it('returns HIGH when activity is at or above 2x stall threshold', () => {
      expect(calculateStalledSeverity(14, 7)).toBe('HIGH');
      expect(calculateStalledSeverity(20, 7)).toBe('HIGH');
    });
  });

  describe('isDiscountAnomaly (CHECK-ANA-003, REQ-F-151, REQ-BR-015)', () => {
    it('flags discount as anomaly when score > avg + (factor * stdDev)', () => {
      // Precondition in CHECK-ANA-003:
      // Rep has average risk score 12; current quotation has score 45 (> avg + 2*stdDev)
      const avg = 12;
      const stdDev = 5;
      const factor = 2.0; // threshold = 12 + 10 = 22

      const normalCheck = isDiscountAnomaly(18, avg, stdDev, factor);
      expect(normalCheck.isAnomaly).toBe(false);

      const anomalyCheck = isDiscountAnomaly(45, avg, stdDev, factor);
      expect(anomalyCheck.isAnomaly).toBe(true);
      expect(anomalyCheck.threshold).toBe(22);
      expect(anomalyCheck.severity).toBe('HIGH'); // 45 > 22 * 1.5 (33)
    });

    it('flags anomaly as MEDIUM when between 1.0x and 1.5x threshold', () => {
      const avg = 10;
      const stdDev = 5;
      const factor = 2.0; // threshold = 20

      const check = isDiscountAnomaly(25, avg, stdDev, factor);
      expect(check.isAnomaly).toBe(true);
      expect(check.severity).toBe('MEDIUM');
    });

    it('does not flag zero or negative scores as anomaly', () => {
      const check = isDiscountAnomaly(0, 5, 2, 2.0);
      expect(check.isAnomaly).toBe(false);
    });
  });

  describe('daysBetween', () => {
    it('calculates absolute difference in whole days', () => {
      const d1 = new Date('2026-09-01T00:00:00Z');
      const d2 = new Date('2026-09-08T12:00:00Z');
      expect(daysBetween(d1, d2)).toBe(7);
    });
  });
});
