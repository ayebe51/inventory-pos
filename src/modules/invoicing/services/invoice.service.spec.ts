/**
 * Unit tests for InvoiceService
 *
 * Validates: Requirements 9.8
 * BR-PUR-008: Supplier invoice tidak bisa melebihi PO amount + 5%
 */

import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { CreatePurchaseInvoiceDTO } from '../interfaces/invoicing.interfaces';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SUPPLIER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' as UUID;
const BRANCH_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' as UUID;
const PO_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc' as UUID;
const PRODUCT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd' as UUID;
const USER_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' as UUID;
const INVOICE_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff' as UUID;

const activeSupplier = {
  id: SUPPLIER_ID,
  supplier_code: 'SUP-001',
  supplier_name: 'PT Supplier Test',
  is_active: true,
  deleted_at: null,
};

const activeBranch = {
  id: BRANCH_ID,
  branch_code: 'BR-001',
  branch_name: 'Cabang Jakarta',
  is_active: true,
  deleted_at: null,
};

const activePO = {
  id: PO_ID,
  po_number: 'PO-202501-00001',
  total_amount: 10000000, // Rp 10,000,000
  status: 'APPROVED',
};

const cancelledPO = {
  id: PO_ID,
  po_number: 'PO-202501-00002',
  total_amount: 10000000,
  status: 'CANCELLED',
};

const baseInvoiceData: CreatePurchaseInvoiceDTO = {
  supplier_id: SUPPLIER_ID,
  branch_id: BRANCH_ID,
  invoice_date: new Date('2025-01-15'),
  due_date: new Date('2025-02-15'),
  po_id: PO_ID,
  lines: [
    {
      product_id: PRODUCT_ID,
      description: 'Product Test',
      qty: 10,
      unit_price: 900000, // Rp 900,000 per unit
      tax_pct: 11,
    },
  ],
};

const createdInvoice = {
  id: INVOICE_ID,
  invoice_number: 'INV-202501-00001',
  invoice_type: 'PURCHASE',
  customer_id: null,
  supplier_id: SUPPLIER_ID,
  branch_id: BRANCH_ID,
  status: 'DRAFT',
  invoice_date: new Date('2025-01-15'),
  due_date: new Date('2025-02-15'),
  subtotal: 9990000,
  tax_amount: 990000,
  total_amount: 9990000,
  paid_amount: 0,
  outstanding_amount: 9990000,
  reference_type: 'PO',
  reference_id: PO_ID,
  notes: null,
  created_by: USER_ID,
  created_at: new Date('2025-01-15'),
  updated_at: new Date('2025-01-15'),
  deleted_at: null,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  supplier: {
    findUnique: jest.fn(),
  },
  branch: {
    findUnique: jest.fn(),
  },
  purchaseOrder: {
    findUnique: jest.fn(),
  },
  invoice: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  invoiceLine: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue({}),
};

const mockNumberingService = {
  generate: jest.fn().mockResolvedValue('INV-202501-00001'),
};

