import { Test, TestingModule } from '@nestjs/testing';
import { ThreeWayMatchingService, ThreeWayMatchingInput } from './three-way-matching.service';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';

describe('ThreeWayMatchingService', () => {
  let service: ThreeWayMatchingService;
  let prisma: PrismaService;

  const mockPoId = '550e8400-e29b-41d4-a716-446655440001';
  const mockProductId1 = '550e8400-e29b-41d4-a716-446655440011';
  const mockProductId2 = '550e8400-e29b-41d4-a716-446655440012';

  const mockPO = {
    id: mockPoId,
    po_number: 'PO-202501-00001',
    total_amount: 10000000,
    deleted_at: null,
    lines: [
      {
        id: '550e8400-e29b-41d4-a716-446655440021',
        product_id: mockProductId1,
        qty_ordered: 100,
        qty_received: 100,
        product: {
          id: mockProductId1,
          code: 'PROD-001',
          name: 'Product 1',
        },
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440022',
        product_id: mockProductId2,
        qty_ordered: 50,
        qty_received: 50,
        product: {
          id: mockProductId2,
          code: 'PROD-002',
          name: 'Product 2',
        },
      },
    ],
  };

  const mockGoodsReceipts = [
    {
      id: '550e8400-e29b-41d4-a716-446655440031',
      po_id: mockPoId,
      gr_number: 'GR-202501-00001',
      status: 'CONFIRMED',
      lines: [
        {
          id: '550e8400-e29b-41d4-a716-446655440041',
          product_id: mockProductId1,
          qty_received: 100,
          total_cost: 5000000, // 100 * 50000
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440042',
          product_id: mockProductId2,
          qty_received: 50,
          total_cost: 5000000, // 50 * 100000
        },
      ],
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThreeWayMatchingService,
        {
          provide: PrismaService,
          useValue: {
            purchaseOrder: {
              findUnique: jest.fn(),
            },
            goodsReceipt: {
              findMany: jest.fn(),
            },
            invoice: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ThreeWayMatchingService>(ThreeWayMatchingService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should pass validation when invoice quantities match PO and GR exactly', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 100, unit_price: 50000 },
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.summary.lines_checked).toBe(2);
      expect(result.summary.lines_matched).toBe(2);
      expect(result.summary.lines_violated).toBe(0);
      expect(result.summary.total_invoice_amount).toBe(10000000); // 100*50000 + 50*100000
    });

    it('should pass validation when invoice quantities are within tolerance (5%)', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 104, unit_price: 50000 }, // 4% over
          { product_id: mockProductId2 as any, qty: 52, unit_price: 100000 }, // 4% over
        ],
      };

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail validation when invoice qty exceeds PO qty beyond tolerance (BR-PUR-003)', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 110, unit_price: 50000 }, // 10% over (exceeds 5% tolerance)
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].violation_type).toBe('QTY_MISMATCH');
      expect(result.violations[0].message).toContain('BR-PUR-003');
      expect(result.violations[0].message).toContain('exceeds PO qty');
      expect(result.violations[0].product_code).toBe('PROD-001');
    });

    it('should fail validation when invoice qty exceeds GR qty beyond tolerance (BR-PUR-003)', async () => {
      // Arrange
      const poWithPartialReceipt = {
        ...mockPO,
        lines: [
          {
            ...mockPO.lines[0],
            qty_received: 80, // Only 80 received out of 100 ordered
          },
          mockPO.lines[1],
        ],
      };

      const grWithPartialReceipt = [
        {
          ...mockGoodsReceipts[0],
          lines: [
            {
              ...mockGoodsReceipts[0].lines[0],
              qty_received: 80, // Only 80 received
              total_cost: 4000000,
            },
            {
              ...mockGoodsReceipts[0].lines[1],
              total_cost: 5000000,
            },
          ],
        },
      ];

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(poWithPartialReceipt as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(grWithPartialReceipt as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 90, unit_price: 50000 }, // 90 > 80*1.05 = 84
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].violation_type).toBe('QTY_MISMATCH');
      expect(result.violations[0].message).toContain('BR-PUR-003');
      expect(result.violations[0].message).toContain('exceeds GR qty');
    });

    it('should fail validation when total invoice amount exceeds PO amount + 5% (BR-PUR-008)', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 100, unit_price: 60000 }, // Higher price
          { product_id: mockProductId2 as any, qty: 50, unit_price: 120000 }, // Higher price
        ],
      };
      // Total: 100*60000 + 50*120000 = 12,000,000 (20% over PO amount of 10,000,000)

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      const amountViolation = result.violations.find(v => v.violation_type === 'AMOUNT_MISMATCH');
      expect(amountViolation).toBeDefined();
      expect(amountViolation!.message).toContain('BR-PUR-008');
      expect(amountViolation!.message).toContain('exceeds PO amount');
    });

    it('should fail validation when invoice references product not in PO', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const unknownProductId = '550e8400-e29b-41d4-a716-446655440099';
      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: unknownProductId as any, qty: 10, unit_price: 50000 },
        ],
      };

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].message).toContain('not found in PO');
    });

    it('should throw BusinessRuleException when PO not found', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(null);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [],
      };

      // Act & Assert
      await expect(service.validate(input)).rejects.toThrow(BusinessRuleException);
      await expect(service.validate(input)).rejects.toThrow('Purchase Order');
      await expect(service.validate(input)).rejects.toThrow('not found');
    });

    it('should handle multiple GRs for the same PO', async () => {
      // Arrange
      const multipleGRs = [
        {
          ...mockGoodsReceipts[0],
          lines: [
            { ...mockGoodsReceipts[0].lines[0], qty_received: 60, total_cost: 3000000 },
            { ...mockGoodsReceipts[0].lines[1], qty_received: 30, total_cost: 3000000 },
          ],
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440032',
          po_id: mockPoId,
          gr_number: 'GR-202501-00002',
          status: 'CONFIRMED',
          lines: [
            {
              id: '550e8400-e29b-41d4-a716-446655440043',
              product_id: mockProductId1,
              qty_received: 40, // Total: 60 + 40 = 100
              total_cost: 2000000,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440044',
              product_id: mockProductId2,
              qty_received: 20, // Total: 30 + 20 = 50
              total_cost: 2000000,
            },
          ],
        },
      ];

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(multipleGRs as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 100, unit_price: 50000 },
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should use custom tolerance when provided', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 108, unit_price: 50000 }, // 8% over
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act with 10% tolerance
      const result = await service.validate(input, 0.10);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should return correct summary information', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 100, unit_price: 50000 },
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act
      const result = await service.validate(input);

      // Assert
      expect(result.summary).toEqual({
        po_id: mockPoId,
        po_number: 'PO-202501-00001',
        total_po_amount: 10000000,
        total_gr_amount: 10000000,
        total_invoice_amount: 10000000,
        lines_checked: 2,
        lines_matched: 2,
        lines_violated: 0,
      });
    });
  });

  describe('validateAndThrow', () => {
    it('should not throw when validation passes', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 100, unit_price: 50000 },
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act & Assert
      await expect(service.validateAndThrow(input)).resolves.not.toThrow();
    });

    it('should throw BusinessRuleException when validation fails', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 110, unit_price: 50000 }, // Exceeds tolerance
          { product_id: mockProductId2 as any, qty: 50, unit_price: 100000 },
        ],
      };

      // Act & Assert
      await expect(service.validateAndThrow(input)).rejects.toThrow(BusinessRuleException);
      await expect(service.validateAndThrow(input)).rejects.toThrow('3-way matching validation failed');
    });

    it('should include violation details in exception', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);

      const input: ThreeWayMatchingInput = {
        po_id: mockPoId as any,
        invoice_lines: [
          { product_id: mockProductId1 as any, qty: 110, unit_price: 50000 },
        ],
      };

      // Act & Assert
      try {
        await service.validateAndThrow(input);
        fail('Should have thrown BusinessRuleException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessRuleException);
        expect((error as BusinessRuleException).message).toContain('BR-PUR-003');
        expect((error as BusinessRuleException).message).toContain('3-way matching validation failed');
      }
    });
  });

  describe('getMatchingReport', () => {
    it('should return comprehensive matching report', async () => {
      // Arrange
      const mockInvoices = [
        {
          id: '550e8400-e29b-41d4-a716-446655440051',
          invoice_number: 'INV-202501-00001',
          reference_type: 'PO',
          reference_id: mockPoId,
          total_amount: 10000000,
          deleted_at: null,
          lines: [
            {
              id: '550e8400-e29b-41d4-a716-446655440061',
              product_id: mockProductId1,
              qty: 100,
              product: { id: mockProductId1, code: 'PROD-001', name: 'Product 1' },
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440062',
              product_id: mockProductId2,
              qty: 50,
              product: { id: mockProductId2, code: 'PROD-002', name: 'Product 2' },
            },
          ],
        },
      ];

      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue({
        ...mockPO,
        supplier: { id: '123', name: 'Test Supplier' },
      } as any);
      jest.spyOn(prisma.goodsReceipt, 'findMany').mockResolvedValue(mockGoodsReceipts as any);
      jest.spyOn(prisma.invoice, 'findMany').mockResolvedValue(mockInvoices as any);

      // Act
      const report = await service.getMatchingReport(mockPoId as any);

      // Assert
      expect(report.po).toBeDefined();
      expect(report.po.po_number).toBe('PO-202501-00001');
      expect(report.goodsReceipts).toHaveLength(1);
      expect(report.invoices).toHaveLength(1);
      expect(report.summary.total_po_qty).toBe(150); // 100 + 50
      expect(report.summary.total_gr_qty).toBe(150);
      expect(report.summary.total_invoice_qty).toBe(150);
      expect(report.summary.total_po_amount).toBe(10000000);
      expect(report.summary.total_gr_amount).toBe(10000000);
      expect(report.summary.total_invoice_amount).toBe(10000000);
    });

    it('should throw BusinessRuleException when PO not found', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.getMatchingReport(mockPoId as any)).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('getTolerance', () => {
    it('should return default tolerance value', () => {
      // Act
      const tolerance = service.getTolerance();

      // Assert
      expect(tolerance).toBe(0.05); // 5%
    });
  });
});
