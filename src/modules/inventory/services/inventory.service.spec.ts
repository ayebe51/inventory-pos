import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { StockMovementDTO } from '../interfaces/inventory.interfaces';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: PrismaService;

  const mockPrismaService = {
    inventoryLedger: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('recordMovement', () => {
    const validMovementData: StockMovementDTO = {
      product_id: '550e8400-e29b-41d4-a716-446655440001',
      warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
      transaction_type: 'GR',
      reference_type: 'PO',
      reference_id: '550e8400-e29b-41d4-a716-446655440003',
      reference_number: 'PO-202501-00001',
      movement_date: new Date('2025-01-15'),
      qty_in: 100,
      qty_out: 0,
      unit_cost: 10000,
      notes: 'Goods receipt from supplier',
      created_by: '550e8400-e29b-41d4-a716-446655440004',
    };

    it('should successfully record a stock-in movement (append-only)', async () => {
      // Arrange
      const mockLatestEntry = {
        running_qty: 50,
        running_cost: 500000,
      };

      const mockCreatedEntry = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        product_id: validMovementData.product_id,
        warehouse_id: validMovementData.warehouse_id,
        transaction_type: validMovementData.transaction_type,
        reference_type: validMovementData.reference_type,
        reference_id: validMovementData.reference_id,
        reference_number: validMovementData.reference_number,
        movement_date: validMovementData.movement_date,
        qty_in: 100,
        qty_out: 0,
        unit_cost: 10000,
        total_cost: 1000000,
        running_qty: 150,
        running_cost: 1500000,
        batch_number: null,
        serial_number: null,
        notes: validMovementData.notes,
        created_by: validMovementData.created_by,
        created_at: new Date(),
      };

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );
      mockPrismaService.inventoryLedger.create.mockResolvedValue(
        mockCreatedEntry,
      );

      // Act
      const result = await service.recordMovement(validMovementData);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockCreatedEntry.id);
      expect(result.qty_in).toBe(100);
      expect(result.qty_out).toBe(0);
      expect(result.running_qty).toBe(150);
      expect(result.running_cost).toBe(1500000);

      // Verify append-only: only create was called, never update or delete
      expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
        1,
      );
      expect(mockPrismaService.inventoryLedger.update).not.toHaveBeenCalled();
      expect(mockPrismaService.inventoryLedger.delete).not.toHaveBeenCalled();
    });

    it('should successfully record a stock-out movement', async () => {
      // Arrange
      const stockOutData: StockMovementDTO = {
        ...validMovementData,
        transaction_type: 'SO',
        qty_in: 0,
        qty_out: 30,
      };

      const mockLatestEntry = {
        running_qty: 150,
        running_cost: 1500000,
      };

      const mockCreatedEntry = {
        id: '550e8400-e29b-41d4-a716-446655440011',
        ...stockOutData,
        total_cost: 0,
        running_qty: 120,
        running_cost: 1200000,
        batch_number: null,
        serial_number: null,
        created_at: new Date(),
      };

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );
      mockPrismaService.inventoryLedger.create.mockResolvedValue(
        mockCreatedEntry,
      );

      // Act
      const result = await service.recordMovement(stockOutData);

      // Assert
      expect(result.qty_in).toBe(0);
      expect(result.qty_out).toBe(30);
      expect(result.running_qty).toBe(120);

      // Verify append-only behavior (BR-INV-002)
      expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
        1,
      );
      expect(mockPrismaService.inventoryLedger.update).not.toHaveBeenCalled();
      expect(mockPrismaService.inventoryLedger.delete).not.toHaveBeenCalled();
    });

    it('should record first movement with zero initial balance', async () => {
      // Arrange
      const firstMovementData: StockMovementDTO = {
        ...validMovementData,
        qty_in: 50,
        qty_out: 0,
        unit_cost: 12000,
      };

      // No previous entries
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      const mockCreatedEntry = {
        id: '550e8400-e29b-41d4-a716-446655440012',
        ...firstMovementData,
        total_cost: 600000,
        running_qty: 50,
        running_cost: 600000,
        batch_number: null,
        serial_number: null,
        created_at: new Date(),
      };

      mockPrismaService.inventoryLedger.create.mockResolvedValue(
        mockCreatedEntry,
      );

      // Act
      const result = await service.recordMovement(firstMovementData);

      // Assert
      expect(result.running_qty).toBe(50);
      expect(result.running_cost).toBe(600000);
      expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should throw error if qty_in is negative', async () => {
      // Arrange
      const invalidData: StockMovementDTO = {
        ...validMovementData,
        qty_in: -10,
      };

      // Act & Assert
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        'qty_in must be >= 0',
      );

      // Verify no database operation was performed
      expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('should throw error if qty_out is negative', async () => {
      // Arrange
      const invalidData: StockMovementDTO = {
        ...validMovementData,
        qty_in: 0,
        qty_out: -5,
      };

      // Act & Assert
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        'qty_out must be >= 0',
      );

      expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('should throw error if both qty_in and qty_out are > 0', async () => {
      // Arrange
      const invalidData: StockMovementDTO = {
        ...validMovementData,
        qty_in: 10,
        qty_out: 5,
      };

      // Act & Assert
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        'Cannot have both qty_in and qty_out > 0 in the same movement',
      );

      expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('should throw error if both qty_in and qty_out are 0', async () => {
      // Arrange
      const invalidData: StockMovementDTO = {
        ...validMovementData,
        qty_in: 0,
        qty_out: 0,
      };

      // Act & Assert
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        'Either qty_in or qty_out must be > 0',
      );

      expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('should throw error if unit_cost is negative', async () => {
      // Arrange
      const invalidData: StockMovementDTO = {
        ...validMovementData,
        unit_cost: -1000,
      };

      // Act & Assert
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        'unit_cost must be >= 0',
      );

      expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('should throw error if movement_date is in the future', async () => {
      // Arrange
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const invalidData: StockMovementDTO = {
        ...validMovementData,
        movement_date: futureDate,
      };

      // Act & Assert
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.recordMovement(invalidData)).rejects.toThrow(
        'movement_date cannot be in the future',
      );

      expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
    });

    it('should calculate correct running balance for multiple movements', async () => {
      // Arrange - Simulate multiple sequential movements
      const movements = [
        { qty_in: 100, qty_out: 0, unit_cost: 10000 }, // +100 @ 10000
        { qty_in: 50, qty_out: 0, unit_cost: 12000 }, // +50 @ 12000
        { qty_in: 0, qty_out: 30, unit_cost: 0 }, // -30
      ];

      let currentQty = 0;
      let currentValue = 0;

      for (const movement of movements) {
        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: currentQty,
          running_cost: currentValue,
        });

        const incomingValue = movement.qty_in * movement.unit_cost;
        const avgCost = currentQty > 0 ? currentValue / currentQty : 0;
        const outgoingValue = movement.qty_out * avgCost;

        currentQty = currentQty + movement.qty_in - movement.qty_out;
        currentValue = currentValue + incomingValue - outgoingValue;

        const mockCreatedEntry = {
          id: `550e8400-e29b-41d4-a716-44665544${movements.indexOf(movement)}`,
          ...validMovementData,
          qty_in: movement.qty_in,
          qty_out: movement.qty_out,
          unit_cost: movement.unit_cost,
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

        const result = await service.recordMovement({
          ...validMovementData,
          qty_in: movement.qty_in,
          qty_out: movement.qty_out,
          unit_cost: movement.unit_cost,
        });

        expect(result.running_qty).toBe(currentQty);
      }

      // Final balance should be 120 (100 + 50 - 30)
      expect(currentQty).toBe(120);

      // Verify all movements were append-only
      expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
        3,
      );
      expect(mockPrismaService.inventoryLedger.update).not.toHaveBeenCalled();
      expect(mockPrismaService.inventoryLedger.delete).not.toHaveBeenCalled();
    });

    it('should enforce BR-INV-002: append-only ledger (no update/delete)', async () => {
      // Arrange
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 1000000,
      });

      const mockCreatedEntry = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        ...validMovementData,
        total_cost: 1000000,
        running_qty: 200,
        running_cost: 2000000,
        batch_number: null,
        serial_number: null,
        created_at: new Date(),
      };

      mockPrismaService.inventoryLedger.create.mockResolvedValue(
        mockCreatedEntry,
      );

      // Act
      await service.recordMovement(validMovementData);

      // Assert - BR-INV-002: Only CREATE is allowed, never UPDATE or DELETE
      expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
        1,
      );
      expect(mockPrismaService.inventoryLedger.update).not.toHaveBeenCalled();
      expect(mockPrismaService.inventoryLedger.delete).not.toHaveBeenCalled();

      // Verify the service doesn't even have methods to update/delete
      expect((service as any).updateMovement).toBeUndefined();
      expect((service as any).deleteMovement).toBeUndefined();
    });

    it('should handle different transaction types correctly', async () => {
      // Arrange
      const transactionTypes = [
        'GR',
        'SO',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'ADJUSTMENT',
        'OPNAME',
        'RETURN_IN',
        'RETURN_OUT',
      ];

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 1000000,
      });

      for (const txType of transactionTypes) {
        const movementData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: txType as any,
        };

        const mockCreatedEntry = {
          id: `550e8400-e29b-41d4-a716-44665544${transactionTypes.indexOf(txType)}`,
          ...movementData,
          total_cost: 1000000,
          running_qty: 200,
          running_cost: 2000000,
          batch_number: null,
          serial_number: null,
          created_at: new Date(),
        };

        mockPrismaService.inventoryLedger.create.mockResolvedValue(
          mockCreatedEntry,
        );

        // Act
        const result = await service.recordMovement(movementData);

        // Assert
        expect(result.transaction_type).toBe(txType);
      }

      // Verify all were append-only operations
      expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
        transactionTypes.length,
      );
      expect(mockPrismaService.inventoryLedger.update).not.toHaveBeenCalled();
      expect(mockPrismaService.inventoryLedger.delete).not.toHaveBeenCalled();
    });

    it('should ensure running_cost is never negative (BR-INV-003)', async () => {
      // Arrange - Edge case where calculation might result in negative
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 10,
        running_cost: 50000,
      });

      const mockCreatedEntry = {
        id: '550e8400-e29b-41d4-a716-446655440030',
        ...validMovementData,
        qty_in: 0,
        qty_out: 10,
        total_cost: 0,
        running_qty: 0,
        running_cost: 0, // Should be 0, not negative
        batch_number: null,
        serial_number: null,
        created_at: new Date(),
      };

      mockPrismaService.inventoryLedger.create.mockResolvedValue(
        mockCreatedEntry,
      );

      // Act
      const result = await service.recordMovement({
        ...validMovementData,
        qty_in: 0,
        qty_out: 10,
      });

      // Assert - BR-INV-003: running_cost must be >= 0
      expect(result.running_cost).toBeGreaterThanOrEqual(0);
    });

    describe('BR-INV-001: Negative Stock Check', () => {
      it('should reject transaction if balance would become negative', async () => {
        // Arrange - Current stock is 50, trying to take out 100
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 100,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 50,
          running_cost: 500000,
        });

        // Act & Assert
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          /Insufficient stock/,
        );

        // Verify error code is INSUFFICIENT_STOCK
        try {
          await service.recordMovement(stockOutData);
        } catch (error) {
          expect(error).toBeInstanceOf(BusinessRuleException);
          const response = (error as any).getResponse();
          expect(response.error.code).toBe(ErrorCode.INSUFFICIENT_STOCK);
        }

        // Verify no database write occurred
        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should reject transaction if balance would become exactly -1', async () => {
        // Arrange - Current stock is 99, trying to take out 100
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 100,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 99,
          running_cost: 990000,
        });

        // Act & Assert
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          /Insufficient stock/,
        );

        // Verify the error message includes product and warehouse IDs
        try {
          await service.recordMovement(stockOutData);
        } catch (error) {
          const errorMessage = (error as Error).message;
          expect(errorMessage).toContain(stockOutData.product_id);
          expect(errorMessage).toContain(stockOutData.warehouse_id);
          expect(errorMessage).toContain('-1'); // Expected negative balance
        }

        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should reject transaction if trying to take out from zero stock', async () => {
        // Arrange - No stock available
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 1,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null); // No previous entries

        // Act & Assert
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          /Insufficient stock/,
        );

        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should allow transaction if balance would become exactly zero', async () => {
        // Arrange - Current stock is 100, taking out exactly 100
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 100,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 100,
          running_cost: 1000000,
        });

        const mockCreatedEntry = {
          id: '550e8400-e29b-41d4-a716-446655440040',
          ...stockOutData,
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
        const result = await service.recordMovement(stockOutData);

        // Assert - Should succeed with zero balance
        expect(result.running_qty).toBe(0);
        expect(result.running_cost).toBe(0);
        expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
          1,
        );
      });

      it('should allow transaction if balance remains positive', async () => {
        // Arrange - Current stock is 100, taking out 50
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 50,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 100,
          running_cost: 1000000,
        });

        const mockCreatedEntry = {
          id: '550e8400-e29b-41d4-a716-446655440041',
          ...stockOutData,
          total_cost: 0,
          running_qty: 50,
          running_cost: 500000,
          batch_number: null,
          serial_number: null,
          created_at: new Date(),
        };

        mockPrismaService.inventoryLedger.create.mockResolvedValue(
          mockCreatedEntry,
        );

        // Act
        const result = await service.recordMovement(stockOutData);

        // Assert - Should succeed with positive balance
        expect(result.running_qty).toBe(50);
        expect(result.running_cost).toBe(500000);
        expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
          1,
        );
      });

      it('should reject large stock-out that exceeds available quantity', async () => {
        // Arrange - Current stock is 10, trying to take out 1000
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 1000,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 10,
          running_cost: 100000,
        });

        // Act & Assert
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          /Insufficient stock/,
        );

        // Verify the error message shows the large negative balance
        try {
          await service.recordMovement(stockOutData);
        } catch (error) {
          const errorMessage = (error as Error).message;
          expect(errorMessage).toContain('-990'); // 10 - 1000 = -990
        }

        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should check negative stock for TRANSFER_OUT transaction type', async () => {
        // Arrange
        const transferOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'TRANSFER_OUT',
          qty_in: 0,
          qty_out: 150,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 100,
          running_cost: 1000000,
        });

        // Act & Assert
        await expect(service.recordMovement(transferOutData)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.recordMovement(transferOutData)).rejects.toThrow(
          /Insufficient stock/,
        );

        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should check negative stock for ADJUSTMENT transaction type (stock decrease)', async () => {
        // Arrange
        const adjustmentData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'ADJUSTMENT',
          qty_in: 0,
          qty_out: 75,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 50,
          running_cost: 500000,
        });

        // Act & Assert
        await expect(service.recordMovement(adjustmentData)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.recordMovement(adjustmentData)).rejects.toThrow(
          /Insufficient stock/,
        );

        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should not check negative stock for stock-in transactions', async () => {
        // Arrange - Stock-in should always be allowed regardless of current balance
        const stockInData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'GR',
          qty_in: 100,
          qty_out: 0,
        };

        // Even with negative current balance (edge case), stock-in should work
        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: -10, // Edge case: somehow negative
          running_cost: 0,
        });

        const mockCreatedEntry = {
          id: '550e8400-e29b-41d4-a716-446655440042',
          ...stockInData,
          total_cost: 1000000,
          running_qty: 90, // -10 + 100
          running_cost: 1000000,
          batch_number: null,
          serial_number: null,
          created_at: new Date(),
        };

        mockPrismaService.inventoryLedger.create.mockResolvedValue(
          mockCreatedEntry,
        );

        // Act
        const result = await service.recordMovement(stockInData);

        // Assert - Should succeed
        expect(result.running_qty).toBe(90);
        expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
          1,
        );
      });

      it('should include product and warehouse IDs in error message', async () => {
        // Arrange
        const productId = '550e8400-e29b-41d4-a716-446655440099';
        const warehouseId = '550e8400-e29b-41d4-a716-446655440088';

        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          product_id: productId,
          warehouse_id: warehouseId,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 100,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 50,
          running_cost: 500000,
        });

        // Act & Assert
        try {
          await service.recordMovement(stockOutData);
          fail('Should have thrown BusinessRuleException');
        } catch (error) {
          expect(error).toBeInstanceOf(BusinessRuleException);
          const errorMessage = (error as Error).message;
          expect(errorMessage).toContain(productId);
          expect(errorMessage).toContain(warehouseId);
          expect(errorMessage).toContain('Insufficient stock');
          expect(errorMessage).toContain('-50'); // 50 - 100 = -50
        }

        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should log warning when negative stock is detected', async () => {
        // Arrange
        const loggerSpy = jest.spyOn((service as any).logger, 'warn');

        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 200,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 100,
          running_cost: 1000000,
        });

        // Act & Assert
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          BusinessRuleException,
        );

        // Verify warning was logged
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('BR-INV-001 violation'),
        );
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('Insufficient stock'),
        );

        loggerSpy.mockRestore();
      });

      it('should handle decimal quantities in negative stock check', async () => {
        // Arrange - Current stock is 10.5, trying to take out 11
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 11,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 10.5,
          running_cost: 105000,
        });

        // Act & Assert
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.recordMovement(stockOutData)).rejects.toThrow(
          /Insufficient stock/,
        );

        expect(mockPrismaService.inventoryLedger.create).not.toHaveBeenCalled();
      });

      it('should allow decimal quantities that result in positive balance', async () => {
        // Arrange - Current stock is 10.5, taking out 10.25
        const stockOutData: StockMovementDTO = {
          ...validMovementData,
          transaction_type: 'SO',
          qty_in: 0,
          qty_out: 10.25,
        };

        mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
          running_qty: 10.5,
          running_cost: 105000,
        });

        const mockCreatedEntry = {
          id: '550e8400-e29b-41d4-a716-446655440043',
          ...stockOutData,
          total_cost: 0,
          running_qty: 0.25,
          running_cost: 2500,
          batch_number: null,
          serial_number: null,
          created_at: new Date(),
        };

        mockPrismaService.inventoryLedger.create.mockResolvedValue(
          mockCreatedEntry,
        );

        // Act
        const result = await service.recordMovement(stockOutData);

        // Assert - Should succeed
        expect(result.running_qty).toBeCloseTo(0.25, 2);
        expect(mockPrismaService.inventoryLedger.create).toHaveBeenCalledTimes(
          1,
        );
      });
    });
  });

  describe('getStockBalance', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440001';
    const warehouseId = '550e8400-e29b-41d4-a716-446655440002';

    it('should calculate stock balance using SUM(qty_in) - SUM(qty_out)', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 250, // Total qty in
          qty_out: 100, // Total qty out
        },
      };

      const mockLatestEntry = {
        running_qty: 150, // 250 - 100
        running_cost: 1500000, // Total value
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result).toBeDefined();
      expect(result.product_id).toBe(productId);
      expect(result.warehouse_id).toBe(warehouseId);
      expect(result.qty_available).toBe(150); // 250 - 100
      expect(result.average_cost).toBe(10000); // 1500000 / 150
      expect(result.total_value).toBe(1500000); // 150 * 10000

      // Verify aggregate was called with correct parameters
      expect(
        mockPrismaService.inventoryLedger.aggregate,
      ).toHaveBeenCalledWith({
        where: {
          product_id: productId,
          warehouse_id: warehouseId,
        },
        _sum: {
          qty_in: true,
          qty_out: true,
        },
      });
    });

    it('should return zero balance when no movements exist', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: null,
          qty_out: null,
        },
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result.qty_available).toBe(0);
      expect(result.average_cost).toBe(0);
      expect(result.total_value).toBe(0);
      expect(result.qty_reserved).toBe(0);
      expect(result.qty_committed).toBe(0);
      expect(result.qty_damaged).toBe(0);
      expect(result.qty_quarantine).toBe(0);
      expect(result.qty_in_transit).toBe(0);
    });

    it('should handle only stock-in movements', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 500,
          qty_out: 0,
        },
      };

      const mockLatestEntry = {
        running_qty: 500,
        running_cost: 5000000,
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result.qty_available).toBe(500);
      expect(result.average_cost).toBe(10000); // 5000000 / 500
      expect(result.total_value).toBe(5000000);
    });

    it('should handle equal qty_in and qty_out (zero balance)', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 300,
          qty_out: 300,
        },
      };

      const mockLatestEntry = {
        running_qty: 0,
        running_cost: 0,
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result.qty_available).toBe(0);
      expect(result.average_cost).toBe(0);
      expect(result.total_value).toBe(0);
    });

    it('should calculate correct average cost from running values', async () => {
      // Arrange - Multiple movements with different costs
      const mockAggregateResult = {
        _sum: {
          qty_in: 350, // 100@10k + 150@12k + 100@11k
          qty_out: 50,
        },
      };

      const mockLatestEntry = {
        running_qty: 300, // 350 - 50
        running_cost: 3400000, // Weighted average cost calculation
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result.qty_available).toBe(300);
      expect(result.average_cost).toBeCloseTo(11333.33, 2); // 3400000 / 300
      expect(result.total_value).toBeCloseTo(3400000, 2);
    });

    it('should ensure average_cost is never negative (BR-INV-003)', async () => {
      // Arrange - Edge case with potential negative cost
      const mockAggregateResult = {
        _sum: {
          qty_in: 100,
          qty_out: 50,
        },
      };

      const mockLatestEntry = {
        running_qty: 50,
        running_cost: -100, // Simulated edge case (should not happen in practice)
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert - BR-INV-003: average_cost must be >= 0
      expect(result.average_cost).toBeGreaterThanOrEqual(0);
      expect(result.total_value).toBeGreaterThanOrEqual(0);
    });

    it('should ensure total_value is never negative', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 100,
          qty_out: 80,
        },
      };

      const mockLatestEntry = {
        running_qty: 20,
        running_cost: 200000,
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result.total_value).toBeGreaterThanOrEqual(0);
      expect(result.total_value).toBe(200000); // 20 * 10000
    });

    it('should set all status quantities to zero (status tracking not yet implemented)', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 200,
          qty_out: 50,
        },
      };

      const mockLatestEntry = {
        running_qty: 150,
        running_cost: 1500000,
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert - All stock is considered AVAILABLE for now (task 10.8 will implement status tracking)
      expect(result.qty_available).toBe(150);
      expect(result.qty_reserved).toBe(0);
      expect(result.qty_committed).toBe(0);
      expect(result.qty_damaged).toBe(0);
      expect(result.qty_quarantine).toBe(0);
      expect(result.qty_in_transit).toBe(0);
    });

    it('should handle large quantities correctly', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 1000000,
          qty_out: 250000,
        },
      };

      const mockLatestEntry = {
        running_qty: 750000,
        running_cost: 7500000000, // 750k @ 10k
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result.qty_available).toBe(750000);
      expect(result.average_cost).toBe(10000);
      expect(result.total_value).toBe(7500000000);
    });

    it('should handle decimal quantities from Prisma correctly', async () => {
      // Arrange - Prisma returns Decimal objects
      const mockAggregateResult = {
        _sum: {
          qty_in: 123.5,
          qty_out: 23.5,
        },
      };

      const mockLatestEntry = {
        running_qty: 100,
        running_cost: 1000000,
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      const result = await service.getStockBalance(productId, warehouseId);

      // Assert
      expect(result.qty_available).toBe(100); // 123.5 - 23.5
      expect(result.average_cost).toBe(10000);
    });

    it('should query only the specific product and warehouse combination', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      };

      const mockLatestEntry = {
        running_qty: 100,
        running_cost: 1000000,
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act
      await service.getStockBalance(productId, warehouseId);

      // Assert - Verify correct WHERE clause
      expect(
        mockPrismaService.inventoryLedger.aggregate,
      ).toHaveBeenCalledWith({
        where: {
          product_id: productId,
          warehouse_id: warehouseId,
        },
        _sum: {
          qty_in: true,
          qty_out: true,
        },
      });

      expect(
        mockPrismaService.inventoryLedger.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          product_id: productId,
          warehouse_id: warehouseId,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          running_qty: true,
          running_cost: true,
        },
      });
    });

    it('should return consistent balance across multiple calls', async () => {
      // Arrange
      const mockAggregateResult = {
        _sum: {
          qty_in: 200,
          qty_out: 50,
        },
      };

      const mockLatestEntry = {
        running_qty: 150,
        running_cost: 1500000,
      };

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue(
        mockAggregateResult,
      );
      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(
        mockLatestEntry,
      );

      // Act - Call multiple times
      const result1 = await service.getStockBalance(productId, warehouseId);
      const result2 = await service.getStockBalance(productId, warehouseId);
      const result3 = await service.getStockBalance(productId, warehouseId);

      // Assert - All results should be identical
      expect(result1.qty_available).toBe(result2.qty_available);
      expect(result2.qty_available).toBe(result3.qty_available);
      expect(result1.average_cost).toBe(result2.average_cost);
      expect(result2.average_cost).toBe(result3.average_cost);
      expect(result1.total_value).toBe(result2.total_value);
      expect(result2.total_value).toBe(result3.total_value);
    });
  });

  describe('transferStock', () => {
    it('should throw not implemented error', async () => {
      await expect(
        service.transferStock({
          from_warehouse_id: '550e8400-e29b-41d4-a716-446655440001',
          to_warehouse_id: '550e8400-e29b-41d4-a716-446655440002',
          transfer_date: new Date(),
          lines: [],
          created_by: '550e8400-e29b-41d4-a716-446655440003',
        }),
      ).rejects.toThrow('Not implemented yet');
    });
  });

  describe('adjustStock', () => {
    it('should throw not implemented error', async () => {
      await expect(
        service.adjustStock(
          {
            warehouse_id: '550e8400-e29b-41d4-a716-446655440001',
            adjustment_date: new Date(),
            reason: 'Test',
            lines: [],
          },
          '550e8400-e29b-41d4-a716-446655440002',
        ),
      ).rejects.toThrow('Not implemented yet');
    });
  });

  describe('lockWarehouse', () => {
    it('should throw not implemented error', async () => {
      await expect(
        service.lockWarehouse(
          '550e8400-e29b-41d4-a716-446655440001',
          'Stock opname',
        ),
      ).rejects.toThrow('Not implemented yet');
    });
  });

  describe('calculateAverageCost', () => {
    const productId = '550e8400-e29b-41d4-a716-446655440001';
    const warehouseId = '550e8400-e29b-41d4-a716-446655440002';

    it('should calculate average cost correctly with single stock-in', async () => {
      // Arrange - 100 units @ 10,000 = 1,000,000
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 1000000,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - Average cost should be 10,000
      expect(result).toBe(10000);
    });

    it('should calculate average cost correctly with multiple stock-ins (WAC formula)', async () => {
      // Arrange - Example from design:
      // Stok awal: 100 unit @ Rp 10.000 = Rp 1.000.000
      // Penerimaan: 50 unit @ Rp 12.000 = Rp 600.000
      // WAC baru: (1.000.000 + 600.000) / (100 + 50) = Rp 10.667
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 150,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 150,
        running_cost: 1600000,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - Average cost should be 10,666.6667 rounded to 10666.6667
      expect(result).toBeCloseTo(10666.6667, 4);
    });

    it('should return 0 when current quantity is 0', async () => {
      // Arrange - No stock
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 100,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when no ledger entries exist', async () => {
      // Arrange - No entries at all
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: null,
          qty_out: null,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert
      expect(result).toBe(0);
    });

    it('should round result to 4 decimal places', async () => {
      // Arrange - 100 units @ 10,000.123456 = 1,000,012.3456
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 1000012.3456,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - Should be rounded to 4 decimal places
      expect(result).toBe(10000.1235); // Rounded from 10000.123456
    });

    it('should ensure result is never negative (BR-INV-003)', async () => {
      // Arrange - Edge case with very small negative value due to rounding
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: -0.0001, // Negative due to rounding error
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - BR-INV-003: result must be >= 0
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should throw error if current quantity is negative (BR-INV-001)', async () => {
      // Arrange - More qty_out than qty_in (should not happen in normal operation)
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 150,
        },
      });

      // Act & Assert
      await expect(
        service.calculateAverageCost(productId, warehouseId),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        service.calculateAverageCost(productId, warehouseId),
      ).rejects.toThrow(/Negative stock detected/);

      // Verify error code
      try {
        await service.calculateAverageCost(productId, warehouseId);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessRuleException);
        const response = (error as any).getResponse();
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      }
    });

    it('should handle decimal quantities correctly', async () => {
      // Arrange - 100.5 units @ running_cost 1,000,525.125
      // Average cost = 1,000,525.125 / 100.5 = 9955.4739...
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100.5,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100.5,
        running_cost: 1000525.125,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - 1000525.125 / 100.5 = 9955.4739...
      expect(result).toBeCloseTo(9955.4739, 4);
    });

    it('should calculate correctly after stock-out', async () => {
      // Arrange - Started with 100 @ 10,000, sold 30
      // Remaining: 70 @ 10,000 = 700,000
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 30,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 70,
        running_cost: 700000,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - Average cost should still be 10,000
      expect(result).toBe(10000);
    });

    it('should calculate correctly with multiple transfers', async () => {
      // Arrange - Complex scenario with multiple movements
      // 100 @ 10,000 + 50 @ 12,000 - 30 = 120 units
      // Total value: 1,000,000 + 600,000 = 1,600,000
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 150,
          qty_out: 30,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 120,
        running_cost: 1200000,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - Average cost should be 10,000
      expect(result).toBe(10000);
    });

    it('should handle very large quantities', async () => {
      // Arrange - 1,000,000 units @ 100 = 100,000,000
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 1000000,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 1000000,
        running_cost: 100000000,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert
      expect(result).toBe(100);
    });

    it('should handle very small quantities', async () => {
      // Arrange - 0.001 units @ 10,000 = 10
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 0.001,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 0.001,
        running_cost: 10,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert
      expect(result).toBe(10000);
    });

    it('should handle zero cost correctly', async () => {
      // Arrange - 100 units @ 0 cost (free goods)
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 0,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert
      expect(result).toBe(0);
    });

    it('should query inventory_ledger with correct filters', async () => {
      // Arrange
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 1000000,
      });

      // Act
      await service.calculateAverageCost(productId, warehouseId);

      // Assert - Verify correct filters were used
      expect(mockPrismaService.inventoryLedger.aggregate).toHaveBeenCalledWith({
        where: {
          product_id: productId,
          warehouse_id: warehouseId,
        },
        _sum: {
          qty_in: true,
          qty_out: true,
        },
      });

      expect(mockPrismaService.inventoryLedger.findFirst).toHaveBeenCalledWith({
        where: {
          product_id: productId,
          warehouse_id: warehouseId,
        },
        orderBy: {
          created_at: 'desc',
        },
        select: {
          running_qty: true,
          running_cost: true,
        },
      });
    });

    it('should log calculation details', async () => {
      // Arrange
      const loggerSpy = jest.spyOn((service as any).logger, 'log');

      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 1000000,
      });

      // Act
      await service.calculateAverageCost(productId, warehouseId);

      // Assert - Verify logging
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Calculating average cost'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Average cost calculated'),
      );

      loggerSpy.mockRestore();
    });

    it('should handle null aggregate results gracefully', async () => {
      // Arrange - Null values from aggregate
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: null,
          qty_out: null,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert
      expect(result).toBe(0);
    });

    it('should handle partial null values from aggregate', async () => {
      // Arrange - Only qty_in is null, qty_out is 50 → balance = 0 - 50 = -50
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: null,
          qty_out: 50,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue(null);

      // Assert - Should throw because qty would be -50 (BR-INV-001)
      await expect(
        service.calculateAverageCost(productId, warehouseId),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should calculate correctly with realistic WAC scenario', async () => {
      // Arrange - Realistic scenario:
      // Day 1: Receive 100 units @ Rp 10,000 = Rp 1,000,000
      // Day 2: Receive 50 units @ Rp 12,000 = Rp 600,000
      // Day 3: Sell 30 units
      // Current: 120 units, value = Rp 1,600,000
      // WAC = 1,600,000 / 120 = 13,333.3333
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 150,
          qty_out: 30,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 120,
        running_cost: 1600000,
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert
      expect(result).toBeCloseTo(13333.3333, 4);
    });

    it('should handle precision with Decimal type from Prisma', async () => {
      // Arrange - Simulate Decimal type from Prisma
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: { toString: () => '100.5555' },
          qty_out: { toString: () => '0' },
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: { toString: () => '100.5555' },
        running_cost: { toString: () => '1005555' },
      });

      // Act
      const result = await service.calculateAverageCost(productId, warehouseId);

      // Assert - Should handle Decimal conversion
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should return consistent results for same product/warehouse', async () => {
      // Arrange
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValue({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValue({
        running_qty: 100,
        running_cost: 1000000,
      });

      // Act - Call multiple times
      const result1 = await service.calculateAverageCost(productId, warehouseId);
      const result2 = await service.calculateAverageCost(productId, warehouseId);
      const result3 = await service.calculateAverageCost(productId, warehouseId);

      // Assert - All results should be identical
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should calculate different averages for different products', async () => {
      // Arrange
      const productId2 = '550e8400-e29b-41d4-a716-446655440099';

      // First call for productId
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValueOnce({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValueOnce({
        running_qty: 100,
        running_cost: 1000000,
      });

      // Second call for productId2
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValueOnce({
        _sum: {
          qty_in: 50,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValueOnce({
        running_qty: 50,
        running_cost: 750000,
      });

      // Act
      const result1 = await service.calculateAverageCost(productId, warehouseId);
      const result2 = await service.calculateAverageCost(
        productId2,
        warehouseId,
      );

      // Assert - Different products should have different averages
      expect(result1).toBe(10000);
      expect(result2).toBe(15000);
      expect(result1).not.toBe(result2);
    });

    it('should calculate different averages for different warehouses', async () => {
      // Arrange
      const warehouseId2 = '550e8400-e29b-41d4-a716-446655440088';

      // First call for warehouseId
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValueOnce({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValueOnce({
        running_qty: 100,
        running_cost: 1000000,
      });

      // Second call for warehouseId2
      mockPrismaService.inventoryLedger.aggregate.mockResolvedValueOnce({
        _sum: {
          qty_in: 100,
          qty_out: 0,
        },
      });

      mockPrismaService.inventoryLedger.findFirst.mockResolvedValueOnce({
        running_qty: 100,
        running_cost: 1200000,
      });

      // Act
      const result1 = await service.calculateAverageCost(productId, warehouseId);
      const result2 = await service.calculateAverageCost(productId, warehouseId2);

      // Assert - Different warehouses should have different averages
      expect(result1).toBe(10000);
      expect(result2).toBe(12000);
      expect(result1).not.toBe(result2);
    });
  });
});