function setupTransactionMock() {
  mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
    const txClient = {
      invoice: mockPrismaService.invoice,
      invoiceLine: mockPrismaService.invoiceLine,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    return fn(txClient);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('InvoiceService - BR-PUR-008 Validation', () => {
  let service: InvoiceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NumberingService, useValue: mockNumberingService },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
    jest.clearAllMocks();
    setupTransactionMock();
  });

  // ── Helper function to calculate invoice total ────────────────────────────

  function calculateInvoiceTotal(lines: CreatePurchaseInvoiceDTO['lines']): number {
    return lines.reduce((sum, line) => {
      const subtotal = line.qty * line.unit_price;
      const taxAmount = (subtotal * line.tax_pct) / 100;
      return sum + subtotal + taxAmount;
    }, 0);
  }

  // ── Happy path: Invoice amount exactly at PO amount ───────────────────────

  describe('Happy path: Invoice amount exactly at PO amount', () => {
    it('should create invoice when amount equals PO amount (Rp 10,000,000)', async () => {
      // Setup: Invoice total = Rp 10,000,000 (exactly PO amount)
      const invoiceData: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        lines: [
          {
            product_id: PRODUCT_ID,
            description: 'Product Test',
            qty: 10,
            unit_price: 900900.90, // Total will be exactly Rp 10,000,000
            tax_pct: 11,
          },
        ],
      };

      const invoiceTotal = calculateInvoiceTotal(invoiceData.lines);
      expect(invoiceTotal).toBeCloseTo(10000000, 0);

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(activePO);
      mockPrismaService.invoice.create.mockResolvedValue({
        ...createdInvoice,
        total_amount: invoiceTotal,
      });

      const result = await service.createPurchaseInvoice(invoiceData, USER_ID);

      expect(result).toBeDefined();
      expect(result.invoice_number).toBe('INV-202501-00001');
      expect(mockPrismaService.purchaseOrder.findUnique).toHaveBeenCalledWith({
        where: { id: PO_ID },
        select: {
          id: true,
          po_number: true,
          total_amount: true,
          status: true,
        },
      });
    });
  });

  // ── Happy path: Invoice amount at PO amount + 5% ──────────────────────────

  describe('Happy path: Invoice amount at PO amount + 5%', () => {
    it('should create invoice when amount equals PO amount + 5% (Rp 10,500,000)', async () => {
      // Setup: Invoice total = Rp 10,500,000 (PO amount + 5%)
      const invoiceData: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        lines: [
          {
            product_id: PRODUCT_ID,
            description: 'Product Test',
            qty: 100,
            unit_price: 94594.59, // Total will be exactly Rp 10,500,000 (PO + 5%)
            tax_pct: 11,
          },
        ],
      };

      const invoiceTotal = calculateInvoiceTotal(invoiceData.lines);
      expect(invoiceTotal).toBeCloseTo(10500000, -1); // Allow 10 unit tolerance

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(activePO);
      mockPrismaService.invoice.create.mockResolvedValue({
        ...createdInvoice,
        total_amount: invoiceTotal,
      });

      const result = await service.createPurchaseInvoice(invoiceData, USER_ID);

      expect(result).toBeDefined();
      expect(result.invoice_number).toBe('INV-202501-00001');
    });
  });

  // ── Happy path: Invoice amount slightly below PO amount + 5% ──────────────

  describe('Happy path: Invoice amount slightly below PO amount + 5%', () => {
    it('should create invoice when amount is Rp 10,499,999 (just below +5%)', async () => {
      // Setup: Invoice total = Rp 10,499,999 (slightly below PO + 5%)
      const invoiceData: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        lines: [
          {
            product_id: PRODUCT_ID,
            description: 'Product Test',
            qty: 100,
            unit_price: 94594.58, // Total will be Rp 10,499,989
            tax_pct: 11,
          },
        ],
      };

      const invoiceTotal = calculateInvoiceTotal(invoiceData.lines);
      expect(invoiceTotal).toBeLessThan(10500000);
      expect(invoiceTotal).toBeGreaterThan(10499900); // Relaxed expectation

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(activePO);
      mockPrismaService.invoice.create.mockResolvedValue({
        ...createdInvoice,
        total_amount: invoiceTotal,
      });

      const result = await service.createPurchaseInvoice(invoiceData, USER_ID);

      expect(result).toBeDefined();
      expect(result.invoice_number).toBe('INV-202501-00001');
    });
  });

  // ── Validation failure: Invoice amount exceeds PO amount + 5% ─────────────

  describe('Validation failure: Invoice amount exceeds PO amount + 5%', () => {
    it('should throw BusinessRuleException when amount exceeds PO + 5% (Rp 10,500,001)', async () => {
      // Setup: Invoice total = Rp 10,500,001 (exceeds PO + 5%)
      const invoiceData: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        lines: [
          {
            product_id: PRODUCT_ID,
            description: 'Product Test',
            qty: 10,
            unit_price: 945946, // Total will exceed Rp 10,500,000
            tax_pct: 11,
          },
        ],
      };

      const invoiceTotal = calculateInvoiceTotal(invoiceData.lines);
      expect(invoiceTotal).toBeGreaterThan(10500000);

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(activePO);

      try {
        await service.createPurchaseInvoice(invoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(response.error.message).toContain('BR-PUR-008');
        expect(response.error.message).toContain('PO-202501-00001');
        expect(response.error.message).toContain('exceeds');
        expect(response.error.message).toContain('5%');
      }
    });

    it('should throw with detailed error message including amounts and percentages', async () => {
      // Setup: Invoice total = Rp 11,000,000 (10% over PO)
      const invoiceData: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        lines: [
          {
            product_id: PRODUCT_ID,
            description: 'Product Test',
            qty: 10,
            unit_price: 990990.99, // Total will be ~Rp 11,000,000
            tax_pct: 11,
          },
        ],
      };

      const invoiceTotal = calculateInvoiceTotal(invoiceData.lines);

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(activePO);

      try {
        await service.createPurchaseInvoice(invoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(response.error.message).toContain('BR-PUR-008');
        // Verify message contains Indonesian Rupiah formatting
        expect(response.error.message).toMatch(/Rp\s[\d.,]+/);
        // Verify message contains percentage
        expect(response.error.message).toMatch(/\d+\.\d+%/);
        // Verify message contains exceeded amount
        expect(response.error.message).toContain('Exceeded by');
      }
    });
  });

  // ── Edge case: Invoice amount exactly at PO amount + 5.01% ────────────────

  describe('Edge case: Invoice amount exactly at PO amount + 5.01%', () => {
    it('should throw BusinessRuleException when amount is at PO + 5.01% (Rp 10,501,000)', async () => {
      // Setup: Invoice total = Rp 10,501,000 (PO + 5.01%)
      const invoiceData: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        lines: [
          {
            product_id: PRODUCT_ID,
            description: 'Product Test',
            qty: 10,
            unit_price: 946036, // Total will be Rp 10,501,000
            tax_pct: 11,
          },
        ],
      };

      const invoiceTotal = calculateInvoiceTotal(invoiceData.lines);
      expect(invoiceTotal).toBeCloseTo(10501000, 0);

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(activePO);

      try {
        await service.createPurchaseInvoice(invoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
        expect(response.error.message).toContain('BR-PUR-008');
      }
    });
  });

  // ── Error case: PO not found ──────────────────────────────────────────────

  describe('Error case: PO not found', () => {
    it('should throw BusinessRuleException with VALIDATION_ERROR when PO does not exist', async () => {
      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(null);

      try {
        await service.createPurchaseInvoice(baseInvoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toContain('Purchase Order');
        expect(response.error.message).toContain('not found');
      }
    });
  });

  // ── Error case: PO is cancelled ───────────────────────────────────────────

  describe('Error case: PO is cancelled', () => {
    it('should throw BusinessRuleException with VALIDATION_ERROR when PO is cancelled', async () => {
      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(cancelledPO);

      try {
        await service.createPurchaseInvoice(baseInvoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toContain('Purchase Order');
        expect(response.error.message).toContain('cancelled');
      }
    });
  });

  // ── Additional validation tests ───────────────────────────────────────────

  describe('Additional validation tests', () => {
    it('should throw VALIDATION_ERROR when supplier is not found', async () => {
      mockPrismaService.supplier.findUnique.mockResolvedValue(null);

      try {
        await service.createPurchaseInvoice(baseInvoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toContain('Supplier');
        expect(response.error.message).toContain('not found or inactive');
      }
    });

    it('should throw VALIDATION_ERROR when supplier is inactive', async () => {
      mockPrismaService.supplier.findUnique.mockResolvedValue({
        ...activeSupplier,
        is_active: false,
      });

      try {
        await service.createPurchaseInvoice(baseInvoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toContain('Supplier');
        expect(response.error.message).toContain('not found or inactive');
      }
    });

    it('should throw VALIDATION_ERROR when branch is not found', async () => {
      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(null);

      try {
        await service.createPurchaseInvoice(baseInvoiceData, USER_ID);
        fail('should have thrown BusinessRuleException');
      } catch (err) {
        expect(err).toBeInstanceOf(BusinessRuleException);
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toContain('Branch');
        expect(response.error.message).toContain('not found or inactive');
      }
    });

    it('should create invoice without PO validation when po_id is not provided', async () => {
      const invoiceDataWithoutPO: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        po_id: undefined,
      };

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.invoice.create.mockResolvedValue({
        ...createdInvoice,
        reference_type: 'MANUAL',
        reference_id: 'INV-202501-00001',
      });

      const result = await service.createPurchaseInvoice(invoiceDataWithoutPO, USER_ID);

      expect(result).toBeDefined();
      expect(result.invoice_number).toBe('INV-202501-00001');
      // Verify PO validation was not called
      expect(mockPrismaService.purchaseOrder.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── Multiple line items calculation ───────────────────────────────────────

  describe('Multiple line items calculation', () => {
    it('should correctly calculate total with multiple line items and validate against PO', async () => {
      // Setup: Multiple lines totaling Rp 10,400,000 (within 5% of PO)
      const invoiceData: CreatePurchaseInvoiceDTO = {
        ...baseInvoiceData,
        lines: [
          {
            product_id: PRODUCT_ID,
            description: 'Product A',
            qty: 5,
            unit_price: 900000, // Rp 4,500,000 subtotal
            tax_pct: 11,
          },
          {
            product_id: PRODUCT_ID,
            description: 'Product B',
            qty: 5,
            unit_price: 837837.84, // Rp 4,189,189.20 subtotal
            tax_pct: 11,
          },
        ],
      };

      const invoiceTotal = calculateInvoiceTotal(invoiceData.lines);
      expect(invoiceTotal).toBeLessThanOrEqual(10500000);

      mockPrismaService.supplier.findUnique.mockResolvedValue(activeSupplier);
      mockPrismaService.branch.findUnique.mockResolvedValue(activeBranch);
      mockPrismaService.purchaseOrder.findUnique.mockResolvedValue(activePO);
      mockPrismaService.invoice.create.mockResolvedValue({
        ...createdInvoice,
        total_amount: invoiceTotal,
      });

      const result = await service.createPurchaseInvoice(invoiceData, USER_ID);

      expect(result).toBeDefined();
      expect(result.invoice_number).toBe('INV-202501-00001');
    });
  });
});
