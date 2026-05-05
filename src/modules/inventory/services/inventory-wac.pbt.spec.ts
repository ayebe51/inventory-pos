import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../../config/prisma.service';

/**
 * Property-Based Tests for BR-INV-003: WAC (Weighted Average Cost) Calculation
 *
 * These tests verify that the WAC formula invariants hold for all possible
 * combinations of stock quantities and costs using property-based testing with fast-check.
 *
 * WAC Formula: ROUND((current_value + incoming_cost) / (current_qty + incoming_qty), 4)
 */
describe('InventoryService - WAC Property-Based Tests (BR-INV-003)', () => {
  let service: InventoryService;

  const mockPrismaService = {
    inventoryLedger: {
      create: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);

    jest.clearAllMocks();
  });

  /**
   * Property 1: WAC result is always >= 0 (BR-INV-003)
   *
   * For any valid inputs (currentQty >= 0, currentCost >= 0, incomingQty > 0, incomingCost >= 0),
   * the WAC result must always be >= 0.
   *
   * **Validates: Requirements BR-INV-003**
   */
  it('WAC result is always >= 0 for any valid inputs (BR-INV-003)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.integer({ min: 0, max: 10000 }),
          currentAvgCost: fc.integer({ min: 0, max: 1000000 }),
          incomingQty: fc.integer({ min: 1, max: 10000 }),
          incomingCost: fc.integer({ min: 0, max: 100000000 }),
        }),
        async ({ currentQty, currentAvgCost, incomingQty, incomingCost }) => {
          // Arrange
          const currentValue = currentQty * currentAvgCost;
          const runningQty = currentQty;
          const runningCost = currentValue;

          mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
            _sum: {
              qty_in: currentQty,
              qty_out: 0,
            },
          });

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
            currentQty > 0
              ? { running_qty: runningQty, running_cost: runningCost }
              : null,
          );

          // Act
          const result = await service.calculateAverageCost(
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002',
            incomingQty,
            incomingCost,
          );

          // Assert - BR-INV-003: WAC must always be >= 0
          expect(result).toBeGreaterThanOrEqual(0);

          jest.clearAllMocks();
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property 2: WAC formula correctness
   *
   * For any valid inputs, WAC = ROUND((currentQty * currentAvgCost + incomingCost) / (currentQty + incomingQty), 4)
   *
   * **Validates: Requirements BR-INV-003**
   */
  it('WAC equals ROUND((currentValue + incomingCost) / (currentQty + incomingQty), 4)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.integer({ min: 0, max: 10000 }),
          currentAvgCost: fc.integer({ min: 0, max: 100000 }),
          incomingQty: fc.integer({ min: 1, max: 10000 }),
          incomingCost: fc.integer({ min: 0, max: 100000000 }),
        }),
        async ({ currentQty, currentAvgCost, incomingQty, incomingCost }) => {
          // Arrange
          const currentValue = currentQty * currentAvgCost;

          mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
            _sum: {
              qty_in: currentQty,
              qty_out: 0,
            },
          });

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
            currentQty > 0
              ? { running_qty: currentQty, running_cost: currentValue }
              : null,
          );

          // Act
          const result = await service.calculateAverageCost(
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002',
            incomingQty,
            incomingCost,
          );

          // Calculate expected WAC using the formula
          const totalQty = currentQty + incomingQty;
          const totalValue = currentValue + incomingCost;
          const expectedWAC =
            totalQty > 0
              ? Math.max(0, Math.round((totalValue / totalQty) * 10000) / 10000)
              : 0;

          // Assert - WAC must match the formula
          expect(result).toBe(expectedWAC);

          jest.clearAllMocks();
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property 3: WAC is rounded to exactly 4 decimal places
   *
   * The result must have at most 4 decimal places.
   *
   * **Validates: Requirements BR-INV-003**
   */
  it('WAC result is always rounded to at most 4 decimal places', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.integer({ min: 0, max: 1000 }),
          currentAvgCost: fc.integer({ min: 0, max: 100000 }),
          incomingQty: fc.integer({ min: 1, max: 1000 }),
          incomingCost: fc.integer({ min: 0, max: 10000000 }),
        }),
        async ({ currentQty, currentAvgCost, incomingQty, incomingCost }) => {
          // Arrange
          const currentValue = currentQty * currentAvgCost;

          mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
            _sum: {
              qty_in: currentQty,
              qty_out: 0,
            },
          });

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
            currentQty > 0
              ? { running_qty: currentQty, running_cost: currentValue }
              : null,
          );

          // Act
          const result = await service.calculateAverageCost(
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002',
            incomingQty,
            incomingCost,
          );

          // Assert - Result must have at most 4 decimal places
          // Multiply by 10000, round, and divide back — should equal original
          const roundedBack = Math.round(result * 10000) / 10000;
          expect(result).toBe(roundedBack);

          jest.clearAllMocks();
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property 4: WAC without incoming goods returns current average cost
   *
   * When called without incomingQty/incomingCost, the result equals
   * ROUND(currentValue / currentQty, 4) for currentQty > 0, or 0 otherwise.
   *
   * **Validates: Requirements BR-INV-003**
   */
  it('WAC without incoming goods returns current average cost', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          currentQty: fc.integer({ min: 1, max: 10000 }),
          currentAvgCost: fc.integer({ min: 0, max: 100000 }),
        }),
        async ({ currentQty, currentAvgCost }) => {
          // Arrange
          const currentValue = currentQty * currentAvgCost;

          mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
            _sum: {
              qty_in: currentQty,
              qty_out: 0,
            },
          });

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
            running_qty: currentQty,
            running_cost: currentValue,
          });

          // Act - Call without incoming goods
          const result = await service.calculateAverageCost(
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002',
          );

          // Calculate expected current average cost
          const expectedAvgCost = Math.max(
            0,
            Math.round((currentValue / currentQty) * 10000) / 10000,
          );

          // Assert
          expect(result).toBe(expectedAvgCost);

          jest.clearAllMocks();
        },
      ),
      { numRuns: 200 },
    );
  });

  /**
   * Property 5: WAC with zero total quantity returns 0
   *
   * When currentQty = 0 and incomingQty = 0 (or no incoming), result must be 0.
   *
   * **Validates: Requirements BR-INV-003**
   */
  it('WAC returns 0 when total quantity is 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          incomingCost: fc.integer({ min: 0, max: 10000000 }),
        }),
        async ({ incomingCost }) => {
          // Arrange - No current stock, no incoming qty
          mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
            _sum: {
              qty_in: null,
              qty_out: null,
            },
          });

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null);

          // Act - Call without incomingQty (defaults to 0)
          const result = await service.calculateAverageCost(
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002',
            0,
            incomingCost,
          );

          // Assert - totalQty = 0 + 0 = 0, so result must be 0
          expect(result).toBe(0);

          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});
