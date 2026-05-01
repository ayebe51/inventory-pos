import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceiptService } from './goods-receipt.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { NotFoundException } from '@nestjs/common';

describe('GoodsReceiptService', () => {
  let service: GoodsReceiptService;
  let prisma: jest.Mocked<PrismaService>;
  let audit: jest.Mocked<AuditService>;
  let numbering: jest.Mocked<NumberingService>;

  const mockUserId = '00000000-0000-0000-0000-000000000001';
  const mockPoId = '00000000-0000-0000-0000-000000000002';
  const mockGrId = '00000000-0000-0000-0000-000000000003';
  const mockProductId = '00000000-0000-0000-0000-000000000004';
  const mockUomId = '00000000-0000-0000-0000-000000000005';
  const mockPoLineId = '00000000-0000-0000-0000-000000000006';

  beforeEach(async () => {
    const mockPrisma = {
      purchaseOrder: {
        findUnique: jest.fn(),
      },
      product: {
        findMany: jest.fn(),
      },
      unitOfMeasure: {
        findMany: jest.fn(),
      },
      goodsReceipt: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      goodsReceiptLine: {
        create: jest.fn(),
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
    audit = module.get(AuditService) as jest.Mocked<AuditService>;
    numbering = module.get(NumberingService) as jest.Mocked<NumberingService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockPO = {
      id: mockPoId,
      po_number: 'PO-202501-00001',
      supplier_id: '00000000-0000-0000-0000-000000000010',
      warehouse_id: '00000000-0000-0000-0000-000000000011',
      status: 'APPROVED',
      deleted_at: null,
      lines: [
        {
          id: mockPoLineId,
          product_id: mockProductId,
          uom_id: mockUomId,
          qty_ordered: 100,
          qty_received: 0,
        },
      ],
      supplier: { id: '00000000-0000-0000-0000-000000000010', name: 'Test Supplier' },
      warehouse: { id: '00000000-0000-0000-0000-000000000011', name: 'Main Warehouse', is_locked: false },
    };

    const mockGRData = {
      receipt_date: new Date('2025-01-15'),
      lines: [
        {
          po_line_id: mockPoLineId,
          product_id: mockProductId,
          qty_received: 100,
          uom_id: mockUomId,
          unit_cost: 10000,
        },
      ],
    };

    beforeEach(() => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(mockPO as any);
      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        { id: mockProductId, is_active: true, deleted_at: null },
      ] as any);
      (prisma.unitOfMeasure.findMany as jest.Mock).mockResolvedValue([
        { id: mockUomId, is_active: true },
      ] as any);
      (numbering.generate as jest.Mock).mockResolvedValue('GR-202501-00001');
      (prisma.goodsReceipt.create as jest.Mock).mockResolvedValue({
        id: mockGrId,
        gr_number: 'GR-202501-00001',
        po_id: mockPoId,
        supplier_id: '00000000-0000-0000-0000-000000000010',
        warehouse_id: '00000000-0000-0000-0000-000000000011',
        receipt_date: new Date('2025-01-15'),
        status: 'DRAFT',
        notes: null,
        confirmed_by: null,
        confirmed_at: null,
        created_by: mockUserId,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      } as any);
      (prisma.goodsReceiptLine.create as jest.Mock).mockResolvedValue({} as any);
    });

    it('should create a goods receipt successfully', async () => {
      const result = await service.create(mockPoId, mockGRData, mockUserId);

      expect(result).toBeDefined();
      expect(result.gr_number).toBe('GR-202501-00001');
      expect(result.status).toBe('DRAFT');
      expect(result.total_amount).toBe(1000000); // 100 * 10000
      expect(prisma.goodsReceipt.create).toHaveBeenCalled();
      expect(prisma.goodsReceiptLine.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          action: 'CREATE',
          entity_type: 'GoodsReceipt',
        }),
        expect.anything(),
      );
    });

    it('should throw NotFoundException when PO not found', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException when PO is not APPROVED or PARTIALLY_RECEIVED', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'DRAFT',
      } as any);

      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        /Cannot create Goods Receipt for PO in DRAFT status/,
      );
    });

    it('should throw BusinessRuleException when warehouse is locked', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        ...mockPO,
        warehouse: { ...mockPO.warehouse, is_locked: true },
      } as any);

      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        /Warehouse .* is locked/,
      );
    });

    it('should throw BusinessRuleException for invalid PO line IDs', async () => {
      const invalidData = {
        ...mockGRData,
        lines: [
          {
            ...mockGRData.lines[0],
            po_line_id: '00000000-0000-0000-0000-999999999999',
          },
        ],
      };

      await expect(service.create(mockPoId, invalidData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(mockPoId, invalidData, mockUserId)).rejects.toThrow(
        /Invalid PO line IDs/,
      );
    });

    describe('BR-PUR-003: Over-receipt validation', () => {
      it('should reject when qty_received exceeds qty_ordered (no tolerance)', async () => {
        const overReceiptData = {
          ...mockGRData,
          lines: [
            {
              ...mockGRData.lines[0],
              qty_received: 101, // Exceeds ordered qty of 100
            },
          ],
        };

        await expect(service.create(mockPoId, overReceiptData, mockUserId)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.create(mockPoId, overReceiptData, mockUserId)).rejects.toThrow(
          /BR-PUR-003/,
        );
      });

      it('should reject when cumulative qty_received exceeds qty_ordered', async () => {
        // PO line already has 50 received, trying to receive 51 more (total 101 > 100)
        (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
          ...mockPO,
          lines: [
            {
              ...mockPO.lines[0],
              qty_received: 50,
            },
          ],
        } as any);

        const overReceiptData = {
          ...mockGRData,
          lines: [
            {
              ...mockGRData.lines[0],
              qty_received: 51,
            },
          ],
        };

        await expect(service.create(mockPoId, overReceiptData, mockUserId)).rejects.toThrow(
          BusinessRuleException,
        );
        await expect(service.create(mockPoId, overReceiptData, mockUserId)).rejects.toThrow(
          /BR-PUR-003/,
        );
      });

      it('should accept exact qty_ordered', async () => {
        const exactData = {
          ...mockGRData,
          lines: [
            {
              ...mockGRData.lines[0],
              qty_received: 100, // Exactly ordered qty
            },
          ],
        };

        const result = await service.create(mockPoId, exactData, mockUserId);

        expect(result).toBeDefined();
        expect(result.status).toBe('DRAFT');
      });

      it('should accept partial receipt', async () => {
        const partialData = {
          ...mockGRData,
          lines: [
            {
              ...mockGRData.lines[0],
              qty_received: 50, // Less than ordered qty
            },
          ],
        };

        const result = await service.create(mockPoId, partialData, mockUserId);

        expect(result).toBeDefined();
        expect(result.status).toBe('DRAFT');
      });

      it('should include tolerance information in error message', async () => {
        const overReceiptData = {
          ...mockGRData,
          lines: [
            {
              ...mockGRData.lines[0],
              qty_received: 110,
            },
          ],
        };

        await expect(service.create(mockPoId, overReceiptData, mockUserId)).rejects.toThrow(
          /Ordered: 100.*Already received: 0.*Remaining: 100/,
        );
      });
    });

    it('should throw BusinessRuleException when product mismatch', async () => {
      const mismatchData = {
        ...mockGRData,
        lines: [
          {
            ...mockGRData.lines[0],
            product_id: '00000000-0000-0000-0000-999999999998',
          },
        ],
      };

      await expect(service.create(mockPoId, mismatchData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(mockPoId, mismatchData, mockUserId)).rejects.toThrow(
        /Product mismatch/,
      );
    });

    it('should throw BusinessRuleException when UOM mismatch', async () => {
      const mismatchData = {
        ...mockGRData,
        lines: [
          {
            ...mockGRData.lines[0],
            uom_id: '00000000-0000-0000-0000-999999999997',
          },
        ],
      };

      await expect(service.create(mockPoId, mismatchData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(mockPoId, mismatchData, mockUserId)).rejects.toThrow(
        /UOM mismatch/,
      );
    });

    it('should throw BusinessRuleException when product not found or inactive', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        /Products not found or inactive/,
      );
    });

    it('should throw BusinessRuleException when UOM not found or inactive', async () => {
      (prisma.unitOfMeasure.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
      await expect(service.create(mockPoId, mockGRData, mockUserId)).rejects.toThrow(
        /UOMs not found or inactive/,
      );
    });

    it('should handle multiple lines correctly', async () => {
      const multiLineData = {
        receipt_date: new Date('2025-01-15'),
        lines: [
          {
            po_line_id: mockPoLineId,
            product_id: mockProductId,
            qty_received: 50,
            uom_id: mockUomId,
            unit_cost: 10000,
          },
          {
            po_line_id: '00000000-0000-0000-0000-000000000020',
            product_id: '00000000-0000-0000-0000-000000000021',
            qty_received: 30,
            uom_id: '00000000-0000-0000-0000-000000000022',
            unit_cost: 15000,
          },
        ],
      };

      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        ...mockPO,
        lines: [
          ...mockPO.lines,
          {
            id: '00000000-0000-0000-0000-000000000020',
            product_id: '00000000-0000-0000-0000-000000000021',
            uom_id: '00000000-0000-0000-0000-000000000022',
            qty_ordered: 50,
            qty_received: 0,
          },
        ],
      } as any);

      (prisma.product.findMany as jest.Mock).mockResolvedValue([
        { id: mockProductId, is_active: true, deleted_at: null },
        { id: '00000000-0000-0000-0000-000000000021', is_active: true, deleted_at: null },
      ] as any);

      (prisma.unitOfMeasure.findMany as jest.Mock).mockResolvedValue([
        { id: mockUomId, is_active: true },
        { id: '00000000-0000-0000-0000-000000000022', is_active: true },
      ] as any);

      const result = await service.create(mockPoId, multiLineData, mockUserId);

      expect(result).toBeDefined();
      expect(result.total_amount).toBe(950000); // (50 * 10000) + (30 * 15000)
      expect(prisma.goodsReceiptLine.create).toHaveBeenCalledTimes(2);
    });

    it('should include batch and serial numbers when provided', async () => {
      const dataWithBatch = {
        ...mockGRData,
        lines: [
          {
            ...mockGRData.lines[0],
            batch_number: 'BATCH-001',
            serial_number: 'SN-12345',
          },
        ],
      };

      await service.create(mockPoId, dataWithBatch, mockUserId);

      expect(prisma.goodsReceiptLine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          batch_number: 'BATCH-001',
          serial_number: 'SN-12345',
        }),
      });
    });

    it('should accept PARTIALLY_RECEIVED PO status', async () => {
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'PARTIALLY_RECEIVED',
      } as any);

      const result = await service.create(mockPoId, mockGRData, mockUserId);

      expect(result).toBeDefined();
      expect(result.status).toBe('DRAFT');
    });
  });

  describe('findById', () => {
    it('should return goods receipt when found', async () => {
      const mockGR = {
        id: mockGrId,
        gr_number: 'GR-202501-00001',
        po_id: mockPoId,
        supplier_id: '00000000-0000-0000-0000-000000000010',
        warehouse_id: '00000000-0000-0000-0000-000000000011',
        receipt_date: new Date('2025-01-15'),
        status: 'DRAFT',
        notes: null,
        confirmed_by: null,
        confirmed_at: null,
        created_by: mockUserId,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        lines: [
          {
            id: '00000000-0000-0000-0000-000000000030',
            total_cost: 1000000,
          },
        ],
      };

      (prisma.goodsReceipt.findUnique as jest.Mock).mockResolvedValue(mockGR as any);

      const result = await service.findById(mockGrId);

      expect(result).toBeDefined();
      expect(result?.gr_number).toBe('GR-202501-00001');
      expect(result?.total_amount).toBe(1000000);
    });

    it('should return null when goods receipt not found', async () => {
      (prisma.goodsReceipt.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById(mockGrId);

      expect(result).toBeNull();
    });

    it('should return null when goods receipt is soft deleted', async () => {
      (prisma.goodsReceipt.findUnique as jest.Mock).mockResolvedValue({
        id: mockGrId,
        deleted_at: new Date(),
      } as any);

      const result = await service.findById(mockGrId);

      expect(result).toBeNull();
    });
  });

  describe('confirm', () => {
    it('should throw error as not implemented yet', async () => {
      await expect(service.confirm(mockGrId, mockUserId)).rejects.toThrow(
        /Not implemented yet/,
      );
    });
  });

  describe('updateAverageCost', () => {
    it('should throw error as not implemented yet', async () => {
      await expect(
        service.updateAverageCost(mockProductId, 'warehouse-123', 100, 10000),
      ).rejects.toThrow(/Not implemented yet/);
    });
  });

  describe('getOverReceiptTolerance', () => {
    it('should return configured tolerance', () => {
      const tolerance = service.getOverReceiptTolerance();
      expect(tolerance).toBe(0.05); // 5%
    });
  });

  describe('getDefaultOverReceiptPolicy', () => {
    it('should return default policy', () => {
      const policy = service.getDefaultOverReceiptPolicy();
      expect(policy).toBe('REJECT');
    });
  });
});
