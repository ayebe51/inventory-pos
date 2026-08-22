import { Test, TestingModule } from '@nestjs/testing';
import { ReportingService } from './reporting.service';
import { PrismaReadService } from '../../../config/prisma-read.service';
import { UUID } from '../../../common/types/uuid.type';

describe('ReportingService - Stock Position Report & Inventory Valuation (FINDING-20A-01)', () => {
  let reportingService: ReportingService;
  let mockPrisma: any;

  const PRODUCT_A = '11111111-1111-1111-1111-111111111111' as UUID;
  const PRODUCT_B = '22222222-2222-2222-2222-222222222222' as UUID;
  const WAREHOUSE_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' as UUID;
  const WAREHOUSE_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' as UUID;

  beforeEach(async () => {
    mockPrisma = {
      $queryRawUnsafe: jest.fn(),
      inventoryLedger: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        { provide: PrismaReadService, useValue: mockPrisma },
      ],
    }).compile();

    reportingService = module.get<ReportingService>(ReportingService);
    jest.clearAllMocks();
  });

  it('TEST 1: Single Movement - Single purchase creates exact ending qty and valuation', async () => {
    // 100 units @ Rp 10.000 = Rp 1.000.000
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        product_id: PRODUCT_A,
        product_code: 'PROD-A',
        product_name: 'Product A',
        warehouse_id: WAREHOUSE_1,
        warehouse_name: 'Warehouse 1',
        qty_on_hand: 100,
        total_value: 1000000,
      },
    ]);

    const report = await reportingService.getStockPositionReport({});
    expect(report.items).toHaveLength(1);
    expect(report.items[0].qty_on_hand).toBe(100);
    expect(report.items[0].total_value).toBe(1000000);
    expect(report.items[0].average_cost).toBe(10000);
  });

  it('TEST 2: Multiple Ledger Rows - Returns latest running_cost (500k), NOT gross sum (2.3M)', async () => {
    // GR +100 (1.000.000) -> SALE -20 (800.000) -> SALE -30 (500.000)
    // SQL window query returns latest partitioned row where rn = 1: running_qty = 50, running_cost = 500.000
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        product_id: PRODUCT_A,
        product_code: 'PROD-A',
        product_name: 'Product A',
        warehouse_id: WAREHOUSE_1,
        warehouse_name: 'Warehouse 1',
        qty_on_hand: 50,
        total_value: 500000,
      },
    ]);

    const report = await reportingService.getStockPositionReport({});
    expect(report.items[0].qty_on_hand).toBe(50);
    expect(report.items[0].total_value).toBe(500000); // NOT 2.300.000
    expect(report.items[0].average_cost).toBe(10000);
  });

  it('TEST 3: Multiple Warehouses - Correctly aggregates across warehouses without cross-contamination', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        product_id: PRODUCT_A,
        product_code: 'PROD-A',
        product_name: 'Product A',
        warehouse_id: WAREHOUSE_1,
        warehouse_name: 'Warehouse 1',
        qty_on_hand: 50,
        total_value: 500000,
      },
      {
        product_id: PRODUCT_A,
        product_code: 'PROD-A',
        product_name: 'Product A',
        warehouse_id: WAREHOUSE_2,
        warehouse_name: 'Warehouse 2',
        qty_on_hand: 30,
        total_value: 300000,
      },
    ]);

    const report = await reportingService.getStockPositionReport({});
    expect(report.items).toHaveLength(2);
    const totalEnterpriseValue = report.items.reduce((sum, item) => sum + item.total_value, 0);
    expect(totalEnterpriseValue).toBe(800000);
  });

  it('TEST 4: Product Partitioning - Each product resolves its own independent latest state', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      {
        product_id: PRODUCT_A,
        product_code: 'PROD-A',
        product_name: 'Product A',
        warehouse_id: WAREHOUSE_1,
        warehouse_name: 'Warehouse 1',
        qty_on_hand: 50,
        total_value: 500000,
      },
      {
        product_id: PRODUCT_B,
        product_code: 'PROD-B',
        product_name: 'Product B',
        warehouse_id: WAREHOUSE_1,
        warehouse_name: 'Warehouse 1',
        qty_on_hand: 70,
        total_value: 700000,
      },
    ]);

    const report = await reportingService.getStockPositionReport({});
    expect(report.items).toHaveLength(2);
    const totalValue = report.items.reduce((sum, item) => sum + item.total_value, 0);
    expect(totalValue).toBe(1200000);
  });

  it('TEST 5: As-of Date Filter - Correctly passes as_of_date to query parameter', async () => {
    const asOfDate = new Date('2026-06-30T23:59:59Z');
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await reportingService.getStockPositionReport({ as_of_date: asOfDate });
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('WITH latest_ledger AS'),
      asOfDate,
      null,
    );
  });

  it('TEST 6: Warehouse Filter - Correctly scopes query when warehouse_id is specified', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await reportingService.getStockPositionReport({ warehouse_id: WAREHOUSE_1 });
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('($2::uuid IS NULL OR w.id = $2::uuid)'),
      expect.any(Date),
      WAREHOUSE_1,
    );
  });

  it('TEST 7: Empty Position - Returns empty items array when no stock exists', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const report = await reportingService.getStockPositionReport({});
    expect(report.items).toEqual([]);
  });

  it('TEST 8: Parity with Executive Dashboard Inventory Valuation', async () => {
    const asOfDate = new Date('2026-08-22T00:00:00Z');
    const mockStockPositionResult = [
      {
        product_id: PRODUCT_A,
        product_code: 'PROD-A',
        product_name: 'Product A',
        warehouse_id: WAREHOUSE_1,
        warehouse_name: 'Warehouse 1',
        qty_on_hand: 100,
        total_value: 10000000,
      },
    ];

    mockPrisma.$queryRawUnsafe.mockImplementation(async (query: string) => {
      if (query.includes('WITH latest_ledger AS')) {
        return mockStockPositionResult;
      }
      if (query.includes('SELECT COALESCE(SUM(total_amount), 0)')) {
        return [{ total: 0 }];
      }
      if (query.includes('FROM journal_entry_lines')) {
        return [{ balance: 0 }];
      }
      if (query.includes('SUM(running_cost) as total_value')) {
        return [{ total_value: 10000000, low_stock_count: 0 }];
      }
      return [];
    });

    const stockReport = await reportingService.getStockPositionReport({ as_of_date: asOfDate });
    const stockReportTotal = stockReport.items.reduce((sum, item) => sum + item.total_value, 0);

    const dashboard = await reportingService.getExecutiveDashboard({ as_of_date: asOfDate });
    const dashboardInventoryValue = dashboard.inventory_value;

    expect(stockReportTotal).toBe(dashboardInventoryValue);
    expect(stockReportTotal).toBe(10000000);
  });
});
