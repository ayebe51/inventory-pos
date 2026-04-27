/**
 * Unit tests for WarehouseService
 *
 * Validates: Requirements 2.6, 2.7 (Master Data — Warehouse)
 * AC: Kode unik per branch, lock/unlock, soft delete, NOT_FOUND
 */

import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseService } from './warehouse.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { CacheService } from '../../../services/cache/cache.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BRANCH_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BRANCH_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const WAREHOUSE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const baseWarehouseRow = {
  id: WAREHOUSE_ID,
  code: 'WH-001',
  name: 'Gudang Utama',
  branch_id: BRANCH_ID,
  address: null,
  is_active: true,
  is_locked: false,
  lock_reason: null,
  locked_at: null,
  locked_by: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  warehouse: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue({}),
};

const mockCacheService = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupTransactionMock() {
  mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
    const txClient = {
      warehouse: mockPrismaService.warehouse,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    return fn(txClient);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('WarehouseService', () => {
  let service: WarehouseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<WarehouseService>(WarehouseService);
    jest.clearAllMocks();
    setupTransactionMock();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validData = {
      code: 'WH-001',
      name: 'Gudang Utama',
      branch_id: BRANCH_ID,
    };

    it('creates a warehouse successfully', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(null);
      mockPrismaService.warehouse.create.mockResolvedValue(baseWarehouseRow);

      const result = await service.create(validData, USER_ID);

      expect(result.id).toBe(WAREHOUSE_ID);
      expect(result.code).toBe('WH-001');
      expect(result.is_locked).toBe(false);
    });

    it('throws CONFLICT when code already exists in same branch (Req 2.7)', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue({ id: 'existing-id' });

      try {
        await service.create(validData, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });

    it('succeeds when same code is used in a different branch', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(null);
      mockPrismaService.warehouse.create.mockResolvedValue({
        ...baseWarehouseRow,
        branch_id: BRANCH_ID_2,
      });

      const result = await service.create({ ...validData, branch_id: BRANCH_ID_2 }, USER_ID);
      expect(result.branch_id).toBe(BRANCH_ID_2);
    });

    it('throws ZodError when code exceeds 20 characters', async () => {
      await expect(
        service.create({ ...validData, code: 'A'.repeat(21) }, USER_ID),
      ).rejects.toThrow();
    });

    it('throws ZodError when name exceeds 100 characters', async () => {
      await expect(
        service.create({ ...validData, name: 'N'.repeat(101) }, USER_ID),
      ).rejects.toThrow();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns warehouse when found', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(baseWarehouseRow);

      const result = await service.findById(WAREHOUSE_ID);
      expect(result.id).toBe(WAREHOUSE_ID);
    });

    it('throws NOT_FOUND when warehouse does not exist', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(null);

      try {
        await service.findById(WAREHOUSE_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('returns cached value without hitting DB', async () => {
      mockCacheService.get.mockResolvedValueOnce(baseWarehouseRow);

      const result = await service.findById(WAREHOUSE_ID);
      expect(result.id).toBe(WAREHOUSE_ID);
      expect(mockPrismaService.warehouse.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── lock ──────────────────────────────────────────────────────────────────

  describe('lock()', () => {
    it('sets is_locked=true and lock fields', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(baseWarehouseRow);
      mockPrismaService.warehouse.update.mockResolvedValue({
        ...baseWarehouseRow,
        is_locked: true,
        lock_reason: 'Stock opname',
        locked_at: new Date(),
        locked_by: USER_ID,
      });

      await expect(service.lock(WAREHOUSE_ID, 'Stock opname', USER_ID)).resolves.toBeUndefined();

      expect(mockPrismaService.warehouse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: WAREHOUSE_ID },
          data: expect.objectContaining({
            is_locked: true,
            lock_reason: 'Stock opname',
            locked_by: USER_ID,
          }),
        }),
      );
    });

    it('throws NOT_FOUND when warehouse does not exist', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(null);

      try {
        await service.lock(WAREHOUSE_ID, 'reason', USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ── unlock ────────────────────────────────────────────────────────────────

  describe('unlock()', () => {
    const lockedRow = {
      ...baseWarehouseRow,
      is_locked: true,
      lock_reason: 'Stock opname',
      locked_at: new Date(),
      locked_by: USER_ID,
    };

    it('sets is_locked=false and clears lock fields', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(lockedRow);
      mockPrismaService.warehouse.update.mockResolvedValue({
        ...lockedRow,
        is_locked: false,
        lock_reason: null,
        locked_at: null,
        locked_by: null,
      });

      await expect(service.unlock(WAREHOUSE_ID, USER_ID)).resolves.toBeUndefined();

      expect(mockPrismaService.warehouse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: WAREHOUSE_ID },
          data: expect.objectContaining({
            is_locked: false,
            lock_reason: null,
            locked_at: null,
            locked_by: null,
          }),
        }),
      );
    });

    it('throws NOT_FOUND when warehouse does not exist', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(null);

      try {
        await service.unlock(WAREHOUSE_ID, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('soft-deletes a warehouse by setting deleted_at', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(baseWarehouseRow);
      mockPrismaService.warehouse.update.mockResolvedValue({
        ...baseWarehouseRow,
        deleted_at: new Date(),
      });

      await expect(service.deactivate(WAREHOUSE_ID, USER_ID)).resolves.toBeUndefined();

      expect(mockPrismaService.warehouse.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: WAREHOUSE_ID },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('throws NOT_FOUND when warehouse does not exist', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(null);

      try {
        await service.deactivate(WAREHOUSE_ID, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('invalidates cache after deactivation', async () => {
      mockPrismaService.warehouse.findFirst.mockResolvedValue(baseWarehouseRow);
      mockPrismaService.warehouse.update.mockResolvedValue({
        ...baseWarehouseRow,
        deleted_at: new Date(),
      });

      await service.deactivate(WAREHOUSE_ID, USER_ID);

      expect(mockCacheService.del).toHaveBeenCalledWith(`warehouse:${WAREHOUSE_ID}`);
      expect(mockCacheService.del).toHaveBeenCalledWith(`warehouse:branch:${BRANCH_ID}`);
    });
  });
});
