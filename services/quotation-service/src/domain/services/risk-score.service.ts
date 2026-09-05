/**
 * RiskScoreService — pure domain calculation for blended discount risk score.
 *
 * Implements:
 * - REQ-F-024, REQ-F-170, REQ-F-171, REQ-F-172, REQ-F-173
 * - REQ-BR-001, REQ-BR-002, REQ-BR-003, REQ-BR-004, REQ-BR-005, REQ-BR-006, REQ-BR-007
 */

export interface LineRiskInput {
  lineId: string;
  categoryId: string;
  discountPct: number;
  quantity: number;
  lineTotal: number;
}

export interface CeilingMap {
  tierCeiling: number;                         // e.g. 15 for GOLD, 10 for SILVER, 5 for BRONZE
  categoryCeilings: Record<string, number>;    // categoryId → ceiling
}

export interface LineViolation {
  lineId: string;
  categoryId: string;
  appliedDiscount: number;
  allowedCeiling: number;
  violationPoints: number;                     // discountPct - ceiling (negative or 0 = compliant)
}

export interface RiskScoreResult {
  blendedScore: number;                        // 0–100
  lineViolations: LineViolation[];
  requiresApproval: boolean;
  requiredRoles: ('SALES_MANAGER' | 'FINANCE')[];
}

/**
 * Computes the blended discount risk score for a set of quotation lines.
 *
 * Algorithm details:
 * 1. For each line, effective ceiling = min(tierCeiling, categoryCeiling).
 * 2. Violation points = discountPct - effectiveCeiling.
 * 3. Violations > 0 are weighted by the line's share of the total order value.
 * 4. Worst single violation points are factored in to ensure a single severe violation flags the quote.
 * 5. Blended score = min(100, weightedViolationSum * 10 + worstSingleViolation * 3).
 *
 * Routing rules:
 * - Score = 0: No approval required (automatic approval / draft).
 * - Score 0.1 to 30.0: SALES_MANAGER approval required.
 * - Score > 30.0: Both SALES_MANAGER and FINANCE approval required.
 */
export function computeBlendedRiskScore(
  lines: LineRiskInput[],
  ceilings: CeilingMap,
  totalOrderValue: number,
): RiskScoreResult {
  if (!lines || lines.length === 0) {
    return {
      blendedScore: 0,
      lineViolations: [],
      requiresApproval: false,
      requiredRoles: [],
    };
  }

  const violations: LineViolation[] = [];
  let weightedViolationSum = 0;

  for (const line of lines) {
    const categoryCeiling = ceilings.categoryCeilings[line.categoryId] ?? ceilings.tierCeiling;
    // Effective ceiling is min of tier ceiling and category ceiling
    const effectiveCeiling = Math.min(ceilings.tierCeiling, categoryCeiling);
    const violationPoints = Math.round((line.discountPct - effectiveCeiling) * 100) / 100;

    violations.push({
      lineId: line.lineId,
      categoryId: line.categoryId,
      appliedDiscount: line.discountPct,
      allowedCeiling: effectiveCeiling,
      violationPoints,
    });

    if (violationPoints > 0) {
      const lineWeight = totalOrderValue > 0 ? Math.max(0, line.lineTotal) / totalOrderValue : (1 / lines.length);
      weightedViolationSum += violationPoints * lineWeight;
    }
  }

  const worstSingleViolation = violations.length > 0
    ? Math.max(0, ...violations.map((v) => Math.max(0, v.violationPoints)))
    : 0;

  // Blended score formulation (0-100)
  const rawScore = weightedViolationSum * 10 + worstSingleViolation * 3;
  const blendedScore = Math.min(100, Math.round(rawScore * 100) / 100);

  const requiresApproval = blendedScore > 0;
  const requiredRoles: ('SALES_MANAGER' | 'FINANCE')[] = [];

  if (blendedScore > 30) {
    requiredRoles.push('SALES_MANAGER', 'FINANCE');
  } else if (blendedScore > 0) {
    requiredRoles.push('SALES_MANAGER');
  }

  return {
    blendedScore,
    lineViolations: violations,
    requiresApproval,
    requiredRoles,
  };
}
