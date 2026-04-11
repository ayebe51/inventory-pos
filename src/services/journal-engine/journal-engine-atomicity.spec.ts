/**
 * Journal Engine Atomicity Tests (Task 6.3)
 *
 * Validates the requirement:
 *   "Transaksi bisnis + auto journal HARUS dalam satu DB transaction;
 *    rollback keduanya jika gagal" (BR-ACC-001 + atomicity constraint)
 *
 * These tests verify that:
 * 1. When the business operation succeeds, the journal entry IS written.
 * 2. When the business operation fails, the journal entry is NOT written
 *    (transaction rollback).
 * 3. When the journal write fails, the business operation is also rolled back.
 * 4. processEvent() uses the provided tx client, not the global prisma.
 * 5. withJournal() helper correctly wraps both operations in one transaction.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { JournalEngineService } from './journal-engine.service';
import { PrismaService } from '../../config/prisma.service';
import { NumberingService, DocumentType } from '../numbering/numbering.service';
import { withJournal } from './with-journal.helper';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { BusinessEvent, JournalEntry } from '../../modules/accounting/interfaces/accounting.interfaces';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildBusinessEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    event_type: 'POS_SALE',
    reference_type: 'POS_TRANSACTION',
    reference_id: 'pos-uuid-1',
    reference_number: 'POS-20260411-00001',
    entry_date: new Date('2026-04-11T10:00:00Z'),
    period_id: 'period-uuid-1',
    amount: 100_000,
    created_by: 'user-uuid-1',
    ...overrides,
  };
}

function buildJournalEntryRow(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'je-uuid-1',
    je_number: 'JE-202604-00001',
    entry_date: new Date('2026-04-11T10:00:00Z'),
    period_id: 'period-uuid-1',
    reference_type: 'POS_TRANSACTION',
    reference_id: 'pos-uuid-1',
    reference_number: 'POS-20260411-00001',
    description: 'Auto journal: POS_SALE - POS-20260411-00001',
    total_debit: 100_000,
    total_credit: 100_000,
    status: 'POSTED',
    is_auto_generated: true,
    reversed_by: null,
    reversed_at: null,
    posted_by: 'user-uuid-1',
    posted_at: new Date('2026-04-11T10:00:00Z'),
    created_by: 'user-uuid-1',
    created_at: new Date('2026-04-11T10:00:00Z'),
    updated_at: new Date('2026-04-11T10:00:00Z'),
    ...overrides,
  };
}

function buildPrismaJeRow() {
  return {
    id: 'je-uuid-1',
    je_number: 'JE-202604-00001',
    entry_date: new Date('2026-04-11T10:00:00Z'),
    period_id: 'period-uuid-1',
    reference_type: 'POS_TRANSACTION',
    reference_id: 'pos-uuid-1',
    reference_number: 'POS-20260411-00001',
    description: 'Auto journal: POS_SALE - POS-20260411-00001',
    total_debit: 100_000,
    total_credit: 100_000,
    status: 'POSTED',
    is_auto_generated: true,
    reversed_by: null,
    reversed_at: null,
    posted_by: 'user-uuid-1',
    posted_at: new Date('2026-04-11T10:00:00Z'),
    created_by: 'user-uuid-1',
    created_at: new Date('2026-04-11T10:00:00Z'),
    updated_at: new Date('2026-04-11T10:00:00Z'),
    lines: [],
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockJeCreate = jest.fn();
const mockFiscalPeriodFindUnique = jest.fn();
const mockTemplateFindUnique = jest.fn();

const mockPrisma = {
  journalEntry: { create: mockJeCreate },
  fiscalPeriod: { findUnique: mockFiscalPeriodFindUnique },
  autoJournalTemplate: { findUnique: mockTemplateFindUnique },
  $transaction: jest.fn(),
} as unknown as PrismaService;

const mockNumbering = {
  generate: jest.fn().mockResolvedValue('JE-202604-00001'),
} as unknown as NumberingService;

// Default happy-path stubs
function setupHappyPathMocks(txOverrides: Partial<{
  fiscalPeriod: unknown;
  template: unknown;
  jeCreate: unknown;
}> = {}) {
  mockFiscalPeriodFindUnique.mockResolvedValue(
    txOverrides.fiscalPeriod ?? { id: 'period-uuid-1', status: 'OPEN' },
  );
  mockTemplateFindUnique.mockResolvedValue(
    txOverrides.template ?? {
      event_type: 'POS_SALE',
      is_active: true,
      debit_account_id: 'acc-cash',
      credit_account_id: 'acc-revenue',
      description: 'POS Sale',
    },
  );
  mockJeCreate.mockResolvedValue(
    txOverrides.jeCreate ?? buildPrismaJeRow(),
  );
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('JournalEngineService — atomicity (Task 6.3)', () => {
  let service: JournalEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).compile();

    service = module.get<JournalEngineService>(JournalEngineService);
  });

  // ── processEvent() uses tx client when provided ────────────────────────────

  describe('processEvent() with transaction client', () => {
    it('uses the provided tx client instead of the global prisma', async () => {
      const txJeCreate = jest.fn().mockResolvedValue(buildPrismaJeRow());
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'POS_SALE',
        is_active: true,
        debit_account_id: 'acc-cash',
        credit_account_id: 'acc-revenue',
        description: 'POS Sale',
      });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      const event = buildBusinessEvent();
      await service.processEvent(event, tx);

      // Must use tx client, NOT the global prisma mock
      expect(txJeCreate).toHaveBeenCalledTimes(1);
      expect(mockJeCreate).not.toHaveBeenCalled();
    });

    it('falls back to internal transaction when tx is not provided', async () => {
      setupHappyPathMocks();

      // Simulate prisma.$transaction executing the callback
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
          cb({
            journalEntry: { create: mockJeCreate },
            fiscalPeriod: { findUnique: mockFiscalPeriodFindUnique },
            autoJournalTemplate: { findUnique: mockTemplateFindUnique },
          } as unknown as Prisma.TransactionClient),
      );

      const event = buildBusinessEvent();
      const result = await service.processEvent(event);

      expect(result).toHaveLength(1);
      expect(result[0].je_number).toBe('JE-202604-00001');
      expect(mockJeCreate).toHaveBeenCalledTimes(1);
    });

    it('passes correct journal entry data to the tx client', async () => {
      const txJeCreate = jest.fn().mockResolvedValue(buildPrismaJeRow());
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'POS_SALE',
        is_active: true,
        debit_account_id: 'acc-cash',
        credit_account_id: 'acc-revenue',
        description: 'POS Sale',
      });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      const event = buildBusinessEvent({ amount: 250_000 });
      await service.processEvent(event, tx);

      expect(txJeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            je_number: 'JE-202604-00001',
            period_id: 'period-uuid-1',
            reference_type: 'POS_TRANSACTION',
            reference_id: 'pos-uuid-1',
            status: 'POSTED',
            is_auto_generated: true,
          }),
        }),
      );
    });

    it('throws PERIOD_LOCKED when fiscal period is CLOSED', async () => {
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'CLOSED' });
      const tx = {
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: jest.fn() },
        journalEntry: { create: jest.fn() },
      } as unknown as Prisma.TransactionClient;

      const event = buildBusinessEvent();

      await expect(service.processEvent(event, tx)).rejects.toThrow(BusinessRuleException);

      try {
        await service.processEvent(event, tx);
      } catch (e) {
        const response = (e as BusinessRuleException).getResponse() as Record<string, unknown>;
        expect((response['error'] as Record<string, unknown>)['code']).toBe(ErrorCode.PERIOD_LOCKED);
      }
    });

    it('throws NOT_FOUND when journal template is missing', async () => {
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue(null);
      const tx = {
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
        journalEntry: { create: jest.fn() },
      } as unknown as Prisma.TransactionClient;

      const event = buildBusinessEvent();

      await expect(service.processEvent(event, tx)).rejects.toThrow(BusinessRuleException);

      try {
        await service.processEvent(event, tx);
      } catch (e) {
        const response = (e as BusinessRuleException).getResponse() as Record<string, unknown>;
        expect((response['error'] as Record<string, unknown>)['code']).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws NOT_FOUND when journal template is inactive', async () => {
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'POS_SALE',
        is_active: false,
        debit_account_id: 'acc-cash',
        credit_account_id: 'acc-revenue',
      });
      const tx = {
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
        journalEntry: { create: jest.fn() },
      } as unknown as Prisma.TransactionClient;

      const event = buildBusinessEvent();
      await expect(service.processEvent(event, tx)).rejects.toThrow(BusinessRuleException);
    });
  });

  // ── withJournal() helper — atomicity behaviour ─────────────────────────────

  describe('withJournal() helper', () => {
    it('commits both business operation and journal entry when operation succeeds', async () => {
      const txJeCreate = jest.fn().mockResolvedValue(buildPrismaJeRow());
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'POS_SALE',
        is_active: true,
        debit_account_id: 'acc-cash',
        credit_account_id: 'acc-revenue',
        description: 'POS Sale',
      });
      const txPosUpdate = jest.fn().mockResolvedValue({ id: 'pos-uuid-1', status: 'COMPLETED' });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
        posTransaction: { update: txPosUpdate },
      } as unknown as Prisma.TransactionClient;

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );

      const event = buildBusinessEvent();
      const [result, journalEntries] = await withJournal(
        mockPrisma,
        service,
        event,
        async (tx) => tx.posTransaction.update({ where: { id: 'pos-uuid-1' }, data: { status: 'COMPLETED' } }),
      );

      expect(txPosUpdate).toHaveBeenCalledTimes(1);
      expect(txJeCreate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 'pos-uuid-1', status: 'COMPLETED' });
      expect(journalEntries).toHaveLength(1);
      expect(journalEntries[0].je_number).toBe('JE-202604-00001');
    });

    it('does NOT write journal entry when business operation throws (rollback)', async () => {
      const txJeCreate = jest.fn();
      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: jest.fn() },
        autoJournalTemplate: { findUnique: jest.fn() },
      } as unknown as Prisma.TransactionClient;

      // Simulate $transaction propagating the error (rollback)
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
          await cb(tx).catch((err) => { throw err; });
        },
      );

      const failingOperation = jest.fn().mockRejectedValue(
        new Error('Insufficient stock'),
      );

      await expect(
        withJournal(mockPrisma, service, buildBusinessEvent(), failingOperation),
      ).rejects.toThrow('Insufficient stock');

      // Journal entry must NOT have been written
      expect(txJeCreate).not.toHaveBeenCalled();
    });

    it('rolls back business operation when journal write throws', async () => {
      const txJeCreate = jest.fn().mockRejectedValue(new Error('DB write failed'));
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'POS_SALE',
        is_active: true,
        debit_account_id: 'acc-cash',
        credit_account_id: 'acc-revenue',
        description: 'POS Sale',
      });
      const txPosUpdate = jest.fn().mockResolvedValue({ id: 'pos-uuid-1' });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
        posTransaction: { update: txPosUpdate },
      } as unknown as Prisma.TransactionClient;

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );

      await expect(
        withJournal(
          mockPrisma,
          service,
          buildBusinessEvent(),
          async (tx) => tx.posTransaction.update({ where: { id: 'pos-uuid-1' }, data: {} }),
        ),
      ).rejects.toThrow('DB write failed');

      // Business operation was called but the whole tx is rolled back
      expect(txPosUpdate).toHaveBeenCalledTimes(1);
    });

    it('rolls back both when fiscal period is CLOSED inside transaction', async () => {
      const txJeCreate = jest.fn();
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'CLOSED' });
      const txPosUpdate = jest.fn().mockResolvedValue({ id: 'pos-uuid-1' });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: jest.fn() },
        posTransaction: { update: txPosUpdate },
      } as unknown as Prisma.TransactionClient;

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );

      await expect(
        withJournal(
          mockPrisma,
          service,
          buildBusinessEvent(),
          async (tx) => tx.posTransaction.update({ where: { id: 'pos-uuid-1' }, data: {} }),
        ),
      ).rejects.toThrow(BusinessRuleException);

      // Journal entry must NOT have been written
      expect(txJeCreate).not.toHaveBeenCalled();
    });

    it('passes journal event metadata correctly to processEvent()', async () => {
      const txJeCreate = jest.fn().mockResolvedValue(buildPrismaJeRow());
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'GOODS_RECEIPT',
        is_active: true,
        debit_account_id: 'acc-inventory',
        credit_account_id: 'acc-gr-clearing',
        description: 'Goods Receipt',
      });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );

      const event = buildBusinessEvent({
        event_type: 'GOODS_RECEIPT',
        reference_type: 'GOODS_RECEIPT',
        reference_id: 'gr-uuid-1',
        reference_number: 'GR-202604-00001',
        amount: 500_000,
        created_by: 'user-uuid-42',
      });

      await withJournal(
        mockPrisma,
        service,
        event,
        async () => ({ received: true }),
      );

      expect(txJeCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reference_type: 'GOODS_RECEIPT',
            reference_id: 'gr-uuid-1',
            reference_number: 'GR-202604-00001',
            created_by: 'user-uuid-42',
            is_auto_generated: true,
          }),
        }),
      );
    });

    it('returns correct tuple [businessResult, journalEntries]', async () => {
      const txJeCreate = jest.fn().mockResolvedValue(buildPrismaJeRow());
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'POS_SALE',
        is_active: true,
        debit_account_id: 'acc-cash',
        credit_account_id: 'acc-revenue',
        description: 'POS Sale',
      });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );

      const [businessResult, journalEntries] = await withJournal(
        mockPrisma,
        service,
        buildBusinessEvent(),
        async () => ({ transactionId: 'pos-uuid-1', total: 100_000 }),
      );

      expect(businessResult).toEqual({ transactionId: 'pos-uuid-1', total: 100_000 });
      expect(journalEntries).toHaveLength(1);
      expect(journalEntries[0]).toMatchObject({
        je_number: 'JE-202604-00001',
        status: 'POSTED',
        is_auto_generated: true,
      });
    });
  });

  // ── Multi-line event support ───────────────────────────────────────────────

  describe('processEvent() with explicit journal lines', () => {
    it('uses provided lines instead of building from template amount', async () => {
      const txJeCreate = jest.fn().mockResolvedValue({
        ...buildPrismaJeRow(),
        total_debit: 300_000,
        total_credit: 300_000,
      });
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'SALES_INVOICE',
        is_active: true,
        debit_account_id: 'acc-ar',
        credit_account_id: 'acc-revenue',
        description: 'Sales Invoice',
      });

      const tx = {
        journalEntry: { create: txJeCreate },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      const event = buildBusinessEvent({
        event_type: 'SALES_INVOICE',
        amount: 300_000,
        lines: [
          { account_id: 'acc-ar', debit: 300_000, credit: 0 },
          { account_id: 'acc-revenue', debit: 0, credit: 272_727 },
          { account_id: 'acc-ppn', debit: 0, credit: 27_273 },
        ],
      });

      await service.processEvent(event, tx);

      // Lines passed to create should match the event lines (3 lines)
      const createCall = txJeCreate.mock.calls[0][0];
      expect(createCall.data.lines.create).toHaveLength(3);
    });

    it('throws BUSINESS_RULE_VIOLATION when provided lines are unbalanced', async () => {
      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'SALES_INVOICE',
        is_active: true,
        debit_account_id: 'acc-ar',
        credit_account_id: 'acc-revenue',
        description: 'Sales Invoice',
      });

      const tx = {
        journalEntry: { create: jest.fn() },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      const event = buildBusinessEvent({
        event_type: 'SALES_INVOICE',
        amount: 300_000,
        lines: [
          { account_id: 'acc-ar', debit: 300_000, credit: 0 },
          { account_id: 'acc-revenue', debit: 0, credit: 200_000 }, // intentionally unbalanced
        ],
      });

      await expect(service.processEvent(event, tx)).rejects.toThrow(BusinessRuleException);

      try {
        await service.processEvent(event, tx);
      } catch (e) {
        const response = (e as BusinessRuleException).getResponse() as Record<string, unknown>;
        expect((response['error'] as Record<string, unknown>)['code']).toBe(
          ErrorCode.BUSINESS_RULE_VIOLATION,
        );
      }
    });
  });

  // ── Idempotency & isolation ────────────────────────────────────────────────

  describe('transaction isolation', () => {
    it('does not leak state between two sequential processEvent() calls', async () => {
      const txJeCreate1 = jest.fn().mockResolvedValue({ ...buildPrismaJeRow(), id: 'je-uuid-1' });
      const txJeCreate2 = jest.fn().mockResolvedValue({ ...buildPrismaJeRow(), id: 'je-uuid-2' });

      const txFiscalPeriod = jest.fn().mockResolvedValue({ id: 'period-uuid-1', status: 'OPEN' });
      const txTemplate = jest.fn().mockResolvedValue({
        event_type: 'POS_SALE',
        is_active: true,
        debit_account_id: 'acc-cash',
        credit_account_id: 'acc-revenue',
        description: 'POS Sale',
      });

      const tx1 = {
        journalEntry: { create: txJeCreate1 },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      const tx2 = {
        journalEntry: { create: txJeCreate2 },
        fiscalPeriod: { findUnique: txFiscalPeriod },
        autoJournalTemplate: { findUnique: txTemplate },
      } as unknown as Prisma.TransactionClient;

      const event1 = buildBusinessEvent({ reference_id: 'pos-uuid-1' });
      const event2 = buildBusinessEvent({ reference_id: 'pos-uuid-2' });

      const [result1] = await service.processEvent(event1, tx1);
      const [result2] = await service.processEvent(event2, tx2);

      // Each call uses its own tx client
      expect(txJeCreate1).toHaveBeenCalledTimes(1);
      expect(txJeCreate2).toHaveBeenCalledTimes(1);
      expect(result1.id).toBe('je-uuid-1');
      expect(result2.id).toBe('je-uuid-2');
    });
  });
});
