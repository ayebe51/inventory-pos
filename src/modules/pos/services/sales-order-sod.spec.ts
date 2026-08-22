import { Test, TestingModule } from '@nestjs/testing';
import { SalesOrderService } from './sales-order.service';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService } from '../../../services/numbering/numbering.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

describe('SalesOrderService - SoD and Approval Hardening', () => {
  let service: SalesOrderService;

  const CREATOR_ID = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa' as UUID;
  const APPROVER_ID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb' as UUID;
  const SO_ID = 'cccccccc-3333-3333-3333-cccccccccccc' as UUID;

  const mockPrisma = {
    salesOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      return fn(mockPrisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesOrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NumberingService, useValue: { generate: jest.fn() } },
        { provide: InventoryService, useValue: { recordMovement: jest.fn() } },
        { provide: JournalEngineService, useValue: { processEvent: jest.fn() } },
      ],
    }).compile();

    service = module.get<SalesOrderService>(SalesOrderService);
    jest.clearAllMocks();
  });

  it('should REJECT self-approval by SO creator (SoD enforcement)', async () => {
    mockPrisma.salesOrder.findUnique.mockResolvedValue({
      id: SO_ID,
      status: 'PENDING_APPROVAL',
      created_by: CREATOR_ID,
    });

    await expect(service.approve(SO_ID, CREATOR_ID)).rejects.toThrow(BusinessRuleException);
    await expect(service.approve(SO_ID, CREATOR_ID)).rejects.toMatchObject({
      response: {
        error: {
          code: ErrorCode.BUSINESS_RULE_VIOLATION,
          message: expect.stringContaining('Segregation of Duties'),
        },
      },
    });
  });

  it('should ALLOW approval by a distinct authorized user', async () => {
    mockPrisma.salesOrder.findUnique.mockResolvedValue({
      id: SO_ID,
      status: 'PENDING_APPROVAL',
      created_by: CREATOR_ID,
    });
    mockPrisma.salesOrder.update.mockResolvedValue({
      id: SO_ID,
      status: 'APPROVED',
      approved_by: APPROVER_ID,
      approved_at: new Date(),
    });

    const result = await service.approve(SO_ID, APPROVER_ID);
    expect(result.status).toBe('APPROVED');
    expect(mockPrisma.salesOrder.update).toHaveBeenCalledWith({
      where: { id: SO_ID },
      data: {
        status: 'APPROVED',
        approved_by: APPROVER_ID,
        approved_at: expect.any(Date),
      },
    });
  });

  it('should REJECT approval if SO is not in PENDING_APPROVAL status (already approved)', async () => {
    mockPrisma.salesOrder.findUnique.mockResolvedValue({
      id: SO_ID,
      status: 'APPROVED',
      created_by: CREATOR_ID,
    });

    await expect(service.approve(SO_ID, APPROVER_ID)).rejects.toThrow(BusinessRuleException);
  });

  it('should REJECT approval if SO is not found', async () => {
    mockPrisma.salesOrder.findUnique.mockResolvedValue(null);

    await expect(service.approve(SO_ID, APPROVER_ID)).rejects.toThrow(BusinessRuleException);
  });
});
