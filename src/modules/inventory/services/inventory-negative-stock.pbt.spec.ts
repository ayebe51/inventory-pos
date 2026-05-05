import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { StockMovementDTO } from '../interfaces/inventory.interfaces';

/**
 * Property-Based Tests for BR-INV-001: Negative Stock Check
 *
 * These tests verify that the negative stock check invariant holds for all possible
 * combinations of stock movements using property-based testing with fast-check.
 */
describe('InventoryService - BR-INV-001 Property-Based Tests', () => {
  let service: InventoryService;
  let prisma: PrismaService;

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
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  /**
   * Property: For any stock-out transaction, if current_qty < qty_out,
   * then the transaction MUST be rejected with INSUFFICIENT_STOCK error
   */
  it('should always reject stock-out when qty_out > current_qty', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          current_qty: fc.integer({ min: 0, max: 1000 }),
          qty_out: fc.integer({ min: 1, max: 2000 }),
          unit_cost: fc.integer({ min: 0, max: 100000 }),
        }),
        async ({ current_qty, qty_out, unit_cost }) => {
          // Only test cases where qty_out > current_qty (insufficient stock)
          fc.pre(qty_out > current_qty);

          // Arrange
          const movementData: StockMovementDTO = {
            product_id: '550e8400-e29b-41d4-a716-446655440001',
            warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
            transaction_type: 'SO',
            reference_type: 'SO',
            reference_id: '550e8400-e29b-41d4-a716-446655440003',
            reference_number: 'SO-202501-00001',
            movement_date: new Date('2025-01-15'),
            qty_in: 0,
            qty_out: qty_out,
            unit_cost: unit_cost,
            created_by: '550e8400-e29b-41d4-a716-446655440004',
          };

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
            current_qty > 0
              ? {
                  running_qty: current_qty,
                  running_cost: current_qty * unit_cost,
                }
              : null,
          );

          // Act & Assert
          let threwError = false;
          try {
            await service.recordMovement(movementData);
          } catch (error) {
            threwError = true;
            expect(error).toBeInstanceOf(BusinessRuleException);
            const response = (error as any).getResponse();
            expect(response.error.code).toBe(ErrorCode.INSUFFICIENT_STOCK);
          }

          // Verify error was thrown
          expect(threwError).toBe(true);

          // Verify no database write occurred
          expect(
            mockPrismaService.inventoryLedger.create,
          ).not.toHaveBeenCalled();

          // Reset for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: For any stock-out transaction, if current_qty >= qty_out,
   * then the transaction MUST succeed and result in non-negative balance
   */
  it('should always allow stock-out when qty_out <= current_qty', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          current_qty: fc.integer({ min: 1, max: 1000 }),
          qty_out: fc.integer({ min: 1, max: 1000 }),
          unit_cost: fc.integer({ min: 1, max: 100000 }),
        }),
        async ({ current_qty, qty_out, unit_cost }) => {
          // Only test cases where qty_out <= current_qty (sufficient stock)
          fc.pre(qty_out <= current_qty);

          // Arrange
          const movementData: StockMovementDTO = {
            product_id: '550e8400-e29b-41d4-a716-446655440001',
            warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
            transaction_type: 'SO',
            reference_type: 'SO',
            reference_id: '550e8400-e29b-41d4-a716-446655440003',
            reference_number: 'SO-202501-00001',
            movement_date: new Date('2025-01-15'),
            qty_in: 0,
            qty_out: qty_out,
            unit_cost: unit_cost,
            created_by: '550e8400-e29b-41d4-a716-446655440004',
          };

          const currentValue = current_qty * unit_cost;
          const avgCost = currentValue / current_qty;
          const outgoingValue = qty_out * avgCost;
          const expectedQty = current_qty - qty_out;
          const expectedValue = Math.max(0, currentValue - outgoingValue);

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
            running_qty: current_qty,
            running_cost: currentValue,
          });

          const mockCreatedEntry = {
            id: '550e8400-e29b-41d4-a716-446655440010',
            ...movementData,
            total_cost: 0,
            running_qty: expectedQty,
            running_cost: expectedValue,
            batch_number: null,
            serial_number: null,
            created_at: new Date(),
          };

          mockPrismaService.inventoryLedger.create.mockResolvedValue(
            mockCreatedEntry,
          );

          // Act
          const result = await service.recordMovement(movementData);

          // Assert - BR-INV-001: Balance must be >= 0
          expect(result.running_qty).toBeGreaterThanOrEqual(0);
          expect(result.running_qty).toBe(expectedQty);

          // Verify database write occurred
          expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
            1,
          );

          // Reset for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Stock-in transactions should ALWAYS succeed regardless of current balance
   */
  it('should always allow stock-in transactions regardless of current balance', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          current_qty: fc.integer({ min: -100, max: 1000 }), // Allow negative for edge case testing
          qty_in: fc.integer({ min: 1, max: 1000 }),
          unit_cost: fc.integer({ min: 0, max: 100000 }),
        }),
        async ({ current_qty, qty_in, unit_cost }) => {
          // Arrange
          const movementData: StockMovementDTO = {
            product_id: '550e8400-e29b-41d4-a716-446655440001',
            warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
            transaction_type: 'GR',
            reference_type: 'PO',
            reference_id: '550e8400-e29b-41d4-a716-446655440003',
            reference_number: 'PO-202501-00001',
            movement_date: new Date('2025-01-15'),
            qty_in: qty_in,
            qty_out: 0,
            unit_cost: unit_cost,
            created_by: '550e8400-e29b-41d4-a716-446655440004',
          };

          const currentValue = current_qty > 0 ? current_qty * unit_cost : 0;
          const incomingValue = qty_in * unit_cost;
          const expectedQty = current_qty + qty_in;
          const expectedValue = Math.max(0, currentValue + incomingValue);

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
            current_qty !== 0
              ? {
                  running_qty: current_qty,
                  running_cost: currentValue,
                }
              : null,
          );

          const mockCreatedEntry = {
            id: '550e8400-e29b-41d4-a716-446655440020',
            ...movementData,
            total_cost: incomingValue,
            running_qty: expectedQty,
            running_cost: expectedValue,
            batch_number: null,
            serial_number: null,
            created_at: new Date(),
          };

          mockPrismaService.inventoryLedger.create.mockResolvedValue(
            mockCreatedEntry,
          );

          // Act
          const result = await service.recordMovement(movementData);

          // Assert - Stock-in should always succeed
          expect(result).toBeDefined();
          expect(result.qty_in).toBe(qty_in);
          expect(result.qty_out).toBe(0);
          expect(result.running_qty).toBe(expectedQty);

          // Verify database write occurred
          expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
            1,
          );

          // Reset for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: For a sequence of movements, the final balance must equal
   * SUM(qty_in) - SUM(qty_out), and must never go negative during the sequence
   */
  it('should maintain non-negative balance through sequence of movements', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            is_in: fc.boolean(),
            qty: fc.integer({ min: 1, max: 100 }),
            unit_cost: fc.integer({ min: 1, max: 10000 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (movements) => {
          let currentQty = 0;
          let currentValue = 0;
          let totalIn = 0;
          let totalOut = 0;

          for (const movement of movements) {
            const qty_in = movement.is_in ? movement.qty : 0;
            const qty_out = movement.is_in ? 0 : movement.qty;

            // Skip if this would cause negative balance
            if (!movement.is_in && qty_out > currentQty) {
              continue;
            }

            // Arrange
            const movementData: StockMovementDTO = {
              product_id: '550e8400-e29b-41d4-a716-446655440001',
              warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
              transaction_type: movement.is_in ? 'GR' : 'SO',
              reference_type: movement.is_in ? 'PO' : 'SO',
              reference_id: '550e8400-e29b-41d4-a716-446655440003',
              reference_number: movement.is_in
                ? 'PO-202501-00001'
                : 'SO-202501-00001',
              movement_date: new Date('2025-01-15'),
              qty_in: qty_in,
              qty_out: qty_out,
              unit_cost: movement.unit_cost,
              created_by: '550e8400-e29b-41d4-a716-446655440004',
            };

            mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
              currentQty > 0
                ? {
                    running_qty: currentQty,
                    running_cost: currentValue,
                  }
                : null,
            );

            // Calculate new balance
            const incomingValue = qty_in * movement.unit_cost;
            const avgCost = currentQty > 0 ? currentValue / currentQty : 0;
            const outgoingValue = qty_out * avgCost;

            currentQty = currentQty + qty_in - qty_out;
            currentValue = Math.max(0, currentValue + incomingValue - outgoingValue);

            totalIn += qty_in;
            totalOut += qty_out;

            const mockCreatedEntry = {
              id: `550e8400-e29b-41d4-a716-44665544${movements.indexOf(movement)}`,
              ...movementData,
              total_cost: incomingValue,
              running_qty: currentQty,
              running_cost: currentValue,
              batch_number: null,
              serial_number: null,
              created_at: new Date(),
            };

            mockPrismaService.inventoryLedger.create.mockResolvedValue(
              mockCreatedEntry,
            );

            // Act
            const result = await service.recordMovement(movementData);

            // Assert - BR-INV-001: Balance must never be negative
            expect(result.running_qty).toBeGreaterThanOrEqual(0);
            expect(result.running_qty).toBe(currentQty);
          }

          // Final assertion: balance = SUM(qty_in) - SUM(qty_out)
          expect(currentQty).toBe(totalIn - totalOut);
          expect(currentQty).toBeGreaterThanOrEqual(0);

          // Reset for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * Property: Attempting to take out more than available should always fail,
   * regardless of the transaction type (SO, TRANSFER_OUT, ADJUSTMENT, etc.)
   */
  it('should reject insufficient stock for all stock-out transaction types', () => {
    const stockOutTypes = [
      'SO',
      'TRANSFER_OUT',
      'ADJUSTMENT',
      'RETURN_OUT',
    ] as const;

    fc.assert(
      fc.asyncProperty(
        fc.record({
          transaction_type: fc.constantFrom(...stockOutTypes),
          current_qty: fc.integer({ min: 0, max: 100 }),
          qty_out: fc.integer({ min: 1, max: 200 }),
          unit_cost: fc.integer({ min: 1, max: 10000 }),
        }),
        async ({ transaction_type, current_qty, qty_out, unit_cost }) => {
          // Only test insufficient stock cases
          fc.pre(qty_out > current_qty);

          // Arrange
          const movementData: StockMovementDTO = {
            product_id: '550e8400-e29b-41d4-a716-446655440001',
            warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
            transaction_type: transaction_type,
            reference_type: transaction_type,
            reference_id: '550e8400-e29b-41d4-a716-446655440003',
            reference_number: `${transaction_type}-202501-00001`,
            movement_date: new Date('2025-01-15'),
            qty_in: 0,
            qty_out: qty_out,
            unit_cost: unit_cost,
            created_by: '550e8400-e29b-41d4-a716-446655440004',
          };

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
            current_qty > 0
              ? {
                  running_qty: current_qty,
                  running_cost: current_qty * unit_cost,
                }
              : null,
          );

          // Act & Assert
          let threwError = false;
          try {
            await service.recordMovement(movementData);
          } catch (error) {
            threwError = true;
            expect(error).toBeInstanceOf(BusinessRuleException);
            const response = (error as any).getResponse();
            expect(response.error.code).toBe(ErrorCode.INSUFFICIENT_STOCK);
          }

          // Verify error was thrown
          expect(threwError).toBe(true);

          // Verify no database write occurred
          expect(
            mockPrismaService.inventoryLedger.create,
          ).not.toHaveBeenCalled();

          // Reset for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: The boundary case where qty_out exactly equals current_qty
   * should always succeed and result in zero balance
   */
  it('should allow stock-out when qty_out exactly equals current_qty (boundary case)', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          qty: fc.integer({ min: 1, max: 1000 }),
          unit_cost: fc.integer({ min: 1, max: 100000 }),
        }),
        async ({ qty, unit_cost }) => {
          // Arrange - qty_out exactly equals current_qty
          const movementData: StockMovementDTO = {
            product_id: '550e8400-e29b-41d4-a716-446655440001',
            warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
            transaction_type: 'SO',
            reference_type: 'SO',
            reference_id: '550e8400-e29b-41d4-a716-446655440003',
            reference_number: 'SO-202501-00001',
            movement_date: new Date('2025-01-15'),
            qty_in: 0,
            qty_out: qty,
            unit_cost: unit_cost,
            created_by: '550e8400-e29b-41d4-a716-446655440004',
          };

          mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
            running_qty: qty,
            running_cost: qty * unit_cost,
          });

          const mockCreatedEntry = {
            id: '550e8400-e29b-41d4-a716-446655440030',
            ...movementData,
            total_cost: 0,
            running_qty: 0,
            running_cost: 0,
            batch_number: null,
            serial_number: null,
            created_at: new Date(),
          };

          mockPrismaService.inventoryLedger.create.mockResolvedValue(
            mockCreatedEntry,
          );

          // Act
          const result = await service.recordMovement(movementData);

          // Assert - Should succeed with exactly zero balance
          expect(result.running_qty).toBe(0);
          expect(result.running_cost).toBe(0);

          // Verify database write occurred
          expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
            1,
          );

          // Reset for next iteration
          jest.clearAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});
