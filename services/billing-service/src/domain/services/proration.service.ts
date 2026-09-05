/**
 * Proration calculation logic
 *
 * Implements REQ-F-132, REQ-BR-011
 */

export interface ProrationInput {
  subscriptionLineId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  changeDate: Date;
  oldQuantity: number;
  newQuantity: number;
  unitPrice: number;
  prorationMode?: 'DAILY' | 'NONE';
}

export interface ProrationResult {
  creditAmount: number; // credit for unused portion at old quantity
  chargeAmount: number; // charge for remaining period at new quantity
  netAmount: number;    // chargeAmount - creditAmount (negative = credit/refund)
  creditNote: boolean;   // true if net amount is negative
}

export function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function computeProration(input: ProrationInput): ProrationResult {
  if (input.prorationMode === 'NONE') {
    return {
      creditAmount: 0,
      chargeAmount: 0,
      netAmount: 0,
      creditNote: false,
    };
  }

  const periodDays = daysBetween(input.currentPeriodStart, input.currentPeriodEnd);
  const remainingDays = Math.max(
    0,
    Math.round((input.currentPeriodEnd.getTime() - input.changeDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const dailyRate = input.unitPrice / periodDays;

  const creditAmount = Math.round(dailyRate * remainingDays * input.oldQuantity * 100) / 100;
  const chargeAmount = Math.round(dailyRate * remainingDays * input.newQuantity * 100) / 100;
  const netAmount = Math.round((chargeAmount - creditAmount) * 100) / 100;

  return {
    creditAmount,
    chargeAmount,
    netAmount,
    creditNote: netAmount < 0,
  };
}
