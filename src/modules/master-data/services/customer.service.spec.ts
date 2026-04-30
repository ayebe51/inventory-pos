/**
 * Unit tests for CustomerService
 *
 * Validates: Requirements 2 (Master Data — Customer)
 * Business Rules:
 * - Code uniqueness across non-deleted customers
 * - credit_limit >= 0 (enforced by DTO)
 * - Credit limit checking for Sales Orders (BR-SAL-003)
 * - Soft delete via deleted_at
 * - Cache invalidation on mutations
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { CacheService } from '../../../services/cache/cache.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const baseCustomerRow = {
  id: CUSTOMER_ID,
  code: 'CUST-001',
  name: 'PT Test Customer',
  email: 'test@customer.com',
  phone: '081234567890',
  address: 'Jl. Test No. 123',
  credit_limit: 10000000 as any, // Rp 10 juta
  outstanding_balance: 2000000 as any, // Rp 2 juta
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  customer: {
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
      customer: mockPrismaService.customer,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    return fn(txClient);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('CustomerService', () => {
  let service: CustomerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    jest.clearAllMocks();
    setupTransactionMock();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validData = {
      code: 'CUST-001',
      name: 'PT Test Customer',
      email: 'test@customer.com',
      phone: '081234567890',
      address: 'Jl. Test No. 123',
      credit_limit: 10000000,
      is_active: true,
    };

    it('creates a customer successfully and returns mapped entity', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue(baseCustomerRow);

      const result = await service.create(validData, USER_ID);

      expect(result.id).toBe(CUSTOMER_ID);
      expect(result.code).toBe('CUST-001');
      expect(result.name).toBe('PT Test Customer');
      expect(result.credit_limit).toBe(10000000);
      expect(result.outstanding_balance).toBe(2000000);
      expect(result.deleted_at).toBeNull();
    });

    it('throws CONFLICT when code already exists', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue({ id: 'existing-id' });

      try {
        await service.create(validData, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
        expect(response.error.message).toContain('CUST-001');
      }
    });

    it('throws ZodError when code exceeds 50 characters', async () => {
      const longCode = 'C'.repeat(51);
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

    it('throws ZodError when credit_limit is negative', async () => {
      await expect(
        service.create({ ...validData, credit_limit: -1 }, USER_ID),
      ).rejects.toThrow();
    });

    it('accepts zero credit_limit', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue({
        ...baseCustomerRow,
        credit_limit: 0 as any,
      });

      const result = await service.create({ ...validData, credit_limit: 0 }, USER_ID);
      expect(result.credit_limit).toBe(0);
    });

    it('accepts code of exactly 50 characters', async () => {
      const code50 = 'C'.repeat(50);
      mockPrismaService.customer.findFirst.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue({ ...baseCustomerRow, code: code50 });

      const result = await service.create({ ...validData, code: code50 }, USER_ID);
      expect(result.code).toBe(code50);
    });

    it('accepts name of exactly 200 characters', async () => {
      const name200 = 'N'.repeat(200);
      mockPrismaService.customer.findFirst.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue({ ...baseCustomerRow, name: name200 });

      const result = await service.create({ ...validData, name: name200 }, USER_ID);
      expect(result.name).toBe(name200);
    });

    it('invalidates cache after creation', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);
      mockPrismaService.customer.create.mockResolvedValue(baseCustomerRow);

      await service.create(validData, USER_ID);

      expect(mockCacheService.delByPattern).toHaveBeenCalledWith('customer:*');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates a customer successfully', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);
      const updatedRow = { ...baseCustomerRow, name: 'PT Updated Customer' };
      mockPrismaService.customer.update.mockResolvedValue(updatedRow);

      const result = await service.update(CUSTOMER_ID, { name: 'PT Updated Customer' }, USER_ID);
      expect(result.name).toBe('PT Updated Customer');
    });

    it('throws NOT_FOUND when customer does not exist', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);

      try {
        await service.update(CUSTOMER_ID, { name: 'X' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws CONFLICT when updating to a code already used by another customer', async () => {
      mockPrismaService.customer.findFirst
        .mockResolvedValueOnce(baseCustomerRow)
        .mockResolvedValueOnce({ id: 'other-id' });

      try {
        await service.update(CUSTOMER_ID, { code: 'TAKEN-CODE' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });

    it('allows updating code to the same value (no conflict)', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);
      mockPrismaService.customer.update.mockResolvedValue(baseCustomerRow);

      const result = await service.update(CUSTOMER_ID, { code: 'CUST-001' }, USER_ID);
      expect(result.code).toBe('CUST-001');
    });

    it('throws ZodError when updated credit_limit is negative', async () => {
      await expect(
        service.update(CUSTOMER_ID, { credit_limit: -100 }, USER_ID),
      ).rejects.toThrow();
    });

    it('invalidates cache after update', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);
      mockPrismaService.customer.update.mockResolvedValue(baseCustomerRow);

      await service.update(CUSTOMER_ID, { name: 'Updated' }, USER_ID);

      expect(mockCacheService.del).toHaveBeenCalledWith(`customer:${CUSTOMER_ID}`);
      expect(mockCacheService.delByPattern).toHaveBeenCalledWith('active_price:*');
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns customer when found', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);

      const result = await service.findById(CUSTOMER_ID);
      expect(result.id).toBe(CUSTOMER_ID);
      expect(result.code).toBe('CUST-001');
    });

    it('throws NOT_FOUND when customer does not exist', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);

      try {
        await service.findById(CUSTOMER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws NOT_FOUND for soft-deleted customer', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);

      try {
        await service.findById(CUSTOMER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('uses cache when available', async () => {
      const cachedCustomer = { ...baseCustomerRow, id: CUSTOMER_ID };
      mockCacheService.get.mockResolvedValueOnce(cachedCustomer);

      const result = await service.findById(CUSTOMER_ID);
      expect(result.id).toBe(CUSTOMER_ID);
      expect(mockPrismaService.customer.findFirst).not.toHaveBeenCalled();
    });

    it('sets cache after DB fetch', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);

      await service.findById(CUSTOMER_ID);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `customer:${CUSTOMER_ID}`,
        expect.any(Object),
        300,
      );
    });
  });

  // ── search ────────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('returns paginated results with default pagination', async () => {
      mockPrismaService.customer.count.mockResolvedValue(1);
      mockPrismaService.customer.findMany.mockResolvedValue([baseCustomerRow]);

      const result = await service.search({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.per_page).toBe(20);
      expect(result.meta.total).toBe(1);
      expect(result.meta.total_pages).toBe(1);
    });

    it('filters by is_active', async () => {
      mockPrismaService.customer.count.mockResolvedValue(0);
      mockPrismaService.customer.findMany.mockResolvedValue([]);

      await service.search({ is_active: false });
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: false }),
        }),
      );
    });

    it('filters by name (partial match, case-insensitive)', async () => {
      mockPrismaService.customer.count.mockResolvedValue(1);
      mockPrismaService.customer.findMany.mockResolvedValue([baseCustomerRow]);

      await service.search({ name: 'Test' });
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Test', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('filters by code (partial match, case-insensitive)', async () => {
      mockPrismaService.customer.count.mockResolvedValue(1);
      mockPrismaService.customer.findMany.mockResolvedValue([baseCustomerRow]);

      await service.search({ code: 'CUST' });
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            code: { contains: 'CUST', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('always excludes soft-deleted customers', async () => {
      mockPrismaService.customer.count.mockResolvedValue(0);
      mockPrismaService.customer.findMany.mockResolvedValue([]);

      await service.search({});
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted_at: null }),
        }),
      );
    });

    it('respects custom page and per_page', async () => {
      mockPrismaService.customer.count.mockResolvedValue(50);
      mockPrismaService.customer.findMany.mockResolvedValue([]);

      const result = await service.search({ page: 3, per_page: 10 });
      expect(result.meta.page).toBe(3);
      expect(result.meta.per_page).toBe(10);
      expect(result.meta.total_pages).toBe(5);
      expect(mockPrismaService.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('soft-deletes a customer by setting deleted_at', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);
      mockPrismaService.customer.update.mockResolvedValue({
        ...baseCustomerRow,
        deleted_at: new Date(),
      });

      await expect(service.deactivate(CUSTOMER_ID, USER_ID)).resolves.toBeUndefined();
      expect(mockPrismaService.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CUSTOMER_ID },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('throws NOT_FOUND when customer does not exist', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);

      try {
        await service.deactivate(CUSTOMER_ID, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('invalidates cache after deactivation', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);
      mockPrismaService.customer.update.mockResolvedValue({
        ...baseCustomerRow,
        deleted_at: new Date(),
      });

      await service.deactivate(CUSTOMER_ID, USER_ID);

      expect(mockCacheService.del).toHaveBeenCalledWith(`customer:${CUSTOMER_ID}`);
      expect(mockCacheService.delByPattern).toHaveBeenCalledWith('active_price:*');
    });
  });

  // ── checkCreditAvailable ──────────────────────────────────────────────────

  describe('checkCreditAvailable() — BR-SAL-003', () => {
    it('returns true when sufficient credit is available', async () => {
      // credit_limit: 10M, outstanding: 2M → available: 8M
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);

      const result = await service.checkCreditAvailable(CUSTOMER_ID, 5000000);
      expect(result).toBe(true);
    });

    it('returns false when credit limit is exceeded', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);

      const result = await service.checkCreditAvailable(CUSTOMER_ID, 9000000);
      expect(result).toBe(false);
    });

    it('returns true when required amount equals available credit', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);

      const result = await service.checkCreditAvailable(CUSTOMER_ID, 8000000);
      expect(result).toBe(true);
    });

    it('throws NOT_FOUND when customer does not exist', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);

      try {
        await service.checkCreditAvailable(CUSTOMER_ID, 1000);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('handles zero credit limit correctly', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue({
        ...baseCustomerRow,
        credit_limit: 0 as any,
        outstanding_balance: 0 as any,
      });

      const result = await service.checkCreditAvailable(CUSTOMER_ID, 1);
      expect(result).toBe(false);
    });

    it('handles customer with no outstanding balance', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue({
        ...baseCustomerRow,
        outstanding_balance: 0 as any,
      });

      const result = await service.checkCreditAvailable(CUSTOMER_ID, 10000000);
      expect(result).toBe(true);
    });
  });

  // ── getRemainingCredit ────────────────────────────────────────────────────

  describe('getRemainingCredit()', () => {
    it('returns correct remaining credit', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(baseCustomerRow);

      const result = await service.getRemainingCredit(CUSTOMER_ID);
      expect(result).toBe(8000000); // 10M - 2M
    });

    it('returns zero when credit is fully utilized', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue({
        ...baseCustomerRow,
        outstanding_balance: 10000000 as any,
      });

      const result = await service.getRemainingCredit(CUSTOMER_ID);
      expect(result).toBe(0);
    });

    it('returns negative value when over limit (edge case)', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue({
        ...baseCustomerRow,
        outstanding_balance: 12000000 as any,
      });

      const result = await service.getRemainingCredit(CUSTOMER_ID);
      expect(result).toBe(-2000000);
    });

    it('throws NOT_FOUND when customer does not exist', async () => {
      mockPrismaService.customer.findFirst.mockResolvedValue(null);

      try {
        await service.getRemainingCredit(CUSTOMER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });
});
