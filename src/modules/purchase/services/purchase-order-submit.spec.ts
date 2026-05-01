import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrderService } from './purchase-order.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { NotFoundException } from '@nestjs/common';
import { UUID } from '../../../common/types/uuid.type';
import { POStatus } from '../interfaces/purchase.interfaces';
import { Prisma } from '@prisma/client';

describe('PurchaseOrderService - submit() with BR-PUR-007', () => {
  let service: PurchaseOrderService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440001' as UUID;
  const mockPoId = '550e8400-e29b-41d4-a716-446655440002' as UUID;

  // Helper to create mock PO with Prisma Decimal types
  const createMockPO = (overrides: Partial<any> = {}) => ({
    id: mockPoId,
    po_number: 'PO-202501-00001',
    status: 'DRAFT' as POStatus,
    total_amount: new Prisma.Decimal(4_999_999),
    approval_level: 1,
    created_by: mockUserId,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    supplier_id: '550e8400-e29b-41d4-a716-446655440003' as UUID,
    branch_id: '550e8400-e29b-41d4-a716-446655440004' as UUID,
    warehouse_id: '550e8400-e29b-41d4-a716-446655440005' as UUID,
    pr_id: null,
    order_date: new Date(),
    expected_delivery_date: null,
    currency: 'IDR',
    exchange_rate: new Prisma.Decimal(1),
    subtotal: new Prisma.Decimal(4_500_000),
    tax_amount: new Prisma.Decimal(499_999),
    additional_cost: new Prisma.Decimal(0),
    approved_by: null,
    approved_at: null,
    notes: null,
    terms_of_payment_id: null,
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        {
          provide: PrismaService,
          useValue: {
            purchaseOrder: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: NumberingService,
          useValue: {
            generate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BR-PUR-007: Approval level determination based on total amount including tax', () => {
    it('should set approval_level to 1 when total_amount < 5,000,000', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00001',
        total_amount: new Prisma.Decimal(4_999_999),
        subtotal: new Prisma.Decimal(4_500_000),
        tax_amount: new Prisma.Decimal(499_999),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 1 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act
      const result = await service.submit(mockPoId, mockUserId);

      // Assert
      expect(result.approval_level).toBe(1);
      expect(result.status).toBe('PENDING_APPROVAL');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: mockPoId },
        data: {
          status: 'PENDING_APPROVAL',
          approval_level: 1,
        },
      });
    });

    it('should set approval_level to 2 when total_amount is between 5,000,000 and 50,000,000', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00002',
        total_amount: new Prisma.Decimal(25_000_000),
        subtotal: new Prisma.Decimal(22_500_000),
        tax_amount: new Prisma.Decimal(2_500_000),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 2 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act
      const result = await service.submit(mockPoId, mockUserId);

      // Assert
      expect(result.approval_level).toBe(2);
      expect(result.status).toBe('PENDING_APPROVAL');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: mockPoId },
        data: {
          status: 'PENDING_APPROVAL',
          approval_level: 2,
        },
      });
    });

    it('should set approval_level to 3 when total_amount > 50,000,000', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00003',
        total_amount: new Prisma.Decimal(75_000_000),
        subtotal: new Prisma.Decimal(67_500_000),
        tax_amount: new Prisma.Decimal(7_500_000),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 3 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act
      const result = await service.submit(mockPoId, mockUserId);

      // Assert
      expect(result.approval_level).toBe(3);
      expect(result.status).toBe('PENDING_APPROVAL');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: mockPoId },
        data: {
          status: 'PENDING_APPROVAL',
          approval_level: 3,
        },
      });
    });

    it('should handle boundary case: exactly 5,000,000 should be Level 2', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00004',
        total_amount: new Prisma.Decimal(5_000_000),
        subtotal: new Prisma.Decimal(4_500_000),
        tax_amount: new Prisma.Decimal(500_000),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 2 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act
      const result = await service.submit(mockPoId, mockUserId);

      // Assert
      expect(result.approval_level).toBe(2);
    });

    it('should handle boundary case: exactly 50,000,000 should be Level 2', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00005',
        total_amount: new Prisma.Decimal(50_000_000),
        subtotal: new Prisma.Decimal(45_000_000),
        tax_amount: new Prisma.Decimal(5_000_000),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 2 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act
      const result = await service.submit(mockPoId, mockUserId);

      // Assert
      expect(result.approval_level).toBe(2);
    });

    it('should handle boundary case: 50,000,001 should be Level 3', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00006',
        total_amount: new Prisma.Decimal(50_000_001),
        subtotal: new Prisma.Decimal(45_000_000),
        tax_amount: new Prisma.Decimal(5_000_001),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 3 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act
      const result = await service.submit(mockPoId, mockUserId);

      // Assert
      expect(result.approval_level).toBe(3);
    });
  });

  describe('State transition validation', () => {
    it('should allow transition from DRAFT to PENDING_APPROVAL', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00007',
        total_amount: new Prisma.Decimal(3_000_000),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 1 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act & Assert
      await expect(service.submit(mockPoId, mockUserId)).resolves.toBeDefined();
    });

    it('should reject transition from APPROVED to PENDING_APPROVAL', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00008',
        status: 'APPROVED' as POStatus,
        approved_by: '550e8400-e29b-41d4-a716-446655440099' as UUID,
        approved_at: new Date(),
      });

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);

      // Act & Assert
      await expect(service.submit(mockPoId, mockUserId)).rejects.toThrow(BusinessRuleException);
    });

    it('should reject transition from CANCELLED to PENDING_APPROVAL', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00009',
        status: 'CANCELLED' as POStatus,
        notes: 'Cancelled: Out of budget',
      });

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);

      // Act & Assert
      await expect(service.submit(mockPoId, mockUserId)).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('Error handling', () => {
    it('should throw NotFoundException when PO does not exist', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.submit(mockPoId, mockUserId)).rejects.toThrow(NotFoundException);
      await expect(service.submit(mockPoId, mockUserId)).rejects.toThrow(
        `Purchase Order ${mockPoId} not found`,
      );
    });

    it('should throw NotFoundException when PO is soft-deleted', async () => {
      // Arrange
      const deletedPO = createMockPO({
        po_number: 'PO-202501-00010',
        deleted_at: new Date(),
      });

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(deletedPO as any);

      // Act & Assert
      await expect(service.submit(mockPoId, mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Audit trail', () => {
    it('should record audit log when PO is submitted', async () => {
      // Arrange
      const existingPO = createMockPO({
        po_number: 'PO-202501-00011',
        total_amount: new Prisma.Decimal(3_000_000),
      });

      const updatedPO = { ...existingPO, status: 'PENDING_APPROVAL', approval_level: 1 };

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(existingPO as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO as any);
        return callback(prisma);
      });

      // Act
      await service.submit(mockPoId, mockUserId);

      // Assert
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          action: 'UPDATE',
          entity_type: 'PurchaseOrder',
          entity_id: mockPoId,
          before_snapshot: expect.any(Object),
          after_snapshot: expect.any(Object),
        }),
        expect.anything(),
      );
    });
  });
});
