/**
 * PeriodManager Service Tests
 *
 * Validates: Requirements 7.3, 7.5 (BR-ACC-001, BR-ACC-002, BR-ACC-007, BR-ACC-008)
 * Validates: Requirement 8, AC 9-11 (period closing checklist)
 *
 * Covers:
 *   - createPeriod: overlap validation, duplicate detection
 *   - openPeriod: DRAFT→OPEN, only one OPEN at a time
 *   - closePeriod: OPEN→CLOSED, BR-ACC-007 sequential order, full checklist
 *   - validatePeriodClosingChecklist: all 5 checklist items (pass and fail)
 *   - validatePeriodOpen: throws PERIOD_LOCKED for CLOSED periods
 *   - PBT: periods created in sequence can always be closed in order
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { PeriodManagerService } from './period-manager.service';
import { PrismaService } from '../../config/prisma.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';

// ── UUIDs ─────────────────────────────────────────────────────────────────────

const PERIOD_ID   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PERIOD_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_ID     = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// ── Factories ─────────────────────────────────────────────────────────────────

function makePeriod(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PERIOD_ID,
    period_name: 'Januari 2025',
    year: 2025,
    month: 1,
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-01-31'),
    status: 'DRAFT',
    closed_by: null,
    closed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockPrisma = {
  fiscalPeriod: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  bankReconciliation: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  invoice: {
    count: jest.fn(),
  },
  payment: {
    count: jest.fn(),
  },
  journalEntry: {
    findMany: jest.fn(),
  },
  stockOpname: {
    count: jest.fn(),
  },
};

// ── Checklist helpers ─────────────────────────────────────────────────────────

/** Sets up all checklist mocks to return "all clear" (checklist passes). */
function mockChecklistAllClear() {
  mockPrisma.invoice.count.mockResolvedValueOnce(0);
  mockPrisma.payment.count.mockResolvedValueOnce(0);
  mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
  mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
  mockPrisma.stockOpname.count.mockResolvedValueOnce(0);
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function expectBRE(
  promise: Promise<unknown>,
  expectedCode: ErrorCode,
  messageFragment?: string,
) {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(BusinessRuleException);
  const body = (caught as BusinessRuleException).getResponse() as Record<string, unknown>;
  const error = body.error as Record<string, unknown>;
  expect(error.code).toBe(expectedCode);
  if (messageFragment) {
    expect(String(error.message)).toContain(messageFragment);
  }
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('PeriodManagerService', () => {
  let service: PeriodManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodManagerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PeriodManagerService>(PeriodManagerService);
    jest.clearAllMocks();
  });

  // ── createPeriod ──────────────────────────────────────────────────────────

  describe('createPeriod()', () => {
    it('creates a period in DRAFT status', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(null);
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null);
      const created = makePeriod();
      mockPrisma.fiscalPeriod.create.mockResolvedValueOnce(created);

      const result = await service.createPeriod({
        period_name: 'Januari 2025',
        year: 2025,
        month: 1,
        start_date: new Date('2025-01-01'),
        end_date: new Date('2025-01-31'),
      });

      expect(result.status).toBe('DRAFT');
      expect(mockPrisma.fiscalPeriod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DRAFT', year: 2025, month: 1 }),
        }),
      );
    });

    it('throws CONFLICT when year/month already exists', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod());

      await expectBRE(
        service.createPeriod({
          period_name: 'Januari 2025 Duplikat',
          year: 2025,
          month: 1,
          start_date: new Date('2025-01-01'),
          end_date: new Date('2025-01-31'),
        }),
        ErrorCode.CONFLICT,
        '2025-01',
      );
    });

    it('throws CONFLICT when date range overlaps with existing period', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(null);
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(
        makePeriod({ period_name: 'Januari 2025' }),
      );

      await expectBRE(
        service.createPeriod({
          period_name: 'Overlap Period',
          year: 2025,
          month: 2,
          start_date: new Date('2025-01-15'),
          end_date: new Date('2025-02-15'),
        }),
        ErrorCode.CONFLICT,
        'overlaps',
      );
    });

    it('throws VALIDATION_ERROR when start_date >= end_date', async () => {
      await expectBRE(
        service.createPeriod({
          period_name: 'Bad Dates',
          year: 2025,
          month: 3,
          start_date: new Date('2025-03-31'),
          end_date: new Date('2025-03-01'),
        }),
        ErrorCode.VALIDATION_ERROR,
        'start_date',
      );
    });

    it('throws VALIDATION_ERROR for invalid month', async () => {
      await expectBRE(
        service.createPeriod({
          period_name: 'Bad Month',
          year: 2025,
          month: 13,
          start_date: new Date('2025-01-01'),
          end_date: new Date('2025-01-31'),
        }),
        ErrorCode.VALIDATION_ERROR,
        'Month',
      );
    });
  });

  // ── openPeriod ────────────────────────────────────────────────────────────

  describe('openPeriod()', () => {
    it('transitions DRAFT → OPEN', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'DRAFT' }));
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null); // no open period
      const opened = makePeriod({ status: 'OPEN' });
      mockPrisma.fiscalPeriod.update.mockResolvedValueOnce(opened);

      const result = await service.openPeriod(PERIOD_ID);
      expect(result.status).toBe('OPEN');
      expect(mockPrisma.fiscalPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'OPEN' } }),
      );
    });

    it('throws BUSINESS_RULE_VIOLATION when period is not DRAFT', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));

      await expectBRE(
        service.openPeriod(PERIOD_ID),
        ErrorCode.BUSINESS_RULE_VIOLATION,
        'OPEN',
      );
    });

    it('throws BUSINESS_RULE_VIOLATION when another period is already OPEN', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'DRAFT' }));
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(
        makePeriod({ id: PERIOD_ID_2, period_name: 'Februari 2025', status: 'OPEN' }),
      );

      await expectBRE(
        service.openPeriod(PERIOD_ID),
        ErrorCode.BUSINESS_RULE_VIOLATION,
        'already OPEN',
      );
    });

    it('throws NOT_FOUND when period does not exist', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(null);

      await expectBRE(service.openPeriod(PERIOD_ID), ErrorCode.NOT_FOUND);
    });
  });

  // ── closePeriod ───────────────────────────────────────────────────────────

  describe('closePeriod()', () => {
    it('transitions OPEN → CLOSED and records closed_by/closed_at', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null); // no earlier unclosed
      // checklist: findUnique called again inside validatePeriodClosingChecklist
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockChecklistAllClear();
      const closed = makePeriod({ status: 'CLOSED', closed_by: USER_ID, closed_at: new Date() });
      mockPrisma.fiscalPeriod.update.mockResolvedValueOnce(closed);

      const result = await service.closePeriod(PERIOD_ID, USER_ID);
      expect(result.status).toBe('CLOSED');
      expect(result.closed_by).toBe(USER_ID);
      expect(mockPrisma.fiscalPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CLOSED',
            closed_by: USER_ID,
          }),
        }),
      );
    });

    it('throws BUSINESS_RULE_VIOLATION when period is not OPEN', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'DRAFT' }));

      await expectBRE(
        service.closePeriod(PERIOD_ID, USER_ID),
        ErrorCode.BUSINESS_RULE_VIOLATION,
        'DRAFT',
      );
    });

    it('throws BUSINESS_RULE_VIOLATION (BR-ACC-007) when an earlier period is not CLOSED', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(
        makePeriod({ status: 'OPEN', year: 2025, month: 3, period_name: 'Maret 2025' }),
      );
      // Earlier period (Feb 2025) is still OPEN
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(
        makePeriod({ id: PERIOD_ID_2, period_name: 'Februari 2025', year: 2025, month: 2, status: 'OPEN' }),
      );

      await expectBRE(
        service.closePeriod(PERIOD_ID, USER_ID),
        ErrorCode.BUSINESS_RULE_VIOLATION,
        'BR-ACC-007',
      );
    });

    it('throws BUSINESS_RULE_VIOLATION when checklist has open invoices', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null); // no earlier unclosed
      // checklist findUnique
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      // checklist: 2 open invoices
      mockPrisma.invoice.count.mockResolvedValueOnce(2);
      mockPrisma.payment.count.mockResolvedValueOnce(0);
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(0);

      await expectBRE(
        service.closePeriod(PERIOD_ID, USER_ID),
        ErrorCode.BUSINESS_RULE_VIOLATION,
        'checklist items are incomplete',
      );
    });

    it('throws BUSINESS_RULE_VIOLATION (BR-ACC-008) when bank reconciliation is incomplete', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null); // no earlier unclosed
      // checklist findUnique
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      // checklist: incomplete bank reconciliation
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.payment.count.mockResolvedValueOnce(0);
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(1);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(0);

      await expectBRE(
        service.closePeriod(PERIOD_ID, USER_ID),
        ErrorCode.BUSINESS_RULE_VIOLATION,
        'incomplete',
      );
    });

    it('throws NOT_FOUND when period does not exist', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(null);

      await expectBRE(service.closePeriod(PERIOD_ID, USER_ID), ErrorCode.NOT_FOUND);
    });
  });

  // ── validatePeriodClosingChecklist ────────────────────────────────────────

  describe('validatePeriodClosingChecklist()', () => {
    it('returns canClose=true when all 5 checklist items pass', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockChecklistAllClear();

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.canClose).toBe(true);
      expect(result.failedItems).toHaveLength(0);
      expect(result.items.noOpenInvoices.passed).toBe(true);
      expect(result.items.noPendingPayments.passed).toBe(true);
      expect(result.items.noUnbalancedJournals.passed).toBe(true);
      expect(result.items.bankReconciliationComplete.passed).toBe(true);
      expect(result.items.noIncompleteOpnames.passed).toBe(true);
    });

    it('fails when there are open invoices (OPEN/PARTIAL/OVERDUE)', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.invoice.count.mockResolvedValueOnce(3);
      mockPrisma.payment.count.mockResolvedValueOnce(0);
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(0);

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.canClose).toBe(false);
      expect(result.items.noOpenInvoices.passed).toBe(false);
      expect(result.items.noOpenInvoices.count).toBe(3);
      expect(result.failedItems).toHaveLength(1);
      expect(result.failedItems[0]).toContain('3 open invoice');
    });

    it('fails when there are pending payments (DRAFT/PENDING_APPROVAL/APPROVED)', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.payment.count.mockResolvedValueOnce(2);
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(0);

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.canClose).toBe(false);
      expect(result.items.noPendingPayments.passed).toBe(false);
      expect(result.items.noPendingPayments.count).toBe(2);
      expect(result.failedItems[0]).toContain('2 pending payment');
    });

    it('fails when there are unbalanced journal entries (|debit - credit| > 0.01)', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.payment.count.mockResolvedValueOnce(0);
      // One balanced, one unbalanced
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([
        { id: 'je-1', je_number: 'JE-202501-00001', total_debit: 1000, total_credit: 1000 },
        { id: 'je-2', je_number: 'JE-202501-00002', total_debit: 500, total_credit: 450 },
      ]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(0);

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.canClose).toBe(false);
      expect(result.items.noUnbalancedJournals.passed).toBe(false);
      expect(result.items.noUnbalancedJournals.count).toBe(1);
      expect(result.failedItems[0]).toContain('1 unbalanced');
    });

    it('passes journal check when difference is within tolerance (<=0.01)', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.payment.count.mockResolvedValueOnce(0);
      // Difference of exactly 0.01 — should pass
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([
        { id: 'je-1', je_number: 'JE-202501-00001', total_debit: 1000.01, total_credit: 1000.00 },
      ]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(0);

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.items.noUnbalancedJournals.passed).toBe(true);
    });

    it('fails when bank reconciliation is incomplete (BR-ACC-008)', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.payment.count.mockResolvedValueOnce(0);
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(2);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(0);

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.canClose).toBe(false);
      expect(result.items.bankReconciliationComplete.passed).toBe(false);
      expect(result.items.bankReconciliationComplete.count).toBe(2);
      expect(result.failedItems[0]).toContain('2 incomplete bank reconciliation');
    });

    it('fails when there are incomplete stock opnames (INITIATED/IN_PROGRESS)', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.invoice.count.mockResolvedValueOnce(0);
      mockPrisma.payment.count.mockResolvedValueOnce(0);
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(1);

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.canClose).toBe(false);
      expect(result.items.noIncompleteOpnames.passed).toBe(false);
      expect(result.items.noIncompleteOpnames.count).toBe(1);
      expect(result.failedItems[0]).toContain('1 incomplete stock opname');
    });

    it('reports all failed items when multiple checklist items fail', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      mockPrisma.invoice.count.mockResolvedValueOnce(1);
      mockPrisma.payment.count.mockResolvedValueOnce(1);
      mockPrisma.journalEntry.findMany.mockResolvedValueOnce([
        { id: 'je-1', je_number: 'JE-202501-00001', total_debit: 100, total_credit: 50 },
      ]);
      mockPrisma.bankReconciliation.count.mockResolvedValueOnce(1);
      mockPrisma.stockOpname.count.mockResolvedValueOnce(1);

      const result = await service.validatePeriodClosingChecklist(PERIOD_ID);

      expect(result.canClose).toBe(false);
      expect(result.failedItems).toHaveLength(5);
    });

    it('throws NOT_FOUND when period does not exist', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(null);

      await expectBRE(
        service.validatePeriodClosingChecklist(PERIOD_ID),
        ErrorCode.NOT_FOUND,
      );
    });
  });

  // ── getCurrentPeriod ──────────────────────────────────────────────────────

  describe('getCurrentPeriod()', () => {
    it('returns the currently OPEN period', async () => {
      const openPeriod = makePeriod({ status: 'OPEN' });
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(openPeriod);

      const result = await service.getCurrentPeriod();
      expect(result.status).toBe('OPEN');
    });

    it('throws NOT_FOUND when no period is OPEN', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null);

      await expectBRE(service.getCurrentPeriod(), ErrorCode.NOT_FOUND, 'No fiscal period');
    });
  });

  // ── getPeriodForDate ──────────────────────────────────────────────────────

  describe('getPeriodForDate()', () => {
    it('returns the period that contains the given date', async () => {
      const period = makePeriod({ status: 'OPEN' });
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(period);

      const result = await service.getPeriodForDate(new Date('2025-01-15'));
      expect(result.period_name).toBe('Januari 2025');
    });

    it('throws NOT_FOUND when no period covers the date', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null);

      await expectBRE(
        service.getPeriodForDate(new Date('2020-01-01')),
        ErrorCode.NOT_FOUND,
        '2020-01-01',
      );
    });
  });

  // ── validatePeriodOpen ────────────────────────────────────────────────────

  describe('validatePeriodOpen()', () => {
    it('does not throw when period is OPEN', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'OPEN' }));
      await expect(service.validatePeriodOpen(PERIOD_ID)).resolves.toBeUndefined();
    });

    it('does not throw when period is DRAFT', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(makePeriod({ status: 'DRAFT' }));
      await expect(service.validatePeriodOpen(PERIOD_ID)).resolves.toBeUndefined();
    });

    it('throws PERIOD_LOCKED when period is CLOSED (BR-ACC-002)', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(
        makePeriod({ status: 'CLOSED', period_name: 'Januari 2025' }),
      );

      let caught: unknown;
      try {
        await service.validatePeriodOpen(PERIOD_ID);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(BusinessRuleException);
      const body = (caught as BusinessRuleException).getResponse() as Record<string, unknown>;
      const error = body.error as Record<string, unknown>;
      expect(error.code).toBe(ErrorCode.PERIOD_LOCKED);
      expect(String(error.message)).toContain('BR-ACC-002');
      expect(String(error.message)).toContain('Januari 2025');
    });

    it('throws NOT_FOUND when period does not exist', async () => {
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(null);
      await expectBRE(service.validatePeriodOpen(PERIOD_ID), ErrorCode.NOT_FOUND);
    });
  });

  // ── Property-Based Test ───────────────────────────────────────────────────
  // Validates: Requirements 7.3 (BR-ACC-007)
  //
  // Property: Given N periods created in sequential calendar order (month 1..N),
  // closing them in that same order should always succeed (no BR-ACC-007 violation).
  // Closing out of order should always fail.

  describe('PBT: sequential period closing (BR-ACC-007)', () => {
    it(
      'PBT: closing periods in sequential order always succeeds; out-of-order always fails',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate 2–6 months in a year
            fc.integer({ min: 2, max: 6 }),
            async (numPeriods) => {
              // Build a list of periods for months 1..numPeriods
              const periods = Array.from({ length: numPeriods }, (_, i) => ({
                id: `period-${i + 1}`,
                period_name: `Month ${i + 1}`,
                year: 2025,
                month: i + 1,
                start_date: new Date(`2025-${String(i + 1).padStart(2, '0')}-01`),
                end_date: new Date(`2025-${String(i + 1).padStart(2, '0')}-28`),
                status: 'OPEN' as const,
                closed_by: null,
                closed_at: null,
                created_at: new Date(),
                updated_at: new Date(),
              }));

              // Simulate closing in sequential order: each call should succeed
              for (let i = 0; i < periods.length; i++) {
                const current = periods[i];

                // findUnique returns the current period
                mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(current);
                // findFirst for earlier unclosed: all previous are already CLOSED → return null
                mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(null);
                // checklist: findUnique called inside validatePeriodClosingChecklist
                mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(current);
                // checklist: all clear
                mockPrisma.invoice.count.mockResolvedValueOnce(0);
                mockPrisma.payment.count.mockResolvedValueOnce(0);
                mockPrisma.journalEntry.findMany.mockResolvedValueOnce([]);
                mockPrisma.bankReconciliation.count.mockResolvedValueOnce(0);
                mockPrisma.stockOpname.count.mockResolvedValueOnce(0);
                // update succeeds
                mockPrisma.fiscalPeriod.update.mockResolvedValueOnce({
                  ...current,
                  status: 'CLOSED',
                  closed_by: USER_ID,
                  closed_at: new Date(),
                });

                const result = await service.closePeriod(current.id, USER_ID);
                // Must succeed and return CLOSED
                if (result.status !== 'CLOSED') return false;
              }

              // Simulate closing out of order: closing month 2 when month 1 is still OPEN
              if (numPeriods >= 2) {
                const laterPeriod = periods[1]; // month 2
                const earlierUnclosed = periods[0]; // month 1 still OPEN

                mockPrisma.fiscalPeriod.findUnique.mockResolvedValueOnce(laterPeriod);
                mockPrisma.fiscalPeriod.findFirst.mockResolvedValueOnce(earlierUnclosed);

                let threw = false;
                try {
                  await service.closePeriod(laterPeriod.id, USER_ID);
                } catch (err) {
                  threw = true;
                  const body = (err as BusinessRuleException).getResponse() as Record<string, unknown>;
                  const error = body.error as Record<string, unknown>;
                  if (error.code !== ErrorCode.BUSINESS_RULE_VIOLATION) return false;
                  if (!String(error.message).includes('BR-ACC-007')) return false;
                }
                if (!threw) return false;
              }

              return true;
            },
          ),
          { numRuns: 100 },
        );
      },
    );
  });
});
