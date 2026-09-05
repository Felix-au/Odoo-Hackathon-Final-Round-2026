/**
 * Deal Health Calculation Engine
 * Pure domain functions for statistical anomaly detection and stall severity calculations.
 */

export function mean(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  return sum / numbers.length;
}

export function standardDeviation(numbers: number[], avg?: number): number {
  if (numbers.length <= 1) return 0;
  const m = avg !== undefined ? avg : mean(numbers);
  const variance = numbers.reduce((acc, val) => acc + Math.pow(val - m, 2), 0) / numbers.length;
  return Math.sqrt(variance);
}

export function calculateStalledSeverity(
  daysSinceActivity: number,
  stallDaysThreshold: number,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (daysSinceActivity >= 2 * stallDaysThreshold) {
    return 'HIGH';
  }
  if (daysSinceActivity >= 1.5 * stallDaysThreshold) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function isDiscountAnomaly(
  blendedRiskScore: number,
  avg: number,
  stdDev: number,
  factor: number = 2.0,
): { isAnomaly: boolean; threshold: number; severity: 'LOW' | 'MEDIUM' | 'HIGH' } {
  const threshold = avg + factor * stdDev;
  const isAnomaly = blendedRiskScore > threshold && blendedRiskScore > 0;

  let severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (isAnomaly) {
    severity = blendedRiskScore > threshold * 1.5 ? 'HIGH' : 'MEDIUM';
  }

  return {
    isAnomaly,
    threshold,
    severity,
  };
}

export function daysBetween(d1: Date, d2: Date): number {
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
