/**
 * Property-Based Tests for Weighted Average Cost (WAC) Calculation
 *
 * **Validates: Requirements 3.11**
 *
 * These tests verify that the WAC calculation algorithm maintains critical invariants
 * across all valid input combinations.
 *
 * WAC Formula: WAC_baru = (nilai_stok_lama + nilai_masuk_baru) / (qty_stok_lama + qty_masuk_baru)
 *
 * Business Rules:
 * - BR-INV-003: Average cost must be >= 0
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceiptService } from './goods-receipt.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService } from '../../../services/numbering/numbering.service';

describe('GoodsReceiptService - WAC Property-Based Tests', () => {
  let service: GoodsReceiptService;
  let prisma: jest.Mocked<PrismaService>;

  const mockProductId = '00000000-0000-0000-0000-000000000004';
  const mockWarehouseId = '00000000-0000-0000-0000-000000000011';

  beforeEach(async () => {
    const mockPrisma = {
      inventoryLedger: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    const mockAudit = {
      record: jest.fn().mockResolvedValue({} as any),
    };

    const mockNumbering = {
      generate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceiptService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: NumberingService, useValue: mockNumbering },
      ],
    }).compile();

    service = module.get<GoodsReceiptService>(GoodsReceiptService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 1: WAC is always non-negative for non-negative inputs
   * BR-INV-003: Average cost >= 0
   */
  it('Property 1: WAC is always >= 0 for all valid non-negative inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.float({ min: 0, max: 1000000, noNaN: true }),
          currentValue: fc.float({ min: 0, max: 100000000, noNaN: true }),
          incomingQty: fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }), // Must be > 0 for receipt
          incomingValue: fc.float({ min: 0, max: 100000000, noNaN: true }),
        }),
        async ({ currentQty, currentValue, incomingQty, incomingValue }) => {
          // Setup mock
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: currentQty,
              running_cost: currentValue,
            },
          ]);

          // Execute
          const wac = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            incomingQty,
            incomingValue,
          );

          // Assert: WAC must be >= 0
          expect(wac).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: WAC equals unit cost when starting from zero stock
   */
  it('Property 2: WAC equals unit cost when current stock is zero', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          incomingQty: fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }),
          unitCost: fc.float({ min: 0, max: 1000000, noNaN: true }),
        }),
        async ({ incomingQty, unitCost }) => {
          const incomingValue = incomingQty * unitCost;

          // Setup mock: zero stock
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([]);

          // Execute
          const wac = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            incomingQty,
            incomingValue,
          );

          // Assert: WAC should equal unit cost (within floating point tolerance)
          expect(wac).toBeCloseTo(unitCost, 2);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: WAC is bounded by min and max unit costs
   * The new WAC should be between the old average cost and the new unit cost
   */
  it('Property 3: WAC is bounded by old average cost and new unit cost', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.float({ min: Math.fround(1), max: 1000000, noNaN: true }),
          oldUnitCost: fc.float({ min: Math.fround(1), max: 100000, noNaN: true }),
          incomingQty: fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }),
          newUnitCost: fc.float({ min: Math.fround(1), max: 100000, noNaN: true }),
        }),
        async ({ currentQty, oldUnitCost, incomingQty, newUnitCost }) => {
          const currentValue = currentQty * oldUnitCost;
          const incomingValue = incomingQty * newUnitCost;

          // Setup mock
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: currentQty,
              running_cost: currentValue,
            },
          ]);

          // Execute
          const wac = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            incomingQty,
            incomingValue,
          );

          // Assert: WAC should be between min and max of old and new unit costs
          const minCost = Math.min(oldUnitCost, newUnitCost);
          const maxCost = Math.max(oldUnitCost, newUnitCost);

          expect(wac).toBeGreaterThanOrEqual(minCost - 0.01); // Small tolerance for floating point
          expect(wac).toBeLessThanOrEqual(maxCost + 0.01);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 4: Total value equals WAC × total quantity
   * This verifies the fundamental accounting equation
   */
  it('Property 4: Total value = WAC × total quantity (accounting equation)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.float({ min: 0, max: 1000000, noNaN: true }),
          currentValue: fc.float({ min: 0, max: 100000000, noNaN: true }),
          incomingQty: fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }),
          incomingValue: fc.float({ min: 0, max: 100000000, noNaN: true }),
        }),
        async ({ currentQty, currentValue, incomingQty, incomingValue }) => {
          // Setup mock
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: currentQty,
              running_cost: currentValue,
            },
          ]);

          // Execute
          const wac = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            incomingQty,
            incomingValue,
          );

          // Calculate expected values
          const totalQty = currentQty + incomingQty;
          const totalValue = currentValue + incomingValue;

          // Assert: WAC × totalQty should equal totalValue (within tolerance)
          const calculatedValue = wac * totalQty;
          expect(calculatedValue).toBeCloseTo(totalValue, 2);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 5: WAC is commutative for same total quantities and values
   * Receiving 100@10 then 50@20 should give same WAC as 50@20 then 100@10
   */
  it('Property 5: WAC is commutative (order of receipts does not matter for final WAC)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          qty1: fc.float({ min: 1, max: 10000, noNaN: true }),
          cost1: fc.float({ min: 1, max: 10000, noNaN: true }),
          qty2: fc.float({ min: 1, max: 10000, noNaN: true }),
          cost2: fc.float({ min: 1, max: 10000, noNaN: true }),
        }),
        async ({ qty1, cost1, qty2, cost2 }) => {
          const value1 = qty1 * cost1;
          const value2 = qty2 * cost2;

          // Scenario A: Receive batch 1 first, then batch 2
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([]);
          const wacAfterFirst = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            qty1,
            value1,
          );

          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: qty1,
              running_cost: value1,
            },
          ]);
          const wacScenarioA = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            qty2,
            value2,
          );

          // Scenario B: Receive batch 2 first, then batch 1
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([]);
          const wacAfterSecond = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            qty2,
            value2,
          );

          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: qty2,
              running_cost: value2,
            },
          ]);
          const wacScenarioB = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            qty1,
            value1,
          );

          // Assert: Both scenarios should result in the same final WAC
          expect(wacScenarioA).toBeCloseTo(wacScenarioB, 2);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property 6: WAC with zero-cost items does not increase average cost
   */
  it('Property 6: Receiving zero-cost items decreases or maintains WAC', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.float({ min: Math.fround(1), max: 1000000, noNaN: true }),
          currentUnitCost: fc.float({ min: Math.fround(1), max: 100000, noNaN: true }),
          incomingQty: fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }),
        }),
        async ({ currentQty, currentUnitCost, incomingQty }) => {
          const currentValue = currentQty * currentUnitCost;
          const incomingValue = 0; // Zero cost items

          // Setup mock
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: currentQty,
              running_cost: currentValue,
            },
          ]);

          // Execute
          const wac = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            incomingQty,
            incomingValue,
          );

          // Assert: New WAC should be <= old unit cost
          expect(wac).toBeLessThanOrEqual(currentUnitCost + 0.01);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7: WAC calculation is stable (no NaN or Infinity)
   */
  it('Property 7: WAC calculation never produces NaN or Infinity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.float({ min: 0, max: 1000000, noNaN: true }),
          currentValue: fc.float({ min: 0, max: 100000000, noNaN: true }),
          incomingQty: fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }),
          incomingValue: fc.float({ min: 0, max: 100000000, noNaN: true }),
        }),
        async ({ currentQty, currentValue, incomingQty, incomingValue }) => {
          // Setup mock
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: currentQty,
              running_cost: currentValue,
            },
          ]);

          // Execute
          const wac = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            incomingQty,
            incomingValue,
          );

          // Assert: WAC must be a finite number
          expect(Number.isFinite(wac)).toBe(true);
          expect(Number.isNaN(wac)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: Receiving items at same cost maintains WAC
   */
  it('Property 8: Receiving items at current WAC maintains the same WAC', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.float({ min: Math.fround(1), max: 1000000, noNaN: true }),
          unitCost: fc.float({ min: Math.fround(1), max: 100000, noNaN: true }),
          incomingQty: fc.float({ min: Math.fround(0.01), max: 1000000, noNaN: true }),
        }),
        async ({ currentQty, unitCost, incomingQty }) => {
          const currentValue = currentQty * unitCost;
          const incomingValue = incomingQty * unitCost; // Same unit cost

          // Setup mock
          (prisma.inventoryLedger.findMany as jest.Mock).mockResolvedValue([
            {
              running_qty: currentQty,
              running_cost: currentValue,
            },
          ]);

          // Execute
          const wac = await service.updateAverageCost(
            mockProductId,
            mockWarehouseId,
            incomingQty,
            incomingValue,
          );

          // Assert: WAC should remain the same (within tolerance)
          expect(wac).toBeCloseTo(unitCost, 2);
        },
      ),
      { numRuns: 100 },
    );
  });
});

