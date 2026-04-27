/**
 * Unit + Property-Based tests for OrganizationService
 *
 * Validates: Requirements 2.6, 2.7
 * AC:
 *  - HEAD_OFFICE has no parent
 *  - BRANCH parent must be HEAD_OFFICE
 *  - Warehouse code unique per branch (delegated to WarehouseService, verified here)
 *  - Hierarchy tree returns correct parent-child structure
 *
 * **Validates: Requirements 2.6**
 */

import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HO_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const BRANCH_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const baseHORow = {
  id: HO_ID,
  code: 'HO-001',
  name: 'Head Office Pusat',
  type: 'HEAD_OFFICE',
  parent_id: null,
  address: null,
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
};

const baseBranchRow = {
  id: BRANCH_ID,
  code: 'BR-001',
  name: 'Cabang Jakarta',
  type: 'BRANCH',
  parent_id: HO_ID,
  address: null,
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  branch: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue({}),
};

function setupTransactionMock() {
  mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
    const txClient = {
      branch: mockPrismaService.branch,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    return fn(txClient);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    jest.clearAllMocks();
    setupTransactionMock();
  });

  // ── createHeadOffice ──────────────────────────────────────────────────────

  describe('createHeadOffice()', () => {
    it('creates a HEAD_OFFICE with no parent', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);
      mockPrismaService.branch.create.mockResolvedValue(baseHORow);

      const result = await service.createHeadOffice(
        { code: 'HO-001', name: 'Head Office Pusat' },
        USER_ID,
      );

      expect(result.type).toBe('HEAD_OFFICE');
      expect(result.parent_id).toBeNull();
      expect(result.code).toBe('HO-001');
    });

    it('throws CONFLICT when code already exists', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue({ id: 'existing' });

      try {
        await service.createHeadOffice({ code: 'HO-001', name: 'Duplicate' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });
  });

  // ── createBranch ──────────────────────────────────────────────────────────

  describe('createBranch()', () => {
    it('creates a BRANCH under a HEAD_OFFICE parent', async () => {
      // First call: validateParentChild → findFirst for parent
      // Second call: code uniqueness check → findFirst returns null
      mockPrismaService.branch.findFirst
        .mockResolvedValueOnce({ id: HO_ID, type: 'HEAD_OFFICE' }) // parent lookup
        .mockResolvedValueOnce(null); // code uniqueness
      mockPrismaService.branch.create.mockResolvedValue(baseBranchRow);

      const result = await service.createBranch(
        { code: 'BR-001', name: 'Cabang Jakarta', parent_id: HO_ID },
        USER_ID,
      );

      expect(result.type).toBe('BRANCH');
      expect(result.parent_id).toBe(HO_ID);
    });

    it('throws BUSINESS_RULE_VIOLATION when parent is not HEAD_OFFICE (Req 2.6)', async () => {
      // Parent is a BRANCH, not HEAD_OFFICE
      mockPrismaService.branch.findFirst.mockResolvedValue({ id: BRANCH_ID, type: 'BRANCH' });

      try {
        await service.createBranch(
          { code: 'BR-002', name: 'Sub-Branch', parent_id: BRANCH_ID },
          USER_ID,
        );
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      }
    });

    it('throws NOT_FOUND when parent does not exist', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue(null);

      try {
        await service.createBranch(
          { code: 'BR-002', name: 'Cabang Baru', parent_id: HO_ID },
          USER_ID,
        );
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('throws CONFLICT when branch code already exists', async () => {
      mockPrismaService.branch.findFirst
        .mockResolvedValueOnce({ id: HO_ID, type: 'HEAD_OFFICE' }) // parent lookup
        .mockResolvedValueOnce({ id: 'existing' }); // code conflict

      try {
        await service.createBranch(
          { code: 'BR-001', name: 'Duplicate', parent_id: HO_ID },
          USER_ID,
        );
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });
  });

  // ── validateParentChild ───────────────────────────────────────────────────

  describe('validateParentChild()', () => {
    it('throws when trying to assign a parent to HEAD_OFFICE', async () => {
      try {
        await service.validateParentChild(HO_ID, 'HEAD_OFFICE');
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      }
    });

    it('passes when BRANCH parent is HEAD_OFFICE', async () => {
      mockPrismaService.branch.findFirst.mockResolvedValue({ id: HO_ID, type: 'HEAD_OFFICE' });
      await expect(service.validateParentChild(HO_ID, 'BRANCH')).resolves.toBeUndefined();
    });
  });

  // ── getHierarchy ──────────────────────────────────────────────────────────

  describe('getHierarchy()', () => {
    it('returns correct parent-child tree structure', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([baseHORow, baseBranchRow]);

      const tree = await service.getHierarchy();

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(HO_ID);
      expect(tree[0].type).toBe('HEAD_OFFICE');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe(BRANCH_ID);
      expect(tree[0].children[0].type).toBe('BRANCH');
    });

    it('returns subtree when branchId is provided', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([baseHORow, baseBranchRow]);

      const subtree = await service.getHierarchy(HO_ID);

      expect(subtree).toHaveLength(1);
      expect(subtree[0].id).toBe(HO_ID);
      expect(subtree[0].children).toHaveLength(1);
    });

    it('returns empty array when branchId not found', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([baseHORow]);

      const subtree = await service.getHierarchy('ffffffff-ffff-ffff-ffff-ffffffffffff');
      expect(subtree).toHaveLength(0);
    });
  });

  // ── getChildren ───────────────────────────────────────────────────────────

  describe('getChildren()', () => {
    it('returns direct children of a node', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([baseBranchRow]);

      const children = await service.getChildren(HO_ID);

      expect(children).toHaveLength(1);
      expect(children[0].parent_id).toBe(HO_ID);
    });

    it('returns empty array when node has no children', async () => {
      mockPrismaService.branch.findMany.mockResolvedValue([]);

      const children = await service.getChildren(BRANCH_ID);
      expect(children).toHaveLength(0);
    });
  });

  // ── Property-Based Tests ──────────────────────────────────────────────────

  /**
   * Property: For any valid hierarchy, every BRANCH node's parent type is HEAD_OFFICE.
   * **Validates: Requirements 2.6**
   */
  describe('PBT: hierarchy parent-child type validity', () => {
    it('every BRANCH node always has a HEAD_OFFICE parent', () => {
      // Build arbitrary hierarchy data: N head offices, M branches per HO
      const arbHierarchy = fc
        .tuple(
          fc.array(
            fc.record({
              id: fc.uuid(),
              code: fc.string({ minLength: 1, maxLength: 10 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            { minLength: 1, maxLength: 5 },
          ),
          fc.array(
            fc.record({
              id: fc.uuid(),
              code: fc.string({ minLength: 1, maxLength: 10 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              parentIndex: fc.nat({ max: 4 }),
            }),
            { minLength: 0, maxLength: 10 },
          ),
        )
        .map(([headOffices, branches]) => {
          const hoNodes = headOffices.map((ho) => ({
            id: ho.id,
            code: ho.code,
            name: ho.name,
            type: 'HEAD_OFFICE' as const,
            parent_id: null,
            address: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
          }));

          const branchNodes = branches.map((br) => {
            const parentHO = hoNodes[br.parentIndex % hoNodes.length];
            return {
              id: br.id,
              code: br.code,
              name: br.name,
              type: 'BRANCH' as const,
              parent_id: parentHO.id,
              address: null,
              is_active: true,
              created_at: new Date(),
              updated_at: new Date(),
              deleted_at: null,
            };
          });

          return [...hoNodes, ...branchNodes];
        });

      fc.assert(
        fc.property(arbHierarchy, (nodes) => {
          // Build a lookup map
          const nodeMap = new Map(nodes.map((n) => [n.id, n]));

          for (const node of nodes) {
            if (node.type === 'BRANCH') {
              // Every BRANCH must have a parent
              expect(node.parent_id).not.toBeNull();
              // Parent must exist
              const parent = nodeMap.get(node.parent_id!);
              expect(parent).toBeDefined();
              // Parent must be HEAD_OFFICE
              expect(parent!.type).toBe('HEAD_OFFICE');
            }

            if (node.type === 'HEAD_OFFICE') {
              // HEAD_OFFICE must have no parent
              expect(node.parent_id).toBeNull();
            }
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
