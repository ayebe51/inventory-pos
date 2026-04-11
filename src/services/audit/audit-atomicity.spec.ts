/**
 * Audit Trail Atomicity Tests
 *
 * Validates Requirement 1 AC 12:
 *   "WHEN operasi mutasi dilakukan, THE Audit_Service SHALL mencatat log
 *    dalam transaksi database yang sama sehingga log tidak bisa ada tanpa
 *    operasi yang berhasil"
 *
 * These tests verify that:
 * 1. When the business operation succeeds, the audit log IS written.
 * 2. When the business operation fails, the audit log is NOT written
 *    (transaction rollback).
 * 3. When the audit write fails, the business operation is also rolled back.
 * 4. AuditService.record() uses the provided tx client, not the global prisma.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AuditService } from './audit.service';
import { PrismaService } from '../../config/prisma.service';
import { withAudit } from './with-audit.helper';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAuditLogRow(overrides: Partial<{
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
}> = {}) {
  return {
    id: overrides.id ?? 'audit-uuid-1',
    user_id: overrides.user_id ?? 'user-uuid-1',
    action: overrides.action ?? 'UPDATE',
    entity_type: overrides.entity_type ?? 'User',
    entity_id: overrides.entity_id ?? 'entity-uuid-1',
    data_before: null,
    data_after: null,
    ip_address: null,
    user_agent: null,
    created_at: new Date('2025-01-01T00:00:00Z'),
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAuditLogCreate = jest.fn();

const mockPrisma = {
  auditLog: {
    create: mockAuditLogCreate,
    count: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as PrismaService;

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('AuditService — atomicity (Task 4.2)', () => {
  let auditService: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    auditService = module.get<AuditService>(AuditService);
  });

  // ── record() uses tx client when provided ──────────────────────────────────

  describe('record() with transaction client', () => {
    it('uses the provided tx client instead of the global prisma', async () => {
      const txCreate = jest.fn().mockResolvedValue(buildAuditLogRow());
      const tx = { auditLog: { create: txCreate } } as unknown as Prisma.TransactionClient;

      await auditService.record(
        {
          user_id: 'user-uuid-1',
          action: 'UPDATE',
          entity_type: 'User',
          entity_id: 'entity-uuid-1',
        },
        tx,
      );

      // tx.auditLog.create must be called, NOT the global prisma mock
      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it('falls back to global prisma when tx is not provided', async () => {
      mockAuditLogCreate.mockResolvedValue(buildAuditLogRow());

      await auditService.record({
        user_id: 'user-uuid-1',
        action: 'CREATE',
        entity_type: 'Product',
        entity_id: 'product-uuid-1',
      });

      expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    });

    it('passes correct fields to the tx client', async () => {
      const txCreate = jest.fn().mockResolvedValue(buildAuditLogRow());
      const tx = { auditLog: { create: txCreate } } as unknown as Prisma.TransactionClient;

      await auditService.record(
        {
          user_id: 'user-uuid-1',
          action: 'DELETE',
          entity_type: 'Product',
          entity_id: 'product-uuid-1',
          before_snapshot: { name: 'Old Name' },
          ip_address: '127.0.0.1',
          user_agent: 'jest-test',
        },
        tx,
      );

      expect(txCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-uuid-1',
          action: 'DELETE',
          entity_type: 'Product',
          entity_id: 'product-uuid-1',
          ip_address: '127.0.0.1',
          user_agent: 'jest-test',
        }),
      });
    });
  });

  // ── withAudit helper — rollback behaviour ──────────────────────────────────

  describe('withAudit() helper', () => {
    it('commits both business operation and audit log when operation succeeds', async () => {
      const txCreate = jest.fn().mockResolvedValue(buildAuditLogRow());
      const txUserUpdate = jest.fn().mockResolvedValue({ id: 'user-uuid-1' });
      const tx = {
        auditLog: { create: txCreate },
        user: { update: txUserUpdate },
      } as unknown as Prisma.TransactionClient;

      // Simulate prisma.$transaction executing the callback with tx
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );

      const result = await withAudit(
        mockPrisma,
        auditService,
        {
          userId: 'user-uuid-1',
          action: 'UPDATE',
          entityType: 'User',
          entityId: 'user-uuid-1',
          before: { status: 'active' },
          after: { status: 'inactive' },
        },
        async (tx) => {
          return tx.user.update({ where: { id: 'user-uuid-1' }, data: {} });
        },
      );

      expect(txUserUpdate).toHaveBeenCalledTimes(1);
      expect(txCreate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 'user-uuid-1' });
    });

    it('does NOT write audit log when business operation throws (rollback)', async () => {
      const txCreate = jest.fn();
      const tx = {
        auditLog: { create: txCreate },
      } as unknown as Prisma.TransactionClient;

      // Simulate prisma.$transaction that propagates the error (rollback)
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
          // The callback throws — $transaction rolls back and re-throws
          await cb(tx).catch((err) => { throw err; });
        },
      );

      const failingOperation = jest.fn().mockRejectedValue(new Error('Business rule violated'));

      await expect(
        withAudit(
          mockPrisma,
          auditService,
          {
            userId: 'user-uuid-1',
            action: 'UPDATE',
            entityType: 'User',
            entityId: 'user-uuid-1',
          },
          failingOperation,
        ),
      ).rejects.toThrow('Business rule violated');

      // Audit log must NOT have been written because the operation failed
      expect(txCreate).not.toHaveBeenCalled();
    });

    it('rolls back business operation when audit write throws', async () => {
      const txCreate = jest.fn().mockRejectedValue(new Error('DB constraint violation'));
      const txUserUpdate = jest.fn().mockResolvedValue({ id: 'user-uuid-1' });
      const tx = {
        auditLog: { create: txCreate },
        user: { update: txUserUpdate },
      } as unknown as Prisma.TransactionClient;

      // Simulate prisma.$transaction that propagates the error (rollback)
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
          return cb(tx); // throws from audit write → $transaction rolls back
        },
      );

      await expect(
        withAudit(
          mockPrisma,
          auditService,
          {
            userId: 'user-uuid-1',
            action: 'UPDATE',
            entityType: 'User',
            entityId: 'user-uuid-1',
          },
          async (tx) => tx.user.update({ where: { id: 'user-uuid-1' }, data: {} }),
        ),
      ).rejects.toThrow('DB constraint violation');

      // Business operation was called but the whole tx is rolled back
      expect(txUserUpdate).toHaveBeenCalledTimes(1);
    });

    it('passes audit event metadata correctly to record()', async () => {
      const txCreate = jest.fn().mockResolvedValue(buildAuditLogRow());
      const tx = {
        auditLog: { create: txCreate },
      } as unknown as Prisma.TransactionClient;

      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) => cb(tx),
      );

      await withAudit(
        mockPrisma,
        auditService,
        {
          userId: 'user-uuid-42',
          action: 'APPROVE',
          entityType: 'PurchaseOrder',
          entityId: 'po-uuid-1',
          before: { status: 'PENDING_APPROVAL' },
          after: { status: 'APPROVED' },
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
        },
        async () => ({ approved: true }),
      );

      expect(txCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user_id: 'user-uuid-42',
          action: 'APPROVE',
          entity_type: 'PurchaseOrder',
          entity_id: 'po-uuid-1',
          ip_address: '10.0.0.1',
          user_agent: 'Mozilla/5.0',
        }),
      });
    });
  });
});
