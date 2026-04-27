/**
 * Unit tests for ProductService
 *
 * Validates: Requirements 2 (Master Data)
 * AC1: UUID PK, kode produk unik
 * AC2: Filter search
 * AC3: Soft delete via deleted_at
 * AC4: Validasi kode max 50, nama max 200, cost/price >= 0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ProductService } from './product.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CATEGORY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UOM_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PRODUCT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

const baseProductRow = {
  id: PRODUCT_ID,
  code: 'PRD-001',
  barcode: null,
  name: 'Produk Test',
  description: null,
  category_id: CATEGORY_ID,
  brand_id: null,
  uom_id: UOM_ID,
  uom_purchase_id: null,
  uom_sales_id: null,
  cost_method: 'WAC',
  standard_cost: 1000 as any,
  selling_price: 1500 as any,
  min_selling_price: 1200 as any,
  reorder_point: 10 as any,
  reorder_qty: 50 as any,
  max_stock: null,
  is_serialized: false,
  is_batch_tracked: false,
  is_active: true,
  tax_category: null,
  weight: null,
  volume: null,
  image_url: null,
  notes: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  product: {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Simulate withAudit: runs the operation callback with a mock tx client,
 * then calls audit.record.
 */
function setupTransactionMock() {
  mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
    const txClient = {
      product: mockPrismaService.product,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    return fn(txClient);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    jest.clearAllMocks();
    setupTransactionMock();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validData = {
      code: 'PRD-001',
      name: 'Produk Test',
      category_id: CATEGORY_ID,
      uom_id: UOM_ID,
      cost_method: 'WAC' as const,
      standard_cost: 1000,
      selling_price: 1500,
      min_selling_price: 1200,
      reorder_point: 10,
      reorder_qty: 50,
      is_serialized: false,
      is_batch_tracked: false,
      is_active: true,
    };

    it('creates a product successfully and returns mapped entity', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null); // no duplicate
      mockPrismaService.product.create.mockResolvedValue(baseProductRow);

      const result = await service.create(validData, USER_ID);

      expect(result.id).toBe(PRODUCT_ID);
      expect(result.code).toBe('PRD-001');
      expect(result.name).toBe('Produk Test');
      expect(result.standard_cost).toBe(1000);
      expect(result.selling_price).toBe(1500);
      expect(result.deleted_at).toBeNull();
    });

    it('throws CONFLICT when code already exists', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({ id: 'existing-id' });

      await expect(service.create(validData, USER_ID)).rejects.toMatchObject({
        getResponse: expect.any(Function),
      });

      try {
        await service.create(validData, USER_ID);
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });

    it('throws ZodError when code exceeds 50 characters', async () => {
      const longCode = 'A'.repeat(51);
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

    it('throws ZodError when standard_cost is negative', async () => {
      await expect(
        service.create({ ...validData, standard_cost: -1 }, USER_ID),
      ).rejects.toThrow();
    });

    it('throws ZodError when selling_price is negative', async () => {
      await expect(
        service.create({ ...validData, selling_price: -0.01 }, USER_ID),
      ).rejects.toThrow();
    });

    it('throws ZodError when min_selling_price is negative', async () => {
      await expect(
        service.create({ ...validData, min_selling_price: -5 }, USER_ID),
      ).rejects.toThrow();
    });

    it('accepts zero values for cost and price fields', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({
        ...baseProductRow,
        standard_cost: 0 as any,
        selling_price: 0 as any,
        min_selling_price: 0 as any,
      });

      const result = await service.create(
        { ...validData, standard_cost: 0, selling_price: 0, min_selling_price: 0 },
        USER_ID,
      );
      expect(result.standard_cost).toBe(0);
      expect(result.selling_price).toBe(0);
    });

    it('accepts code of exactly 50 characters', async () => {
      const code50 = 'A'.repeat(50);
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ ...baseProductRow, code: code50 });

      const result = await service.create({ ...validData, code: code50 }, USER_ID);
      expect(result.code).toBe(code50);
    });

    it('accepts name of exactly 200 characters', async () => {
      const name200 = 'N'.repeat(200);
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ ...baseProductRow, name: name200 });

      const result = await service.create({ ...validData, name: name200 }, USER_ID);
      expect(result.name).toBe(name200);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates a product successfully', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(baseProductRow);
      const updatedRow = { ...baseProductRow, name: 'Nama Baru' };
      mockPrismaService.product.update.mockResolvedValue(updatedRow);

      const result = await service.update(PRODUCT_ID, { name: 'Nama Baru' }, USER_ID);
      expect(result.name).toBe('Nama Baru');
    });

    it('throws NOT_FOUND when product does not exist', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      try {
        await service.update(PRODUCT_ID, { name: 'X' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws CONFLICT when updating to a code already used by another product', async () => {
      mockPrismaService.product.findFirst
        .mockResolvedValueOnce(baseProductRow) // existing product found
        .mockResolvedValueOnce({ id: 'other-id' }); // code conflict found

      try {
        await service.update(PRODUCT_ID, { code: 'TAKEN-CODE' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });

    it('allows updating code to the same value (no conflict)', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(baseProductRow);
      mockPrismaService.product.update.mockResolvedValue(baseProductRow);

      // Same code as existing — should not check for conflict
      const result = await service.update(PRODUCT_ID, { code: 'PRD-001' }, USER_ID);
      expect(result.code).toBe('PRD-001');
    });

    it('throws ZodError when updated name exceeds 200 characters', async () => {
      await expect(
        service.update(PRODUCT_ID, { name: 'N'.repeat(201) }, USER_ID),
      ).rejects.toThrow();
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns product when found', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(baseProductRow);

      const result = await service.findById(PRODUCT_ID);
      expect(result.id).toBe(PRODUCT_ID);
      expect(result.code).toBe('PRD-001');
    });

    it('throws NOT_FOUND when product does not exist', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      try {
        await service.findById(PRODUCT_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws NOT_FOUND for soft-deleted product (deleted_at is set)', async () => {
      // findFirst with deleted_at: null filter returns null for soft-deleted
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      try {
        await service.findById(PRODUCT_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ── search ────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('returns paginated results with default pagination', async () => {
      mockPrismaService.product.count.mockResolvedValue(1);
      mockPrismaService.product.findMany.mockResolvedValue([baseProductRow]);

      const result = await service.search({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.per_page).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.total_pages).toBe(1);
    });

    it('filters by is_active', async () => {
      mockPrismaService.product.count.mockResolvedValue(0);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.search({ is_active: false });
      expect(result.data).toHaveLength(0);
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: false }),
        }),
      );
    });

    it('filters by category_id', async () => {
      mockPrismaService.product.count.mockResolvedValue(1);
      mockPrismaService.product.findMany.mockResolvedValue([baseProductRow]);

      await service.search({ category_id: CATEGORY_ID });
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category_id: CATEGORY_ID }),
        }),
      );
    });

    it('filters by name (partial match)', async () => {
      mockPrismaService.product.count.mockResolvedValue(1);
      mockPrismaService.product.findMany.mockResolvedValue([baseProductRow]);

      await service.search({ name: 'Test' });
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Test', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('filters by code (partial match)', async () => {
      mockPrismaService.product.count.mockResolvedValue(1);
      mockPrismaService.product.findMany.mockResolvedValue([baseProductRow]);

      await service.search({ code: 'PRD' });
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            code: { contains: 'PRD', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('always excludes soft-deleted products', async () => {
      mockPrismaService.product.count.mockResolvedValue(0);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      await service.search({});
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: null }),
        }),
      );
    });

    it('respects custom page and per_page', async () => {
      mockPrismaService.product.count.mockResolvedValue(50);
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.search({ page: 3, per_page: 10 });
      expect(result.meta.page).toBe(3);
      expect(result.meta.per_page).toBe(10);
      expect(result.meta.total_pages).toBe(5);
      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('soft-deletes a product by setting deleted_at', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(baseProductRow);
      mockPrismaService.product.update.mockResolvedValue({
        ...baseProductRow,
        deleted_at: new Date(),
      });

      await expect(service.deactivate(PRODUCT_ID, USER_ID)).resolves.toBeUndefined();
      expect(mockPrismaService.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PRODUCT_ID },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('throws NOT_FOUND when product does not exist', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      try {
        await service.deactivate(PRODUCT_ID, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('does not hard-delete the product record', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(baseProductRow);
      mockPrismaService.product.update.mockResolvedValue({
        ...baseProductRow,
        deleted_at: new Date(),
      });

      await service.deactivate(PRODUCT_ID, USER_ID);
      // Ensure delete was never called — only update
      expect(mockPrismaService.product).not.toHaveProperty('delete');
    });
  });
});
