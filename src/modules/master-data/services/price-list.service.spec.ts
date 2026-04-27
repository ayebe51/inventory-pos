import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { PriceListService } from './price-list.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { CacheService } from '../../../services/cache/cache.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';

// ── Helpers ───────────────────────────────────────────────────────────────────

const uuid = () => '00000000-0000-0000-0000-000000000001';
const uuid2 = () => '00000000-0000-0000-0000-000000000002';
const uuid3 = () => '00000000-0000-0000-0000-000000000003';

function makePriceListRow(overrides: Partial<{
  id: string;
  code: string;
  name: string;
  customer_id: string | null;
  valid_from: Date;
  valid_to: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}> = {}) {
  return {
    id: uuid(),
    code: 'PL-001',
    name: 'Default Price List',
    customer_id: null,
    valid_from: new Date('2025-01-01'),
    valid_to: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  priceListItem: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  priceList: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

const mockAudit = {
  record: jest.fn().mockResolvedValue(undefined),
};

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  delByPattern: jest.fn().mockResolvedValue(undefined),
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('PriceListService', () => {
  let service: PriceListService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceListService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<PriceListService>(PriceListService);
  });

  // ── getActivePrice ──────────────────────────────────────────────────────────

  describe('getActivePrice', () => {
    const productId = uuid();
    const customerId = uuid2();
    const date = new Date('2025-06-15');

    it('returns customer-specific price when a matching price list exists', async () => {
      mockPrisma.priceListItem.findMany.mockResolvedValue([
        {
          price_list_id: uuid3(),
          unit_price: { valueOf: () => 15000, toString: () => '15000' },
          price_list: { id: uuid3(), customer_id: customerId },
        },
      ]);

      const result = await service.getActivePrice(productId, customerId, date);

      expect(result.price).toBe(15000);
      expect(result.source).toBe('PRICE_LIST_CUSTOMER');
      expect(result.price_list_id).toBe(uuid3());
    });

    it('returns general price list when no customer-specific list exists', async () => {
      mockPrisma.priceListItem.findMany.mockResolvedValue([
        {
          price_list_id: uuid3(),
          unit_price: { valueOf: () => 12000, toString: () => '12000' },
          price_list: { id: uuid3(), customer_id: null },
        },
      ]);

      const result = await service.getActivePrice(productId, customerId, date);

      expect(result.price).toBe(12000);
      expect(result.source).toBe('PRICE_LIST_GENERAL');
    });

    it('falls back to product default selling_price when no price list matches', async () => {
      mockPrisma.priceListItem.findMany.mockResolvedValue([]);
      mockPrisma.product.findFirst.mockResolvedValue({
        id: productId,
        selling_price: { valueOf: () => 10000, toString: () => '10000' },
      });

      const result = await service.getActivePrice(productId, customerId, date);

      expect(result.price).toBe(10000);
      expect(result.source).toBe('PRODUCT_DEFAULT');
      expect(result.price_list_id).toBeNull();
    });

    it('throws NOT_FOUND when product does not exist and no price list matches', async () => {
      mockPrisma.priceListItem.findMany.mockResolvedValue([]);
      mockPrisma.product.findFirst.mockResolvedValue(null);

      await expect(service.getActivePrice(productId, customerId, date)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('returns cached result without hitting DB on second call', async () => {
      const cachedResult = { price: 9999, price_list_id: uuid3(), source: 'PRICE_LIST_GENERAL' };
      mockCache.get.mockResolvedValueOnce(cachedResult);

      const result = await service.getActivePrice(productId, customerId, date);

      expect(result).toEqual(cachedResult);
      expect(mockPrisma.priceListItem.findMany).not.toHaveBeenCalled();
    });

    it('prefers customer-specific price over general price list', async () => {
      mockPrisma.priceListItem.findMany.mockResolvedValue([
        {
          price_list_id: uuid3(),
          unit_price: { valueOf: () => 15000, toString: () => '15000' },
          price_list: { id: uuid3(), customer_id: customerId },
        },
        {
          price_list_id: uuid2(),
          unit_price: { valueOf: () => 12000, toString: () => '12000' },
          price_list: { id: uuid2(), customer_id: null },
        },
      ]);

      const result = await service.getActivePrice(productId, customerId, date);

      expect(result.price).toBe(15000);
      expect(result.source).toBe('PRICE_LIST_CUSTOMER');
    });

    it('handles null customerId by skipping customer-specific lookup', async () => {
      mockPrisma.priceListItem.findMany.mockResolvedValue([
        {
          price_list_id: uuid3(),
          unit_price: { valueOf: () => 11000, toString: () => '11000' },
          price_list: { id: uuid3(), customer_id: null },
        },
      ]);

      const result = await service.getActivePrice(productId, null, date);

      expect(result.price).toBe(11000);
      expect(result.source).toBe('PRICE_LIST_GENERAL');
    });
  });

  // ── createPriceList ─────────────────────────────────────────────────────────

  describe('createPriceList', () => {
    const validData = {
      code: 'PL-001',
      name: 'Standard Price List',
      valid_from: new Date('2025-01-01'),
      is_active: true,
    };

    it('creates a price list successfully', async () => {
      mockPrisma.priceList.findFirst.mockResolvedValue(null); // no duplicate
      const row = makePriceListRow();
      mockPrisma.priceList.create.mockResolvedValue(row);

      const result = await service.createPriceList(validData, uuid() as any);

      expect(result.code).toBe(row.code);
      expect(mockPrisma.priceList.create).toHaveBeenCalledTimes(1);
    });

    it('throws CONFLICT when code already exists', async () => {
      mockPrisma.priceList.findFirst.mockResolvedValue({ id: uuid() });

      await expect(service.createPriceList(validData, uuid() as any)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('throws VALIDATION_ERROR when valid_to is before valid_from', async () => {
      mockPrisma.priceList.findFirst.mockResolvedValue(null);

      await expect(
        service.createPriceList(
          { ...validData, valid_from: new Date('2025-06-01'), valid_to: new Date('2025-01-01') },
          uuid() as any,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ── updatePrices ────────────────────────────────────────────────────────────

  describe('updatePrices', () => {
    it('upserts price items and invalidates cache', async () => {
      mockPrisma.priceList.findFirst.mockResolvedValue({ id: uuid(), name: 'PL' });
      mockPrisma.priceListItem.upsert.mockResolvedValue({});

      await service.updatePrices(
        uuid() as any,
        [{ product_id: uuid2(), unit_price: 5000 }],
        uuid() as any,
      );

      expect(mockPrisma.priceListItem.upsert).toHaveBeenCalledTimes(1);
      expect(mockCache.delByPattern).toHaveBeenCalledWith('active_price:*');
    });

    it('throws NOT_FOUND when price list does not exist', async () => {
      mockPrisma.priceList.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePrices(uuid() as any, [{ product_id: uuid2(), unit_price: 5000 }], uuid() as any),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ── Property-Based Tests ────────────────────────────────────────────────────

  describe('PBT: getActivePrice always returns a non-negative price', () => {
    it('price is always >= 0 regardless of source', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 1_000_000, noNaN: true }),
          async (rawPrice) => {
            jest.clearAllMocks();
            mockCache.get.mockResolvedValue(null);
            mockCache.set.mockResolvedValue(undefined);

            // Simulate fallback to product default
            mockPrisma.priceListItem.findMany.mockResolvedValue([]);
            mockPrisma.product.findFirst.mockResolvedValue({
              id: uuid(),
              selling_price: { valueOf: () => rawPrice, toString: () => String(rawPrice) },
            });

            const result = await service.getActivePrice(uuid() as any, null, new Date());
            return result.price >= 0;
          },
        ),
        { numRuns: 50 },
      );
    });

    it('customer-specific price always takes priority over general price list', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: 0, max: 500_000, noNaN: true }),
          fc.float({ min: 0, max: 500_000, noNaN: true }),
          async (customerPrice, generalPrice) => {
            jest.clearAllMocks();
            mockCache.get.mockResolvedValue(null);
            mockCache.set.mockResolvedValue(undefined);

            const cId = uuid2();
            mockPrisma.priceListItem.findMany.mockResolvedValue([
              {
                price_list_id: uuid3(),
                unit_price: { valueOf: () => customerPrice, toString: () => String(customerPrice) },
                price_list: { id: uuid3(), customer_id: cId },
              },
              {
                price_list_id: uuid(),
                unit_price: { valueOf: () => generalPrice, toString: () => String(generalPrice) },
                price_list: { id: uuid(), customer_id: null },
              },
            ]);

            const result = await service.getActivePrice(uuid() as any, cId as any, new Date());
            return result.source === 'PRICE_LIST_CUSTOMER' && result.price === customerPrice;
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
