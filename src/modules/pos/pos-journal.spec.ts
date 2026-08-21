import { POSService } from './services/pos.service';

describe('P0-003 POS Auto-Journal Integration Unit Test', () => {
  let posService: POSService;
  let mockPrisma: any;
  let mockNumbering: any;
  let mockJournalEngine: any;
  let mockPeriodManager: any;

  beforeEach(() => {
    mockPrisma = {
      posTransaction: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      paymentMethod: {
        findFirst: jest.fn(),
      },
      posPayment: {
        create: jest.fn(),
      },
      fiscalPeriod: {
        findFirst: jest.fn(),
      },
      posTransactionLine: {
        findMany: jest.fn(),
      },
      inventoryLedger: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };
    mockNumbering = { generate: jest.fn() };
    mockJournalEngine = { processEvent: jest.fn() };
    mockPeriodManager = { getCurrentPeriod: jest.fn() };

    posService = new POSService(
      mockPrisma as any,
      mockNumbering as any,
      mockJournalEngine as any,
      mockPeriodManager as any,
    );
  });

  it('posts POS_SALE and POS_SALE_COGS auto-journals on applyPayment', async () => {
    const txId = 'tx-1111';
    const cashierId = 'user-9999';
    const periodId = 'period-2026';

    mockPrisma.posTransaction.findUnique.mockResolvedValue({
      id: txId,
      status: 'OPEN',
      version: 1,
      total_amount: 150000,
      cashier_id: cashierId,
    });

    mockPrisma.paymentMethod.findFirst.mockResolvedValue({
      id: 'pm-cash',
      type: 'CASH',
    });

    mockPrisma.posTransaction.update.mockResolvedValue({
      id: txId,
      transaction_number: 'POS-202608-00001',
      total_amount: 150000,
      paid_amount: 150000,
      change_amount: 0,
      status: 'COMPLETED',
    });

    mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({
      id: periodId,
      status: 'OPEN',
    });

    mockPrisma.posTransactionLine.findMany.mockResolvedValue([
      { qty: 2, unit_cost: 40000 }, // Total COGS = 80,000
    ]);

    mockPrisma.inventoryLedger.findMany.mockResolvedValue([
      { total_cost: 80000 },
    ]);

    const receipt = await posService.applyPayment(txId as any, [
      { method: 'CASH', amount: 150000, version: 1 },
    ]);

    expect(receipt).toBeDefined();
    expect(receipt.transaction_number).toBe('POS-202608-00001');

    // Verify POS_SALE journal event call
    expect(mockJournalEngine.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'POS_SALE',
        reference_type: 'POS_TRANSACTION',
        reference_id: txId,
        amount: 150000,
      }),
      mockPrisma,
    );

    // Verify POS_SALE_COGS journal event call
    expect(mockJournalEngine.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'POS_SALE_COGS',
        reference_type: 'POS_TRANSACTION',
        reference_id: txId,
        amount: 80000,
      }),
      mockPrisma,
    );
  });
});
