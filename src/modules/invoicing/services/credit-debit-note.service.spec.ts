import { Test, TestingModule } from '@nestjs/testing';
import { CreditNoteService } from './credit-note.service';
import { DebitNoteService } from './debit-note.service';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

describe('CreditNoteService & DebitNoteService', () => {
  let creditNoteService: CreditNoteService;
  let debitNoteService: DebitNoteService;

  const INVOICE_ID = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa' as UUID;
  const USER_ID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' as UUID;

  const mockSalesInvoice = {
    id: INVOICE_ID,
    invoice_number: 'INV-202601-00001',
    invoice_type: 'SALES',
    customer_id: 'cust-1',
    branch_id: 'branch-1',
    total_amount: 1000000,
    outstanding_amount: 1000000,
    status: 'OPEN',
  };

  const mockPurchaseInvoice = {
    id: INVOICE_ID,
    invoice_number: 'INV-202601-00002',
    invoice_type: 'PURCHASE',
    supplier_id: 'supp-1',
    branch_id: 'branch-1',
    total_amount: 500000,
    outstanding_amount: 500000,
    status: 'OPEN',
  };

  const mockPrisma: any = {
    invoice: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    fiscalPeriod: {
      findFirst: jest.fn().mockResolvedValue({ id: 'period-1', status: 'OPEN' }),
    },
    $transaction: jest.fn(),
  };

  const mockNumbering = {
    generate: jest.fn().mockImplementation((type) => `${type}-202608-00001`),
  };

  const mockJournalEngine = {
    processEvent: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      return fn(mockPrisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditNoteService,
        DebitNoteService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: JournalEngineService, useValue: mockJournalEngine },
      ],
    }).compile();

    creditNoteService = module.get<CreditNoteService>(CreditNoteService);
    debitNoteService = module.get<DebitNoteService>(DebitNoteService);
    jest.clearAllMocks();
  });

  describe('CreditNoteService', () => {
    it('should successfully create and post Credit Note for valid Sales Invoice', async () => {
      mockPrisma.invoice.findUnique.mockImplementation(async (args: any) => {
        if (args.where.id === INVOICE_ID) return mockSalesInvoice;
        return {
          id: 'cn-id-1',
          invoice_number: 'CN-202608-00001',
          total_amount: 200000,
          invoice_type: 'CREDIT_NOTE',
          reference_id: INVOICE_ID,
          invoice_date: new Date(),
        };
      });
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'cn-id-1',
        invoice_number: 'CN-202608-00001',
        total_amount: 200000,
        invoice_type: 'CREDIT_NOTE',
      });

      const result = await creditNoteService.createCreditNote(INVOICE_ID, 200000, 'Price adjustment', USER_ID);
      expect(result).toBeDefined();
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: {
          outstanding_amount: 800000,
          status: 'PARTIAL',
        },
      });
      expect(mockJournalEngine.processEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'SALES_RETURN',
          reference_type: 'CREDIT_NOTE',
          amount: 200000,
        }),
        expect.anything(),
      );
    });

    it('should REJECT Credit Note if invoice is PURCHASE invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockPurchaseInvoice);
      await expect(
        creditNoteService.createCreditNote(INVOICE_ID, 100000, 'Invalid type', USER_ID),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should REJECT Credit Note if amount exceeds invoice total', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockSalesInvoice);
      await expect(
        creditNoteService.createCreditNote(INVOICE_ID, 2000000, 'Excess amount', USER_ID),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('DebitNoteService', () => {
    it('should successfully create and post Debit Note for valid Purchase Invoice', async () => {
      mockPrisma.invoice.findUnique.mockImplementation(async (args: any) => {
        if (args.where.id === INVOICE_ID) return mockPurchaseInvoice;
        return {
          id: 'dn-id-1',
          invoice_number: 'DN-202608-00001',
          total_amount: 150000,
          invoice_type: 'DEBIT_NOTE',
          reference_id: INVOICE_ID,
          invoice_date: new Date(),
        };
      });
      mockPrisma.invoice.create.mockResolvedValue({
        id: 'dn-id-1',
        invoice_number: 'DN-202608-00001',
        total_amount: 150000,
        invoice_type: 'DEBIT_NOTE',
      });

      const result = await debitNoteService.createDebitNote(INVOICE_ID, 150000, 'Supplier rebate', USER_ID);
      expect(result).toBeDefined();
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: INVOICE_ID },
        data: {
          outstanding_amount: 350000,
          status: 'PARTIAL',
        },
      });
      expect(mockJournalEngine.processEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'GOODS_RECEIPT',
          reference_type: 'DEBIT_NOTE',
          amount: 150000,
        }),
        expect.anything(),
      );
    });

    it('should REJECT Debit Note if invoice is SALES invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockSalesInvoice);
      await expect(
        debitNoteService.createDebitNote(INVOICE_ID, 100000, 'Invalid type', USER_ID),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
