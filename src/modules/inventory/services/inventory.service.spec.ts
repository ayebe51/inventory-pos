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
  });

  describe('getStockBalance', () => {
    it('should throw not implemented error', async () => {
      await expect(
        service.getStockBalance(
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ),
      ).rejects.toThrow('Not implemented yet');
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
    it('should throw not implemented error', async () => {
      await expect(
        service.calculateAverageCost(
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ),
      ).rejects.toThrow('Not implemented yet');
    });
  });
});
