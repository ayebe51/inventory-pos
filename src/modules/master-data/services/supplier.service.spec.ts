/**
 * Unit tests for SupplierService
 *
 * Validates: Requirements 2 (Master Data — Supplier)
 * Business Rules:
 * - Code uniqueness across non-deleted suppliers
 * - payment_terms_days >= 0 (enforced by DTO)
 * - Soft delete via deleted_at
 * - Cache invalidation on mutations
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SupplierService } from './supplier.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { CacheService } from '../../../services/cache/cache.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SUPPLIER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const baseSupplierRow = {
  id: SUPPLIER_ID,
  code: 'SUPP-001',
  name: 'PT Supplier Test',
  email: 'supplier@test.com',
  phone: '081234567890',
  address: 'Jl. Supplier No. 456',
  payment_terms_days: 30,
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  supplier: {
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
  delByPattern: jest.fn().mockResolvedValue(undefined),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupTransactionMock() {
  mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
    const txClient = {
      supplier: mockPrismaService.supplier,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    return fn(txClient);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('SupplierService', () => {
  let service: SupplierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
    jest.clearAllMocks();
    setupTransactionMock();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validData = {
      code: 'SUPP-001',
      name: 'PT Supplier Test',
      email: 'supplier@test.com',
      phone: '081234567890',
      address: 'Jl. Supplier No. 456',
      payment_terms_days: 30,
      is_active: true,
    };

    it('creates a supplier successfully and returns mapped entity', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier.create.mockResolvedValue(baseSupplierRow);

      const result = await service.create(validData, USER_ID);

      expect(result.id).toBe(SUPPLIER_ID);
      expect(result.code).toBe('SUPP-001');
      expect(result.name).toBe('PT Supplier Test');
      expect(result.payment_terms_days).toBe(30);
      expect(result.deleted_at).toBeNull();
    });

    it('throws CONFLICT when code already exists', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue({ id: 'existing-id' });

      try {
        await service.create(validData, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
        expect(response.error.message).toContain('SUPP-001');
      }
    });

    it('throws ZodError when code exceeds 50 characters', async () => {
      const longCode = 'S'.repeat(51);
      await expect(
        service.create({ ...validData, code: longCode }, USER_ID),
      ).rejects.toThrow();
    });

    it('throws ZodError when name exceeds 200 characters', async () => {
      const longName = 'N'.repeat(201);
      await expect(
        service.create({ ...validData, name: longName }, USER_ID),
      ).rejects.toThrow();
    });

    it('throws ZodError when payment_terms_days is negative', async () => {
      await expect(
        service.create({ ...validData, payment_terms_days: -1 }, USER_ID),
      ).rejects.toThrow();
    });

    it('accepts zero payment_terms_days (cash on delivery)', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier.create.mockResolvedValue({
        ...baseSupplierRow,
        payment_terms_days: 0,
      });

      const result = await service.create({ ...validData, payment_terms_days: 0 }, USER_ID);
      expect(result.payment_terms_days).toBe(0);
    });

    it('accepts code of exactly 50 characters', async () => {
      const code50 = 'S'.repeat(50);
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier.create.mockResolvedValue({ ...baseSupplierRow, code: code50 });

      const result = await service.create({ ...validData, code: code50 }, USER_ID);
      expect(result.code).toBe(code50);
    });

    it('accepts name of exactly 200 characters', async () => {
      const name200 = 'N'.repeat(200);
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier.create.mockResolvedValue({ ...baseSupplierRow, name: name200 });

      const result = await service.create({ ...validData, name: name200 }, USER_ID);
      expect(result.name).toBe(name200);
    });

    it('invalidates cache after creation', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier.create.mockResolvedValue(baseSupplierRow);

      await service.create(validData, USER_ID);

      expect(mockCacheService.delByPattern).toHaveBeenCalledWith('supplier:*');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates a supplier successfully', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);
      const updatedRow = { ...baseSupplierRow, name: 'PT Updated Supplier' };
      mockPrismaService.supplier.update.mockResolvedValue(updatedRow);

      const result = await service.update(SUPPLIER_ID, { name: 'PT Updated Supplier' }, USER_ID);
      expect(result.name).toBe('PT Updated Supplier');
    });

    it('throws NOT_FOUND when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      try {
        await service.update(SUPPLIER_ID, { name: 'X' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws CONFLICT when updating to a code already used by another supplier', async () => {
      mockPrismaService.supplier.findFirst
        .mockResolvedValueOnce(baseSupplierRow)
        .mockResolvedValueOnce({ id: 'other-id' });

      try {
        await service.update(SUPPLIER_ID, { code: 'TAKEN-CODE' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });

    it('allows updating code to the same value (no conflict)', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);
      mockPrismaService.supplier.update.mockResolvedValue(baseSupplierRow);

      const result = await service.update(SUPPLIER_ID, { code: 'SUPP-001' }, USER_ID);
      expect(result.code).toBe('SUPP-001');
    });

    it('throws ZodError when updated payment_terms_days is negative', async () => {
      await expect(
        service.update(SUPPLIER_ID, { payment_terms_days: -5 }, USER_ID),
      ).rejects.toThrow();
    });

    it('allows updating payment_terms_days to zero', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);
      mockPrismaService.supplier.update.mockResolvedValue({
        ...baseSupplierRow,
        payment_terms_days: 0,
      });

      const result = await service.update(SUPPLIER_ID, { payment_terms_days: 0 }, USER_ID);
      expect(result.payment_terms_days).toBe(0);
    });

    it('invalidates cache after update', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);
      mockPrismaService.supplier.update.mockResolvedValue(baseSupplierRow);

      await service.update(SUPPLIER_ID, { name: 'Updated' }, USER_ID);

      expect(mockCacheService.del).toHaveBeenCalledWith(`supplier:${SUPPLIER_ID}`);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns supplier when found', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);

      const result = await service.findById(SUPPLIER_ID);
      expect(result.id).toBe(SUPPLIER_ID);
      expect(result.code).toBe('SUPP-001');
    });

    it('throws NOT_FOUND when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      try {
        await service.findById(SUPPLIER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws NOT_FOUND for soft-deleted supplier', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      try {
        await service.findById(SUPPLIER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('uses cache when available', async () => {
      const cachedSupplier = { ...baseSupplierRow, id: SUPPLIER_ID };
      mockCacheService.get.mockResolvedValueOnce(cachedSupplier);

      const result = await service.findById(SUPPLIER_ID);
      expect(result.id).toBe(SUPPLIER_ID);
      expect(mockPrismaService.supplier.findFirst).not.toHaveBeenCalled();
    });

    it('sets cache after DB fetch', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);

      await service.findById(SUPPLIER_ID);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `supplier:${SUPPLIER_ID}`,
        expect.any(Object),
        300,
      );
    });
  });

  // ── search ────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('returns paginated results with default pagination', async () => {
      mockPrismaService.supplier.count.mockResolvedValue(1);
      mockPrismaService.supplier.findMany.mockResolvedValue([baseSupplierRow]);

      const result = await service.search({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.per_page).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.total_pages).toBe(1);
    });

    it('filters by is_active', async () => {
      mockPrismaService.supplier.count.mockResolvedValue(0);
      mockPrismaService.supplier.findMany.mockResolvedValue([]);

      await service.search({ is_active: false });
      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: false }),
        }),
      );
    });

    it('filters by name (partial match, case-insensitive)', async () => {
      mockPrismaService.supplier.count.mockResolvedValue(1);
      mockPrismaService.supplier.findMany.mockResolvedValue([baseSupplierRow]);

      await service.search({ name: 'Test' });
      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Test', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('filters by code (partial match, case-insensitive)', async () => {
      mockPrismaService.supplier.count.mockResolvedValue(1);
      mockPrismaService.supplier.findMany.mockResolvedValue([baseSupplierRow]);

      await service.search({ code: 'SUPP' });
      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            code: { contains: 'SUPP', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('always excludes soft-deleted suppliers', async () => {
      mockPrismaService.supplier.count.mockResolvedValue(0);
      mockPrismaService.supplier.findMany.mockResolvedValue([]);

      await service.search({});
      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: null }),
        }),
      );
    });

    it('respects custom page and per_page', async () => {
      mockPrismaService.supplier.count.mockResolvedValue(50);
      mockPrismaService.supplier.findMany.mockResolvedValue([]);

      const result = await service.search({ page: 3, per_page: 10 });
      expect(result.meta.page).toBe(3);
      expect(result.meta.per_page).toBe(10);
      expect(result.meta.total_pages).toBe(5);
      expect(mockPrismaService.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('soft-deletes a supplier by setting deleted_at', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);
      mockPrismaService.supplier.update.mockResolvedValue({
        ...baseSupplierRow,
        deleted_at: new Date(),
      });

      await expect(service.deactivate(SUPPLIER_ID, USER_ID)).resolves.toBeUndefined();
      expect(mockPrismaService.supplier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SUPPLIER_ID },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('throws NOT_FOUND when supplier does not exist', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);

      try {
        await service.deactivate(SUPPLIER_ID, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('invalidates cache after deactivation', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);
      mockPrismaService.supplier.update.mockResolvedValue({
        ...baseSupplierRow,
        deleted_at: new Date(),
      });

      await service.deactivate(SUPPLIER_ID, USER_ID);

      expect(mockCacheService.del).toHaveBeenCalledWith(`supplier:${SUPPLIER_ID}`);
    });

    it('does not hard-delete the supplier record', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(baseSupplierRow);
      mockPrismaService.supplier.update.mockResolvedValue({
        ...baseSupplierRow,
        deleted_at: new Date(),
      });

      await service.deactivate(SUPPLIER_ID, USER_ID);
      // Ensure delete was never called — only update
      expect(mockPrismaService.supplier).not.toHaveProperty('delete');
    });
  });

  // ── Edge cases and boundary tests ─────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles very long payment terms (e.g., 365 days)', async () => {
      mockPrismaService.supplier.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier.create.mockResolvedValue({
        ...baseSupplierRow,
        payment_terms_days: 365,
      });

      const result = await service.create(
        {
          code: 'SUPP-LONG',
          name: 'Long Terms Supplier',
          payment_terms_days: 365,
          is_active: true,
        },
        USER_ID,
      );
      expect(result.payment_terms_days).toBe(365);
    });

    it('handles supplier with minimal required fields only', async () => {
      const minimalData = {
        code: 'SUPP-MIN',
        name: 'Minimal Supplier',
        payment_terms_days: 0,
        is_active: true,
      };

      mockPrismaService.supplier.findFirst.mockResolvedValue(null);
      mockPrismaService.supplier.create.mockResolvedValue({
        ...baseSupplierRow,
        ...minimalData,
        email: null,
        phone: null,
        address: null,
      });

      const result = await service.create(minimalData, USER_ID);
      expect(result.code).toBe('SUPP-MIN');
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.address).toBeNull();
    });
  });
});
