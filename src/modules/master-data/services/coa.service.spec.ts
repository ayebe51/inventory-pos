/**
 * Unit tests for CoaService
 *
 * Validates: Requirements 2.8, 2.9, 8.5, 8.6, 8.15
 * BR-ACC-005: COA dengan journal history tidak bisa dihapus (soft delete only)
 * BR-ACC-006: Akun header (is_header=true) tidak bisa dipakai di journal line
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CoaService } from './coa.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { validateAccountCodeFormat, getAccountCodeLevel } from '../dto/coa.dto';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COA_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PARENT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const baseCoaRow = {
  id: COA_ID,
  account_code: '1.001.001',
  account_name: 'Kas Kecil',
  account_type: 'ASSET',
  account_category: null,
  parent_id: PARENT_ID,
  level: 3,
  is_header: false,
  normal_balance: 'DEBIT',
  is_active: true,
  is_system: false,
  branch_id: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  deleted_at: null,
};

const headerCoaRow = {
  ...baseCoaRow,
  id: PARENT_ID,
  account_code: '1.001',
  account_name: 'Kas dan Setara Kas',
  level: 2,
  is_header: true,
  parent_id: null,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrismaService = {
  chartOfAccount: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  journalEntryLine: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue({}),
};

function setupTransactionMock() {
  mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => {
    const txClient = {
      chartOfAccount: mockPrismaService.chartOfAccount,
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-id' }) },
    };
    return fn(txClient);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('CoaService', () => {
  let service: CoaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoaService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<CoaService>(CoaService);
    jest.clearAllMocks();
    setupTransactionMock();
  });

  // ── account_code format validation (pure function) ────────────────────────

  describe('validateAccountCodeFormat()', () => {
    it.each([
      ['1', true],
      ['1.001', true],
      ['1.001.001', true],
      ['1.001.001.001', true],
      ['1.001.001.001.001', true],
    ])('accepts valid code "%s"', (code, expected) => {
      expect(validateAccountCodeFormat(code)).toBe(expected);
    });

    it.each([
      ['1001', false],          // no dots
      ['1.1.1', false],         // segments not 3 digits
      ['1.001.001.001.001.001', false], // 6 levels
      ['A.001.001', false],     // non-digit first segment
      ['1.001.001.', false],    // trailing dot
      ['', false],              // empty
      ['1.0011', false],        // 4-digit segment
    ])('rejects invalid code "%s"', (code, expected) => {
      expect(validateAccountCodeFormat(code)).toBe(expected);
    });
  });

  describe('getAccountCodeLevel()', () => {
    it('returns 1 for root code "1"', () => expect(getAccountCodeLevel('1')).toBe(1));
    it('returns 2 for "1.001"', () => expect(getAccountCodeLevel('1.001')).toBe(2));
    it('returns 3 for "1.001.001"', () => expect(getAccountCodeLevel('1.001.001')).toBe(3));
    it('returns 4 for "1.001.001.001"', () => expect(getAccountCodeLevel('1.001.001.001')).toBe(4));
    it('returns 5 for "1.001.001.001.001"', () => expect(getAccountCodeLevel('1.001.001.001.001')).toBe(5));
    it('returns 0 for invalid code', () => expect(getAccountCodeLevel('invalid')).toBe(0));
  });

  // ── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {
    const validData = {
      account_code: '1.001.001',
      account_name: 'Kas Kecil',
      account_type: 'ASSET' as const,
      is_header: false,
      normal_balance: 'DEBIT' as const,
      is_active: true,
      parent_id: PARENT_ID,
    };

    it('creates a COA account successfully', async () => {
      mockPrismaService.chartOfAccount.findFirst
        .mockResolvedValueOnce(null)           // no duplicate code
        .mockResolvedValueOnce({ id: PARENT_ID, level: 2, is_header: true }); // parent found
      mockPrismaService.chartOfAccount.create.mockResolvedValue(baseCoaRow);

      const result = await service.create(validData, USER_ID);

      expect(result.id).toBe(COA_ID);
      expect(result.account_code).toBe('1.001.001');
      expect(result.level).toBe(3);
    });

    it('throws CONFLICT when account_code already exists', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValueOnce({ id: 'existing' });

      try {
        await service.create(validData, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.CONFLICT);
      }
    });

    it('throws VALIDATION_ERROR for invalid account_code format "1001"', async () => {
      await expect(
        service.create({ ...validData, account_code: '1001' }, USER_ID),
      ).rejects.toThrow();
    });

    it('throws VALIDATION_ERROR for invalid account_code format "1.1.1.1.1.1" (6 levels)', async () => {
      await expect(
        service.create({ ...validData, account_code: '1.001.001.001.001.001' }, USER_ID),
      ).rejects.toThrow();
    });

    it('throws VALIDATION_ERROR when level does not match parent.level + 1', async () => {
      mockPrismaService.chartOfAccount.findFirst
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({ id: PARENT_ID, level: 1, is_header: true }); // parent level 1

      // account_code "1.001.001" = level 3, but parent is level 1 → should be level 2
      try {
        await service.create(validData, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('throws VALIDATION_ERROR when parent is not a header account', async () => {
      mockPrismaService.chartOfAccount.findFirst
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({ id: PARENT_ID, level: 2, is_header: false }); // non-header parent

      try {
        await service.create(validData, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });

    it('throws NOT_FOUND when parent_id does not exist', async () => {
      mockPrismaService.chartOfAccount.findFirst
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce(null); // parent not found

      try {
        await service.create(validData, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });

    it('creates root account (level 1) without parent', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValueOnce(null); // no duplicate
      const rootRow = { ...baseCoaRow, account_code: '1', level: 1, parent_id: null };
      mockPrismaService.chartOfAccount.create.mockResolvedValue(rootRow);

      const result = await service.create(
        { ...validData, account_code: '1', parent_id: null },
        USER_ID,
      );
      expect(result.level).toBe(1);
      expect(result.parent_id).toBeNull();
    });

    it('throws VALIDATION_ERROR when root account code is not level 1', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValueOnce(null);

      try {
        await service.create({ ...validData, account_code: '1.001', parent_id: null }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
      }
    });
  });

  // ── validatePostable() — BR-ACC-006 ──────────────────────────────────────

  describe('validatePostable() — BR-ACC-006', () => {
    it('does not throw for a non-header account', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue({
        id: COA_ID,
        is_header: false,
        account_code: '1.001.001',
        account_name: 'Kas Kecil',
      });

      await expect(service.validatePostable(COA_ID)).resolves.toBeUndefined();
    });

    it('throws VALIDATION_ERROR (BR-ACC-006) for a header account', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue({
        id: PARENT_ID,
        is_header: true,
        account_code: '1.001',
        account_name: 'Kas dan Setara Kas',
      });

      try {
        await service.validatePostable(PARENT_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(response.error.message).toContain('BR-ACC-006');
      }
    });

    it('throws NOT_FOUND when account does not exist', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(null);

      try {
        await service.validatePostable(COA_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ── softDelete() — BR-ACC-005 ─────────────────────────────────────────────

  describe('softDelete() — BR-ACC-005', () => {
    it('soft-deletes a COA account without journal history', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(baseCoaRow);
      mockPrismaService.journalEntryLine.findFirst.mockResolvedValue(null); // no history
      mockPrismaService.chartOfAccount.update.mockResolvedValue({
        ...baseCoaRow,
        deleted_at: new Date(),
      });

      await expect(service.softDelete(COA_ID, USER_ID)).resolves.toBeUndefined();
      expect(mockPrismaService.chartOfAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: COA_ID },
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('still soft-deletes (not hard-deletes) when journal history exists (BR-ACC-005)', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(baseCoaRow);
      mockPrismaService.journalEntryLine.findFirst.mockResolvedValue({ id: 'je-line-1' }); // has history
      mockPrismaService.chartOfAccount.update.mockResolvedValue({
        ...baseCoaRow,
        deleted_at: new Date(),
      });

      // Should succeed with soft delete (not throw)
      await expect(service.softDelete(COA_ID, USER_ID)).resolves.toBeUndefined();
      // Verify it used update (soft delete), not delete (hard delete)
      expect(mockPrismaService.chartOfAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deleted_at: expect.any(Date) }),
        }),
      );
    });

    it('throws BUSINESS_RULE_VIOLATION when account is_system=true', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue({
        ...baseCoaRow,
        is_system: true,
      });

      try {
        await service.softDelete(COA_ID, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      }
    });

    it('throws NOT_FOUND when account does not exist', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(null);

      try {
        await service.softDelete(COA_ID, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ── hierarchy level validation ────────────────────────────────────────────

  describe('hierarchy level validation (max 5 levels)', () => {
    it('accepts level 5 account code', async () => {
      const level5Code = '1.001.001.001.001';
      const level4ParentId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

      mockPrismaService.chartOfAccount.findFirst
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({ id: level4ParentId, level: 4, is_header: true }); // parent level 4

      const level5Row = { ...baseCoaRow, account_code: level5Code, level: 5, parent_id: level4ParentId };
      mockPrismaService.chartOfAccount.create.mockResolvedValue(level5Row);

      const result = await service.create(
        {
          account_code: level5Code,
          account_name: 'Akun Level 5',
          account_type: 'ASSET' as const,
          is_header: false,
          normal_balance: 'DEBIT' as const,
          is_active: true,
          parent_id: level4ParentId,
        },
        USER_ID,
      );
      expect(result.level).toBe(5);
    });

    it('rejects account code with 6 levels via Zod validation', async () => {
      await expect(
        service.create(
          {
            account_code: '1.001.001.001.001.001',
            account_name: 'Akun Level 6',
            account_type: 'ASSET' as const,
            is_header: false,
            normal_balance: 'DEBIT' as const,
            is_active: true,
          },
          USER_ID,
        ),
      ).rejects.toThrow();
    });
  });

  // ── findById() ────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns COA with children', async () => {
      const coaWithChildren = {
        ...baseCoaRow,
        children: [{ ...baseCoaRow, id: 'child-id', account_code: '1.001.001', level: 3 }],
      };
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(coaWithChildren);

      const result = await service.findById(COA_ID);
      expect(result.id).toBe(COA_ID);
      expect(result.children).toHaveLength(1);
    });

    it('throws NOT_FOUND when account does not exist', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(null);

      try {
        await service.findById(COA_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates account name successfully', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(baseCoaRow);
      const updatedRow = { ...baseCoaRow, account_name: 'Nama Baru' };
      mockPrismaService.chartOfAccount.update.mockResolvedValue(updatedRow);

      const result = await service.update(COA_ID, { account_name: 'Nama Baru' }, USER_ID);
      expect(result.account_name).toBe('Nama Baru');
    });

    it('throws BUSINESS_RULE_VIOLATION when changing account_type with journal history', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(baseCoaRow);
      mockPrismaService.journalEntryLine.findFirst.mockResolvedValue({ id: 'je-line-1' });

      try {
        await service.update(COA_ID, { account_type: 'LIABILITY' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.BUSINESS_RULE_VIOLATION);
      }
    });

    it('throws NOT_FOUND when account does not exist', async () => {
      mockPrismaService.chartOfAccount.findFirst.mockResolvedValue(null);

      try {
        await service.update(COA_ID, { account_name: 'X' }, USER_ID);
        fail('should have thrown');
      } catch (err) {
        const response = (err as BusinessRuleException).getResponse() as any;
        expect(response.error.code).toBe(ErrorCode.NOT_FOUND);
      }
    });
  });

  // ── getTree() ─────────────────────────────────────────────────────────────

  describe('getTree()', () => {
    it('returns hierarchical tree structure', async () => {
      const rows = [
        { ...headerCoaRow, parent_id: null },
        { ...baseCoaRow, parent_id: PARENT_ID },
      ];
      mockPrismaService.chartOfAccount.findMany.mockResolvedValue(rows);

      const tree = await service.getTree();
      expect(tree).toHaveLength(1); // one root
      expect(tree[0].children).toHaveLength(1); // one child
    });

    it('returns empty array when no accounts', async () => {
      mockPrismaService.chartOfAccount.findMany.mockResolvedValue([]);
      const tree = await service.getTree();
      expect(tree).toHaveLength(0);
    });
  });
});
