/**
 * Tests for ApprovalEngineService.getApprovalChain()
 *
 * Validates: Requirements 7.1
 * Approval thresholds (BR-PUR-007):
 *   Level 1 : amount < 5,000,000        → Supervisor
 *   Level 2 : 5,000,000 ≤ amount ≤ 50,000,000 → Finance_Manager
 *   Level 3 : amount > 50,000,000       → Owner
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalEngineService, APPROVAL_THRESHOLDS, APPROVAL_ROLES } from './approval-engine.service';
import { PrismaService } from '../../config/prisma.service';

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockUserRoles = [
  {
    user: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      full_name: 'Budi Supervisor',
      email: 'budi@example.com',
    },
  },
];

const mockPrismaService = {
  userRole: {
    findMany: jest.fn().mockResolvedValue(mockUserRoles),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const BRANCH_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const DOC_TYPE = 'PURCHASE_ORDER' as const;

// ── Test suite ────────────────────────────────────────────────────────────────

describe('ApprovalEngineService.getApprovalChain()', () => {
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
    mockPrismaService.userRole.findMany.mockResolvedValue(mockUserRoles);
  });

  // ── Level determination ───────────────────────────────────────────────────

  it('returns Level 1 (Supervisor) for amount = 0', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 0, BRANCH_ID);
    expect(chain.level).toBe(1);
    expect(chain.requiredRole).toBe(APPROVAL_ROLES.LEVEL_1);
    expect(chain.thresholdMin).toBe(0);
    expect(chain.thresholdMax).toBe(APPROVAL_THRESHOLDS.LEVEL_1_MAX);
  });

  it('returns Level 1 (Supervisor) for amount < 5,000,000', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 4_999_999, BRANCH_ID);
    expect(chain.level).toBe(1);
    expect(chain.requiredRole).toBe(APPROVAL_ROLES.LEVEL_1);
  });

  it('returns Level 2 (Finance_Manager) for amount = 5,000,000 (boundary)', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 5_000_000, BRANCH_ID);
    expect(chain.level).toBe(2);
    expect(chain.requiredRole).toBe(APPROVAL_ROLES.LEVEL_2);
    expect(chain.thresholdMin).toBe(APPROVAL_THRESHOLDS.LEVEL_1_MAX);
    expect(chain.thresholdMax).toBe(APPROVAL_THRESHOLDS.LEVEL_2_MAX);
  });

  it('returns Level 2 (Finance_Manager) for amount in 5jt–50jt range', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 25_000_000, BRANCH_ID);
    expect(chain.level).toBe(2);
    expect(chain.requiredRole).toBe(APPROVAL_ROLES.LEVEL_2);
  });

  it('returns Level 2 (Finance_Manager) for amount = 50,000,000 (boundary)', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 50_000_000, BRANCH_ID);
    expect(chain.level).toBe(2);
    expect(chain.requiredRole).toBe(APPROVAL_ROLES.LEVEL_2);
  });

  it('returns Level 3 (Owner) for amount > 50,000,000', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 50_000_001, BRANCH_ID);
    expect(chain.level).toBe(3);
    expect(chain.requiredRole).toBe(APPROVAL_ROLES.LEVEL_3);
    expect(chain.thresholdMin).toBe(APPROVAL_THRESHOLDS.LEVEL_2_MAX);
    expect(chain.thresholdMax).toBeNull();
  });

  it('returns Level 3 (Owner) for very large amount', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 1_000_000_000, BRANCH_ID);
    expect(chain.level).toBe(3);
    expect(chain.requiredRole).toBe(APPROVAL_ROLES.LEVEL_3);
  });

  // ── Approvers list ────────────────────────────────────────────────────────

  it('returns approvers from the branch with the required role', async () => {
    const chain = await service.getApprovalChain(DOC_TYPE, 1_000_000, BRANCH_ID);
    expect(chain.approvers).toHaveLength(1);
    expect(chain.approvers[0].full_name).toBe('Budi Supervisor');
    expect(chain.approvers[0].email).toBe('budi@example.com');
  });

  it('queries Prisma with correct role name and branchId', async () => {
    await service.getApprovalChain(DOC_TYPE, 1_000_000, BRANCH_ID);
    expect(mockPrismaService.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branch_id: BRANCH_ID,
          role: { name: APPROVAL_ROLES.LEVEL_1 },
        }),
      }),
    );
  });

  it('returns empty approvers list when no users have the role in the branch', async () => {
    mockPrismaService.userRole.findMany.mockResolvedValueOnce([]);
    const chain = await service.getApprovalChain(DOC_TYPE, 1_000_000, BRANCH_ID);
    expect(chain.approvers).toHaveLength(0);
  });

  // ── Validation ────────────────────────────────────────────────────────────

  it('throws ZodError for negative amount', async () => {
    await expect(service.getApprovalChain(DOC_TYPE, -1, BRANCH_ID)).rejects.toThrow();
  });

  it('throws ZodError for invalid branchId', async () => {
    await expect(service.getApprovalChain(DOC_TYPE, 1_000_000, 'not-a-uuid')).rejects.toThrow();
  });

  // ── Property-based test ───────────────────────────────────────────────────
  // Validates: Requirements 7.1
  // For any amount >= 0, getApprovalChain always returns a valid level (1|2|3)
  // and the amount falls within the returned threshold range.

  it('PBT: for any amount >= 0, level is 1|2|3 and amount is within threshold range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 1_000_000_000, noNaN: true }),
        async (amount) => {
          const chain = await service.getApprovalChain(DOC_TYPE, amount, BRANCH_ID);

          // Level must be 1, 2, or 3
          expect([1, 2, 3]).toContain(chain.level);

          // Amount must be >= thresholdMin
          expect(amount).toBeGreaterThanOrEqual(chain.thresholdMin);

          // Amount must be < thresholdMax (or thresholdMax is null for level 3)
          if (chain.thresholdMax !== null) {
            expect(amount).toBeLessThanOrEqual(chain.thresholdMax);
          } else {
            expect(chain.level).toBe(3);
          }

          // Role must match level
          const expectedRole = {
            1: APPROVAL_ROLES.LEVEL_1,
            2: APPROVAL_ROLES.LEVEL_2,
            3: APPROVAL_ROLES.LEVEL_3,
          }[chain.level];
          expect(chain.requiredRole).toBe(expectedRole);
        },
      ),
      { numRuns: 500 },
    );
  });
});
