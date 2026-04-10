/**
 * Property-based tests validating core business rule invariants.
 * These serve as a smoke-test for the fast-check + Jest setup (Task 1.6)
 * and as living documentation of correctness properties used throughout the system.
 */
import * as fc from 'fast-check';
import {
  arbNonNegativeAmount,
  arbNonNegativeQty,
  arbPositiveQty,
  arbUnitCost,
  calculateWAC,
  isJournalBalanced,
} from './pbt-helpers';

describe('PBT Setup — core invariants', () => {
  // ─── BR-INV-003: WAC is always >= 0 ───────────────────────────────────────
  describe('calculateWAC', () => {
    it('WAC >= 0 for all valid (qty, cost) combinations', () => {
      fc.assert(
        fc.property(
          arbNonNegativeQty,
          arbNonNegativeAmount,
          arbPositiveQty,
          arbUnitCost,
          (currentQty, currentAvgCost, incomingQty, incomingUnitCost) => {
            const incomingCost = incomingQty * incomingUnitCost;
            const wac = calculateWAC(currentQty, currentAvgCost, incomingQty, incomingCost);
            return wac >= 0;
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('WAC = 0 when both current and incoming qty are 0', () => {
      expect(calculateWAC(0, 0, 0, 0)).toBe(0);
    });

    it('WAC equals incoming unit cost when current stock is 0', () => {
      fc.assert(
        fc.property(arbPositiveQty, arbUnitCost, (qty, unitCost) => {
          const wac = calculateWAC(0, 0, qty, qty * unitCost);
          return Math.abs(wac - unitCost) < 0.001;
        }),
        { numRuns: 500 },
      );
    });

    it('WAC is rounded to 4 decimal places', () => {
      fc.assert(
        fc.property(
          arbNonNegativeQty,
          arbNonNegativeAmount,
          arbPositiveQty,
          arbUnitCost,
          (currentQty, currentAvgCost, incomingQty, incomingUnitCost) => {
            const wac = calculateWAC(
              currentQty,
              currentAvgCost,
              incomingQty,
              incomingQty * incomingUnitCost,
            );
            const rounded = Math.round(wac * 10_000) / 10_000;
            return wac === rounded;
          },
        ),
        { numRuns: 500 },
      );
    });
  });

  // ─── BR-ACC-001: Journal balance invariant ────────────────────────────────
  describe('isJournalBalanced', () => {
    it('balanced lines always pass (debit === credit)', () => {
      fc.assert(
        fc.property(arbNonNegativeAmount, (amount) => {
          const lines = [
            { debit: amount, credit: 0 },
            { debit: 0, credit: amount },
          ];
          return isJournalBalanced(lines);
        }),
        { numRuns: 1000 },
      );
    });

    it('unbalanced lines with difference > 0.01 always fail', () => {
      fc.assert(
        fc.property(
          arbNonNegativeAmount,
          fc.integer({ min: 2, max: 10_000 }).map((n) => n / 100), // diff > 0.01
          (amount, diff) => {
            const lines = [
              { debit: amount + diff, credit: 0 },
              { debit: 0, credit: amount },
            ];
            return !isJournalBalanced(lines);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('multi-line journal balances when total debit === total credit', () => {
      fc.assert(
        fc.property(
          fc.array(arbNonNegativeAmount, { minLength: 2, maxLength: 10 }),
          (amounts) => {
            const total = amounts.reduce((s, a) => s + a, 0);
            const lines = [
              ...amounts.map((a) => ({ debit: a, credit: 0 })),
              { debit: 0, credit: total },
            ];
            return isJournalBalanced(lines);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});
