import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from './services/invoice.service';
import { ThreeWayMatchingService } from '../purchase/services/three-way-matching.service';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../services/audit/audit.service';
import { NumberingService } from '../../services/numbering/numbering.service';
import { JournalEngineService } from '../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import { UUID } from '../../common/types/uuid.type';
import { CreatePurchaseInvoiceDTO } from './interfaces/invoicing.interfaces';

describe('Three-Way Matching & Purchase Invoicing — Adversarial & Control Hardening', () => {
  let invoiceService: InvoiceService;
  let matchingService: ThreeWayMatchingService;

  const SUPPLIER_ID = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa' as UUID;
  const BRANCH_ID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' as UUID;
  const PO_ID = 'cccccccc-3333-3333-3333-cccccccccccc' as UUID;
  const PRODUCT_A = 'dddddddd-4444-4444-4444-dddddddddddd' as UUID;
  const PRODUCT_B = 'eeeeeeee-5555-5555-5555-eeeeeeeeeeee' as UUID;
  const USER_ID = '99999999-9999-9999-9999-999999999999' as UUID;
  const INVOICE_ID = 'ffffffff-7777-7777-7777-ffffffffffff' as UUID;

  const mockPO = {
    id: PO_ID,
    po_number: 'PO-202601-00001',
    supplier_id: SUPPLIER_ID,
    branch_id: BRANCH_ID,
    total_amount: 10000000,
    status: 'APPROVED',
    deleted_at: null,
    lines: [
      {
        id: 'po-line-1',
        product_id: PRODUCT_A,
        qty_ordered: 100,
        unit_price: 100000,
        product: { code: 'PROD-A', name: 'Produk A' },
      },
    ],
  };

  const mockSupplier = {
    id: SUPPLIER_ID,
    name: 'PT Vendor Terpercaya',
    payment_terms_days: 30,
    is_active: true,
    deleted_at: null,
  };

  const mockBranch = {
    id: BRANCH_ID,
    name: 'Cabang Utama',
    is_active: true,
    deleted_at: null,
  };

  let mockPrisma: any;
  let mockJournalEngine: any;

  beforeEach(async () => {
    mockPrisma = {
      purchaseOrder: { findUnique: jest.fn() },
      goodsReceipt: { findMany: jest.fn() },
      supplier: { findUnique: jest.fn().mockResolvedValue(mockSupplier) },
      branch: { findUnique: jest.fn().mockResolvedValue(mockBranch) },
      invoice: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      invoiceLine: { create: jest.fn() },
      fiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'period-1', status: 'OPEN' }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        if (Array.isArray(fn)) return Promise.all(fn);
        return fn(mockPrisma);
      }),
    };

    mockJournalEngine = {
      processEvent: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        ThreeWayMatchingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: { record: jest.fn().mockResolvedValue({}) } },
        { provide: NumberingService, useValue: { generate: jest.fn().mockResolvedValue('INV-202608-00001') } },
        { provide: JournalEngineService, useValue: mockJournalEngine },
      ],
    }).compile();

    invoiceService = module.get<InvoiceService>(InvoiceService);
    matchingService = module.get<ThreeWayMatchingService>(ThreeWayMatchingService);
    jest.clearAllMocks();

    mockPrisma.purchaseOrder.findUnique.mockResolvedValue(mockPO);
  });

  describe('Three-Way Matching Invariants', () => {
    it('ANTI-BYPASS RULE 1: PO = 100, GR = 0, Invoice = 100 MUST BE REJECTED', async () => {
      // 0 goods receipts confirmed
      mockPrisma.goodsReceipt.findMany.mockResolvedValue([]);

      const invoicePayload: CreatePurchaseInvoiceDTO = {
        supplier_id: SUPPLIER_ID,
        branch_id: BRANCH_ID,
        po_id: PO_ID,
        invoice_date: new Date(),
        due_date: new Date(),
        lines: [
          {
            product_id: PRODUCT_A,
            qty: 100,
            unit_price: 100000,
            tax_pct: 0,
          },
        ],
      };

      await expect(
        invoiceService.createPurchaseInvoice(invoicePayload, USER_ID),
      ).rejects.toThrow(BusinessRuleException);

      // Verify no invoice and no journal created
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
      expect(mockJournalEngine.processEvent).not.toHaveBeenCalled();
    });

    it('ANTI-BYPASS RULE 2: PO = 100, GR = 40, Invoice = 100 MUST BE REJECTED', async () => {
      // Only 40 units received in GR
      mockPrisma.goodsReceipt.findMany.mockResolvedValue([
        {
          id: 'gr-1',
          status: 'CONFIRMED',
          lines: [{ product_id: PRODUCT_A, qty_received: 40, total_cost: 4000000 }],
        },
      ]);

      const invoicePayload: CreatePurchaseInvoiceDTO = {
        supplier_id: SUPPLIER_ID,
        branch_id: BRANCH_ID,
        po_id: PO_ID,
        invoice_date: new Date(),
        due_date: new Date(),
        lines: [
          {
            product_id: PRODUCT_A,
            qty: 100, // exceeds received quantity (40 + 5% tolerance is 42)
            unit_price: 100000,
            tax_pct: 0,
          },
        ],
      };

      await expect(
        invoiceService.createPurchaseInvoice(invoicePayload, USER_ID),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('VALID FLOW 1: PO = 100, GR = 100, Invoice = 100 MUST PASS', async () => {
      mockPrisma.goodsReceipt.findMany.mockResolvedValue([
        {
          id: 'gr-1',
          status: 'CONFIRMED',
          lines: [{ product_id: PRODUCT_A, qty_received: 100, total_cost: 10000000 }],
        },
      ]);
      mockPrisma.invoice.create.mockResolvedValue({
        id: INVOICE_ID,
        invoice_number: 'INV-202608-00001',
        status: 'DRAFT',
        total_amount: 10000000,
      });

      const invoicePayload: CreatePurchaseInvoiceDTO = {
        supplier_id: SUPPLIER_ID,
        branch_id: BRANCH_ID,
        po_id: PO_ID,
        invoice_date: new Date(),
        due_date: new Date(),
        lines: [
          {
            product_id: PRODUCT_A,
            qty: 100,
            unit_price: 100000,
            tax_pct: 0,
          },
        ],
      };

      const result = await invoiceService.createPurchaseInvoice(invoicePayload, USER_ID);
      expect(result).toBeDefined();
      expect(mockPrisma.invoice.create).toHaveBeenCalled();
    });

    it('VALID FLOW 2: Partial Invoicing (PO = 100, GR = 100, Invoice = 40) MUST PASS', async () => {
      mockPrisma.goodsReceipt.findMany.mockResolvedValue([
        {
          id: 'gr-1',
          status: 'CONFIRMED',
          lines: [{ product_id: PRODUCT_A, qty_received: 100, total_cost: 10000000 }],
        },
      ]);
      mockPrisma.invoice.create.mockResolvedValue({
        id: INVOICE_ID,
        invoice_number: 'INV-202608-00002',
        status: 'DRAFT',
        total_amount: 4000000,
      });

      const invoicePayload: CreatePurchaseInvoiceDTO = {
        supplier_id: SUPPLIER_ID,
        branch_id: BRANCH_ID,
        po_id: PO_ID,
        invoice_date: new Date(),
        due_date: new Date(),
        lines: [
          {
            product_id: PRODUCT_A,
            qty: 40,
            unit_price: 100000,
            tax_pct: 0,
          },
        ],
      };

      const result = await invoiceService.createPurchaseInvoice(invoicePayload, USER_ID);
      expect(result).toBeDefined();
    });

    it('VALID FLOW 3: Multiple Goods Receipts (GR1 = 40, GR2 = 60, Invoice = 100) MUST PASS', async () => {
      mockPrisma.goodsReceipt.findMany.mockResolvedValue([
        {
          id: 'gr-1',
          status: 'CONFIRMED',
          lines: [{ product_id: PRODUCT_A, qty_received: 40, total_cost: 4000000 }],
        },
        {
          id: 'gr-2',
          status: 'CONFIRMED',
          lines: [{ product_id: PRODUCT_A, qty_received: 60, total_cost: 6000000 }],
        },
      ]);
      mockPrisma.invoice.create.mockResolvedValue({
        id: INVOICE_ID,
        invoice_number: 'INV-202608-00003',
        status: 'DRAFT',
        total_amount: 10000000,
      });

      const invoicePayload: CreatePurchaseInvoiceDTO = {
        supplier_id: SUPPLIER_ID,
        branch_id: BRANCH_ID,
        po_id: PO_ID,
        invoice_date: new Date(),
        due_date: new Date(),
        lines: [
          {
            product_id: PRODUCT_A,
            qty: 100,
            unit_price: 100000,
            tax_pct: 0,
          },
        ],
      };

      const result = await invoiceService.createPurchaseInvoice(invoicePayload, USER_ID);
      expect(result).toBeDefined();
    });

    it('TOLERANCE BOUNDARY: Invoice qty = 105 (within 5% tolerance) PASSES, 106 FAILS', async () => {
      mockPrisma.goodsReceipt.findMany.mockResolvedValue([
        {
          id: 'gr-1',
          status: 'CONFIRMED',
          lines: [{ product_id: PRODUCT_A, qty_received: 100, total_cost: 10000000 }],
        },
      ]);

      // 105 units <= 100 * 1.05 -> PASSES
      const passPayload = {
        po_id: PO_ID,
        invoice_lines: [{ product_id: PRODUCT_A, qty: 105, unit_price: 100000 }],
      };
      const passResult = await matchingService.validate(passPayload);
      expect(passResult.isValid).toBe(true);

      // 106 units > 100 * 1.05 -> FAILS
      const failPayload = {
        po_id: PO_ID,
        invoice_lines: [{ product_id: PRODUCT_A, qty: 106, unit_price: 100000 }],
      };
      const failResult = await matchingService.validate(failPayload);
      expect(failResult.isValid).toBe(false);
      expect(failResult.violations.length).toBeGreaterThan(0);
    });

    it('SERVER-SIDE POST BOUNDARY: Direct post() attempt without GR MUST BE BLOCKED', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: INVOICE_ID,
        invoice_number: 'INV-202608-00001',
        invoice_type: 'PURCHASE',
        reference_type: 'PO',
        reference_id: PO_ID,
        status: 'DRAFT',
        total_amount: 10000000,
        deleted_at: null,
        lines: [
          { product_id: PRODUCT_A, qty: 100, unit_price: 100000 },
        ],
      });

      // No confirmed GRs
      mockPrisma.goodsReceipt.findMany.mockResolvedValue([]);

      await expect(invoiceService.post(INVOICE_ID, USER_ID)).rejects.toThrow(BusinessRuleException);

      // Verify no status change and no journal entry
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
      expect(mockJournalEngine.processEvent).not.toHaveBeenCalled();
    });
  });
});
