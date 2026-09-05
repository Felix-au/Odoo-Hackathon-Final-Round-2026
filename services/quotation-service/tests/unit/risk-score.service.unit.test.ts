import { describe, it, expect } from 'vitest';
import {
  computeBlendedRiskScore,
  LineRiskInput,
  CeilingMap,
} from '../../src/domain/services/risk-score.service';

describe('computeBlendedRiskScore', () => {
  const defaultCeilings: CeilingMap = {
    tierCeiling: 15, // GOLD tier
    categoryCeilings: {
      'cat-hardware': 15,
      'cat-service': 10,
      'cat-software': 20,
    },
  };

  it('returns score=0 when all lines within ceilings', () => {
    const lines: LineRiskInput[] = [
      {
        lineId: 'line-1',
        categoryId: 'cat-hardware',
        discountPct: 10, // ceiling 15 -> ok
        quantity: 2,
        lineTotal: 1000,
      },
      {
        lineId: 'line-2',
        categoryId: 'cat-service',
        discountPct: 8, // ceiling 10 -> ok
        quantity: 1,
        lineTotal: 500,
      },
    ];

    const result = computeBlendedRiskScore(lines, defaultCeilings, 1500);

    expect(result.blendedScore).toBe(0);
    expect(result.requiresApproval).toBe(false);
    expect(result.requiredRoles).toEqual([]);
    expect(result.lineViolations.every((v) => v.violationPoints <= 0)).toBe(true);
  });

  it('returns positive score when single line exceeds category ceiling', () => {
    const lines: LineRiskInput[] = [
      {
        lineId: 'line-1',
        categoryId: 'cat-hardware',
        discountPct: 12, // ceiling 15 -> compliant
        quantity: 1,
        lineTotal: 1000,
      },
      {
        lineId: 'line-2',
        categoryId: 'cat-service',
        discountPct: 18, // ceiling min(15, 10)=10 -> 8 points violation
        quantity: 1,
        lineTotal: 1000,
      },
    ];

    const result = computeBlendedRiskScore(lines, defaultCeilings, 2000);

    expect(result.blendedScore).toBeGreaterThan(0);
    expect(result.requiresApproval).toBe(true);
    expect(result.requiredRoles).toContain('SALES_MANAGER');

    const serviceViolation = result.lineViolations.find((v) => v.lineId === 'line-2');
    expect(serviceViolation?.violationPoints).toBe(8);
    expect(serviceViolation?.allowedCeiling).toBe(10);
  });

  it('captures cumulative violations across multiple slightly-over lines', () => {
    // 3 lines, each 2 points over
    const lines: LineRiskInput[] = [
      {
        lineId: 'line-1',
        categoryId: 'cat-service',
        discountPct: 12, // ceiling 10 -> +2
        quantity: 1,
        lineTotal: 1000,
      },
      {
        lineId: 'line-2',
        categoryId: 'cat-service',
        discountPct: 12, // ceiling 10 -> +2
        quantity: 1,
        lineTotal: 1000,
      },
      {
        lineId: 'line-3',
        categoryId: 'cat-service',
        discountPct: 12, // ceiling 10 -> +2
        quantity: 1,
        lineTotal: 1000,
      },
    ];

    const result = computeBlendedRiskScore(lines, defaultCeilings, 3000);

    expect(result.blendedScore).toBeGreaterThan(0);
    expect(result.requiresApproval).toBe(true);
    // Cumulative: weighted sum is (2 * 1/3 * 3) = 2. raw = 2*10 + 2*3 = 26
    expect(result.blendedScore).toBe(26);
  });

  it('returns higher score when more lines are violated', () => {
    const singleViolationLines: LineRiskInput[] = [
      {
        lineId: 'line-1',
        categoryId: 'cat-service',
        discountPct: 14, // ceiling 10 -> +4
        quantity: 1,
        lineTotal: 1000,
      },
      {
        lineId: 'line-2',
        categoryId: 'cat-hardware',
        discountPct: 5, // ceiling 15 -> ok
        quantity: 1,
        lineTotal: 1000,
      },
    ];

    const doubleViolationLines: LineRiskInput[] = [
      {
        lineId: 'line-1',
        categoryId: 'cat-service',
        discountPct: 14, // ceiling 10 -> +4
        quantity: 1,
        lineTotal: 1000,
      },
      {
        lineId: 'line-2',
        categoryId: 'cat-hardware',
        discountPct: 20, // ceiling 15 -> +5
        quantity: 1,
        lineTotal: 1000,
      },
    ];

    const result1 = computeBlendedRiskScore(singleViolationLines, defaultCeilings, 2000);
    const result2 = computeBlendedRiskScore(doubleViolationLines, defaultCeilings, 2000);

    expect(result2.blendedScore).toBeGreaterThan(result1.blendedScore);
  });

  it('correctly handles Gold tier with Hardware (15%) and Service (10%) ceilings', () => {
    const ceilings: CeilingMap = {
      tierCeiling: 15,
      categoryCeilings: {
        'cat-hw': 15,
        'cat-svc': 10,
      },
    };

    const lines: LineRiskInput[] = [
      { lineId: 'l1', categoryId: 'cat-hw', discountPct: 15, quantity: 1, lineTotal: 500 },
      { lineId: 'l2', categoryId: 'cat-svc', discountPct: 10, quantity: 1, lineTotal: 500 },
    ];

    const result = computeBlendedRiskScore(lines, ceilings, 1000);
    expect(result.blendedScore).toBe(0);
    expect(result.requiresApproval).toBe(false);
  });

  it('example from PDF: Hardware 12% (allowed 15%) = compliant; Service 18% (allowed 10%) = violation', () => {
    const ceilings: CeilingMap = {
      tierCeiling: 15,
      categoryCeilings: {
        'cat-hw': 15,
        'cat-svc': 10,
      },
    };

    const lines: LineRiskInput[] = [
      { lineId: 'hw', categoryId: 'cat-hw', discountPct: 12, quantity: 1, lineTotal: 1000 },
      { lineId: 'svc', categoryId: 'cat-svc', discountPct: 18, quantity: 1, lineTotal: 1000 },
    ];

    const result = computeBlendedRiskScore(lines, ceilings, 2000);

    const hwViolation = result.lineViolations.find((v) => v.lineId === 'hw');
    const svcViolation = result.lineViolations.find((v) => v.lineId === 'svc');

    expect(hwViolation?.violationPoints).toBe(-3); // compliant
    expect(svcViolation?.violationPoints).toBe(8); // +8 violation
    expect(result.blendedScore).toBeGreaterThan(0);
    expect(result.requiresApproval).toBe(true);
  });

  it('handles zero-value order gracefully', () => {
    const lines: LineRiskInput[] = [
      { lineId: 'free', categoryId: 'cat-hw', discountPct: 0, quantity: 1, lineTotal: 0 },
    ];

    const result = computeBlendedRiskScore(lines, defaultCeilings, 0);
    expect(result.blendedScore).toBe(0);
    expect(result.requiresApproval).toBe(false);
  });

  it('handles lines with 0% discount (always compliant)', () => {
    const lines: LineRiskInput[] = [
      { lineId: 'no-disc-1', categoryId: 'cat-hw', discountPct: 0, quantity: 5, lineTotal: 5000 },
      { lineId: 'no-disc-2', categoryId: 'cat-svc', discountPct: 0, quantity: 2, lineTotal: 2000 },
    ];

    const result = computeBlendedRiskScore(lines, defaultCeilings, 7000);
    expect(result.blendedScore).toBe(0);
    expect(result.requiresApproval).toBe(false);
    expect(result.requiredRoles).toEqual([]);
  });

  it('routes to SALES_MANAGER and FINANCE when blended score exceeds 30', () => {
    // High violation line
    const lines: LineRiskInput[] = [
      {
        lineId: 'l1',
        categoryId: 'cat-service',
        discountPct: 40, // ceiling 10 -> +30 violation
        quantity: 1,
        lineTotal: 10000,
      },
    ];

    const result = computeBlendedRiskScore(lines, defaultCeilings, 10000);
    expect(result.blendedScore).toBeGreaterThan(30);
    expect(result.requiredRoles).toEqual(['SALES_MANAGER', 'FINANCE']);
  });
});
