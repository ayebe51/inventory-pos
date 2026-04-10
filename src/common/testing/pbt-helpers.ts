/**
 * Shared fast-check arbitraries and helpers for property-based testing.
 * Import these in *.spec.ts files that use PBT.
 */
import * as fc from 'fast-check';

/** UUID v4 arbitrary */
export const arbUUID = fc.uuid();

/** Non-negative number with up to 4 decimal places (for costs, prices) */
export const arbNonNegativeAmount = fc
  .integer({ min: 0, max: 1_000_000_000 })
  .map((n) => Math.round(n) / 100);

/** Positive quantity (> 0, integer) */
export const arbPositiveQty = fc.integer({ min: 1, max: 100_000 });

/** Non-negative quantity (>= 0, integer) */
export const arbNonNegativeQty = fc.integer({ min: 0, max: 100_000 });

/** Positive cost per unit */
export const arbUnitCost = fc
  .integer({ min: 1, max: 100_000_000 })
  .map((n) => Math.round(n) / 100);

/**
 * Arbitrary for a valid journal line pair (debit + credit that balance).
 * Returns an array of two lines where SUM(debit) === SUM(credit).
 */
export const arbBalancedJournalLines = arbNonNegativeAmount.map((amount) => [
  { debit: amount, credit: 0 },
  { debit: 0, credit: amount },
]);

/**
 * Weighted Average Cost formula — mirrors BR-INV-003.
 * Returns newAverageCost rounded to 4 decimal places.
 */
export function calculateWAC(
  currentQty: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingCost: number,
): number {
  const totalQty = currentQty + incomingQty;
  if (totalQty === 0) return 0;
  const currentValue = currentQty * currentAvgCost;
  const totalValue = currentValue + incomingCost;
  return Math.round((totalValue / totalQty) * 10_000) / 10_000;
}

/**
 * Journal balance validator — mirrors BR-ACC-001.
 * Tolerance: <= 0.01
 */
export function isJournalBalanced(
  lines: Array<{ debit: number; credit: number }>,
): boolean {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(totalDebit - totalCredit) <= 0.01;
}
