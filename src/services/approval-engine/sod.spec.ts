/**
 * SOD Enforcement Tests
 *
 * SOD-001: Pembuat PO tidak bisa menjadi approver PO yang sama
 * SOD-002: Pembuat payment tidak bisa menjadi approver payment
 * SOD-003: Kasir tidak bisa void transaksinya sendiri
 *
 * Validates: Requirements 3.4, 7.13, 7.14, 5.10, 5.11
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalEngineService } from './approval-engine.service';
import { PosService } from '../pos/pos.service';
import { PrismaService } from '../../config/prisma.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';

// ── UUIDs ─────────────────────────────────────────────────────────────────────

const CREATOR_ID   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const APPROVER_ID  = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const DOC_ID       = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockPrismaService = {
  userRole: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  purchaseOrder: {
    findUnique: jest.fn(),
  },
  payment: {
    findUnique: jest.fn(),
  },
  posTransaction: {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function expectSODViolation(promise: Promise<unknown>, sodCode: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(BusinessRuleException);
  const body = (caught as BusinessRuleException).getResponse() as Record<string, unknown>;
  expect((body.error as Record<string, unknown>).code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
  expect((body.error as Record<string, unknown>).message).toContain(sodCode);
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe('SOD-001: PO creator cannot approve own PO', () => {
  let service: ApprovalEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalEngineService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ApprovalEngineService>(ApprovalEngineService);
    jest.clearAllMocks();
  });

  it('throws BUSINESS_RULE_VIOLATION when approverId === created_by (SOD-001)', async () => {
    mockPrismaService.purchaseOrder.findUnique.mockResolvedValueOnce({
      created_by: CREATOR_ID,
    });

    await expectSODViolation(
      service.approve('PURCHASE_ORDER', DOC_ID, CREATOR_ID),
      'SOD-001',
    );
  });

  it('does NOT throw when approverId !== created_by (valid case)', async () => {
    mockPrismaService.purchaseOrder.findUnique.mockResolvedValueOnce({
      created_by: CREATOR_ID,
    });

    await expect(
      service.approve('PURCHASE_ORDER', DOC_ID, APPROVER_ID),
    ).resolves.toBeUndefined();
  });
});

describe('SOD-002: Payment creator cannot approve own payment', () => {
  let service: ApprovalEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalEngineService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ApprovalEngineService>(ApprovalEngineService);
    jest.clearAllMocks();
  });

  it('throws BUSINESS_RULE_VIOLATION when approverId === created_by (SOD-002)', async () => {
    mockPrismaService.payment.findUnique.mockResolvedValueOnce({
      created_by: CREATOR_ID,
    });

    await expectSODViolation(
      service.approve('PAYMENT', DOC_ID, CREATOR_ID),
      'SOD-002',
    );
  });

  it('does NOT throw when approverId !== created_by (valid case)', async () => {
    mockPrismaService.payment.findUnique.mockResolvedValueOnce({
      created_by: CREATOR_ID,
    });

    await expect(
      service.approve('PAYMENT', DOC_ID, APPROVER_ID),
    ).resolves.toBeUndefined();
  });
});

describe('SOD-003: Cashier cannot void own transaction', () => {
  let posService: PosService;

  const CASHIER_ID    = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const SUPERVISOR_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const TX_ID         = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    posService = module.get<PosService>(PosService);
    jest.clearAllMocks();
  });

  it('throws BUSINESS_RULE_VIOLATION when supervisorId === cashier_id (SOD-003)', async () => {
    mockPrismaService.posTransaction.findUnique.mockResolvedValueOnce({
      cashier_id: CASHIER_ID,
      status: 'COMPLETED',
    });

    await expectSODViolation(
      posService.voidTransaction(TX_ID, CASHIER_ID, 'test void'),
      'SOD-003',
    );
  });

  it('does NOT throw when supervisorId !== cashier_id (valid case)', async () => {
    mockPrismaService.posTransaction.findUnique.mockResolvedValueOnce({
      cashier_id: CASHIER_ID,
      status: 'COMPLETED',
    });
    mockPrismaService.posTransaction.update.mockResolvedValueOnce({});

    await expect(
      posService.voidTransaction(TX_ID, SUPERVISOR_ID, 'supervisor void'),
    ).resolves.toBeUndefined();

    expect(mockPrismaService.posTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TX_ID },
        data: expect.objectContaining({
          status: 'VOIDED',
          voided_by: SUPERVISOR_ID,
        }),
      }),
    );
  });

  it('SOD-003 check happens BEFORE any DB write', async () => {
    mockPrismaService.posTransaction.findUnique.mockResolvedValueOnce({
      cashier_id: CASHIER_ID,
      status: 'COMPLETED',
    });

    await expect(
      posService.voidTransaction(TX_ID, CASHIER_ID, 'self void attempt'),
    ).rejects.toBeInstanceOf(BusinessRuleException);

    // update must NOT have been called
    expect(mockPrismaService.posTransaction.update).not.toHaveBeenCalled();
  });
});
