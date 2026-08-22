import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseReturnService, CreatePurchaseReturnDTO } from './purchase-return.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService } from '../../../services/numbering/numbering.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { PeriodManagerService } from '../../../services/period-manager/period-manager.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

describe('PurchaseReturnService', () => {
  let service: PurchaseReturnService;

  const SUPPLIER_ID = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa' as UUID;
  const BRANCH_ID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' as UUID;
  const WAREHOUSE_ID = 'cccccccc-3333-3333-3333-cccccccccccc' as UUID;
  const PRODUCT_ID = 'dddddddd-4444-4444-4444-dddddddddddd' as UUID;
  const UOM_ID = 'eeeeeeee-5555-5555-5555-eeeeeeeeeeee' as UUID;
  const GR_ID = 'ffffffff-6666-6666-6666-ffffffffffff' as UUID;
  const USER_ID = '99999999-9999-9999-9999-999999999999' as UUID;

  const mockSupplier = {
    id: SUPPLIER_ID,
    name: 'PT Vendor Utama',
    is_active: true,
    deleted_at: null,
  };

  const mockWarehouse = {
    id: WAREHOUSE_ID,
    name: 'Gudang Pusat',
    is_active: true,
    is_locked: false,
    deleted_at: null,
  };

  const mockGR = {
    id: GR_ID,
    gr_number: 'GR-202601-00001',
    status: 'CONFIRMED',
    deleted_at: null,
    lines: [
      {
        product_id: PRODUCT_ID,
        qty_received: 100,
      },
    ],
  };

  const mockPrisma: any = {
    supplier: { findUnique: jest.fn() },
    warehouse: { findUnique: jest.fn() },
    goodsReceipt: { findUnique: jest.fn() },
    purchaseReturn: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    purchaseReturnLine: { create: jest.fn() },
    inventoryLedger: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockAudit = { record: jest.fn().mockResolvedValue({}) };
  const mockNumbering = { generate: jest.fn().mockResolvedValue('PRET-202608-00001') };
  const mockJournalEngine = { processEvent: jest.fn().mockResolvedValue([]) };
  const mockPeriodManager = {
    getPeriodForDate: jest.fn().mockResolvedValue({ id: 'period-1', status: 'OPEN' }),
    validatePeriodOpen: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      return fn(mockPrisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseReturnService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: NumberingService, useValue: mockNumbering },
        { provide: JournalEngineService, useValue: mockJournalEngine },
        { provide: PeriodManagerService, useValue: mockPeriodManager },
      ],
    }).compile();

    service = module.get<PurchaseReturnService>(PurchaseReturnService);
    jest.clearAllMocks();

    mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
    mockPrisma.warehouse.findUnique.mockResolvedValue(mockWarehouse);
    mockPrisma.goodsReceipt.findUnique.mockResolvedValue(mockGR);
    mockPrisma.purchaseReturn.findMany.mockResolvedValue([]);
    mockPrisma.inventoryLedger.findFirst.mockResolvedValue({
      sequence_number: 5,
      running_qty: 150,
      running_cost: 1500000,
    });
    mockPrisma.purchaseReturn.create.mockImplementation((args: any) => ({
      id: 'pret-id-1',
      ...args.data,
    }));
  });

  it('should successfully create Purchase Return, decrement stock, and post journal entry', async () => {
    const input: CreatePurchaseReturnDTO = {
      supplier_id: SUPPLIER_ID,
      branch_id: BRANCH_ID,
      warehouse_id: WAREHOUSE_ID,
      gr_id: GR_ID,
      reason: 'Damaged packaging from supplier',
      lines: [
        {
          product_id: PRODUCT_ID,
          uom_id: UOM_ID,
          qty: 20,
          unit_cost: 10000,
        },
      ],
    };

    const result = await service.createReturn(input, USER_ID);
    expect(result).toBeDefined();
    expect(result.return_number).toBe('PRET-202608-00001');

    // Verify inventory ledger was created with PURCHASE_RETURN and qty_out = 20
    expect(mockPrisma.inventoryLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        transaction_type: 'PURCHASE_RETURN',
        qty_in: 0,
        qty_out: 20,
        running_qty: 130, // 150 - 20
      }),
    });

    // Verify journal engine was invoked
    expect(mockJournalEngine.processEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'STOCK_ADJUSTMENT_NEGATIVE',
        reference_type: 'PURCHASE_RETURN',
        amount: 200000, // 20 * 10000
      }),
      expect.anything(),
    );
  });

  it('should REJECT return if return quantity exceeds received quantity in GR', async () => {
    const input: CreatePurchaseReturnDTO = {
      supplier_id: SUPPLIER_ID,
      branch_id: BRANCH_ID,
      warehouse_id: WAREHOUSE_ID,
      gr_id: GR_ID,
      reason: 'Over return attempt',
      lines: [
        {
          product_id: PRODUCT_ID,
          uom_id: UOM_ID,
          qty: 120, // GR only received 100
          unit_cost: 10000,
        },
      ],
    };

    await expect(service.createReturn(input, USER_ID)).rejects.toThrow(BusinessRuleException);
  });

  it('should REJECT return if available warehouse physical stock is insufficient', async () => {
    mockPrisma.inventoryLedger.findFirst.mockResolvedValue({
      sequence_number: 1,
      running_qty: 10, // only 10 in stock
      running_cost: 100000,
    });

    const input: CreatePurchaseReturnDTO = {
      supplier_id: SUPPLIER_ID,
      branch_id: BRANCH_ID,
      warehouse_id: WAREHOUSE_ID,
      gr_id: GR_ID,
      reason: 'Return more than stock in warehouse',
      lines: [
        {
          product_id: PRODUCT_ID,
          uom_id: UOM_ID,
          qty: 50,
          unit_cost: 10000,
        },
      ],
    };

    await expect(service.createReturn(input, USER_ID)).rejects.toThrow(BusinessRuleException);
  });

  it('should REJECT return if warehouse is locked (BR-INV-005)', async () => {
    mockPrisma.warehouse.findUnique.mockResolvedValue({
      ...mockWarehouse,
      is_locked: true,
    });

    const input: CreatePurchaseReturnDTO = {
      supplier_id: SUPPLIER_ID,
      branch_id: BRANCH_ID,
      warehouse_id: WAREHOUSE_ID,
      reason: 'Locked warehouse attempt',
      lines: [
        {
          product_id: PRODUCT_ID,
          uom_id: UOM_ID,
          qty: 10,
          unit_cost: 10000,
        },
      ],
    };

    await expect(service.createReturn(input, USER_ID)).rejects.toThrow(BusinessRuleException);
  });
});
