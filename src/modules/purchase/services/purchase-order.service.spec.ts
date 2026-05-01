import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { POStatus } from '../interfaces/purchase.interfaces';

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;
  let prisma: PrismaService;
  let audit: AuditService;
  let numbering: NumberingService;

  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockApproverId = '550e8400-e29b-41d4-a716-446655440001';
  const mockSupplierId = '550e8400-e29b-41d4-a716-446655440002';
  const mockBranchId = '550e8400-e29b-41d4-a716-446655440003';
  const mockWarehouseId = '550e8400-e29b-41d4-a716-446655440004';
  const mockProductId = '550e8400-e29b-41d4-a716-446655440005';
  const mockUomId = '550e8400-e29b-41d4-a716-446655440006';
  const mockPOId = '550e8400-e29b-41d4-a716-446655440007';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        {
          provide: PrismaService,
          useValue: {
            supplier: { findUnique: jest.fn() },
            branch: { findUnique: jest.fn() },
            warehouse: { findUnique: jest.fn() },
            purchaseRequest: { findUnique: jest.fn() },
            product: { findMany: jest.fn() },
            unitOfMeasure: { findMany: jest.fn() },
            purchaseOrder: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            purchaseOrderLine: {
              create: jest.fn(),
              update: jest.fn(),
            },
            goodsReceipt: {
              create: jest.fn(),
              findFirst: jest.fn(),
            },
            goodsReceiptLine: {
              create: jest.fn(),
            },
            $transaction: jest.fn((callback) => callback(module.get(PrismaService))),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
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
    numbering = module.get<NumberingService>(NumberingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validPOData = {
      supplier_id: mockSupplierId,
      branch_id: mockBranchId,
      warehouse_id: mockWarehouseId,
      order_date: new Date('2025-01-15'),
      currency: 'IDR',
      exchange_rate: 1,
      additional_cost: 0,
      lines: [
        {
          product_id: mockProductId,
          qty_ordered: 10,
          uom_id: mockUomId,
          unit_price: 100000,
          discount_pct: 0,
          tax_pct: 11,
        },
      ],
    };

    beforeEach(() => {
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue({
        id: mockSupplierId,
        code: 'SUP001',
        name: 'Test Supplier',
        is_active: true,
        deleted_at: null,
      });

      (prisma.branch.findUnique as jest.Mock).mockResolvedValue({
        id: mockBranchId,
        code: 'BR001',
        name: 'Test Branch',
        is_active: true,
        deleted_at: null,
      });

      (prisma.warehouse.findUnique as jest.Mock).mockResolvedValue({
        id: mockWarehouseId,
        code: 'WH001',
        name: 'Test Warehouse',
        branch_id: mockBranchId,
        is_active: true,
        deleted_at: null,
      });

      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        {
          id: mockProductId,
          code: 'PROD001',
          name: 'Test Product',
          is_active: true,
          deleted_at: null,
        },
      ]);

      (prisma.unitOfMeasure.findMany as jest.Mock).mockResolvedValue([
        {
          id: mockUomId,
          code: 'PCS',
          name: 'Pieces',
          is_active: true,
        },
      ]);

      (numbering.generate as jest.Mock).mockResolvedValue('PO-202501-00001');

      (prisma.purchaseOrder.create as jest.Mock).mockResolvedValue({
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'DRAFT',
        supplier_id: mockSupplierId,
        branch_id: mockBranchId,
        warehouse_id: mockWarehouseId,
        order_date: new Date('2025-01-15'),
        currency: 'IDR',
        exchange_rate: 1,
        subtotal: 1110000,
        tax_amount: 110000,
        additional_cost: 0,
        total_amount: 1110000,
        approval_level: 1,
        created_by: mockUserId,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      });

      (prisma.purchaseOrderLine.create as jest.Mock).mockResolvedValue({});
    });

    it('should create PO with DRAFT status and correct totals', async () => {
      const result = await service.create(validPOData, mockUserId);

      expect(result.status).toBe('DRAFT');
      expect(result.po_number).toBe('PO-202501-00001');
      expect(result.total_amount).toBe(1110000);
      expect(result.approval_level).toBe(1);
      expect(prisma.purchaseOrder.create).toHaveBeenCalled();
      expect(prisma.purchaseOrderLine.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity_type: 'PurchaseOrder',
        }),
        expect.anything(),
      );
    });

    it('should reject if supplier is inactive', async () => {
      (prisma.supplier.findUnique as jest.Mock).mockResolvedValue({
        id: mockSupplierId,
        is_active: false,
        deleted_at: null,
      });

      await expect(service.create(validPOData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should reject if warehouse does not belong to branch', async () => {
      (prisma.warehouse.findUnique as jest.Mock).mockResolvedValue({
        id: mockWarehouseId,
        branch_id: 'different-branch-id',
        is_active: true,
        deleted_at: null,
      });

      await expect(service.create(validPOData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should reject if product is not found', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.create(validPOData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('submit', () => {
    it('should transition from DRAFT to PENDING_APPROVAL', async () => {
      const draftPO = {
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'DRAFT',
        created_by: mockUserId,
      };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(draftPO);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...draftPO,
        status: 'PENDING_APPROVAL',
      });

      const result = await service.submit(mockPOId, mockUserId);

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: mockPOId },
        data: { status: 'PENDING_APPROVAL' },
      });
    });

    it('should reject invalid state transition', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'APPROVED',
      });

      await expect(service.submit(mockPOId, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw NotFoundException if PO not found', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.submit(mockPOId, mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('should transition from PENDING_APPROVAL to APPROVED', async () => {
      const pendingPO = {
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'PENDING_APPROVAL',
        created_by: mockUserId,
        notes: null,
      };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(pendingPO);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...pendingPO,
        status: 'APPROVED',
        approved_by: mockApproverId,
        approved_at: new Date(),
      });

      const result = await service.approve(mockPOId, mockApproverId, 'Approved');

      expect(result.status).toBe('APPROVED');
      expect(result.approved_by).toBe(mockApproverId);
      expect(prisma.purchaseOrder.update).toHaveBeenCalled();
    });

    it('should enforce SOD-001: creator cannot approve their own PO', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'PENDING_APPROVAL',
        created_by: mockUserId,
      });

      await expect(service.approve(mockPOId, mockUserId, 'Approved')).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.approve(mockPOId, mockUserId, 'Approved')).rejects.toThrow(
        /SOD-001/,
      );
    });

    it('should reject invalid state transition', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'DRAFT',
        created_by: mockUserId,
      });

      await expect(service.approve(mockPOId, mockApproverId, 'Approved')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('reject', () => {
    it('should transition from PENDING_APPROVAL to REJECTED with reason', async () => {
      const pendingPO = {
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'PENDING_APPROVAL',
        notes: null,
      };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(pendingPO);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...pendingPO,
        status: 'REJECTED',
        notes: 'Rejected: Budget exceeded',
      });

      const result = await service.reject(mockPOId, mockApproverId, 'Budget exceeded');

      expect(result.status).toBe('REJECTED');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: mockPOId },
        data: expect.objectContaining({
          status: 'REJECTED',
          notes: expect.stringContaining('Budget exceeded'),
        }),
      });
    });

    it('should require rejection reason', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'PENDING_APPROVAL',
      });

      await expect(service.reject(mockPOId, mockApproverId, '')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('revise', () => {
    it('should transition from REJECTED back to DRAFT', async () => {
      const rejectedPO = {
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'REJECTED',
      };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(rejectedPO);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...rejectedPO,
        status: 'DRAFT',
      });

      const result = await service.revise(mockPOId, mockUserId);

      expect(result.status).toBe('DRAFT');
    });

    it('should reject invalid state transition', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'APPROVED',
      });

      await expect(service.revise(mockPOId, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel APPROVED PO if no GR confirmed', async () => {
      const approvedPO = {
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'APPROVED',
        notes: null,
      };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(approvedPO);
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...approvedPO,
        status: 'CANCELLED',
        notes: 'Cancelled: Supplier unavailable',
      });

      const result = await service.cancel(mockPOId, mockUserId, 'Supplier unavailable');

      expect(result.status).toBe('CANCELLED');
    });

    it('should reject cancellation if GR already confirmed', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'APPROVED',
      });

      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue({
        id: 'gr-id',
        status: 'CONFIRMED',
      });

      await expect(
        service.cancel(mockPOId, mockUserId, 'Supplier unavailable'),
      ).rejects.toThrow(BusinessRuleException);
      await expect(
        service.cancel(mockPOId, mockUserId, 'Supplier unavailable'),
      ).rejects.toThrow(/Goods Receipt has already been confirmed/);
    });

    it('should require cancellation reason', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'APPROVED',
      });

      await expect(service.cancel(mockPOId, mockUserId, '')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('receiveGoods', () => {
    const grData = {
      receipt_date: new Date('2025-01-20'),
      lines: [
        {
          po_line_id: 'po-line-id',
          product_id: mockProductId,
          qty_received: 5,
          uom_id: mockUomId,
          unit_cost: 100000,
        },
      ],
    };

    beforeEach(() => {
      (numbering.generate as jest.Mock).mockResolvedValue('GR-202501-00001');
      (prisma.goodsReceipt.create as jest.Mock).mockResolvedValue({
        id: 'gr-id',
        gr_number: 'GR-202501-00001',
        status: 'DRAFT',
      });
      (prisma.goodsReceiptLine.create as jest.Mock).mockResolvedValue({});
      (prisma.purchaseOrderLine.update as jest.Mock).mockResolvedValue({});
    });

    it('should create GR for APPROVED PO', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'APPROVED',
        supplier_id: mockSupplierId,
        warehouse_id: mockWarehouseId,
        lines: [
          {
            id: 'po-line-id',
            product_id: mockProductId,
            qty_ordered: 10,
            qty_received: 0,
          },
        ],
        deleted_at: null,
      });

      const result = await service.receiveGoods(mockPOId, grData, mockUserId);

      expect(result.gr_number).toBe('GR-202501-00001');
      expect(result.status).toBe('DRAFT');
      expect(prisma.goodsReceipt.create).toHaveBeenCalled();
      expect(prisma.goodsReceiptLine.create).toHaveBeenCalled();
      expect(prisma.purchaseOrderLine.update).toHaveBeenCalled();
    });

    it('should reject GR if PO not APPROVED or PARTIALLY_RECEIVED', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'DRAFT',
        lines: [],
        deleted_at: null,
      });

      await expect(service.receiveGoods(mockPOId, grData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should reject if qty_received exceeds remaining qty', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'APPROVED',
        supplier_id: mockSupplierId,
        warehouse_id: mockWarehouseId,
        lines: [
          {
            id: 'po-line-id',
            product_id: mockProductId,
            qty_ordered: 10,
            qty_received: 8, // Only 2 remaining
          },
        ],
        deleted_at: null,
      });

      await expect(service.receiveGoods(mockPOId, grData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.receiveGoods(mockPOId, grData, mockUserId)).rejects.toThrow(
        /Only 2 units remaining/,
      );
    });

    it('should reject if PO line ID is invalid', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'APPROVED',
        supplier_id: mockSupplierId,
        warehouse_id: mockWarehouseId,
        lines: [
          {
            id: 'different-line-id',
            product_id: mockProductId,
            qty_ordered: 10,
            qty_received: 0,
          },
        ],
        deleted_at: null,
      });

      await expect(service.receiveGoods(mockPOId, grData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('updateReceiptStatus', () => {
    it('should update to PARTIALLY_RECEIVED when not all lines fully received', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'APPROVED',
        lines: [
          { qty_ordered: 10, qty_received: 5 },
          { qty_ordered: 20, qty_received: 0 },
        ],
      });

      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'PARTIALLY_RECEIVED',
      });

      const result = await service.updateReceiptStatus(mockPOId, mockUserId);

      expect(result.status).toBe('PARTIALLY_RECEIVED');
    });

    it('should update to FULLY_RECEIVED when all lines fully received', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'PARTIALLY_RECEIVED',
        lines: [
          { qty_ordered: 10, qty_received: 10 },
          { qty_ordered: 20, qty_received: 20 },
        ],
      });

      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'FULLY_RECEIVED',
      });

      const result = await service.updateReceiptStatus(mockPOId, mockUserId);

      expect(result.status).toBe('FULLY_RECEIVED');
    });
  });

  describe('close', () => {
    it('should transition from FULLY_RECEIVED to CLOSED', async () => {
      const fullyReceivedPO = {
        id: mockPOId,
        po_number: 'PO-202501-00001',
        status: 'FULLY_RECEIVED',
      };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(fullyReceivedPO);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...fullyReceivedPO,
        status: 'CLOSED',
      });

      const result = await service.close(mockPOId, mockUserId);

      expect(result.status).toBe('CLOSED');
    });

    it('should reject invalid state transition', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        id: mockPOId,
        status: 'APPROVED',
      });

      await expect(service.close(mockPOId, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('getApprovalThreshold', () => {
    it('should return level 1 for amount < 5M', () => {
      expect(service.getApprovalThreshold(1000000)).toBe(1);
      expect(service.getApprovalThreshold(4999999)).toBe(1);
    });

    it('should return level 2 for amount 5M-50M', () => {
      expect(service.getApprovalThreshold(5000000)).toBe(2);
      expect(service.getApprovalThreshold(25000000)).toBe(2);
      expect(service.getApprovalThreshold(49999999)).toBe(2);
    });

    it('should return level 3 for amount > 50M', () => {
      expect(service.getApprovalThreshold(50000000)).toBe(3);
      expect(service.getApprovalThreshold(100000000)).toBe(3);
    });
  });

  describe('State Machine Validation', () => {
    it('should allow all valid transitions', () => {
      const validTransitions: Array<[POStatus, POStatus]> = [
        ['DRAFT', 'PENDING_APPROVAL'],
        ['PENDING_APPROVAL', 'APPROVED'],
        ['PENDING_APPROVAL', 'REJECTED'],
        ['REJECTED', 'DRAFT'],
        ['APPROVED', 'PARTIALLY_RECEIVED'],
        ['APPROVED', 'FULLY_RECEIVED'],
        ['APPROVED', 'CANCELLED'],
        ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED'],
        ['FULLY_RECEIVED', 'CLOSED'],
      ];

      for (const [from, to] of validTransitions) {
        expect(() => service['validateTransition'](from, to)).not.toThrow();
      }
    });

    it('should reject invalid transitions', () => {
      const invalidTransitions: Array<[POStatus, POStatus]> = [
        ['DRAFT', 'APPROVED'],
        ['DRAFT', 'CANCELLED'],
        ['APPROVED', 'DRAFT'],
        ['CANCELLED', 'APPROVED'],
        ['CLOSED', 'APPROVED'],
        ['PARTIALLY_RECEIVED', 'DRAFT'],
      ];

      for (const [from, to] of invalidTransitions) {
        expect(() => service['validateTransition'](from, to)).toThrow(BusinessRuleException);
      }
    });
  });
});
