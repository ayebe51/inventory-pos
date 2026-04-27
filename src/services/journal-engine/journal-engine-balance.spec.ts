import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { JournalEngineService } from './journal-engine.service';
import { PrismaService } from '../../config/prisma.service';
import { NumberingService } from '../numbering/numbering.service';
import { PeriodManagerService } from '../period-manager/period-manager.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { JournalLine } from '../../modules/accounting/interfaces/accounting.interfaces';

describe('JournalEngineService.validateJournalBalance (BR-ACC-001)', () => {
  let service: JournalEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalEngineService,
        { provide: PrismaService, useValue: {} },
        { provide: NumberingService, useValue: {} },
        { provide: PeriodManagerService, useValue: { validatePeriodOpen: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<JournalEngineService>(JournalEngineService);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('should return isValid=true for a perfectly balanced entry', () => {
    const lines: JournalLine[] = [
      { account_id: 'acc-1', debit: 1000, credit: 0 },
      { account_id: 'acc-2', debit: 0, credit: 1000 },
    ];
    const result = service.validateJournalBalance(lines);
    expect(result.isValid).toBe(true);
    expect(result.totalDebit).toBe(1000);
    expect(result.totalCredit).toBe(1000);
    expect(result.difference).toBe(0);
  });

  it('should return isValid=true when difference is exactly 0.01 (rounding tolerance)', () => {
    const lines: JournalLine[] = [
      { account_id: 'acc-1', debit: 1000.01, credit: 0 },
      { account_id: 'acc-2', debit: 0, credit: 1000.00 },
    ];
    const result = service.validateJournalBalance(lines);
    expect(result.isValid).toBe(true);
    expect(result.difference).toBeCloseTo(0.01, 5);
  });

  it('should handle multi-line balanced entries', () => {
    const lines: JournalLine[] = [
      { account_id: 'acc-1', debit: 500, credit: 0 },
      { account_id: 'acc-2', debit: 300, credit: 0 },
      { account_id: 'acc-3', debit: 200, credit: 0 },
      { account_id: 'acc-4', debit: 0, credit: 1000 },
    ];
    const result = service.validateJournalBalance(lines);
    expect(result.isValid).toBe(true);
    expect(result.totalDebit).toBe(1000);
    expect(result.totalCredit).toBe(1000);
  });

  // ── Failure cases ────────────────────────────────────────────────────────────

  const getErrorCode = (e: unknown): string =>
    (e as BusinessRuleException).getResponse()?.['error']?.code;

  it('should throw BUSINESS_RULE_VIOLATION when difference > 0.01', () => {
    const lines: JournalLine[] = [
      { account_id: 'acc-1', debit: 1000.02, credit: 0 },
      { account_id: 'acc-2', debit: 0, credit: 1000.00 },
    ];
    expect(() => service.validateJournalBalance(lines)).toThrow(BusinessRuleException);
    try {
      service.validateJournalBalance(lines);
    } catch (e) {
      expect(getErrorCode(e)).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
    }
  });

  it('should throw VALIDATION_ERROR when fewer than 2 lines', () => {
    const lines: JournalLine[] = [
      { account_id: 'acc-1', debit: 1000, credit: 0 },
    ];
    expect(() => service.validateJournalBalance(lines)).toThrow(BusinessRuleException);
    try {
      service.validateJournalBalance(lines);
    } catch (e) {
      expect(getErrorCode(e)).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it('should throw VALIDATION_ERROR when lines array is empty', () => {
    expect(() => service.validateJournalBalance([])).toThrow(BusinessRuleException);
    try {
      service.validateJournalBalance([]);
    } catch (e) {
      expect(getErrorCode(e)).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it('should throw VALIDATION_ERROR when a line has both debit and credit > 0', () => {
    const lines: JournalLine[] = [
      { account_id: 'acc-1', debit: 500, credit: 500 },
      { account_id: 'acc-2', debit: 0, credit: 0 },
    ];
    expect(() => service.validateJournalBalance(lines)).toThrow(BusinessRuleException);
    try {
      service.validateJournalBalance(lines);
    } catch (e) {
      expect(getErrorCode(e)).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  it('should throw VALIDATION_ERROR when a line has negative debit', () => {
    const lines: JournalLine[] = [
      { account_id: 'acc-1', debit: -100, credit: 0 },
      { account_id: 'acc-2', debit: 0, credit: -100 },
    ];
    expect(() => service.validateJournalBalance(lines)).toThrow(BusinessRuleException);
    try {
      service.validateJournalBalance(lines);
    } catch (e) {
      expect(getErrorCode(e)).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });

  // ── Property-based tests ─────────────────────────────────────────────────────

  it('PBT: balanced entries always pass validation', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true }),
        fc.array(fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), { minLength: 1, maxLength: 5 }),
        (total, weights) => {
          const sum = weights.reduce((a, b) => a + b, 0) || 1;
          const debitLines: JournalLine[] = weights.map((w, i) => ({
            account_id: `debit-${i}`,
            debit: Math.round((w / sum) * total * 100) / 100,
            credit: 0,
          }));
          // Adjust last line to ensure exact balance
          const debitTotal = debitLines.reduce((s, l) => s + l.debit, 0);
          const creditLines: JournalLine[] = [
            { account_id: 'credit-0', debit: 0, credit: debitTotal },
          ];
          const lines = [...debitLines, ...creditLines];
          const result = service.validateJournalBalance(lines);
          return result.isValid === true && result.difference <= 0.01;
        },
      ),
    );
  });

  it('PBT: unbalanced entries (difference > 0.01) always throw', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.02), max: Math.fround(1_000_000), noNaN: true }),
        fc.float({ min: Math.fround(0.02), max: Math.fround(1_000_000), noNaN: true }),
        (debitAmt, creditAmt) => {
          // Ensure difference is strictly > 0.01
          fc.pre(Math.abs(debitAmt - creditAmt) > 0.01);
          const lines: JournalLine[] = [
            { account_id: 'acc-1', debit: debitAmt, credit: 0 },
            { account_id: 'acc-2', debit: 0, credit: creditAmt },
          ];
          let threw = false;
          try {
            service.validateJournalBalance(lines);
          } catch (e) {
            threw = true;
          }
          return threw;
        },
      ),
    );
  });

  it('PBT: validateBalance and validateJournalBalance agree on valid entries', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(1_000_000), noNaN: true }),
        (amount) => {
          const lines: JournalLine[] = [
            { account_id: 'acc-1', debit: amount, credit: 0 },
            { account_id: 'acc-2', debit: 0, credit: amount },
          ];
          const legacyResult = service.validateBalance(lines);
          const detailedResult = service.validateJournalBalance(lines);
          return legacyResult === detailedResult.isValid;
        },
      ),
    );
  });
});
