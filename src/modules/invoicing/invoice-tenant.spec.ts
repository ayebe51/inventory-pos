import { InvoiceService } from './services/invoice.service';
import { ForbiddenException } from '@nestjs/common';

describe('P0-002 Cross-Branch Tenant Isolation Unit Test', () => {
  let invoiceService: InvoiceService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockNumbering: any;
  let mockJournalEngine: any;

  beforeEach(() => {
    mockPrisma = {
      invoice: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((callbackOrArray) => {
        if (Array.isArray(callbackOrArray)) {
          return Promise.all(callbackOrArray);
        }
        return callbackOrArray(mockPrisma);
      }),
    };
    mockAudit = { record: jest.fn() };
    mockNumbering = { generate: jest.fn() };
    mockJournalEngine = { processEvent: jest.fn() };

    invoiceService = new InvoiceService(
      mockPrisma as any,
      mockAudit as any,
      mockNumbering as any,
      mockJournalEngine as any,
    );
  });

  it('filters search results by user branch_id', async () => {
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.invoice.count.mockResolvedValue(0);

    const userBranchId = 'branch-aaaa-1111';
    await invoiceService.search({ branch_id: userBranchId, page: 1, per_page: 20 });

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branch_id: userBranchId,
          deleted_at: null,
        }),
      }),
    );
  });

  it('allows findById when invoice branch matches user branch', async () => {
    const userBranchId = 'branch-aaaa-1111';
    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      branch_id: userBranchId,
      deleted_at: null,
      subtotal: 100,
      tax_amount: 10,
      total_amount: 110,
      paid_amount: 0,
      outstanding_amount: 110,
    });

    const invoice = await invoiceService.findById('inv-1' as any, { branch_id: userBranchId });
    expect(invoice).toBeDefined();
    expect(invoice?.id).toBe('inv-1');
  });

  it('throws ForbiddenException when invoice branch does NOT match user branch', async () => {
    const userBranchId = 'branch-aaaa-1111';
    const otherBranchId = 'branch-bbbb-2222';

    mockPrisma.invoice.findUnique.mockResolvedValue({
      id: 'inv-2',
      branch_id: otherBranchId,
      deleted_at: null,
    });

    await expect(
      invoiceService.findById('inv-2' as any, { branch_id: userBranchId }),
    ).rejects.toThrow(ForbiddenException);
  });
});
